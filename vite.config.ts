import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Accept the mobile project's existing public Supabase variable names locally.
  // Production should continue to use the documented VITE_* names.
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
