// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import fs from "fs";
import path from "path";
var __vite_injected_original_dirname = "/home/project";
var buildTarget = process.env.BUILD_TARGET;
var isNativeBuild = buildTarget === "electron" || buildTarget === "capacitor";
function copyDirSafe(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    try {
      const stat = fs.statSync(srcFile);
      if (stat.isDirectory()) {
        copyDirSafe(srcFile, destFile);
      } else {
        fs.copyFileSync(srcFile, destFile);
      }
    } catch {
    }
  }
}
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "safe-copy-public",
      apply: "build",
      closeBundle() {
        copyDirSafe(path.resolve(__vite_injected_original_dirname, "public"), path.resolve(__vite_injected_original_dirname, "dist"));
      }
    }
  ],
  base: isNativeBuild ? "./" : "/",
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: buildTarget === "electron",
    copyPublicDir: false
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IGJ1aWxkVGFyZ2V0ID0gcHJvY2Vzcy5lbnYuQlVJTERfVEFSR0VUO1xuY29uc3QgaXNOYXRpdmVCdWlsZCA9IGJ1aWxkVGFyZ2V0ID09PSAnZWxlY3Ryb24nIHx8IGJ1aWxkVGFyZ2V0ID09PSAnY2FwYWNpdG9yJztcblxuZnVuY3Rpb24gY29weURpclNhZmUoc3JjOiBzdHJpbmcsIGRlc3Q6IHN0cmluZykge1xuICBmcy5ta2RpclN5bmMoZGVzdCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIGZvciAoY29uc3QgZmlsZSBvZiBmcy5yZWFkZGlyU3luYyhzcmMpKSB7XG4gICAgY29uc3Qgc3JjRmlsZSA9IHBhdGguam9pbihzcmMsIGZpbGUpO1xuICAgIGNvbnN0IGRlc3RGaWxlID0gcGF0aC5qb2luKGRlc3QsIGZpbGUpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoc3JjRmlsZSk7XG4gICAgICBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIGNvcHlEaXJTYWZlKHNyY0ZpbGUsIGRlc3RGaWxlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZzLmNvcHlGaWxlU3luYyhzcmNGaWxlLCBkZXN0RmlsZSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBza2lwIGZpbGVzIHRoYXQgY2FuJ3QgYmUgY29waWVkIGluIHNhbmRib3hcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAge1xuICAgICAgbmFtZTogJ3NhZmUtY29weS1wdWJsaWMnLFxuICAgICAgYXBwbHk6ICdidWlsZCcsXG4gICAgICBjbG9zZUJ1bmRsZSgpIHtcbiAgICAgICAgY29weURpclNhZmUocGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3B1YmxpYycpLCBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnZGlzdCcpKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgXSxcbiAgYmFzZTogaXNOYXRpdmVCdWlsZCA/ICcuLycgOiAnLycsXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcbiAgICBzb3VyY2VtYXA6IGJ1aWxkVGFyZ2V0ID09PSAnZWxlY3Ryb24nLFxuICAgIGNvcHlQdWJsaWNEaXI6IGZhbHNlLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTSxjQUFjLFFBQVEsSUFBSTtBQUNoQyxJQUFNLGdCQUFnQixnQkFBZ0IsY0FBYyxnQkFBZ0I7QUFFcEUsU0FBUyxZQUFZLEtBQWEsTUFBYztBQUM5QyxLQUFHLFVBQVUsTUFBTSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQ3RDLGFBQVcsUUFBUSxHQUFHLFlBQVksR0FBRyxHQUFHO0FBQ3RDLFVBQU0sVUFBVSxLQUFLLEtBQUssS0FBSyxJQUFJO0FBQ25DLFVBQU0sV0FBVyxLQUFLLEtBQUssTUFBTSxJQUFJO0FBQ3JDLFFBQUk7QUFDRixZQUFNLE9BQU8sR0FBRyxTQUFTLE9BQU87QUFDaEMsVUFBSSxLQUFLLFlBQVksR0FBRztBQUN0QixvQkFBWSxTQUFTLFFBQVE7QUFBQSxNQUMvQixPQUFPO0FBQ0wsV0FBRyxhQUFhLFNBQVMsUUFBUTtBQUFBLE1BQ25DO0FBQUEsSUFDRixRQUFRO0FBQUEsSUFFUjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxjQUFjO0FBQ1osb0JBQVksS0FBSyxRQUFRLGtDQUFXLFFBQVEsR0FBRyxLQUFLLFFBQVEsa0NBQVcsTUFBTSxDQUFDO0FBQUEsTUFDaEY7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTSxnQkFBZ0IsT0FBTztBQUFBLEVBQzdCLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsRUFDMUI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFdBQVcsZ0JBQWdCO0FBQUEsSUFDM0IsZUFBZTtBQUFBLEVBQ2pCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
