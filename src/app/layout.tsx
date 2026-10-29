import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const fuenteSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--fuente-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Legajo Único del Estudiante",
  description: "Sistema de Legajo Único del Estudiante (LUE) — Escuela Secundaria, Mendoza",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={fuenteSans.variable}>
      <body>{children}</body>
    </html>
  );
}
