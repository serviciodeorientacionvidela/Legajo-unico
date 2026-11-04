# Circuito LUE implementado — 03/11/2026

Referencia: documento «LUE – Funcionamiento, procedimiento de apertura y circuito de comunicación», y seis capturas aportadas por la escuela. Las normas citadas se toman como contexto del documento; esta implementación no sustituye su validación institucional.

## Qué se incorpora

- Acceso **Seguimiento LUE** en el menú y dentro de la ficha del estudiante.
- Bandeja con legajos abiertos, derivaciones, pendientes, alertas de 10/15/20 faltas e ICE en cero. Una ficha de matrícula no es un legajo abierto.
- Apertura mediante primera actuación, derivación o situación relevante, con foto del rendimiento y trayectoria disponibles. Las faltas se toman del acumulado anual de la trayectoria activa del GEI; los meses parciales nunca se convierten en un total anual supuesto.
- Actuaciones con nueve tipos, fecha, motivo, resumen de hasta tres líneas, acta/libro/folio, autor y fecha de registro. Historial por ciclo; anulación conservando el registro y el motivo, deshabilitada hasta validación institucional.
- Derivación A, respuesta B del SOE y seguimientos C vinculados. La respuesta institucional vuelve a quien derivó; las acciones reservadas quedan para el equipo.
- Seguimientos con responsable, fecha, resultado o cancelación; resolución previa al cierre de una derivación.
- Fichas de salud y psicosocial con apoyos, acuerdos, referentes y documentación, sin campos nuevos de diagnóstico. Cada lectura y modificación se audita.
- Situaciones para escolaridad protegida, federados, CUD/evaluación, condicionalidad, extensión, embarazo/paternidad/lactancia, aprendizaje, ingresantes, salidas, no asistencia, domiciliaria, judicialización y resolución de cambio de género. Incluye gestiones y denuncias al Juzgado de Paz y PODES.
- Doce reportes con filtros, Excel y PDF mediante impresión. Reportes sensibles identificados por iniciales/legajo y auditados. El reporte de género requiere DIRECCION.
- Permisos explícitos DIRECCION, SOE y PRECEPTORIA, con cursos incluyendo turno; la cuenta administradora no se convierte automáticamente en dirección. Se restringen también las consultas y cargas previas de preceptoría al habilitar el circuito.
- Job diario de recordatorios con claves de deduplicación. Avisos dos días antes, al vencer y diariamente si sigue sin resolver; los vencidos incluyen dirección. Recordatorios de renovación/cierre de escolaridad protegida.
- Los legajos no se reinician cada ciclo. Pases, abandono y egreso quedan para consulta. La revisión de diciembre permite cerrar o dar de baja situaciones expresamente; no se borra automáticamente el historial.

El saldo ICE continúa siendo el oficial del GEI: el LUE documenta la resolución y descargo. Las alertas de 20 faltas/ICE solicitan revisar la apertura; la primera actuación requiere una causa y responsable, evitando aperturas sin un registro institucional. Los formularios conservan los estados pendientes cuando aún falta un aval.

## Activación en la base real

El 03/11 se consultó exclusivamente el catálogo de la base configurada: faltaban las tablas nuevas. Se preparó `scripts/sql/seguimiento-base-actual.sql`; **no se ejecutó**. El SQL es aditivo: crea siete tablas y tipos, agrega campos de apertura y valores de auditoría. No contiene borrados de registros.

1. Revisar el SQL, respaldar la base con el mecanismo habitual y aplicar durante la ventana de mantenimiento autorizada. No ejecutar `db:seed` sobre datos reales.
2. Para volver a generar las diferencias con el estado actual (solo lectura): `node scripts/preparar-seguimiento.mjs`.
3. Aplicación del SQL revisado: cargar el entorno de conexión y ejecutar `prisma db execute --file scripts/sql/seguimiento-base-actual.sql --schema prisma/schema.prisma`. El CLI de Prisma no lee `.env.local` automáticamente; usar el entorno de despliegue o cargarlo antes.
4. Regenerar Prisma, compilar y publicar. Desde administración, entrar en **Seguimiento LUE → Perfiles y cursos** y asignar función y cursos exactos. Configurar los perfiles antes de habilitar el acceso general.
5. Establecer `LUE_SEGUIMIENTO_HABILITADO=true`. Hasta entonces las pantallas anteriores siguen compatibles con la base sin migrar y el módulo real informa que está pendiente de habilitación.
6. Configurar `CRON_SECRET`; `vercel.json` programa el job a las 11:00 UTC (08:00 Argentina). También puede invocarse desde otro planificador con `Authorization: Bearer <CRON_SECRET>`.

## Correo institucional

El sistema prepara el envío mediante un adaptador HTTPS configurable, no una cuenta personal. Requiere `LUE_CORREO_ENDPOINT`, `LUE_CORREO_TOKEN`, `LUE_PUBLIC_URL` y la lista `LUE_DOMINIOS_INSTITUCIONALES` separada por comas. Sin estos datos, se generan los avisos LUE y se informa cuántos correos quedaron pendientes; no se marca un correo como enviado.

Contrato del adaptador: POST JSON `{ "to": "cuenta@dominio", "subject": "Recordatorio institucional LUE", "text": "https://.../?seguimiento=..." }`, autorización Bearer e `Idempotency-Key` única. Debe deduplicar esa clave y responder 2xx únicamente al aceptar el envío. El texto contiene solo el enlace, sin nombre ni motivo del estudiante. No se ha configurado ni enviado correo real.

## Validaciones pendientes de la escuela

La pantalla Procedimiento conserva los once puntos abiertos de la sección 11. En particular:

- La alerta de 15 faltas figura como propuesta institucional.
- Los contenidos definitivos de las fichas deben validarse con el SOE.
- La condicionalidad por ICE requiere resolución y fundamento, no se deduce automáticamente del puntaje.
- La anulación por dirección requiere habilitar `LUE_PERMITIR_ANULACION=true` solo después de acordar quién puede efectuarla. No revierte automáticamente otras decisiones vinculadas.
- No hay borrado por plazos de conservación no definidos.
- No se interpreta «permanecedor» como diagnóstico ni se inventa un número de protocolo.

## Verificación local

- `npm run typecheck`
- `npm run build`
- `node --import tsx --test tests/seguimiento.test.mjs`
- Con servidor demo en `127.0.0.1:3105`: `node tests/seguimiento-browser.mjs`

Las pruebas de servicio usan un cliente de transacción simulado y no modifican la base real. La demostración trabaja con datos ficticios en memoria. Las capturas de prueba y la exportación quedan en `artifacts/seguimiento/`.
