import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Relative asset paths so the production build runs under any
  // subpath (the benchmark harness serves it nested, not at root).
  base: './',
})
