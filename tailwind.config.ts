import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        marca: {
          50: "#eef4fb",
          100: "#d6e4f5",
          600: "#1f5fa9",
          700: "#184a85",
          800: "#123863",
        },
      },
    },
  },
  plugins: [],
};

export default config;
