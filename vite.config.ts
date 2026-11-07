import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id) => (/node_modules\/(three|@react-three)/.test(id) ? 'three' : undefined),
      },
    },
  },
})
