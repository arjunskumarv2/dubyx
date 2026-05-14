/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f5',
          100: '#fce7ed',
          200: '#fbd0de',
          300: '#f8a9c2',
          400: '#f3749b',
          500: '#e94878',
          600: '#d52a5d',
          700: '#b31d4b',
          800: '#8D1B3D',
          900: '#7a1836',
          950: '#45071b',
        },
        gold: {
          50: '#fdf9ec',
          100: '#faf1cc',
          200: '#f4e19b',
          300: '#eccc60',
          400: '#e4b535',
          500: '#C9A84C',
          600: '#b5891e',
          700: '#926819',
          800: '#79521b',
          900: '#67441c',
        },
        maroon: '#8D1B3D',
        qatar: {
          maroon: '#8D1B3D',
          white: '#FFFFFF',
          gold: '#C9A84C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
