/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // aqui definimos a sua cor V4
        'v4-red': '#ED1C24',
      }
    }
  },
  plugins: [],
  // opcional: força incluir estas classes mesmo se não detectadas estaticamente
  safelist: [
    'bg-v4-red',
    'text-v4-red',
    'hover:text-v4-red',
    'focus:ring-v4-red',
    'border-v4-red',
    'hover:bg-red-50'
  ],
}
