/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff', 100: '#dbe6ff', 500: '#3b6fff',
          600: '#2b59e0', 700: '#1f44b8',
        },
      },
    },
  },
  plugins: [],
};
