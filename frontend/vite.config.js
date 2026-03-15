import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        landing: resolve(__dirname, "landing.html"),
      },
    },
  },
});
