import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
mkdirSync("scripts/sql", { recursive: true });
// Consulta el catálogo de la base; no ejecuta ninguna modificación.
execFileSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-schema-datasource",
    "prisma/schema.prisma",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
    "--output",
    "scripts/sql/seguimiento-base-actual.sql",
  ],
  { stdio: "inherit", env: process.env },
);
console.log("SQL de diferencias preparado. No se aplicaron cambios a la base.");
