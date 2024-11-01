import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      "Content-Security-Policy": `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src 'self' *.youtube.com`,
    },
    port: 3000,
    proxy: {
      "/socket.io/": {
        target: "http://localhost:4000",
        ws: true,
      },
    },
  },
});
