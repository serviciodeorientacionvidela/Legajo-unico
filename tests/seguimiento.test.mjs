import test from "node:test";
import assert from "node:assert/strict";
import {
  validarApertura,
  inasistenciasAnuales,
  diasHastaFecha,
  estadoVigencia,
  actuacionSchema,
  situacionSchema,
  respuestaSchema,
  diaLocal,
} from "../src/lib/seguimiento/reglas.ts";
import {
  exigirCurso,
  exigirDireccion,
} from "../src/lib/seguimiento/permisos.ts";

test("Apertura por faltas: 19.5, 20 y ausencia de acumulado anual", () => {
  assert.match(validarApertura("INASISTENCIAS", 19.5, 25, false), /20/);
  assert.match(validarApertura("INASISTENCIAS", null, 25, false), /confirmado/);
  assert.equal(validarApertura("INASISTENCIAS", 20, 25, false), null);
  assert.match(validarApertura("ICE_CERO", 0, 1, false), /mayor/);
  assert.equal(validarApertura("DERIVACION_SOE", 0, 25, false), null);
});
test("No convierte agosto-octubre ni ciclos anteriores en acumulado anual", () => {
  const e = {
    trayectoria: [{ cicloLectivo: 2025, activo: false, inasistencias: 30 }],
    asistencias: [{ cicloLectivo: 2026, totalInasistencias: 22 }],
  };
  assert.equal(inasistenciasAnuales(e, 2026), null);
  e.trayectoria.push({ cicloLectivo: 2026, activo: true, inasistencias: 20.5 });
  assert.equal(inasistenciasAnuales(e, 2026), 20.5);
});
test("Recordatorios y vencimientos respetan fechas de Argentina", () => {
  assert.equal(diaLocal(new Date("2026-11-04T01:00:00Z")), "2026-11-03");
  assert.equal(diasHastaFecha("2026-11-05", "2026-11-03"), 2);
  assert.equal(diasHastaFecha("2026-11-03", "2026-11-03"), 0);
  assert.equal(
    estadoVigencia("VIGENTE", "2026-11-02", "2026-11-03"),
    "VENCIDA",
  );
  assert.equal(
    estadoVigencia("CUMPLIDA", "2026-11-02", "2026-11-03"),
    "CUMPLIDA",
  );
});
test("Curso incluye turno; permisos de dirección son explícitos", () => {
  const p = {
    usuarioId: "u",
    funcion: "PRECEPTORIA",
    cursos: [{ anio: 3, division: "1", turno: "Mañana" }],
  };
  assert.doesNotThrow(() =>
    exigirCurso(p, { anio: 3, division: "1", turno: "Mañana" }),
  );
  assert.throws(() =>
    exigirCurso(p, { anio: 3, division: "1", turno: "Tarde" }),
  );
  assert.throws(() =>
    exigirCurso(
      { ...p, cursos: [] },
      { anio: 3, division: "1", turno: "Mañana" },
    ),
  );
  assert.throws(() => exigirDireccion({ ...p, funcion: "SOE" }));
});
test("Actas completas, tres líneas y descargo para quita ICE", () => {
  const a = {
    tipo: "FAMILIA",
    fecha: "2026-11-03",
    motivo: "Citación familiar",
    resumen: "Se acordó un seguimiento.",
  };
  assert.equal(actuacionSchema.safeParse(a).success, true);
  assert.equal(
    actuacionSchema.safeParse({ ...a, resumen: "uno\ndos\ntres\ncuatro" })
      .success,
    false,
  );
  assert.equal(
    actuacionSchema.safeParse({ ...a, tipoActa: "Acta compromiso" }).success,
    false,
  );
  assert.equal(
    actuacionSchema.safeParse({ ...a, puntosIce: 3 }).success,
    false,
  );
  assert.equal(
    actuacionSchema.safeParse({ ...a, fecha: "2026-02-31" }).success,
    false,
  );
});
test("Extensión vigente exige Supervisión; derivación externa exige organismo", () => {
  const s = {
    tipo: "EXTENSION_INASISTENCIAS",
    estado: "VIGENTE",
    fechaInicio: "2026-11-03",
  };
  assert.equal(situacionSchema.safeParse(s).success, false);
  assert.equal(
    situacionSchema.safeParse({ ...s, aval: "Supervisión" }).success,
    true,
  );
  assert.equal(
    respuestaSchema.safeParse({
      id: "d",
      accionesSoe: "Se realizó entrevista.",
      respuesta: "Se acordó nueva cita.",
      destino: "EXTERNA_ORGANISMO",
      estado: "EN_CURSO",
    }).success,
    false,
  );
});

