import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        institucional: {
          50: "#eef5ff",
          100: "#d9e8ff",
          500: "#2f6fd6",
          600: "#1f57b3",
          700: "#1a4690",
          900: "#14284d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
