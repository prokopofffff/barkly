/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Barkly brand palette — tweak freely.
        brand: {
          DEFAULT: '#58CC02', // Duolingo-ish green
          dark: '#46A302',
        },
        ink: '#0E0F13',
      },
    },
  },
  plugins: [],
};
