# Legajo Único del Estudiante (LUE)

Sistema de legajo digital unificado para una escuela secundaria de Mendoza: matrícula, calificaciones,
asistencia, régimen de convivencia por puntos, alertas pedagógicas (CUD / PPI), informes del SOE y
carpetas en Google Drive, con control de acceso por rol conforme a la **Ley 25.326** y la **Ley 26.061**.

**Stack:** Next.js 15 (App Router) · TypeScript estricto · Tailwind CSS · Prisma + PostgreSQL (Neon) ·
Google Drive API (Service Account) · SheetJS (`xlsx`) · Playwright.

---

## Probarlo ya (modo demostración, sin base de datos)

```bash
npm install
npm run dev          # http://localhost:3000
```

Sin `.env.local`, el dashboard arranca en **modo demostración** con 18 legajos ficticios en memoria:

- Arriba a la derecha, el **simulador de rol** (Directivo / SOE · Preceptor · Docente). También aparece dentro del legajo
  abierto, así se ve cómo cambia el mismo legajo según el rol.
- En cada legajo, **«JSON recibido»** muestra el payload exacto que llegó al navegador: para Docente y Preceptor
  los datos clínicos **no existen** en la respuesta.
- Casos incluidos: CUD + PPI (TEA), PPI sin CUD (dislexia), CUD próximo a vencer, alumnos con 8 y 5 puntos,
  incidente pendiente de aprobación, materias previas, riesgo pedagógico y un pase.
- **Importar GEI** (rol Directivo) incluye un botón para descargar un Excel de ejemplo y probar la importación.
- El contador de la barra superior muestra el cierre automático por inactividad (10 min).

## Matriz de permisos (RBAC)

| Módulo | Docente | Preceptor | Directivo / SOE |
|---|---|---|---|
| Datos biográficos y curso | Lectura | Lectura / Edición | Control total |
| Contacto familiar (domicilio, tutores, teléfonos, emails) | Sin acceso | Lectura | Control total |
| Trayectoria escolar y alertas tempranas (GEI) | Sin acceso | Lectura | Control total |
| Calificaciones, promedios y asistencias | Lectura | Lectura | Control total |
| Indicador CUD / PPI | Solo Sí/No | Solo Sí/No | Diagnóstico y PDF |
| Régimen de convivencia | Sin acceso | Carga e incidentes (quedan pendientes) | Aprobación, quita de puntos y baja |
| Informes SOE y carpeta confidencial | Sin acceso | Sin acceso | Control total |
| Auditoría y sincronización GEI | Sin acceso | Sin acceso | Control total |

La sanitización se hace en el servidor por **lista blanca** (`src/lib/rbac.ts`): las vistas se arman campo por
campo, de modo que un campo nuevo del esquema nunca se filtra por accidente. El modo demo usa exactamente las
mismas funciones.

## Seguridad implementada

- `GET /api/estudiantes/[dni]` registra **siempre** `VER_LEGAJO` en `AuditLog` (y `VER_CUD_SOE` si se
  expusieron datos de salud), incluso si el DNI no existe. Si la auditoría falla, no se devuelven datos.
- Sesión con JWT HS256 en cookie `httpOnly` + `SameSite=Strict`, que **vence a los 10 minutos** y se renueva
  solo con actividad. `SessionTimeoutGuard` cierra la sesión en el cliente tras 10 min sin mouse/teclado
  (con aviso 60 s antes). El rol se relee de la base en cada request.
- Login con bcrypt, respuesta de tiempo constante y límite de 5 intentos fallidos cada 15 min.
- Incidentes de convivencia en transacción `Serializable`: el saldo nunca queda negativo y la baja restituye los
  puntos.
- Headers `no-store` en toda la API, `X-Frame-Options: DENY`, `noindex`.

## Estructura

