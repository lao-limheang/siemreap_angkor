/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Battambang', 'sans-serif'],
        display: ['Playfair Display', 'Battambang', 'Georgia', 'serif'],
        khmer: ['Battambang', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#fdf5ec',
          100: '#fbe6cd',
          200: '#f5c99a',
          300: '#eda467',
          400: '#e08040',
          500: '#c0622b',
          600: '#a04e22',
          700: '#7e3b1a',
          800: '#5f2c14',
          900: '#421e0e',
        },
        warm: {
          50:  '#fdfaf5',
          100: '#faf4ea',
          200: '#f3e6d0',
          300: '#e8d2b0',
          400: '#d4b48a',
          500: '#b89060',
        },
        stone: {
          50:  '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
      },
      boxShadow: {
        'card': '0 4px 24px -4px rgba(0,0,0,0.10)',
        'card-hover': '0 12px 40px -8px rgba(0,0,0,0.18)',
        'nav': '0 1px 0 rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
