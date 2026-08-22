/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // GitHub Pages 하위 경로(/pension-compass/)와 로컬 모두 동작
  plugins: [react()],
  test: { environment: 'node' },
})
