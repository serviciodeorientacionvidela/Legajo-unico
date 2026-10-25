import Dashboard from "@/components/Dashboard";

/**
 * Dashboard institucional.
 * NEXT_PUBLIC_DEMO_MODE distinto de "false" → modo demostración con datos semilla en memoria
 * (funciona sin base de datos). Con "false" → API real con login, RBAC y auditoría en PostgreSQL.
 */
export default function Inicio() {
  const modoDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  return <Dashboard modoDemo={modoDemo} />;
}
