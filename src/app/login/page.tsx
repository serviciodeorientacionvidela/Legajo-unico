"use client";

import { GraduationCap, Loader2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

const MOTIVOS: Record<string, string> = {
  inactividad: "La sesión se cerró automáticamente tras 10 minutos de inactividad.",
  expirada: "La sesión expiró. Vuelva a iniciar sesión.",
};

function FormularioIngreso() {
  const router = useRouter();
  const parametros = useSearchParams();
  const motivo = MOTIVOS[parametros.get("motivo") ?? ""];
  const modoDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(cuerpo.error ?? "No se pudo iniciar sesión.");
      }
      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="tarjeta grid w-full max-w-4xl overflow-hidden md:grid-cols-2">
      {/* Panel institucional (petróleo) */}
      <div className="flex flex-col items-center justify-center gap-4 bg-institucional-950 px-8 py-10 text-center">
        <span className="grid h-28 w-28 place-items-center rounded-full ring-4 ring-institucional-400 md:h-36 md:w-36">
          <GraduationCap className="h-12 w-12 text-institucional-300 md:h-16 md:w-16" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Legajo Único del Estudiante</h1>
          <p className="mt-1 text-sm text-institucional-200">Escuela 4012 · Ing. Ricardo Videla</p>
        </div>
        <p className="max-w-xs text-xs text-institucional-200/80">
          Trayectoria, rendimiento, asistencia, convivencia e informes del SOE en un solo lugar.
        </p>
      </div>

      {/* Formulario */}
      <div className="px-8 py-10">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-institucional-50 text-institucional-600">
            <LockKeyhole className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="mt-3 text-lg font-bold text-institucional-950">Iniciar sesión</h2>
          <p className="text-xs text-slate-500">Acceso restringido al personal de la institución</p>
        </div>

        {motivo && <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">{motivo}</p>}

        <form onSubmit={ingresar} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Email institucional
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="campo-pildora mt-1.5"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="campo-pildora mt-1.5"
            />
          </label>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{error}</p>}
          <button type="submit" disabled={enviando} className="boton-primario w-full py-2.5">
            {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Ingresar
          </button>
        </form>

        {modoDemo && (
          <p className="mt-6 text-center text-xs text-slate-500">
            El sistema está en modo demostración.{" "}
            <Link href="/" className="font-semibold text-institucional-700 hover:underline">
              Ir al dashboard de demostración
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function PaginaIngreso() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Cargando" />}>
        <FormularioIngreso />
      </Suspense>
    </main>
  );
}
