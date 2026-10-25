import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis y playwright son paquetes pesados de Node: no se empaquetan para el servidor.
  serverExternalPackages: ["googleapis", "playwright"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        // Los legajos contienen datos personales de menores: nunca se cachean.
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
