"use client";

/** Iniciales para el avatar, sin títulos (Lic., Prof., ...). Acepta "APELLIDO, Nombre". */
export function iniciales(nombre: string): string {
  return nombre
    .replace(/^(Lic|Prof|Dr|Dra)\.\s*/i, "")
    .replace(",", " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function urlFotoUsuario(id: string, fotoVersion: string | null | undefined): string | null {
  return fotoVersion ? `/api/usuarios/${encodeURIComponent(id)}/foto?v=${encodeURIComponent(fotoVersion)}` : null;
}

/** Foto de perfil circular; si no hay foto muestra las iniciales. `src` puede ser una URL o un data URL. */
export default function Avatar({
  nombre,
  src,
  tamanio = "md",
  className = "",
}: {
  nombre: string;
  src: string | null;
  tamanio?: "sm" | "md" | "lg";
  className?: string;
}) {
  const medidas = { sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-24 w-24 text-2xl" }[tamanio];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- imagen servida por la API autenticada
    return <img src={src} alt={`Foto de ${nombre}`} className={`${medidas} shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`${medidas} grid shrink-0 place-items-center rounded-full bg-institucional-800 font-bold text-institucional-100 ${className}`}
    >
      {iniciales(nombre)}
    </span>
  );
}

/** Recorta al centro y reduce la imagen a 256×256 JPEG en el navegador (la base guarda solo esto). */
export async function reducirFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite procesar imágenes.");
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
