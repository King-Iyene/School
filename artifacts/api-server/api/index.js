// Plain JS re-export of our esbuild-bundled Express app (dist/app.mjs, built
// by build.mjs during the Vercel build step). Kept as .js so Vercel's Node.js
// function builder never runs its own TypeScript compile pass on this file —
// that pass has its own module resolution and can't see our workspace
// packages (@workspace/api-zod, @workspace/db), which are source-only and
// resolved via package.json "exports"/"main" fields, not a prebuilt dist.
//
// This imports dist/app.mjs (the Express app itself), not dist/index.mjs —
// the latter calls app.listen(port) and requires a PORT env var, which is
// for a traditional persistent-server host, not a Vercel serverless function.
export { default } from "../dist/app.mjs";