```
prisma/schema.prisma          Modelos: Usuario, Estudiante, CalificacionMateria, IncidenteConvivencia,
                              IntervencionSoe, AuditLog
prisma/seed.ts                Carga los casos ficticios + un usuario por rol
scripts/gei-scraper.ts        Playwright: login al GEI, descarga de reportes e importación
src/lib/                      prisma, rbac, audit, session, api, consultas, convivencia, tipos, demo
src/services/
  googleDriveService.ts       sincronizarEstructuraDrive / moverCarpetaPorPromocion
  geiParser.ts                Parser Excel/CSV del GEI (puro, también corre en el navegador)
  geiSyncService.ts           Upsert masivo por DNI + Drive + auditoría
src/app/api/
  estudiantes/                GET (filtros + métricas) · POST (alta / sincronización)
  estudiantes/[dni]/          GET legajo unificado (RBAC + auditoría)
  convivencia/                POST carga · PATCH aprobar / dar de baja
  gei/import/                 POST multipart con el Excel del GEI
  auditoria/                  GET logs (Directivo)
  auth/                       login · logout · me
src/components/               Dashboard, LegajoDetalle, IncidenteModal, ImportGeiModal, AuditoriaPanel,
                              SessionTimeoutGuard, RoleSimulator, MetricCards, StudentTable
```

---

## Puesta en producción (cuando esté el correo institucional)

### 1. GitHub
```bash
git branch -M main
git remote add origin https://github.com/<cuenta-institucional>/legajo-unico.git
git push -u origin main
```
> Repositorio **privado**: aunque el código no tiene datos reales, la configuración y el historial son de la institución.

### 2. Neon (PostgreSQL)
1. Crear el proyecto (región `sa-east-1`, São Paulo).
2. Copiar la cadena **pooled** en `DATABASE_URL` (`.env.local`).
3. Crear las tablas: `npm run db:push` (o `npm run db:migrate` para versionar migraciones).
4. Opcional, solo en una base de prueba: `SEED_PASSWORD=... npm run db:seed`.

### 3. Google Drive
1. En Google Cloud (cuenta institucional): crear un proyecto, habilitar **Google Drive API** y crear una
   **Service Account** con una clave JSON.
2. Crear una **Unidad Compartida** institucional (las Service Accounts no tienen cuota propia) y agregar el
   email de la Service Account como *Administrador de contenido*.
3. Copiar el ID de la carpeta de la unidad en `GOOGLE_DRIVE_ROOT_FOLDER_ID`. El sistema crea dentro
   `LEGAJO_UNICO_ESTUDIANTES_2026 / [Año] / [División] / [DNI - APELLIDO, Nombres] / 01_… 02_… 03_…`.
4. Compartir la unidad **solo con el equipo Directivo / SOE**. El acceso de preceptores a
   `01_Documentacion_General` y `02_Convivencia_y_Actas` se otorga por carpeta; `03_SOE_y_Salud_Confidencial`
   nunca se comparte fuera del nivel 3.

### 4. Vercel
1. Importar el repositorio y cargar las variables de `.env.example` (sin comillas en el panel).
2. `NEXT_PUBLIC_DEMO_MODE=false` para usar la base real y el login.
3. `GOOGLE_PRIVATE_KEY` va con los `\n` literales, tal como en el JSON de la clave.
4. La importación del GEI con creación de carpetas para toda la escuela puede tardar: la ruta declara
   `maxDuration = 300` (requiere plan Pro; en Hobby el límite es menor y conviene importar sin Drive y
   sincronizar las carpetas con el scraper local).

### 5. Primer usuario Directivo
Hasta tener una pantalla de administración de usuarios, el primer usuario se crea con Prisma Studio
(`npm run db:studio`), con un `passwordHash` generado así:
```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "contraseña-segura"
```

### 6. Scraper del GEI
```bash
npx playwright install chromium                     # una sola vez
npm run gei:scrape -- --headed --solo-descargar     # calibrar selectores viendo el navegador
npm run gei:scrape                                  # descarga + importación
```
Las URLs de los reportes (`GEI_REPORTES`) y, si hace falta, los selectores (`GEI_SELECTOR_*`) se configuran
después de inspeccionar el portal con la cuenta del establecimiento. Los archivos descargados quedan en
`gei-downloads/` (excluida de git).

## Notas técnicas

- `npm audit` reporta avisos en herramientas de build (CLI de Prisma 6, el `postcss` interno de Next 15 y
  el de Tailwind 3). Ninguno procesa datos de usuarios en ejecución, y las correcciones requieren
  Prisma 7 / Next 16 / Tailwind 4 (cambios mayores). Conviene planificar esa actualización.
- El esquema agrega algunos campos al modelo original: `cudUrl`, `observacionesConfidenciales`, las IDs de las 3
  subcarpetas de Drive y `aprobado` / `aprobadoPorId` / `anulado` en `IncidenteConvivencia`. Son necesarios para
  la matriz de permisos (Diagnóstico y PDF; Preceptor carga y Directivo aprueba o da de baja).
