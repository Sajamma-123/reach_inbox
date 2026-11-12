/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        surface: {
          base: '#090d16',
          panel: '#0f1422',
          card: '#141a2b',
          border: '#1e293b',
          hover: '#1a2236',
        }
      }
    },
  },
  plugins: [],
}
