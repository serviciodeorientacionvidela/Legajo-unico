/**
 * Guías de procedimiento que se muestran al registrar una actuación de tipo "Protocolo".
 * Resumen operativo de la normativa provincial; ante dudas manda el texto oficial (sección Normativa).
 *
 * Fuentes: Decreto 1187/2018 (Ley 9054) y su Anexo III según el portal de procedimientos de la DGE
 * (hportal.mendoza.edu.ar), Anexo I Protocolo de Bullying (DGE), Protocolo DGE ante amenazas de
 * intimidación pública y retos virales, y Resolución 214/2026 del Ministerio de Salud y Deportes (911).
 */

export interface DocumentoNormativo {
  titulo: string;
  archivo: string;
  descripcion: string;
}

export const NORMATIVA: DocumentoNormativo[] = [
  {
    titulo: "Decreto 1187/2018",
    archivo: "/normativa/decreto-1187-2018.pdf",
    descripcion: "Reglamenta la Ley 9054: denuncia ante abuso sexual o maltrato y guías de situaciones emergentes.",
  },
  {
    titulo: "Anexo I · Acta de denuncia (Ley 9054)",
    archivo: "/normativa/anexo-i-acta-denuncia-ley-9054.doc",
    descripcion: "Formulario de acta para presentar ante el/la Asesor/a de Personas Menores e Incapaces.",
  },
  {
    titulo: "Decreto 1187 · Anexo III (índice, pág. 54)",
    archivo: "/normativa/decreto-1187-anexo-iii-indice-p54.jpeg",
    descripcion: "Guía de procedimientos ante situaciones emergentes del nivel secundario.",
  },
  {
    titulo: "Decreto 1187 · Anexo III (índice, pág. 55)",
    archivo: "/normativa/decreto-1187-anexo-iii-indice-p55.jpeg",
    descripcion: "Continuación del índice: violencia, armas, trabajo infantil, trata, paradero.",
  },
  {
    titulo: "Protocolo de Bullying · Anexo I",
    archivo: "/normativa/protocolo-bullying-anexo-i.pdf",
    descripcion: "Los ocho pasos de intervención, tabla de gravedad, memorandos y plantillas.",
  },
  {
    titulo: "Protocolo ante amenazas de intimidación pública y retos virales",
    archivo: "/normativa/protocolo-amenazas-intimidacion-publica.jpeg",
    descripcion: "Afiche DGE: prevención, acción inmediata, comunicación, abordaje SOE y encuadre legal.",
  },
  {
    titulo: "Resolución 214/2026 · Emergencias y 911",
    archivo: "/normativa/resolucion-214-2026-protocolo-emergencias-911.pdf",
    descripcion: "Criterios de emergencia, urgencia y no emergencia y flujograma obligatorio del 911.",
  },
];

export interface PasoProtocolo {
  titulo: string;
  detalle?: string;
}

export interface SituacionProtocolo {
  id: string;
  titulo: string;
  /** Cuándo aplica. */
  cuando?: string;
  pasos: PasoProtocolo[];
  /** A quién se avisa. */
  avisar?: string[];
  /** Qué se registra. */
  registrar?: string;
  /** Advertencias: lo que no hay que hacer. */
  evitar?: string[];
  /** Teléfonos útiles. */
  telefonos?: string[];
}

export interface GuiaProtocolo {
  titulo: string;
  resumen: string;
  documentos: string[];
  /** Si hay varias situaciones, se elige una (p. ej. Decreto 1187). */
  situaciones: SituacionProtocolo[];
}

