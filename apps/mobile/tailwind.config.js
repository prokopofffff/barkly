/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ГАВ — dark-mode, neon-lime brand, gold/green rewards.
        // Mirrors the design system in docs (see styles.css :root).
        bg: '#08080c',
        ink: '#050507', // deepest backdrop (stage / status areas)
        surface: {
          DEFAULT: '#14141d',
          2: '#1c1c29',
        },
        elevated: '#262638',
        content: {
          DEFAULT: '#f6f6fb', // primary text
          dim: 'rgba(246,246,251,0.62)',
          faint: 'rgba(246,246,251,0.34)',
        },
        // brand + rewards
        lime: {
          DEFAULT: '#b6f23d',
          dark: '#8fd010',
        },
        gold: '#ffd83d',
        green: '#54e08a',
        rose: '#ff6b81',
        flame: '#ff8a3d',
        // secondary accents
        violet: '#c084fc',
        cyan: '#34e3ff',
        pink: '#ff6fcf',
        // legacy Duolingo-ish brand green (kept for back-compat)
        brand: {
          DEFAULT: '#58CC02',
          dark: '#46A302',
        },
      },
      fontFamily: {
        // Nunito is the brand face; weights are separate families on native.
        sans: ['Nunito_700Bold'],
        nunito: ['Nunito_400Regular'],
        'nunito-semibold': ['Nunito_600SemiBold'],
        'nunito-bold': ['Nunito_700Bold'],
        'nunito-x': ['Nunito_800ExtraBold'],
        'nunito-black': ['Nunito_900Black'],
        mono: ['SpaceMono_400Regular'],
      },
      borderRadius: {
        xs: '10px',
        sm: '14px',
        DEFAULT: '20px',
        lg: '28px',
        xl: '36px',
      },
    },
  },
  plugins: [],
};
