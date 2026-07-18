import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Builds into Django's static/frontend, generating a manifest that the
// `vite_asset` template tag reads to serve hashed assets from one Docker image.
//
// Base path is conditional:
//   • dev  → "/"                  so the app + client-side routes (e.g. /dashboard)
//                                 are served from the dev-server root with HMR.
//   • build → "/static/frontend/" so hashed assets resolve under Django/WhiteNoise.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/static/frontend/" : "/",
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    origin: "http://127.0.0.1:5173",
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/media": "http://127.0.0.1:8000",
      "/admin": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
  build: {
    manifest: true,
    outDir: resolve(__dirname, "../static/frontend"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/main.jsx"),
    },
  },
}));
