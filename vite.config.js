import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib.ts'),
      fileName: 'vega-gl',
      formats: ['esm', 'cjs']
    },
    demo: {
      entry: resolve(__dirname, "./src/demo.ts"),
    },
  }
})