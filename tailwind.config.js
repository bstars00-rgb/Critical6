/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff', 100: '#dbe6ff', 300: '#9db8ff', 500: '#3b6fff',
          600: '#2b59e0', 700: '#1f44b8', 800: '#1a3a9e', 900: '#152e7a',
        },
      },
    },
  },
  plugins: [],
};
