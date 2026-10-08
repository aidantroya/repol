/**
 * Detector inteligente de metadatos académicos para documentos de la ESPOL en RePol.
 * 
 * Analiza en 2 etapas con alta precisión:
 * 1. Etapa 1: Análisis del Encabezado / Primera Página / Mitad Superior del documento (PDF / DOCX).
 * 2. Etapa 2: Análisis del Nombre de Archivo y Cuerpo Completo (para soluciones globales).
 * 
 * Tolera diacríticos sueltos de LaTeX, mayúsculas/minúsculas, tildes, números pegados,
 * ordinales (1ra, 2da, 3ra, 1er, 2do, 3er, I, II, III), códigos ESPOL y alias de materias.
 * 
 * Reglas de calendario académico ESPOL:
 * - PAE (Extraordinario / Intensivo / Verano / III Término): Marzo - Abril
 * - 1PAO (Primer Término): Mayo - Septiembre
 *   - 1ra Eval (Parcial): Junio / Julio | 2da Eval (Final): Agosto | 3ra Eval (Mejoramiento): Septiembre
 * - 2PAO (Segundo Término): Octubre - Febrero (cruza fin de año)
 *   - 1ra Eval (Parcial): Noviembre | 2da Eval (Final): Enero | 3ra Eval (Mejoramiento): Febrero
 */

export interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

export interface DetectedDocumentMetadata {
  subjectId?: string;
  subjectName?: string;
  subjectCode?: string;
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA";
  subcategory: string;
  periodYear: string; // "2024", "2025", "S/F"
  periodTerm: "1PAO" | "2PAO" | "PAE";
  isSolution: boolean;
  suggestedTitle: string;
  confidence: {
    subject: boolean;
    category: boolean;
    periodYear: boolean;
    periodTerm: boolean;
    isSolution: boolean;
  };
}

/**
 * Limpia y une diacríticos tipográficos de LaTeX (ej. 'soluci ´on' -> 'solucion', 'a˜no' -> 'ano', 'c´alculo' -> 'calculo')
 */