const DEC_1187: GuiaProtocolo = {
  titulo: "Decreto 1187/2018 · Situaciones emergentes",
  resumen:
    "Elija la situación. En todos los casos: escuchar sin interrogar ni revictimizar, no dejar solo al estudiante, labrar acta y avisar por línea jerárquica.",
  documentos: [
    "/normativa/decreto-1187-2018.pdf",
    "/normativa/anexo-i-acta-denuncia-ley-9054.doc",
  ],
  situaciones: [
    {
      id: "certeza",
      titulo: "Maltrato o abuso sexual: relato o indicador de certeza",
      cuando:
        "El estudiante relata la situación o el personal la conoce de manera directa (Art. 1, Decreto 1187).",
      pasos: [
        { titulo: "Si hay lesiones, llamar a emergencias médicas", detalle: "El médico decide si concurre." },
        {
          titulo: "Labrar el acta (modelo Anexo I)",
          detalle: "La labra quien tuvo noticia, con un miembro del equipo directivo. Se asienta en el libro respectivo.",
        },
        {
          titulo: "Enviar el acta en forma inmediata",
          detalle: "Al Asesor/a de Personas Menores e Incapaces y al OAL, por correo, WhatsApp o personalmente.",
        },
        { titulo: "Confirmar la recepción por teléfono y pedir instrucciones" },
        { titulo: "Dar intervención al SOE", detalle: "Para el acompañamiento de la trayectoria escolar." },
      ],
      avisar: ["Asesor/a de Menores", "OAL / ETI", "Equipo directivo", "SOE"],
      registrar: "Acta modelo Anexo I + documentación respaldatoria.",
      evitar: [
        "Si quien relata es un adulto de la familia, esa persona debe hacer la denuncia en Fiscalía.",
        "Ante dudas, consultar de urgencia a la DOAITE antes de dar intervención al Asesor/a.",
      ],
    },
    {
      id: "presuncion",
      titulo: "Presunción de maltrato o abuso (indicadores genéricos)",
      cuando: "No hay relato ni evidencias, pero se sospecha que puede estar ocurriendo (Art. 2).",
      pasos: [
        { titulo: "Realizar un informe escrito de la institución" },
        {
          titulo: "Dar intervención al SOE / DOAITE",
          detalle: "Evalúa la situación articulando con el PPMI. Asesoramiento: Línea 102.",
        },
        { titulo: "Dar intervención al ETI u organismo que lo reemplace" },
        {
          titulo: "Si se confirma, pasar al procedimiento de certeza",
          detalle: "El profesional interviniente comunica al Asesor/a de Menores.",
        },
      ],
      avisar: ["SOE / DOAITE", "ETI", "Equipo directivo"],
      registrar: "Informe escrito institucional.",
      telefonos: ["Línea 102"],
    },
    {
      id: "personal-alumno",
      titulo: "Maltrato o violencia del personal hacia estudiantes",
      pasos: [
        { titulo: "Si es necesario, llamar a emergencias médicas" },
        { titulo: "Citar de inmediato a la familia e informar" },
        {
          titulo: "Denuncia en Fiscalía",
          detalle: "La dirección orienta a la familia; si no la hace, la realiza un directivo.",
        },
        { titulo: "Libro de actas", detalle: "Con firma del personal de la institución y de la familia." },
        {
          titulo: "Descargo del agente: 5 días",
          detalle: "Vencido el plazo, elevar a Supervisión y Dirección de línea.",
        },
        {
          titulo: "Denuncia ante la Junta de Disciplina",
          detalle: "Si es personal no docente: Dirección de Recursos Humanos.",
        },
        { titulo: "SOE acompaña la trayectoria del estudiante" },
      ],
      avisar: ["Familia", "Fiscalía", "Supervisión", "Junta de Disciplina / RRHH"],
      registrar: "Libro de actas firmado.",
    },
    {
      id: "sexual-pares",
      titulo: "Situaciones de índole sexual entre pares",
      pasos: [
        { titulo: "Privilegiar el relato", detalle: "Escuchar con calma, sin culpar, juzgar ni interrogar, en privado." },
        { titulo: "Llamar de inmediato a las familias", detalle: "La entrevista la realiza un profesional del SOE." },
        { titulo: "Si es necesario, llamar a emergencias médicas" },
        {
          titulo: "Intervención del SOE",
          detalle: "Distingue juego sexual de imposición; deriva al Programa Provincial de Maltrato Infantil o salud mental.",
        },
        { titulo: "Acta firmada por los intervinientes", detalle: "Resguardando la intimidad de los implicados." },
        { titulo: "Informar por línea jerárquica" },
      ],
      avisar: ["Familias", "SOE", "Línea jerárquica"],
      registrar: "Acta firmada.",
    },
    {
      id: "acoso",
      titulo: "Acoso, ciberacoso o discriminación entre estudiantes",
      cuando: "Para bullying, aplique además el protocolo específico (causa «Bullying»).",
      pasos: [
        { titulo: "Contener y dar seguridad al estudiante afectado" },
        { titulo: "Hablar por separado con quienes acosan" },
        { titulo: "Llamar de inmediato a las familias" },
        {
          titulo: "Ciberacoso: no responder, bloquear y guardar evidencia",
          detalle: "Se puede denunciar o bloquear con los procedimientos del INADI.",
        },
        { titulo: "Intervención del SOE", detalle: "Trabajo institucional, áulico, grupal e individual." },
        { titulo: "Revisar los Acuerdos de Convivencia", detalle: "Desnaturalizar burlas y sobrenombres; ESI / INADI." },
        { titulo: "Libro de actas sin juicios de valor e informar por línea jerárquica" },
      ],
      avisar: ["Familias", "SOE", "Línea jerárquica"],
      registrar: "Libro de actas.",
    },
    {
      id: "autolesion",
      titulo: "Autolesiones",
      pasos: [
        { titulo: "Detener la autoagresión y no dejar solo al estudiante" },
        {
          titulo: "Llamar a emergencias médicas",
          detalle: "Si ordena traslado, acompaña un directivo o el docente a cargo.",
        },
        { titulo: "Llamar de inmediato a la familia" },
        { titulo: "Si no llega la emergencia y hay lesiones", detalle: "Articular con el Centro de Salud o CIC más cercano." },
        { titulo: "Intervención del SOE", detalle: "Diseña la intervención y el acompañamiento." },
        { titulo: "Libro de actas e informar por línea jerárquica" },
      ],
      avisar: ["Emergencias", "Familia", "SOE", "Línea jerárquica"],
      registrar: "Libro de actas.",
    },
    {
      id: "suicidio",
      titulo: "Estudiante expresa ideas de suicidio",
      pasos: [
        {
          titulo: "Tomarlo en serio sin alarmarse",
          detalle: "Escuchar sin inducir el relato, hablar lo mínimo, no contar experiencias propias.",
        },
        { titulo: "No dejarlo solo", detalle: "Retenerlo hasta decidir el curso de acción." },
        { titulo: "Llamar de inmediato a la familia" },
        { titulo: "Llamar a emergencias médicas para evaluación" },
        { titulo: "Intervención del SOE", detalle: "Diseña la intervención y la derivación a salud mental." },
        { titulo: "Libro de actas e informar por línea jerárquica" },
      ],
      avisar: ["Familia", "Emergencias", "SOE", "Línea jerárquica"],
      registrar: "Libro de actas.",
    },
    {
      id: "consumo",
      titulo: "Consumo problemático o intoxicación",
      pasos: [
        { titulo: "Contener y no dejar solo al estudiante" },
        { titulo: "Si hay intoxicación, llamar a emergencias médicas" },
        { titulo: "Confidencialidad", detalle: "Que no intervengan actores innecesarios; convocar a un adulto de confianza." },
        { titulo: "Llamar a la familia", detalle: "Si no llega y hay traslado, acompaña un directivo." },
        { titulo: "Intervención del SOE", detalle: "Indica la derivación a salud mental si corresponde." },
        { titulo: "Sostener la escolaridad durante el tratamiento" },
        { titulo: "Sustancias ilegales en la escuela", detalle: "Comunicarse con Fonodroga (24 h)." },
      ],
      avisar: ["Familia", "SOE", "Línea jerárquica"],
      telefonos: ["Fonodroga 0800-800-3764"],
    },
    {
      id: "arma",
      titulo: "Presencia de arma en la escuela",
      cuando: "Armas de fuego, blancas o impropias (cualquier objeto usado para amenazar o agredir).",
      pasos: [
        { titulo: "Pedir al portador que entregue el arma" },
        {
          titulo: "Si no la entrega o no se identifica al portador: comisaría o 911",
          detalle: "El estudiante no acompaña a la policía ni puede ser trasladado por ella.",
        },
        { titulo: "Convocar a un directivo o referente del estudiante y llamar a la familia" },
        { titulo: "Si un adulto amenaza con un arma: 911 de inmediato" },
        { titulo: "Actas e informe por línea jerárquica" },
        { titulo: "Intervención del SOE", detalle: "Evalúa derivación a salud y el abordaje institucional." },
      ],
      avisar: ["911 / Comisaría", "Familia", "Línea jerárquica", "SOE"],
      registrar: "Actas.",
    },
    {
      id: "adulto-personal",
      titulo: "Violencia de familiares u otros adultos hacia el personal",
      pasos: [
        { titulo: "Atender entre dos o más personas", detalle: "No responder con agresión; alejar a los estudiantes." },
        { titulo: "Si no se desactiva con diálogo: policía / 911" },
        { titulo: "Primeros auxilios y emergencias médicas si hace falta" },
        { titulo: "Contener al personal agredido" },
        { titulo: "Acta con testigos e informe por línea jerárquica" },
        {
          titulo: "Denuncia",
          detalle: "La hace el personal agredido o el directivo. La DGE brinda asistencia letrada gratuita (Defensor del Docente).",
        },
      ],
      avisar: ["911", "Línea jerárquica", "Fiscalía"],
      registrar: "Acta con testigos.",
    },
    {
      id: "trabajo-trata",
      titulo: "Trabajo infantil o trata de personas",
      pasos: [
        { titulo: "Trabajo infantil (menores de 16): informar a la COPRETI" },
        { titulo: "Trata: llamar a la línea 0800 800 TRATA", detalle: "Gratuita y confidencial." },
        { titulo: "Informar de inmediato a Supervisión" },
        { titulo: "Registrar en actas" },
        { titulo: "Sostener y seguir la trayectoria escolar" },
      ],
      avisar: ["COPRETI", "Línea Trata", "Supervisión"],
      registrar: "Actas.",
      telefonos: ["COPRETI 261-4413312 · copreti@mendoza.gov.ar", "0800 800 87282 (TRATA)"],
    },
    {
      id: "paradero",
      titulo: "Se desconoce el paradero del estudiante",
      pasos: [
        {
          titulo: "Orientar a la familia a denunciar «Averiguación de paradero»",
          detalle: "En la Fiscalía más cercana. No hace falta esperar 24 horas.",
        },
        { titulo: "Si la familia no denuncia, denuncia la dirección o el SOE" },
        { titulo: "Contener a compañeros y familiares" },
      ],
      avisar: ["Familia", "Fiscalía", "SOE"],
    },
  ],
};

