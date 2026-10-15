import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// VITE_BASE is set in CI to "/<repo-name>/" for GitHub Pages; local dev serves from "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/setupTests.ts', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
    },
  },
})
