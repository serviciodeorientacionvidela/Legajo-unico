import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { procesarAvisos } from "@/lib/seguimiento/avisos";
import { seguimientoHabilitado } from "@/lib/seguimiento/permisos";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const esperado = Buffer.from(`Bearer ${secret ?? ""}`);
  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  if (
    !secret ||
    recibido.length !== esperado.length ||
    !timingSafeEqual(recibido, esperado)
  )
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!seguimientoHabilitado())
    return NextResponse.json(
      { error: "Seguimiento no habilitado" },
      { status: 503 },
    );
  try {
    return NextResponse.json(await procesarAvisos());
  } catch {
    return NextResponse.json(
      { error: "No se completó la generación de avisos; se puede reintentar." },
      { status: 500 },
    );
  }
}
