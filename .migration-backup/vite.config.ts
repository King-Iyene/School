import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const buildTarget = process.env.BUILD_TARGET;
const isNativeBuild = buildTarget === 'electron' || buildTarget === 'capacitor';

function copyDirSafe(src: string, dest: string) {
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
      // skip files that can't be copied in sandbox
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'safe-copy-public',
      apply: 'build',
      closeBundle() {
        copyDirSafe(path.resolve(__dirname, 'public'), path.resolve(__dirname, 'dist'));
      },
    },
  ],
  base: isNativeBuild ? './' : '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: buildTarget === 'electron',
    copyPublicDir: false,
  },
});
