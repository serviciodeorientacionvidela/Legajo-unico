import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";

/**
 * Contraseñas temporales que genera la cuenta técnica. Se guardan cifradas (AES-256-GCM) solo hasta
 * que la persona elige la suya, para poder reenviarlas si se pierden. Las contraseñas propias nunca
 * se guardan legibles: solo su hash bcrypt.
 *
 * La clave se deriva de NEXTAUTH_SECRET (o de CLAVES_TEMPORALES_SECRET si se define).
 */
function clave(): Buffer {
  const secreto = process.env.CLAVES_TEMPORALES_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secreto || secreto.length < 32) throw new Error("Falta NEXTAUTH_SECRET para cifrar contraseñas temporales.");
  return createHash("sha256").update(`lue:claves-temporales:${secreto}`).digest();
}

export function cifrarClaveTemporal(texto: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  return ["v1", iv.toString("base64url"), cifrador.getAuthTag().toString("base64url"), datos.toString("base64url")].join(":");
}

export function descifrarClaveTemporal(cifrada: string): string | null {
  try {
    const [version, iv, tag, datos] = cifrada.split(":");
    if (version !== "v1" || !iv || !tag || !datos) return null;
    const descifrador = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64url"));
    descifrador.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([descifrador.update(Buffer.from(datos, "base64url")), descifrador.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Contraseña temporal fácil de dictar: palabra + 4 dígitos. */
export function generarClaveTemporal(): string {
  const palabras = ["aula", "patio", "tiza", "recreo", "legajo", "cuaderno", "pizarra", "mochila", "campana", "regla"];
  const palabra = palabras[randomInt(palabras.length)] ?? "legajo";
  return `${palabra}${String(randomInt(10000)).padStart(4, "0")}`;
}
