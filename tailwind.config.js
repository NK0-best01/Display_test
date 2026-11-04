/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      screens: {
        'xga': '1024px',
      },
      minWidth: {
        'touch': '64px',
      },
      minHeight: {
        'touch': '64px',
      },
    },
  },
  plugins: [],
};
