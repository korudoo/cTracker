/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#dbeeff',
          200: '#bddfff',
          300: '#8bc8ff',
          400: '#52a8ff',
          500: '#2f86f6',
          600: '#1f6de3',
          700: '#1d59ca',
          800: '#1f49a3',
          900: '#1e3f80'
        },
      },
      boxShadow: {
        card: '0 6px 24px rgba(16, 24, 40, 0.08)',
      },
    },
  },
  plugins: [],
};
