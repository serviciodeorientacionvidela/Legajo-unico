import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Petróleo + turquesa. Contraste verificado: texto blanco sobre 600 = 5:1; texto 700 sobre blanco = 6,9:1.
        // 400/500 son de acento (anillos de foco, detalles): no llevan texto encima.
        institucional: {
          50: "#effafa",
          100: "#d3f2f3",
          200: "#a7e4e7",
          300: "#6dd0d5",
          400: "#2fbac2",
          500: "#14a3ab",
          600: "#0b7b83",
          700: "#0d646b",
          800: "#124f56",
          900: "#163f46",
          950: "#0e2b31",
        },
        fondo: "#eef3f4",
      },
      fontFamily: {
        sans: ["var(--fuente-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        tarjeta: "0 1px 2px rgb(14 43 49 / 0.06), 0 4px 16px -4px rgb(14 43 49 / 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
