import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const base = process.env.VITE_BASE_PATH || '/'
if (!base.startsWith('/') || !base.endsWith('/') || base.includes('..')) {
  throw new Error('VITE_BASE_PATH は / または /リポジトリ名/ を指定してください')
}
export default defineConfig({ plugins: [react(), tailwindcss()], base })