test('Servidor: apertura, actuación, seguimiento y auditoría se escriben juntos', async()=>{
 const {prisma}=await import('../src/lib/prisma.ts');
 const {escribirSeguimiento}=await import('../src/lib/seguimiento/servicio.ts');
 const escrituras=[];
 const e={id:'e',dni:'12345678',anio:3,division:'1',turno:'Mañana',estadoMatricula:'REGULAR',legajoAbiertoEl:null,promedioGeneral:6,puntosConvivencia:25,requierePpi:false,fechaNacimiento:null,trayectoria:[{cicloLectivo:2026,activo:true,inasistencias:20}],asistencias:[],calificaciones:[{previa:true}]};
 const registrar=(tabla)=>({create:async({data})=>{escrituras.push({tabla,data});return {id:`${tabla}-1`,...data}}});
 const tx={estudiante:{findUnique:async()=>e,update:async({data})=>{escrituras.push({tabla:'apertura',data});return {...e,...data}}},usuario:{findUnique:async()=>({activo:true,rol:'DIRECTIVO_SOE',perfilSeguimiento:{funcion:'DIRECCION',cursos:[]}})},actuacion:registrar('actuacion'),seguimientoCaso:registrar('seguimiento'),auditLog:registrar('auditoria'),situacionEspecial:registrar('situacion')};
 const original=prisma.$transaction;
 prisma.$transaction=async(fn)=>fn(tx);
 try{
  const p={usuarioId:'u',funcion:'DIRECCION',cursos:[]};const u={id:'u',rol:'DIRECTIVO_SOE',nombre:'Prueba',email:'prueba@example.invalid'};
  await escribirSeguimiento(e.dni,'ACTUACION',{tipo:'INASISTENCIAS',fecha:'2026-11-03',motivo:'Veinte inasistencias',resumen:'Se revisaron antecedentes y se citó a la familia.',motivoApertura:'INASISTENCIAS',seguimientoFecha:'2026-11-05',responsableId:'u',condicional:true},p,u,null);
  assert.deepEqual(escrituras.map(x=>x.tabla),['apertura','actuacion','situacion','seguimiento','auditoria']);
  assert.equal(escrituras[0].data.aperturaInasistencias,20);
  assert.equal(escrituras[0].data.aperturaPendientes,1);
  assert.equal(escrituras.at(-1).data.accion,'CARGAR_ACTUACION');
  escrituras.length=0;e.trayectoria[0].inasistencias=19;
  await assert.rejects(()=>escribirSeguimiento(e.dni,'ACTUACION',{tipo:'INASISTENCIAS',fecha:'2026-11-03',motivo:'Diecinueve inasistencias',resumen:'No corresponde abrir por faltas.',motivoApertura:'INASISTENCIAS',seguimientoFecha:'2026-11-05',responsableId:'u'},p,u,null),/20/);
  assert.equal(escrituras.length,0);
 }finally{prisma.$transaction=original;}
});

test('Reporte 9 no admite SOE ni preceptoría aun invocando el servidor directamente',async()=>{
 const {generarReporte}=await import('../src/lib/seguimiento/reportes.ts');
 const u={id:'u',rol:'DIRECTIVO_SOE',nombre:'Prueba',email:'prueba@example.invalid'};
 await assert.rejects(()=>generarReporte(9,2026,'','',{usuarioId:'u',funcion:'SOE',cursos:[]},u),/dirección/);
 await assert.rejects(()=>generarReporte(5,2026,'','',{usuarioId:'u',funcion:'PRECEPTORIA',cursos:[]},u),/solo accede/);
});
