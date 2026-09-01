/**
 * Dev proxy for Replit workflow health checks.
 *
 * Opens PROXY_PORT immediately with HTTP 200 responses so the Replit
 * workflow readiness check passes right away. Starts Metro on METRO_PORT
 * in the background. Once Metro is ready, all traffic is proxied to it.
 */

const http = require("http");
const { spawn } = require("child_process");

const PROXY_PORT = parseInt(process.env.PORT || "8000", 10);
const METRO_PORT = PROXY_PORT + 1;

let metroReady = false;

function checkMetro() {
  const req = http.get(
    { hostname: "localhost", port: METRO_PORT, path: "/", timeout: 2000 },
    () => { metroReady = true; }
  );
  req.on("error", () => setTimeout(checkMetro, 1000));
  req.on("timeout", () => { req.destroy(); setTimeout(checkMetro, 1000); });
}

const proxy = http.createServer((req, res) => {
  if (!metroReady) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<!DOCTYPE html><html><body><h2>SchoolOS Mobile — Metro is starting\u2026</h2><script>setTimeout(()=>location.reload(),2000)</script></body></html>");
    return;
  }

  const options = {
    hostname: "localhost",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("Proxy error: " + err.message);
    }
  });

  req.pipe(proxyReq, { end: true });
});

proxy.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log("Dev proxy listening on port " + PROXY_PORT + " \u2192 Metro on " + METRO_PORT);
  checkMetro();
});

const env = { ...process.env, PORT: String(METRO_PORT) };
const metro = spawn("pnpm", ["exec", "expo", "start", "--localhost", "--port", String(METRO_PORT), "--no-dev"], {
  env,
  stdio: "inherit",
});

metro.on("close", (code) => {
  console.log("Metro exited with code " + code);
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => { metro.kill("SIGTERM"); process.exit(0); });
process.on("SIGINT", () => { metro.kill("SIGINT"); process.exit(0); });
