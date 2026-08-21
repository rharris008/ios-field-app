/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ios: {
          navy:   '#1A2B4A',
          navydark: '#111D33',
          navylight: '#243559',
          white:  '#FFFFFF',
          ltgrey: '#F5F5F5',
          mdgrey: '#CCCCCC',
          dktext: '#333333',
          green:  '#27AE60',
          amber:  '#E67E22',
          red:    '#C0392B',
          blue:   '#2E86C1',
        },
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
