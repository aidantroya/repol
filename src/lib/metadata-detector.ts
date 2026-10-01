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
  const norm = normalizeString(combinedText);

  // 1. Palabras clave explícitas de solución
  const solutionKeywords = /\b(?:solucion|soluciones|solucionario|solucionarios|rubrica|rubricas|pauta|pautas|pauta de correccion|clave|claves|clave de respuestas|hoja de respuestas|respuestas correctas|banco de respuestas|resuelto|resueltos|resuelta|resueltas|resolucion|resoluciones|desarrollo|desarrollado|desarrollada|calificado|solution|solutions|solution manual|answer key|answer|answers|solved|marking scheme)\b/;
  if (solutionKeywords.test(norm)) {
    return true;
  }

  // 2. Patrones de preguntas resueltas (ej. "Sol:", "Solución:", "Rpta:", "Rta:", "Ans:")
  const answerHeaderPattern = /(?:\bsol\s*[:\.\-]|solucion\s*[:\.\-]|rpta\s*[:\.\-]|rta\s*[:\.\-]|ans\s*[:\.\-]|resp\s*[:\.\-])/i;
  if (answerHeaderPattern.test(combinedText)) {
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
export function generateCleanDocumentTitle(metadata: {
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA";
  subcategory: string;
  periodYear: string;
  periodTerm: string;
  isSolution: boolean;
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

  if (metadata.category === "EXAMEN") {
    let examName = "Examen Parcial";
    if (metadata.subcategory === "Final") examName = "Examen Final";
    else if (metadata.subcategory === "Mejoramiento") examName = "Examen de Mejoramiento";
    else if (metadata.subcategory && metadata.subcategory !== "Otro") examName = `Examen ${metadata.subcategory}`;

    return `${examName}${periodTag}${solSuffix}`.trim();
  }

  if (metadata.category === "LECCION") {
    const sub = metadata.subcategory && metadata.subcategory !== "Otro" ? metadata.subcategory : "Lección";
    return `${sub}${periodTag}${solSuffix}`.trim();
  }

  if (metadata.category === "TALLER") {
    const sub = metadata.subcategory && metadata.subcategory !== "Otro" ? metadata.subcategory : "Taller";
    return `${sub}${periodTag}${solSuffix}`.trim();
  }

  // Para CLASE y TAREA (Material de Entrenamiento):
  // No imponer un nombre genérico para permitir que descripciones específicas se mantengan
  const cleanOriginal = (metadata.originalFilename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanOriginal || `${metadata.subcategory || "Documento"}${periodTag}${solSuffix}`.trim();
}

/**
 * Detecta la categoría y subcategoría a partir de texto (encabezado o nombre de archivo).
 * Maneja todas las variaciones posibles de ordinales, números romanos, nombres y sinónimos.
 */
export function detectCategoryAndSubcategory(
  combinedText: string
): { category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA"; subcategory: string; detected: boolean } {
  if (!combinedText) {
    return { category: "EXAMEN", subcategory: "Parcial", detected: false };
  }

  const norm = normalizeString(combinedText);

  // =========================================================================
  // 1. LECCIONES (Lección 1, 2, 3, 4, Quiz, Control de Lectura, Prueba Corta)
  // Evaluado primero para evitar colisión con 'evaluación' genérica.
  // =========================================================================
  const isLeccionKeyword = /\b(?:leccion|lecciones|lecc|lec|quiz|quizzes|control de lectura|prueba corta|short test|test corto)\b/.test(norm);
  const isLShort = /\b(?:l\s*[1-4]|q\s*[1-4])\b/.test(norm);

  if (isLeccionKeyword || isLShort) {
    // Lección 4 / Quiz 4 / Cuarta Lección
    if (
      /\b(?:leccion\s*(?:4|iv|cuatro)|lec\s*4|lecc\s*4|l\s*4|quiz\s*(?:4|iv)|q\s*4|cuarta\s+leccion|4\s*ta\s+leccion|4\s*ra\s+leccion|4\s*a\s+leccion|cuarto\s+quiz|4\s*to\s+quiz|control\s*(?:4|iv)|prueba\s*4)\b/.test(
        norm
      )
    ) {
      return { category: "LECCION", subcategory: "Lección 4", detected: true };
    }
    // Lección 3 / Quiz 3 / Tercera Lección
    if (
      /\b(?:leccion\s*(?:3|iii|tres)|lec\s*3|lecc\s*3|l\s*3|quiz\s*(?:3|iii)|q\s*3|tercera\s+leccion|3\s*ra\s+leccion|3\s*era\s+leccion|3\s*a\s+leccion|tercer\s+quiz|3\s*er\s+quiz|control\s*(?:3|iii)|prueba\s*3)\b/.test(
        norm
      )
    ) {
      return { category: "LECCION", subcategory: "Lección 3", detected: true };
    }
    // Lección 2 / Quiz 2 / Segunda Lección
    if (
      /\b(?:leccion\s*(?:2|ii|dos)|lec\s*2|lecc\s*2|l\s*2|quiz\s*(?:2|ii)|q\s*2|segunda\s+leccion|2\s*da\s+leccion|2\s*nda\s+leccion|2\s*a\s+leccion|segundo\s+quiz|2\s*do\s+quiz|control\s*(?:2|ii)|prueba\s*2)\b/.test(
        norm
      )
    ) {
      return { category: "LECCION", subcategory: "Lección 2", detected: true };
    }
    // Lección 1 / Quiz 1 / Primera Lección
    if (
      /\b(?:leccion\s*(?:1|i|uno|primera)|lec\s*1|lecc\s*1|l\s*1|quiz\s*(?:1|i)|q\s*1|primera\s+leccion|1\s*ra\s+leccion|1\s*era\s+leccion|1\s*er\s+leccion|1\s*a\s+leccion|primer\s+quiz|1\s*er\s+quiz|control\s*(?:1|i)|prueba\s*1)\b/.test(
        norm
      )
    ) {
      return { category: "LECCION", subcategory: "Lección 1", detected: true };
    }

    return { category: "LECCION", subcategory: "Lección 1", detected: true };
  }

  // =========================================================================
  // 2. TALLERES (Taller 1, 2, 3, 4, Workshop, Actividad Grupal)
  // =========================================================================
  const isTallerKeyword = /\b(?:taller|talleres|tall|workshop|workshops|actividad grupal|trabajo en clase)\b/.test(norm);
  const isTShort = /\b(?:t\s*[1-4]|w\s*[1-4])\b/.test(norm);

  if (isTallerKeyword || isTShort) {
    // Taller 4 / Cuarto Taller
    if (
      /\b(?:taller\s*(?:4|iv|cuatro)|tall\s*4|t\s*4|workshop\s*4|w\s*4|cuarto\s+taller|4\s*to\s+taller|4\s*a\s+taller|4\s*ta\s+taller)\b/.test(
        norm
      )
    ) {
      return { category: "TALLER", subcategory: "Taller 4", detected: true };
    }
    // Taller 3 / Tercer Taller
    if (
      /\b(?:taller\s*(?:3|iii|tres)|tall\s*3|t\s*3|workshop\s*3|w\s*3|tercer\s+taller|3\s*er\s+taller|3\s*ra\s+taller|3\s*era\s+taller|3\s*a\s+taller)\b/.test(
        norm
      )
    ) {
      return { category: "TALLER", subcategory: "Taller 3", detected: true };
    }
    // Taller 2 / Segundo Taller
    if (
      /\b(?:taller\s*(?:2|ii|dos)|tall\s*2|t\s*2|workshop\s*2|w\s*2|segundo\s+taller|2\s*do\s+taller|2\s*da\s+taller|2\s*a\s+taller)\b/.test(
        norm
      )
    ) {
      return { category: "TALLER", subcategory: "Taller 2", detected: true };
    }
    // Taller 1 / Primer Taller
    if (
      /\b(?:taller\s*(?:1|i|uno|primer)|tall\s*1|t\s*1|workshop\s*1|w\s*1|primer\s+taller|1\s*er\s+taller|1\s*ro\s+taller|1\s*ra\s+taller|1\s*a\s+taller)\b/.test(
        norm
      )
    ) {
      return { category: "TALLER", subcategory: "Taller 1", detected: true };
    }

    return { category: "TALLER", subcategory: "Taller 1", detected: true };
  }

  // =========================================================================
  // 3. MATERIAL DE ENTRENAMIENTO / TAREAS (Guías, Ejercicios, Deberes, Labs)
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
      /\b(?:ejercicio|ejercicios|ejercicios extras|ejercicios de refuerzo|ejercicios adicionales|ejercicios tipo examen|practica adicional|problemas adicionales)\b/.test(
        norm
      )
    ) {
      return { category: "TAREA", subcategory: "Ejercicios Extras", detected: true };
    }
    return { category: "TAREA", subcategory: "Tareas", detected: true };
  }

  // =========================================================================
  // 4. EXÁMENES - MEJORAMIENTO / 3RA EVALUACIÓN / RECUPERACIÓN / GRACIA
  // =========================================================================
  if (
    /\b(?:mejoramiento|mejora|recuperacion|gracia|supletorio|remedial|subsanacion|makeup exam|improvement exam|third exam|tercera evaluacion|evaluacion tercera|evaluacion 3|evaluacion iii|eval 3|eval iii|tercera eval|3ra evaluacion|3era evaluacion|3ra eval|3era eval|3 a evaluacion|3ra ev|tercera ev|examen de tercera evaluacion|tercer examen|3er examen|3er exam|examen 3|examen iii|tercer parcial|3er parcial|3ro parcial|3er p|3 p|3p|p 3|p3|parcial 3|parcial iii|evaluacion de mejoramiento|examen de mejoramiento|examen de recuperacion|examen de gracia)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Mejoramiento", detected: true };
  }

  // =========================================================================
  // 5. EXÁMENES - FINAL / 2DA EVALUACIÓN / 2DO PARCIAL
  // =========================================================================
  if (
    /\b(?:final|examen final|evaluacion final|ex final|eval final|final exam|second exam|segunda evaluacion|evaluacion segunda|evaluacion 2|evaluacion ii|eval 2|eval ii|segunda eval|2da evaluacion|2nda evaluacion|2da eval|2nda eval|2 a evaluacion|2da ev|segunda ev|examen de segunda evaluacion|segundo examen|2do examen|2do exam|examen 2|examen ii|segundo parcial|2do parcial|2do p|2 p|2p|p 2|p2|parcial 2|parcial ii)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Final", detected: true };
  }

  // =========================================================================
  // 6. EXÁMENES - PARCIAL / 1RA EVALUACIÓN / 1ER PARCIAL
  // =========================================================================
  if (
    /\b(?:parcial|primer parcial|1er parcial|1ro parcial|1er p|1 p|1p|p 1|p1|parcial 1|parcial i|primera evaluacion|evaluacion primera|evaluacion 1|evaluacion i|eval 1|eval i|primera eval|1ra evaluacion|1era evaluacion|1ra eval|1era eval|1 a evaluacion|1ra ev|primera ev|examen parcial|evaluacion parcial|ex parcial|eval parcial|midterm|first exam|primer examen|1er examen|1ro examen|1er exam|examen 1|examen i|examen de primera evaluacion|examen|evaluacion)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Parcial", detected: true };
  }

  // =========================================================================
  // 7. CLASES Y APUNTES (Diapositivas, Apuntes de Clase, Guía Teórica, Formulario)
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

  // 1. Detección directa por nombres de términos oficiales ESPOL
  // PAE (Extraordinario / Intensivo / Verano / 3PAO / 3T / III PAO)
  if (
    /\b(?:pae|p\s*a\s*e|pao\s*(?:3|iii|tres)|3\s*pao|iii\s*pao|intensivo|extraordinario|verano|3\s*t|iii\s*t|t\s*3|t\s*iii|3\s*er\s*termino|tercer\s*termino|iii\s*termino|tercer\s*pao|3\s*er\s*pao|tercer\s*periodo|3\s*er\s*semestre)\b/.test(
      norm
    ) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:3|iii|pae|3t)\b/i.test(combinedText)
  ) {
    return { term: "PAE", detected: true };
  }

  // 2PAO (II Término / 2T / 2do Término / II PAO / PAO 2 / PAO II)
  if (
    /\b(?:2\s*pao|ii\s*pao|pao\s*(?:2|ii|dos)|pao2|paoii|2\s*t|ii\s*t|t\s*2|t\s*ii|2\s*termino|2\s*do\s*termino|segundo\s*termino|ii\s*termino|segundo\s*pao|2\s*do\s*pao|2\s*da\s*pao|2\s*s|2\s*do\s*semestre|segundo\s*semestre|termino\s*(?:2|ii)|segundo\s*periodo|ii\s*periodo)\b/.test(
      norm
    ) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:2|ii|2pao|2t)\b/i.test(combinedText)
  ) {
    return { term: "2PAO", detected: true };
  }

  // 1PAO (I Término / 1T / 1er Término / I PAO / PAO 1 / PAO I)
  if (
    /\b(?:1\s*pao|i\s*pao|pao\s*(?:1|i|uno)|pao1|paoi|1\s*t|i\s*t|t\s*1|t\s*i|1\s*termino|1\s*er\s*termino|primer\s*termino|i\s*termino|primer\s*pao|1\s*er\s*pao|1\s*era\s*pao|1\s*s|1\s*er\s*semestre|primer\s*semestre|termino\s*(?:1|i)|primer\s*periodo|i\s*periodo)\b/.test(
      norm
    ) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:1|i|1pao|1t)\b/i.test(combinedText)
  ) {
    return { term: "1PAO", detected: true };
  }

  // 2. Detección por meses del calendario académico ESPOL
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
  const upperRaw = combinedText.toUpperCase();

  // 1. Búsqueda por CÓDIGO OFICIAL ESPOL (ej: CCPG1043, MATG1001, FISG1002, FIEC04341)
  // Compara tanto la versión unida (CCPG1043) como con espacio/guión (CCPG 1043 / CCPG-1043)
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

      // Búsqueda del código separado (ej. CCPG 1043)
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
    if (subNorm.length < 4) continue;

    const nameRegex = new RegExp(`\\b${subNorm}\\b`, "i");
    if (nameRegex.test(norm)) {
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
    "fisica 1": ["fisica i", "fisica mecanica", "fisica para ingenieria 1", "fisica 1", "mecanica newtoniana"],
    "fisica 2": ["fisica ii", "fisica electromagnetismo", "fisica 2", "electromagnetismo", "electricidad y magnetismo"],
    "fisica 3": ["fisica iii", "fisica moderna", "fisica 3", "ondas y optica"],
    "calculo 1": ["calculo de una variable", "calculo i", "calculo diferencial", "calculo integral", "una variable"],
    "calculo 2": ["calculo vectorial", "calculo ii", "calculo multivariable", "vectorial", "multivariable"],
    "algebra lineal": ["algebra lineal", "lineal"],
    "ecuaciones diferenciales": ["ecuaciones diferenciales", "edo", "ecua dif", "ecuaciones dif"],
    "estadistica": ["estadistica inferencial", "probabilidad y estadistica", "estadistica descriptiva", "probabilidad"],
    "matematicas discretas": ["matematicas discretas", "matematica discreta", "discretas", "estructuras discretas"],
    "fundamentos de programacion": ["fundamentos de programacion", "funda pro", "fundamentos programacion", "fundaprog"],
    "estructuras de datos": ["estructuras de datos", "estructura de datos", "ed"],
    "poo": ["programacion orientada a objetos", "poo", "orientada a objetos"],
    "redes": ["redes de comunicacion", "redes de computadoras", "redes"],
    "sistemas operativos": ["sistemas operativos", "so", "sist operativos"],
    "bases de datos": ["sistemas de bases de datos", "base de datos", "bases de datos", "bd"],
    "quimica general": ["quimica general", "quimica 1", "quimica basica"],
  };

  for (const [aliasKey, aliasList] of Object.entries(commonAliases)) {
    for (const alias of aliasList) {
      if (norm.includes(alias)) {
        const found = sortedSubjects.find((s) => {
          const sNorm = normalizeString(s.name);
          return sNorm.includes(aliasKey) || aliasList.some((a) => sNorm.includes(a));
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
  const fileCategory = detectCategoryAndSubcategory(cleanFilename);
  const fileTerm = detectPeriodTerm(cleanFilename);
  const fileYear = detectPeriodYear(cleanFilename);
  const fileSubject = detectSubject(cleanFilename, subjects);

  // Etapa 2: Análisis del encabezado / primera página del documento
  const docCategory = headerSample
    ? detectCategoryAndSubcategory(headerSample)
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
  // Si el documento en su texto/encabezado contiene detección con certeza, se le da PRIORIDAD sobre el nombre de archivo
  const finalCategory = docCategory.detected ? docCategory : fileCategory;
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