export function cleanLatexAccents(str: string): string {
  if (!str) return "";
  return str
    .replace(/([a-zA-Z])\s*[\u00b4\u0060\'\^~˜\u02DC\u0300-\u036f]\s*([a-zA-Z])/g, "$1$2")
    .replace(/[\u00b4\u0060\'\^~˜\u02DC]/g, " ");
}

/**
 * Normaliza cadenas para comparación fonética y semántica ultra-robusta:
 * - Limpia artefactos y tildes LaTeX
 * - Convierte a minúsculas
 * - Remueve tildes y diacríticos (á->a, é->e, etc.)
 * - Separa letras y números pegados (ej. 'leccion1' -> 'leccion 1', '1pao' -> '1 pao', 'quiz2' -> 'quiz 2')
 * - Reemplaza signos de puntuación por espacios simples
 */
export function normalizeString(str: string): string {
  if (!str) return "";
  return cleanLatexAccents(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
    .replace(/([a-z])([0-9])/g, "$1 $2") // Separa letras de números pegados ej: leccion1 -> leccion 1
    .replace(/([0-9])([a-z])/g, "$1 $2") // Separa números de letras pegadas ej: 1pao -> 1 pao
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta si el documento contiene la solución / solucionario / respuestas / rúbrica.
 * Busca tanto en encabezados como en el contenido de las preguntas y ejercicios.
 */
export function detectIsSolution(combinedText: string): boolean {
  if (!combinedText) return false;

  // Remover el Compromiso de Honor estándar de la ESPOL para no confundir frases como:
  // "diseñado para ser resuelto de manera individual" o "ajeno al desarrollo del examen"
  const textWithoutHonorPledge = combinedText.replace(
    /compromiso de honor[\s\S]*?(?:firmo|firmarlo|copiar|mediocridad)/gi,
    " "
  );

  const norm = normalizeString(textWithoutHonorPledge);

  // 1. Palabras clave explícitas de solución
  const solutionKeywords = /\b(?:solucion|soluciones|solucionario|solucionarios|rubrica|rubricas|pauta|pautas|pauta de correccion|clave de respuestas|hoja de respuestas|respuestas correctas|banco de respuestas|resolucion|resoluciones|solution manual|answer key|marking scheme)\b/;
  if (solutionKeywords.test(norm)) {
    return true;
  }

  // 2. Patrones de preguntas resueltas (ej. "Sol:", "Solución:", "Rpta:", "Rta:", "Ans:")
  const answerHeaderPattern = /(?:\bsol\s*[:\.\-]|solucion\s*[:\.\-]|rpta\s*[:\.\-]|rta\s*[:\.\-]|ans\s*[:\.\-]|resp\s*[:\.\-])/i;
  if (answerHeaderPattern.test(textWithoutHonorPledge)) {
    return true;
  }

  // 3. Patrones con diacríticos LaTeX o espaciado irregular
  if (/\b(?:soluci\s*on|soluci\s*onario|r\s*ubrica|resoluci\s*on)\b/.test(norm)) {
    return true;
  }

  return false;
}

/**
 * Genera un título limpio y estandarizado para Exámenes, Lecciones y Talleres.
 * Para Clases y Tareas preserva el nombre descriptivo original.
 */
/**
 * Formatea un título agregando el sufijo de versión `(v2)`, `(v3)`, etc.
 * Si el título ya contiene `(Solución)`, ubica la versión antes del indicador de solución.
 * Para versiones <= 1, devuelve el título sin etiqueta de versión.
 */
export function formatVersionedTitle(baseTitle: string, versionNumber: number): string {
  if (!baseTitle) return "";
  if (versionNumber <= 1) return baseTitle;

  // Remover cualquier sufijo de versión previo (ej: (v2), (v3))
  let cleanTitle = baseTitle.replace(/\s*\(v\d+\)/gi, "").trim();

  // Verificar si tiene sufijo de solución al final
  const isSol = /\(soluci[oó]n\)$/i.test(cleanTitle);
  if (isSol) {
    cleanTitle = cleanTitle.replace(/\s*\(soluci[oó]n\)$/i, "").trim();
    return `${cleanTitle} (v${versionNumber}) (Solución)`;
  }

  return `${cleanTitle} (v${versionNumber})`;
}

/**
 * Extrae el número de versión de un título (ej: "Lección 1 2024 1PAO (v2)" -> 2).
 * Si no contiene versión explícita, retorna 1.
 */
export function extractVersionFromTitle(title: string): number {
  if (!title) return 1;
  const match = title.match(/\(v(\d+)\)/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return isNaN(num) || num < 1 ? 1 : num;
  }
  return 1;
}

/**
 * Genera un título limpio y estandarizado para Exámenes, Lecciones y Talleres.
 * Para Clases y Tareas preserva el nombre descriptivo original.
 * Soporta versionamiento opcional para lecciones y talleres (v2, v3, etc.).
 */
export function generateCleanDocumentTitle(metadata: {
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA";
  subcategory: string;
  periodYear: string;
  periodTerm: string;
  isSolution: boolean;
  version?: number;
  originalFilename?: string;
}): string {
  const isSol = metadata.isSolution;
  const solSuffix = isSol ? " (Solución)" : "";
  const yearStr =
    metadata.periodYear && metadata.periodYear !== "S/F" && metadata.periodYear !== "0"
      ? metadata.periodYear
      : "";
  const termStr = metadata.periodTerm || "1PAO";
  const periodTag = yearStr ? (termStr ? ` ${yearStr} ${termStr}` : ` ${yearStr}`) : "";
  const versionNum = metadata.version || 1;

  if (metadata.category === "EXAMEN") {
    let examName = "Examen Parcial";
    if (metadata.subcategory === "Final") examName = "Examen Final";
    else if (metadata.subcategory === "Mejoramiento") examName = "Examen de Mejoramiento";
    else if (metadata.subcategory && metadata.subcategory !== "Otro") examName = `Examen ${metadata.subcategory}`;

    return `${examName}${periodTag}${solSuffix}`.trim();
  }

  if (metadata.category === "LECCION") {
    const sub = metadata.subcategory && metadata.subcategory !== "Otro" ? metadata.subcategory : "Lección";
    const base = `${sub}${periodTag}${solSuffix}`.trim();
    return formatVersionedTitle(base, versionNum);
  }

  if (metadata.category === "TALLER") {
    const sub = metadata.subcategory && metadata.subcategory !== "Otro" ? metadata.subcategory : "Taller";
    const base = `${sub}${periodTag}${solSuffix}`.trim();
    return formatVersionedTitle(base, versionNum);
  }

  // Para CLASE y TAREA (Material de Entrenamiento):
  // No imponer un nombre genérico para permitir que descripciones específicas se mantengan
  const cleanOriginal = (metadata.originalFilename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const base = cleanOriginal || `${metadata.subcategory || "Documento"}${periodTag}${solSuffix}`.trim();
  return formatVersionedTitle(base, versionNum);
}

/**
 * Detecta la categoría y subcategoría a partir de texto (encabezado o nombre de archivo).
 * Maneja todas las variaciones posibles de ordinales, números romanos, nombres y sinónimos.
 */
export function detectCategoryAndSubcategory(
  combinedText: string,
  isFilename = false
): { category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA"; subcategory: string; detected: boolean } {
  if (!combinedText) {
    return { category: "EXAMEN", subcategory: "Parcial", detected: false };
  }

  const norm = normalizeString(combinedText);
  const isShortText = isFilename || combinedText.length < 80;

  // =========================================================================
  // 1. EXÁMENES Y EVALUACIONES FORMALES (Prioridad principal en documentos oficiales ESPOL)
  // =========================================================================

  // A) MEJORAMIENTO / 3RA EVALUACIÓN / 3E / RECUPERACIÓN / GRACIA
  const isMejoramientoExplicit =
    /\b(?:evaluacion|eval|examen|parcial)\s*[:\.\-]?\s*(?:tercera|tercer|tercero|3\s*ra|3\s*era|3\s*er|3\s*ro|3\s*a|3\s*p|3|iii|mejoramiento|recuperacion|gracia|supletorio)\b/.test(norm) ||
    /\b(?:mejoramiento|mejora|recuperacion|gracia|supletorio|remedial|subsanacion|makeup exam|improvement exam|third exam|evaluacion\s*3\s*p|examen\s*3\s*p|eval\s*3\s*p)\b/.test(norm) ||
    /(?:\b(?:tercera|tercer|tercero|3\s*ra|3\s*era|3\s*er|3\s*ro|3\s*a|3\s*p|iii)\s*(?:evaluacion|eval|examen|parcial)\b)/.test(norm) ||
    /(?:\b(?:evaluacion|eval|examen|parcial)\s*(?:de\s+|del\s+)?(?:tercera|tercer|tercero|3\s*ra|3\s*era|3\s*er|3\s*ro|3\s*a|3\s*p|iii)\b)/.test(norm) ||
    /\b(?:3\s*e|e\s*3|3\s*p|p\s*3|3\s*er\s*p|3\s*ro\s*p|3\s*era\s*p|parcial\s*3|parcial\s*iii|evaluacion\s*3|evaluacion\s*iii|eval\s*3|eval\s*iii|examen\s*3|examen\s*iii)\b/.test(norm);

  if (isMejoramientoExplicit) {
    return { category: "EXAMEN", subcategory: "Mejoramiento", detected: true };
  }

  // B) FINAL / 2DA EVALUACIÓN / 2E / 2DO PARCIAL
  const isFinalExplicit =
    /\b(?:evaluacion|eval|examen|parcial)\s*[:\.\-]?\s*(?:segunda|segundo|2\s*da|2\s*nda|2\s*do|2\s*a|2\s*p|2|ii|final)\b/.test(norm) ||
    /\b(?:final|examen final|evaluacion final|ex final|eval final|final exam|second exam|segundo parcial|2\s*do\s+parcial|evaluacion\s*2\s*p|examen\s*2\s*p|eval\s*2\s*p)\b/.test(norm) ||
    /(?:\b(?:segunda|segundo|2\s*da|2\s*nda|2\s*do|2\s*a|2\s*p|ii)\s*(?:evaluacion|eval|examen|parcial)\b)/.test(norm) ||
    /(?:\b(?:evaluacion|eval|examen|parcial)\s*(?:de\s+|del\s+)?(?:segunda|segundo|2\s*da|2\s*nda|2\s*do|2\s*a|2\s*p|ii)\b)/.test(norm) ||
    /\b(?:2\s*e|e\s*2|2\s*p|p\s*2|2\s*do\s*p|2\s*da\s*p|2\s*nda\s*p|parcial\s*2|parcial\s*ii|evaluacion\s*2|evaluacion\s*ii|eval\s*2|eval\s*ii|examen\s*2|examen\s*ii)\b/.test(norm);

  if (isFinalExplicit) {
    return { category: "EXAMEN", subcategory: "Final", detected: true };
  }

  // C) PARCIAL / 1RA EVALUACIÓN / 1E / 1ER PARCIAL / 1P
  const isParcialExplicit =
    /\b(?:evaluacion|eval|examen|parcial)\s*[:\.\-]?\s*(?:primera|primer|primero|1\s*ra|1\s*era|1\s*er|1\s*ro|1\s*a|1\s*p|1|i|parcial)\b/.test(norm) ||
    /\b(?:parcial|primer parcial|1\s*er\s+parcial|1\s*ro\s+parcial|midterm|first exam|primer examen|1\s*er\s+examen|evaluacion\s*1\s*p|examen\s*1\s*p|eval\s*1\s*p)\b/.test(norm) ||
    /(?:\b(?:primera|primer|primero|1\s*ra|1\s*era|1\s*er|1\s*ro|1\s*a|1\s*p|i)\s*(?:evaluacion|eval|examen|parcial)\b)/.test(norm) ||
    /(?:\b(?:evaluacion|eval|examen|parcial)\s*(?:de\s+|del\s+)?(?:primera|primer|primero|1\s*ra|1\s*era|1\s*er|1\s*ro|1\s*a|1\s*p|i)\b)/.test(norm) ||
    /\b(?:1\s*e|e\s*1|1\s*p|p\s*1|1\s*er\s*p|1\s*ra\s*p|parcial\s*1|parcial\s*i|evaluacion\s*1|evaluacion\s*i|eval\s*1|eval\s*i|examen\s*1|examen\s*i)\b/.test(norm);

  if (isParcialExplicit) {
    return { category: "EXAMEN", subcategory: "Parcial", detected: true };
  }

  // =========================================================================
  // 2. LECCIONES (Lección 1, 2, 3, 4, Quiz 1-4, Control de Lectura 1-4)
  // =========================================================================
  const isLeccionKeyword = /\b(?:leccion|lecciones|lecc|lec|quiz|quizzes|control de lectura|prueba corta|short test|test corto)\b/.test(norm);
  const isLShort = isShortText && /\b(?:l\s*[1-4]|q\s*[1-4])\b/.test(norm);

  if (isLeccionKeyword || isLShort) {
    // Lección 4 / Quiz 4 / Cuarta Lección
    if (
      /\b(?:leccion\s*(?:4|iv|cuatro)|lec\s*4|lecc\s*4|quiz\s*(?:4|iv)|cuarta\s+leccion|4\s*ta\s+leccion|4\s*ra\s+leccion|4\s*a\s+leccion|cuarto\s+quiz|4\s*to\s+quiz|control\s*(?:4|iv)|prueba\s*4)\b/.test(norm) ||
      (isShortText && /\b(?:l\s*4|4\s*l|q\s*4|4\s*q)\b/.test(norm))
    ) {
      return { category: "LECCION", subcategory: "Lección 4", detected: true };
    }
    // Lección 3 / Quiz 3 / Tercera Lección
    if (
      /\b(?:leccion\s*(?:3|iii|tres)|lec\s*3|lecc\s*3|quiz\s*(?:3|iii)|tercera\s+leccion|3\s*ra\s+leccion|3\s*era\s+leccion|3\s*a\s+leccion|tercer\s+quiz|3\s*er\s+quiz|control\s*(?:3|iii)|prueba\s*3)\b/.test(norm) ||
      (isShortText && /\b(?:l\s*3|3\s*l|q\s*3|3\s*q)\b/.test(norm))
    ) {
      return { category: "LECCION", subcategory: "Lección 3", detected: true };
    }
    // Lección 2 / Quiz 2 / Segunda Lección
    if (
      /\b(?:leccion\s*(?:2|ii|dos)|lec\s*2|lecc\s*2|quiz\s*(?:2|ii)|segunda\s+leccion|2\s*da\s+leccion|2\s*nda\s+leccion|2\s*a\s+leccion|segundo\s+quiz|2\s*do\s+quiz|control\s*(?:2|ii)|prueba\s*2)\b/.test(norm) ||
      (isShortText && /\b(?:l\s*2|2\s*l|q\s*2|2\s*q)\b/.test(norm))
    ) {
      return { category: "LECCION", subcategory: "Lección 2", detected: true };
    }
    // Lección 1 / Quiz 1 / Primera Lección
    if (
      /\b(?:leccion\s*(?:1|i|uno|primera)|lec\s*1|lecc\s*1|quiz\s*(?:1|i)|primera\s+leccion|1\s*ra\s+leccion|1\s*era\s+leccion|1\s*er\s+leccion|1\s*a\s+leccion|primer\s+quiz|1\s*er\s+quiz|control\s*(?:1|i)|prueba\s*1)\b/.test(norm) ||
      (isShortText && /\b(?:l\s*1|1\s*l|q\s*1|1\s*q)\b/.test(norm))
    ) {
      return { category: "LECCION", subcategory: "Lección 1", detected: true };
    }

    // Solo si el texto es corto (nombre de archivo tipo "leccion.pdf") asignamos Lección 1
    if (isShortText) {
      return { category: "LECCION", subcategory: "Lección 1", detected: true };
    }
  }

  // =========================================================================
  // 3. TALLERES (Taller 1, 2, 3, 4, Workshop, Actividad Grupal)
  // =========================================================================
  const isTallerKeyword = /\b(?:taller|talleres|tall|workshop|workshops|actividad grupal|trabajo en clase)\b/.test(norm);
  const isTShort = isShortText && /\b(?:t\s*[1-4]|w\s*[1-4])\b/.test(norm);

  if (isTallerKeyword || isTShort) {
    // Taller 4 / Cuarto Taller
    if (
      /\b(?:taller\s*(?:4|iv|cuatro)|tall\s*4|workshop\s*4|cuarto\s+taller|4\s*to\s+taller|4\s*a\s+taller|4\s*ta\s+taller)\b/.test(norm) ||
      (isShortText && /\b(?:t\s*4|4\s*t|w\s*4|4\s*w)\b/.test(norm))
    ) {
      return { category: "TALLER", subcategory: "Taller 4", detected: true };
    }
    // Taller 3 / Tercer Taller
    if (
      /\b(?:taller\s*(?:3|iii|tres)|tall\s*3|workshop\s*3|tercer\s+taller|3\s*er\s+taller|3\s*ra\s+taller|3\s*era\s+taller|3\s*a\s+taller)\b/.test(norm) ||
      (isShortText && /\b(?:t\s*3|3\s*t|w\s*3|3\s*w)\b/.test(norm))
    ) {
      return { category: "TALLER", subcategory: "Taller 3", detected: true };
    }
    // Taller 2 / Segundo Taller
    if (
      /\b(?:taller\s*(?:2|ii|dos)|tall\s*2|workshop\s*2|segundo\s+taller|2\s*do\s+taller|2\s*da\s+taller|2\s*a\s+taller)\b/.test(norm) ||
      (isShortText && /\b(?:t\s*2|2\s*t|w\s*2|2\s*w)\b/.test(norm))
    ) {
      return { category: "TALLER", subcategory: "Taller 2", detected: true };
    }
    // Taller 1 / Primer Taller
    if (
      /\b(?:taller\s*(?:1|i|uno|primer)|tall\s*1|workshop\s*1|primer\s+taller|1\s*er\s+taller|1\s*ro\s+taller|1\s*ra\s+taller|1\s*a\s+taller)\b/.test(norm) ||
      (isShortText && /\b(?:t\s*1|1\s*t|w\s*1|1\s*w)\b/.test(norm))
    ) {
      return { category: "TALLER", subcategory: "Taller 1", detected: true };
    }

    if (isShortText) {
      return { category: "TALLER", subcategory: "Taller 1", detected: true };
    }
  }

  // =========================================================================
  // 4. EXAMEN GENÉRICO CON INFERENCIA POR CALENDARIO ACADÉMICO ESPOL
  // =========================================================================
  const isGenericExam = /\b(?:examen|evaluacion|compromiso de honor)\b/.test(norm);
  if (isGenericExam) {
    if (/\b(?:septiembre|setiembre|febrero)\b/.test(norm)) {
      return { category: "EXAMEN", subcategory: "Mejoramiento", detected: true };
    }
    if (/\b(?:agosto|enero)\b/.test(norm)) {
      return { category: "EXAMEN", subcategory: "Final", detected: true };
    }
    if (/\b(?:junio|julio|noviembre|diciembre)\b/.test(norm)) {
      return { category: "EXAMEN", subcategory: "Parcial", detected: true };
    }
    return { category: "EXAMEN", subcategory: "Parcial", detected: true };
  }

  // =========================================================================
  // 4. MATERIAL DE ENTRENAMIENTO / TAREAS (Guías, Deberes, Labs, Problem Sets)
  // =========================================================================
  if (
    /\b(?:tarea|tareas|deber|deberes|homework|hw|asignacion|assignment|guia de problemas|guia de ejercicios|guia de estudio|guia practica|guia de practica|guia de trabajo|problemas propuestos|problemas resueltos|ejercicios propuestos|ejercicios extras|ejercicios de refuerzo|ejercicios adicionales|ejercicios tipo examen|banco de preguntas|banco de ejercicios|problem set|problemset|pset|hoja de trabajo|hoja de ejercicios|worksheet|laboratorio|lab|practica de laboratorio|informe)\b/.test(
      norm
    )
  ) {
    if (
      /\b(?:guia de problemas|guia de ejercicios|guia de estudio|guia practica|guia de practica|guia de trabajo|problemas propuestos|problemas resueltos|ejercicios propuestos|banco de preguntas|banco de ejercicios|problem set|problemset|pset|hoja de trabajo|hoja de ejercicios|worksheet)\b/.test(
        norm
      )
    ) {
      return { category: "TAREA", subcategory: "Guía de Problemas", detected: true };
    }
    if (
      /\b(?:ejercicios extras|ejercicios de refuerzo|ejercicios adicionales|ejercicios tipo examen|practica adicional|problemas adicionales)\b/.test(
        norm
      )
    ) {
      return { category: "TAREA", subcategory: "Ejercicios Extras", detected: true };
    }
    return { category: "TAREA", subcategory: "Tareas", detected: true };
  }

  // =========================================================================
  // 5. CLASES Y APUNTES (Diapositivas, Apuntes de Clase, Guía Teórica, Formulario)
  // =========================================================================
  if (/\b(?:diapositiva|diapositivas|slide|slides|presentacion|presentaciones|ppt|pptx|powerpoint|diapo|diapos)\b/.test(norm)) {
    return { category: "CLASE", subcategory: "Diapositivas", detected: true };
  }
  if (/\b(?:formulario|formulario oficial|formulario teorico|syllabus|silabo|manual|libro|compendio|guia teorica)\b/.test(norm)) {
    return { category: "CLASE", subcategory: "Guía Teórica", detected: true };
  }
  if (/\b(?:apuntes|apunte|apuntes de clase|notas de clase|lecture notes|cuaderno|resumen|resumenes|clase|teoria)\b/.test(norm)) {
    return { category: "CLASE", subcategory: "Apuntes de Clase", detected: true };
  }

  // Por defecto (si no se encuentra coincidencia clara)
  return { category: "EXAMEN", subcategory: "Parcial", detected: false };
}


/**
 * Detecta el término académico (1PAO, 2PAO, PAE) por términos oficiales, abreviaturas y meses de calendario ESPOL.
 */
export function detectPeriodTerm(combinedText: string): { term: "1PAO" | "2PAO" | "PAE"; detected: boolean } {
  if (!combinedText) {
    return { term: "1PAO", detected: false };
  }

  const norm = normalizeString(combinedText);

  // 1. Detección explícita de 1PAO / 1er Término / 1T / I Término / I Semestre
  if (
    /\b(?:1\s*pao|i\s*pao|1\s*t|i\s*t|t\s*1|t\s*i)\b/.test(norm) ||
    /\b(?:termino|termtno)\s+(?:1|i|uno)\b/.test(norm) ||
    /\b(?:1\s*er|1\s*ro|primer|primero|i)\s+(?:termino|termtno|periodo|semestre|pao)\b/.test(norm) ||
    /\b(?:periodo|termino)\s*[:\.\-]?\s*(?:primer|primero|1\s*er|1\s*ro|1|i|uno)\b/.test(norm) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:1|i|1pao|1t)\b/i.test(combinedText)
  ) {
    return { term: "1PAO", detected: true };
  }

  // 2. Detección explícita de 2PAO / 2do Término / 2T / II Término / II Semestre
  if (
    /\b(?:2\s*pao|ii\s*pao|2\s*t|ii\s*t|t\s*2|t\s*ii)\b/.test(norm) ||
    /\b(?:termino|termtno)\s+(?:2|ii|dos)\b/.test(norm) ||
    /\b(?:2\s*do|2\s*da|segundo|ii)\s+(?:termino|termtno|periodo|semestre|pao)\b/.test(norm) ||
    /\b(?:periodo|termino)\s*[:\.\-]?\s*(?:segundo|2\s*do|2\s*da|2|ii|dos)\b/.test(norm) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:2|ii|2pao|2t)\b/i.test(combinedText)
  ) {
    return { term: "2PAO", detected: true };
  }

  // 3. Detección explícita de PAE / 3PAO / 3er Término / 3T / Extraordinario / Verano / Intensivo
  if (
    /\b(?:pae|p\s*a\s*e|intensivo|extraordinario|verano)\b/.test(norm) ||
    /\b(?:3\s*pao|iii\s*pao|3\s*t|iii\s*t|t\s*3|t\s*iii)\b/.test(norm) ||
    /\b(?:termino|termtno)\s+(?:3|iii|tres|tercero?)\b/.test(norm) ||
    /\b(?:3\s*er|3\s*ro|tercer|tercero|iii)\s+(?:termino|termtno|periodo|semestre|pao)\b/.test(norm) ||
    /\b(?:periodo|termino)\s*[:\.\-]?\s*(?:tercer|tercero|3\s*er|3\s*ro|3|iii|tres|extraordinario|pae)\b/.test(norm) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:3|iii|pae|3t)\b/i.test(combinedText)
  ) {
    return { term: "PAE", detected: true };
  }

  // 4. Formato postfijo secundario ("pao 1", "pao 2", "pao 3")
  if (/\bpao\s*(?:1|i|uno)\b/.test(norm)) return { term: "1PAO", detected: true };
  if (/\bpao\s*(?:2|ii|dos)\b/.test(norm)) return { term: "2PAO", detected: true };
  if (/\bpao\s*(?:3|iii|tres)\b/.test(norm)) return { term: "PAE", detected: true };

  // 5. Detección por meses del calendario académico ESPOL
  // PAE: Marzo, Abril
  if (/\b(?:marzo|abril)\b/.test(norm)) {
    return { term: "PAE", detected: true };
  }

  // 1PAO: Mayo, Junio, Julio, Agosto, Septiembre
  if (/\b(?:mayo|junio|julio|agosto|septiembre|setiembre)\b/.test(norm)) {
    return { term: "1PAO", detected: true };
  }

  // 2PAO: Octubre, Noviembre, Diciembre, Enero, Febrero
  if (/\b(?:octubre|noviembre|diciembre|enero|febrero)\b/.test(norm)) {
    return { term: "2PAO", detected: true };
  }

  // 3. Detección por fecha numérica DD/MM/YYYY o YYYY-MM-DD
  const dateNumMatch = combinedText.match(
    /(?:[0-3]?\d[\/\-\.]([0-1]?\d)[\/\-\.](?:19|20)\d\d)|(?:(?:19|20)\d\d[\/\-\.]([0-1]?\d)[\/\-\.][0-3]?\d)/
  );
  if (dateNumMatch) {
    const monthNum = parseInt(dateNumMatch[1] || dateNumMatch[2], 10);
    if (monthNum >= 3 && monthNum <= 4) return { term: "PAE", detected: true };
    if (monthNum >= 5 && monthNum <= 9) return { term: "1PAO", detected: true };
    if (monthNum >= 10 || monthNum <= 2) return { term: "2PAO", detected: true };
  }

  return { term: "1PAO", detected: false };
}

/**
 * Detecta el año académico del documento (ej. 2024, 2025, 2026, o "S/F") con scoring contextual.
 */
export function detectPeriodYear(combinedText: string): { year: string; detected: boolean } {
  if (!combinedText) {
    return { year: "S/F", detected: false };
  }

  // 1. Rangos de año como "2024-2025", "2024 - 2025", "2024/2025" -> tomar el año base de inicio
  const rangeMatch = combinedText.match(/\b(19\d\d|20\d\d)\s*[\-\/]\s*(19\d\d|20\d\d)\b/);
  if (rangeMatch) {
    const firstYear = parseInt(rangeMatch[1], 10);
    if (firstYear >= 1995 && firstYear <= new Date().getFullYear() + 2) {
      return { year: String(firstYear), detected: true };
    }
  }

  // 2. Coincidencias específicas cercanas a palabras clave de encabezado ESPOL
  const headerYearMatch = combinedText.match(
    /\b(?:periodo|ano|año|fecha|pao|termino|semestre|espol|evaluacion|examen|leccion|taller)\s*(?:y\s*(?:ano|año))?\s*[:\s\-]*.*?\b(19\d\d|20[0-3]\d)\b/i
  );
  if (headerYearMatch) {
    const y = parseInt(headerYearMatch[1], 10);
    if (y >= 1995 && y <= new Date().getFullYear() + 2) {
      return { year: String(y), detected: true };
    }
  }

  // 3. Años de 4 dígitos entre 1995 y el año futuro inmediato
  const yearMatches = Array.from(combinedText.matchAll(/\b(199\d|20[0-3]\d)\b/g)).map((m) =>
    parseInt(m[1], 10)
  );

  if (yearMatches.length > 0) {
    const currentYear = new Date().getFullYear();
    const validYears = yearMatches.filter((y) => y >= 1995 && y <= currentYear + 2);
    if (validYears.length > 0) {
      return { year: String(validYears[0]), detected: true };
    }
    return { year: String(yearMatches[0]), detected: true };
  }

  return { year: "S/F", detected: false };
}

/**
 * Detecta la materia comparando con el catálogo de materias de la ESPOL.
 * Busca tanto códigos oficiales (ej: CCPG1043, MATG1001, FISG1002) como nombres y alias frecuentes.
 */
export function detectSubject(
  combinedText: string,
  subjects: SubjectOption[]
): { subjectId?: string; subjectName?: string; subjectCode?: string; detected: boolean } {
  if (!subjects || subjects.length === 0 || !combinedText) {
    return { detected: false };
  }

  const norm = normalizeString(combinedText);
  const normNumerals = norm
    .replace(/\bviii\b/g, "8")
    .replace(/\bvii\b/g, "7")
    .replace(/\bvi\b/g, "6")
    .replace(/\biv\b/g, "4")
    .replace(/\bv\b/g, "5")
    .replace(/\biii\b/g, "3")
    .replace(/\bii\b/g, "2")
    .replace(/\bi\b/g, "1");

  // Reemplazar confusiones de OCR frecuentes en códigos (ej: CCPG1O43 -> CCPG1043, MATG1OO1 -> MATG1001)
  const upperRaw = combinedText.toUpperCase()
    .replace(/\b([A-Z]{3,4})\s*([0-9OIl]{3,5})\b/g, (_match, p1, p2) => {
      const fixedNums = p2.replace(/O/g, "0").replace(/[Il]/g, "1");
      return `${p1}${fixedNums}`;
    });

  // 1. Búsqueda por CÓDIGO OFICIAL ESPOL (ej: CCPG1043, MATG1001, FISG1002, EYAG1044, FIEC04341)
  for (const sub of subjects) {
    if (!sub.code) continue;
    const cleanCode = sub.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanCode.length >= 4) {
      // Búsqueda del código continuo
      const codeRegexContinuous = new RegExp(`\\b${cleanCode}\\b`, "i");
      if (codeRegexContinuous.test(upperRaw.replace(/[^A-Z0-9\s]/g, " "))) {
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          detected: true,
        };
      }

      // Búsqueda del código separado (ej. CCPG 1043 / EYAG 1044)
      const letters = cleanCode.replace(/[0-9]/g, "");
      const digits = cleanCode.replace(/[^0-9]/g, "");
      if (letters && digits) {
        const separatedCodeRegex = new RegExp(`\\b${letters}\\s*[-_]?\\s*${digits}\\b`, "i");
        if (separatedCodeRegex.test(upperRaw)) {
          return {
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code,
            detected: true,
          };
        }
      }
    }
  }

  // 2. Búsqueda por NOMBRE DE MATERIA EXACTO / COMPLETO (ordenado de mayor a menor longitud)
  const sortedSubjects = [...subjects].sort((a, b) => b.name.length - a.name.length);

  for (const sub of sortedSubjects) {
    const subNorm = normalizeString(sub.name);
    const subNormNumerals = subNorm
      .replace(/\bviii\b/g, "8")
      .replace(/\bvii\b/g, "7")
      .replace(/\bvi\b/g, "6")
      .replace(/\biv\b/g, "4")
      .replace(/\bv\b/g, "5")
      .replace(/\biii\b/g, "3")
      .replace(/\bii\b/g, "2")
      .replace(/\bi\b/g, "1");

    if (subNorm.length < 4) continue;

    const nameRegex = new RegExp(`\\b${subNorm}\\b`, "i");
    const nameRegexNumerals = new RegExp(`\\b${subNormNumerals}\\b`, "i");

    if (nameRegex.test(norm) || nameRegexNumerals.test(normNumerals)) {
      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        detected: true,
      };
    }
  }

  // 3. Coincidencias frecuentes con abreviaturas o nombres alternativos populares de la ESPOL
  const commonAliases: Record<string, string[]> = {
    "sistemas digitales i": ["sistemas digitales 1", "sistemas digitales i", "digitales 1", "digitales i", "sis digitales 1", "sis digitales i", "sistemas digitales"],
    "sistemas digitales ii": ["sistemas digitales 2", "sistemas digitales ii", "digitales 2", "digitales ii", "sis digitales 2", "sis digitales ii"],
    "fisica 1": ["fisica i", "fisica mecanica", "fisica para ingenieria 1", "fisica 1", "mecanica newtoniana"],
    "fisica 2": ["fisica ii", "fisica electromagnetismo", "fisica 2", "electromagnetismo", "electricidad y magnetismo"],
    "fisica 3": ["fisica iii", "fisica moderna", "fisica 3", "ondas y optica"],
    "calculo 1": ["calculo de una variable", "calculo i", "calculo diferencial", "calculo integral", "una variable"],
    "calculo 2": ["calculo vectorial", "calculo ii", "calculo multivariable", "vectorial", "multivariable"],
    "algebra lineal": ["algebra lineal", "lineal"],
    "ecuaciones diferenciales": ["ecuaciones diferenciales", "edo", "ecua dif", "ecuaciones dif"],
    "estadistica": ["estadistica inferencial", "probabilidad y estadistica", "estadistica descriptiva", "probabilidad", "estadistica 1", "estadistica i"],
    "matematicas discretas": ["matematicas discretas", "matematica discreta", "discretas", "estructuras discretas"],
    "fundamentos de programacion": ["fundamentos de programacion", "funda pro", "fundamentos programacion", "fundaprog"],
    "estructuras de datos": ["estructuras de datos", "estructura de datos", "ed"],
    "poo": ["programacion orientada a objetos", "poo", "orientada a objetos"],
    "redes": ["redes de comunicacion", "redes de computadoras", "redes"],
    "sistemas operativos": ["sistemas operativos", "so", "sist operativos"],
    "bases de datos": ["sistemas de bases de datos", "base de datos", "bases de datos", "bd"],
    "circuitos electricos": ["circuitos electricos", "circuitos 1", "circuitos i", "analisis de circuitos"],
    "electronica": ["electronica 1", "electronica i", "electronica basica", "dispositivos electronicos"],
    "quimica general": ["quimica general", "quimica 1", "quimica basica"],
  };

  for (const [aliasKey, aliasList] of Object.entries(commonAliases)) {
    for (const alias of aliasList) {
      if (norm.includes(alias) || normNumerals.includes(alias)) {
        const found = sortedSubjects.find((s) => {
          const sNorm = normalizeString(s.name);
          const sNormNum = sNorm
            .replace(/\bviii\b/g, "8")
            .replace(/\bvii\b/g, "7")
            .replace(/\bvi\b/g, "6")
            .replace(/\biv\b/g, "4")
            .replace(/\bv\b/g, "5")
            .replace(/\biii\b/g, "3")
            .replace(/\bii\b/g, "2")
            .replace(/\bi\b/g, "1");
          return (
            sNorm === aliasKey ||
            sNormNum === aliasKey ||
            sNorm.includes(aliasKey) ||
            sNormNum.includes(aliasKey) ||
            aliasList.some((a) => sNorm === a || sNormNum === a)
          );
        });
        if (found) {
          return {
            subjectId: found.id,
            subjectName: found.name,
            subjectCode: found.code,
            detected: true,
          };
        }
      }
    }
  }

  return { detected: false };
}

/**
 * Función principal que ejecuta el detector inteligente en 2 etapas:
 * 1. Primero evalúa la mitad superior / primera página del documento (PDF / DOCX).
 * 2. Si faltan datos o para corroborar, analiza el nombre de archivo y el cuerpo completo.
 */
export function detectDocumentMetadata(
  filename: string,
  rawHeaderOrDocumentText: string = "",
  subjects: SubjectOption[] = []
): DetectedDocumentMetadata {
  const cleanFilename = filename.replace(/\.[^/.]+$/, ""); // Remueve extensión

  // Tomamos una muestra de la primera página / mitad superior (hasta 3500 caracteres)
  const headerSample = (rawHeaderOrDocumentText || "").substring(0, 3500);

  // Etapa 1: Análisis del nombre del archivo
  const fileCategory = detectCategoryAndSubcategory(cleanFilename, true);
  const fileTerm = detectPeriodTerm(cleanFilename);
  const fileYear = detectPeriodYear(cleanFilename);
  const fileSubject = detectSubject(cleanFilename, subjects);

  // Etapa 2: Análisis del encabezado / primera página del documento
  const docCategory = headerSample
    ? detectCategoryAndSubcategory(headerSample, false)
    : { category: "EXAMEN" as const, subcategory: "Parcial", detected: false };
  const docTerm = headerSample
    ? detectPeriodTerm(headerSample)
    : { term: "1PAO" as const, detected: false };
  const docYear = headerSample
    ? detectPeriodYear(headerSample)
    : { year: "S/F", detected: false };
  const docSubject = headerSample
    ? detectSubject(headerSample, subjects)
    : { detected: false };

  // Consolidar resultados finales:
  // Jerarquía de especificidad de categoría:
  // Evaluaciones (EXAMEN, LECCION, TALLER) tienen mayor prioridad (rango 2)
  // que materiales de estudio genéricos (TAREA, CLASE - rango 1)
  const getCategoryRank = (cat: { category: string; detected: boolean }) => {
    if (!cat.detected) return 0;
    if (["EXAMEN", "LECCION", "TALLER"].includes(cat.category)) return 2;
    return 1;
  };

  const docRank = getCategoryRank(docCategory);
  const fileRank = getCategoryRank(fileCategory);

  let finalCategory = fileCategory;
  if (docRank >= fileRank && docCategory.detected) {
    finalCategory = docCategory;
  } else if (fileCategory.detected) {
    finalCategory = fileCategory;
  } else if (docCategory.detected) {
    finalCategory = docCategory;
  }

  const finalTerm = docTerm.detected ? docTerm.term : fileTerm.detected ? fileTerm.term : "1PAO";
  const finalYear = docYear.detected ? docYear.year : fileYear.detected ? fileYear.year : "S/F";
  const finalSubject = docSubject.detected ? docSubject : fileSubject;

  // Detección de Solución / Solucionario / Rúbrica en todo el texto del documento o en el nombre
  const isSol =
    detectIsSolution(cleanFilename) ||
    (rawHeaderOrDocumentText ? detectIsSolution(rawHeaderOrDocumentText) : false);

  // Generación de título limpio y estructurado para Exámenes, Lecciones y Talleres
  const suggestedTitle = generateCleanDocumentTitle({
    category: finalCategory.category,
    subcategory: finalCategory.subcategory,
    periodYear: finalYear,
    periodTerm: finalTerm,
    isSolution: isSol,
    originalFilename: filename,
  });

  return {
    subjectId: finalSubject.subjectId,
    subjectName: finalSubject.subjectName,
    subjectCode: finalSubject.subjectCode,
    category: finalCategory.category,
    subcategory: finalCategory.subcategory,
    periodYear: finalYear,
    periodTerm: finalTerm,
    isSolution: isSol,
    suggestedTitle,
    confidence: {
      subject: finalSubject.detected,
      category: finalCategory.detected,
      periodYear: docYear.detected || fileYear.detected,
      periodTerm: docTerm.detected || fileTerm.detected,
      isSolution: isSol,
    },
  };
}

/**
 * Detector híbrido que consulta primero a Google Gemini AI para máxima comprensión contextual.
 * Si la IA no está disponible (timeout, cuota 429 agotada o error de red), se activa
 * de forma inmediata y automática el detector por reglas locales sin interrumpir el flujo.
 */
export async function detectDocumentMetadataHybrid(
  filename: string,
  rawHeaderOrDocumentText: string = "",
  subjects: SubjectOption[] = []
): Promise<DetectedDocumentMetadata> {
  const cleanFilename = filename.replace(/\.[^/.]+$/, "");

  // 1. Intento primario con IA Ligera (Google Gemini)
  try {
    const { detectMetadataWithGemini } = await import("./gemini-detector");
    const aiResult = await detectMetadataWithGemini(filename, rawHeaderOrDocumentText);

    if (aiResult && aiResult.category) {
      // Cruzar la materia detectada por la IA con el catálogo oficial de la ESPOL
      let matchedSubject = subjects.find(
        (s) =>
          aiResult.subjectCode &&
          s.code &&
          s.code.toUpperCase().replace(/[^A-Z0-9]/g, "") === aiResult.subjectCode.toUpperCase().replace(/[^A-Z0-9]/g, "")
      );

      if (!matchedSubject && aiResult.subjectName) {
        const normName = normalizeString(aiResult.subjectName);
        matchedSubject = subjects.find((s) => {
          const sNorm = normalizeString(s.name);
          return sNorm.includes(normName) || normName.includes(sNorm);
        });
      }

      // Si la IA no encontró materia, intentar con el detector de materias local
      if (!matchedSubject) {
        const localSub = detectSubject(rawHeaderOrDocumentText || cleanFilename, subjects);
        if (localSub.detected) {
          matchedSubject = subjects.find((s) => s.id === localSub.subjectId);
        }
      }

      const finalCategory = aiResult.category;
      const finalSubcategory = aiResult.subcategory || "Parcial";
      const finalYear = aiResult.periodYear && aiResult.periodYear !== "S/F" ? aiResult.periodYear : "S/F";
      const finalTerm = aiResult.periodTerm || "1PAO";
      const isSol =
        aiResult.isSolution ??
        (detectIsSolution(cleanFilename) || (rawHeaderOrDocumentText ? detectIsSolution(rawHeaderOrDocumentText) : false));

      const suggestedTitle = generateCleanDocumentTitle({
        category: finalCategory,
        subcategory: finalSubcategory,
        periodYear: finalYear,
        periodTerm: finalTerm,
        isSolution: isSol,
        originalFilename: filename,
      });

      return {
        subjectId: matchedSubject?.id,
        subjectName: matchedSubject?.name || aiResult.subjectName,
        subjectCode: matchedSubject?.code || aiResult.subjectCode,
        category: finalCategory,
        subcategory: finalSubcategory,
        periodYear: finalYear,
        periodTerm: finalTerm,
        isSolution: isSol,
        suggestedTitle,
        confidence: {
          subject: Boolean(matchedSubject),
          category: true,
          periodYear: finalYear !== "S/F",
          periodTerm: true,
          isSolution: isSol,
        },
      };
    }
  } catch (error) {
    console.warn("[Hybrid Detector] IA no disponible, ejecutando fallback local:", error);
  }

  // 2. Fallback automático e inmediato al detector por reglas locales
  return detectDocumentMetadata(filename, rawHeaderOrDocumentText, subjects);
}