const BULLYING: GuiaProtocolo = {
  titulo: "Protocolo de Bullying · Ocho pasos",
  resumen:
    "La persona encargada sigue los ocho pasos. Intervenciones en privado, confidencialidad y legajo del caso con Hoja de Registro.",
  documentos: ["/normativa/protocolo-bullying-anexo-i.pdf"],
  situaciones: [
    {
      id: "bullying",
      titulo: "Intervención ante sospecha de acoso escolar",
      pasos: [
        {
          titulo: "1 · Identificar el caso",
          detalle: "¿Desequilibrio de poder? ¿Repetición? ¿Intención de dañar? ¿Cambios en la víctima? ¿Ciberacoso?",
        },
        { titulo: "2 · Documentar", detalle: "Hoja de Registro de Caso, informar al SOE y abrir legajo." },
        {
          titulo: "3 · Entrevistas por separado (máx. 5 días)",
          detalle: "Estudiante acosado, quien acosa y testigos. Memorando de cada reunión.",
        },
        {
          titulo: "4 · Entrevistas con las familias",
          detalle: "En días u horarios distintos, al menos dos integrantes de la escuela. Memorando firmado.",
        },
        { titulo: "5 · Plan de acción inmediato", detalle: "Supervisión de recreos, pasillos, baños y chats escolares." },
        { titulo: "6 · Seguimiento cada 15 días", detalle: "Plantilla de Seguimiento de Caso." },
        {
          titulo: "7 · Evaluar gravedad",
          detalle:
            "Leve / Moderado: plan escolar en 15-30 días. Grave / Muy grave: dirección y SOE de inmediato, denuncia a ETI, Asesora de Menores y Fiscalía si corresponde.",
        },
        { titulo: "8 · Cierre", detalle: "Con la dirección; fecha de cierre y resumen en la Hoja de Registro." },
      ],
      avisar: ["SOE", "Familias", "Dirección", "ETI / Asesora (grave)"],
      registrar: "Hoja de Registro, memorandos y Plantilla de Seguimiento.",
      evitar: [
        "Minimizar («son cosas de chicos») o culpar a quien sufre el acoso.",
        "Revelar la identidad de quien sufre el acoso o de quien lo informó.",
        "Enfrentar a las partes, aplicar mediación o forzar disculpas.",
        "Reunir a ambas familias en el mismo encuentro.",
      ],
    },
  ],
};

