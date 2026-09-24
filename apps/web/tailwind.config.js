/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaf3",
          100: "#d7f2e0",
          200: "#b0e4c3",
          300: "#7ecfa0",
          400: "#4bb27c",
          500: "#279560",
          600: "#18794c",
          700: "#146140",
          800: "#134d35",
          900: "#11402d",
          950: "#062418",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 45, 30, 0.04), 0 8px 24px -12px rgba(15, 45, 30, 0.12)",
        softer: "0 1px 2px rgba(15, 45, 30, 0.03)",
        pop: "0 12px 32px -8px rgba(15, 45, 30, 0.22)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
