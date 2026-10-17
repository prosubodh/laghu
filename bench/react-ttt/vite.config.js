import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the production build runs under any
  // subpath (the benchmark harness serves it nested, not at root).
  base: "./",
});
