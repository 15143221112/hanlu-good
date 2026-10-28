import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { port: 33100, strictPort: true },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: '考后复盘本',
        short_name: '复盘本',
        description: '高中考后复盘系统：成绩轨迹、错题、趋势与提分行动项',
        lang: 'zh-CN',
        theme_color: '#dc2626',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: './',
        scope: './'
      },
      workbox: {
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,wasm,mjs,png,svg}']
      }
    })
  ]
})
