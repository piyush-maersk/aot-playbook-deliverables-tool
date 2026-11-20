import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The SPA calls /api/*; in local dev Vite proxies it to the FastAPI backend on :8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: { environment: "node" },
});
