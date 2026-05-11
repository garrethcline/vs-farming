/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Display: Fraunces is a variable serif with personality (almanac feel)
        display: ['"Fraunces"', 'Georgia', 'serif'],
        // Body: Manrope is a humanist sans, geometric but warm
        sans: ['"Manrope"', '"Helvetica Neue"', 'sans-serif'],
        // Mono: JetBrains Mono for numbers / code
        mono: ['"JetBrains Mono"', '"SF Mono"', 'monospace'],
        // Accent: a serif italic for ornamental headers
        editorial: ['"Fraunces"', 'serif'],
      },
      colors: {
        // Forest greens (canonical from the spreadsheet)
        forest: {
          950: '#0F2A1F',
          900: '#1B4332',
          800: '#2D6A4F',
          700: '#40916C',
          600: '#52796F',
          500: '#74A57F',
          400: '#94B5A0',
          300: '#B7C9BD',
          200: '#D5E1D8',
          100: '#E9EFE9',
          50: '#F1F5F1',
        },
        // Parchment / paper / cream
        parchment: {
          900: '#3A332A',
          800: '#5C5040',
          700: '#7A6E5C',
          600: '#A89B82',
          500: '#C7BAA0',
          400: '#DDD0B6',
          300: '#EDE2C7',
          200: '#F5EDD8',
          100: '#FAF5E8',
          50: '#FDFAF1',
        },
        // Terracotta (sparingly, for accents)
        terra: {
          900: '#5C2418',
          800: '#7A2E1F',
          700: '#A03A28',
          600: '#BC4749',
          500: '#D86060',
          400: '#E48580',
          300: '#EDA8A0',
        },
        // Gold/amber (for accents, calls-to-action)
        amber: {
          900: '#5C3A1A',
          800: '#7A4F22',
          700: '#A0682E',
          600: '#C2873A',
          500: '#DDA15E',
          400: '#E5B580',
          300: '#EDCAA0',
        },
        // Ink (text)
        ink: {
          900: '#1A1816',
          800: '#2C2A29',
          700: '#3F3D3B',
          600: '#5C5854',
          500: '#7A7570',
          400: '#9C968F',
          300: '#BDB7B0',
        },
        // Nutrient axis colors
        nitrogen: '#0F5132',  // green
        phosphorus: '#7F77DD', // purple
        potassium: '#DDA15E',  // gold
      },
      boxShadow: {
        'paper': '0 1px 2px rgba(60, 50, 35, 0.05), 0 4px 12px rgba(60, 50, 35, 0.04)',
        'paper-lg': '0 2px 4px rgba(60, 50, 35, 0.06), 0 12px 32px rgba(60, 50, 35, 0.06)',
        'inset-soft': 'inset 0 1px 2px rgba(60, 50, 35, 0.06)',
      },
      backgroundImage: {
        // Subtle paper-grain texture via CSS
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.4 0 0 0 0 0.36 0 0 0 0 0.28 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