const AMENAZAS: GuiaProtocolo = {
  titulo: "Amenazas de intimidación pública y retos virales",
  resumen:
    "No paralizar la actividad: mantener la presencialidad con seguridad reforzada y trazabilidad. Ante dudas, consultar a Dirección o al SOE.",
  documentos: ["/normativa/protocolo-amenazas-intimidacion-publica.jpeg"],
  situaciones: [
    {
      id: "amenazas",
      titulo: "Hallazgo de una amenaza",
      pasos: [
        { titulo: "Llamar al 911", detalle: "Toda amenaza a la integridad física se reporta al sistema de emergencias." },
        { titulo: "Avisar al superior jerárquico", detalle: "DAE, Supervisión y Dirección de Nivel." },
        {
          titulo: "Preservar la evidencia",
          detalle: "Fotografiar el mensaje para la denuncia judicial y luego eliminarlo para evitar la viralización.",
        },
        {
          titulo: "Comunicado oficial a las familias",
          detalle: "Transmitir previsibilidad. No replicar el texto de la amenaza.",
        },
        {
          titulo: "Abordaje del SOE",
          detalle: "Primeros auxilios psicológicos, desescalada grupal en las aulas y expresión emocional.",
        },
        { titulo: "Articulación territorial", detalle: "Avisar a las escuelas primarias de la zona para unificar el discurso." },
      ],
      avisar: ["911", "DAE / Supervisión", "Familias", "SOE"],
      registrar: "Registro fotográfico de la evidencia y acta.",
      evitar: [
        "Difundir la situación en redes sociales personales.",
        "Replicar el texto de la amenaza en el comunicado.",
      ],
    },
    {
      id: "prevencion",
      titulo: "Prevención y detección temprana",
      pasos: [
        { titulo: "Inspección previa", detalle: "Revisar baños, aulas y espacios comunes; ante algo sospechoso, preservar y avisar." },
        { titulo: "Entornos de cuidado", detalle: "Presencia adulta en espacios comunes y sanitarios." },
        { titulo: "Gestión de pertenencias", detalle: "Excepcionalmente, asistir solo con carpeta y cartuchera." },
      ],
    },
  ],
};

