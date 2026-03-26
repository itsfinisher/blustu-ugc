/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        blu: {
          DEFAULT: "#2F95E8",
          hover: "#1E7DD4",
          soft: "#EFF7FF",
          "soft-border": "#BFDBFE",
          50: "#F0F7FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#2F95E8",
          600: "#1E7DD4",
          700: "#1D6CB8",
          800: "#1E5A96",
          900: "#1E4A76",
        },
      },
      fontFamily: {
        display: ["Outfit", "system-ui", "sans-serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
      },
    },
  },
  plugins: [],
};
