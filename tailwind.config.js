/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 现代清新语义色：玫红=错/红灯 翠绿=对/掌握 琥珀橙=待办 亮青=信息
        danger: '#f43f5e',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#06b6d4',
        muted: '#94a3b8',
        card: '#ffffff',
        bg: '#eef1f8'
      }
    }
  },
  plugins: []
}