const AMBULANCIA: GuiaProtocolo = {
  titulo: "Emergencias en la escuela · 911 (Res. 214/2026)",
  resumen: "Ante la duda razonable y signos de alarma, priorizar la seguridad y activar el 911.",
  documentos: ["/normativa/resolucion-214-2026-protocolo-emergencias-911.pdf"],
  situaciones: [
    {
      id: "flujograma",
      titulo: "Flujograma oficial",
      pasos: [
        { titulo: "1 · Detección y evaluación", detalle: "Evaluación inicial rápida (ABCD de primeros auxilios)." },
        {
          titulo: "2 · ¿Signos de alarma?",
          detalle:
            "Dificultad respiratoria, inconsciencia, convulsión, sangrado abundante, dolor de pecho. SÍ: 911. NO: observación y comunicación.",
        },
        {
          titulo: "3 · Llamada al 911",
          detalle: "Quién llama (nombre y cargo), dirección exacta, qué pasó y edad, ¿está consciente?, ¿respira?",
        },
        {
          titulo: "4 · Asistencia y espera",
          detalle: "Primeros auxilios básicos. No abandonar ni trasladar por medios propios. Seguir al operador.",
        },
        {
          titulo: "5 · Recepción y cierre",
          detalle: "Guiar a la ambulancia, informar lo sucedido y labrar acta con fecha, hora y detalle.",
        },
      ],
      avisar: ["911", "Familia", "Equipo directivo"],
      registrar: "Acta institucional con fecha, hora y procedimiento.",
    },
    {
      id: "criterios",
      titulo: "¿Cuándo corresponde el 911?",
      pasos: [
        {
          titulo: "Emergencia: 911 inmediato",
          detalle:
            "Compromiso respiratorio, pérdida de conciencia, convulsiones, hemorragia que no cede, dolor torácico, trauma grave, shock, anafilaxia, intoxicación, autolesión activa.",
        },
        {
          titulo: "Urgencia: vigilar, 911 solo si empeora",
          detalle: "Fiebre, dolor abdominal leve, caídas menores, vómitos aislados, cefalea, ansiedad sin riesgo.",
        },
        {
          titulo: "No emergencia: no llamar",
          detalle: "Controles, malestares leves, raspones o hematomas, situaciones disciplinarias.",
        },
      ],
    },
  ],
};

/** Guía según la causa elegida en una actuación de tipo Protocolo. */
export function guiaProtocolo(causa: string): GuiaProtocolo | null {
  switch (causa) {
    case "Dec. 1187":
      return DEC_1187;
    case "Bullying":
      return BULLYING;
    case "Amenazas virales":
    case "Amenazas de intimidación pública":
      return AMENAZAS;
    case "Protocolo de ambulancia":
      return AMBULANCIA;
    default:
      return null;
  }
}

export function documentoNormativo(archivo: string): DocumentoNormativo | undefined {
  return NORMATIVA.find((d) => d.archivo === archivo);
}
