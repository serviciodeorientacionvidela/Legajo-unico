import { NextResponse } from "next/server";
import { borrarCookieSesion } from "@/lib/session";

export const runtime = "nodejs";

/** POST /api/auth/logout — invocado manualmente o por SessionTimeoutGuard tras 10 min de inactividad. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  borrarCookieSesion(res);
  return res;
}
