"use client";

import { GraduationCap, Loader2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

const MOTIVOS: Record<string, string> = {
  inactividad: "La sesión se cerró automáticamente tras 10 minutos de inactividad.",
  expirada: "La sesión expiró. Vuelva a iniciar sesión.",
};

const CLASE_CAMPO =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-institucional-500 focus:outline-none focus:ring-1 focus:ring-institucional-500";

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
    <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
      <div className="flex flex-col items-center text-center">
        <span className="rounded-lg bg-institucional-600 p-2.5 text-white">
          <GraduationCap className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Legajo Único del Estudiante</h1>
        <p className="text-xs text-slate-500">Acceso restringido al personal de la institución</p>
      </div>

      {motivo && <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">{motivo}</p>}

      <form onSubmit={ingresar} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Email institucional
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={CLASE_CAMPO} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">{error}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-institucional-600 px-4 py-2 text-sm font-medium text-white hover:bg-institucional-700 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />}
          Ingresar
        </button>
      </form>

      {modoDemo && (
        <p className="mt-6 text-center text-xs text-slate-500">
          El sistema está en modo demostración.{" "}
          <Link href="/" className="font-medium text-institucional-700 hover:underline">
            Ir al dashboard de demostración
          </Link>
        </p>
      )}
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
