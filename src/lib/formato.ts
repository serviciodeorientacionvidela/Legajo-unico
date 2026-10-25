const ORDINAL_FEMENINO: Record<string, string> = {
  "1": "1ra", "2": "2da", "3": "3ra", "4": "4ta", "5": "5ta", "6": "6ta", "7": "7ma", "8": "8va", "9": "9na", "10": "10ma",
};

/** 1, "2" → "1° 2da" */
export function etiquetaCurso(anio: number, division: string): string {
  return `${anio}° ${ORDINAL_FEMENINO[division] ?? division}`;
}

/** Fechas "solo día" (nacimiento, vencimiento CUD): se muestran en UTC para no correr un día. */
export function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

export function formatearFechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Mendoza",
  }).format(new Date(iso));
}

export function edad(isoNacimiento: string | null, referencia = new Date()): number | null {
  if (!isoNacimiento) return null;
  const nacimiento = new Date(isoNacimiento);
  let anios = referencia.getUTCFullYear() - nacimiento.getUTCFullYear();
  const cumplio =
    referencia.getUTCMonth() > nacimiento.getUTCMonth() ||
    (referencia.getUTCMonth() === nacimiento.getUTCMonth() && referencia.getUTCDate() >= nacimiento.getUTCDate());
  if (!cumplio) anios--;
  return anios;
}

export function diasHasta(iso: string, referencia = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - referencia.getTime()) / 86_400_000);
}

export function formatearNota(nota: number | null): string {
  return nota === null ? "—" : nota.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
