import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5174 },
  build: {
    rollupOptions: {
      output: {
        // Firebase is only reachable from the lazy-loaded admin routes, so
        // keeping it in its own chunk means a visitor to `/` never downloads it.
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
          ],
        },
      },
    },
  },
});
