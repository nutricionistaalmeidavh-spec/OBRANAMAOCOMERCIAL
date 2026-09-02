/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#121b2a',
        canvas: '#f3f5f8',
        primary: '#2f67d8',
        positive: '#159a76',
        negative: '#e04444',
        warning: '#d89317'
      },
      boxShadow: { panel: '0 1px 2px rgba(15, 23, 42, .04), 0 8px 26px rgba(15, 23, 42, .04)' }
    }
  },
  plugins: []
}
