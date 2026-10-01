/**
 * Detector inteligente de metadatos académicos para documentos de la ESPOL en RePol.
 * 
 * Analiza en 2 etapas:
 * 1. Etapa 1: Nombre del archivo (e.g. "Leccion1_solucion.pdf", "Examen_Final_CCPG1043_2024_1PAO.pdf").
 * 2. Etapa 2: Encabezado / Primeras páginas del documento (PDF / DOCX) con patrones oficiales de la ESPOL.
 * 
 * Reglas de calendario académico ESPOL:
 * - PAE (Extraordinario/Intensivo): Marzo - Abril / inicios de Mayo
 *   - 1ra Eval: Marzo | 2da Eval: Abril | 3ra Eval: Fines de Abril
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
 * Limpia y une diacríticos tipográficos de LaTeX (ej. 'soluci ´on' -> 'solucion', 'a˜no' -> 'ano')
 */
export function cleanLatexAccents(str: string): string {
  if (!str) return "";
  return str
    .replace(/([a-zA-Z])\s*[\u00b4\u0060\'\^~˜\u02DC\u0300-\u036f]\s*([a-zA-Z])/g, "$1$2")
    .replace(/[\u00b4\u0060\'\^~˜\u02DC]/g, " ");
}

/**
 * Normaliza cadenas para comparación fonética/semántica:
 * Limpia artefactos LaTeX, remueve tildes, separa letras y números pegados (ej. 'leccion1' -> 'leccion 1'), símbolos, mayúsculas y reduce espacios.
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
 * Detecta si el documento contiene la solución / solucionario / respuestas / rúbrica
 */
export function detectIsSolution(combinedText: string): boolean {
  if (!combinedText) return false;
  const norm = normalizeString(combinedText);
  return (
    /\b(?:solucion|solucionario|soluciones|sol|rubrica|pauta|clave|respuestas|resuelto|resueltos|calificado|solution|solutions|answer|answers)\b/.test(
      norm
    ) ||
    /\b(?:soluci\s*on|soluci\s*onario|r\s*ubrica|resoluci\s*on)\b/.test(norm)
  );
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
 * Detecta la categoría y subcategoría a partir de texto (nombre de archivo o encabezado)
 */
function detectCategoryAndSubcategory(
  combinedText: string
): { category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA"; subcategory: string; detected: boolean } {
  const norm = normalizeString(combinedText);

  // 1. LECCIÓN (1, 2, 3, 4, etc.) - Evaluado primero para evitar colisión con 'evaluación' genérica
  if (/\b(?:leccion|lecc|lec|quiz|control\s+de\s+lectura|l\s*1|l\s*2|l\s*3|l\s*4)\b/.test(norm)) {
    if (/\b(?:leccion\s*4|leccion\s*iv|lec\s*4|l\s*4|quiz\s*4|cuarta\s+leccion|4\s*ta\s+leccion|4\s*ra\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 4", detected: true };
    }
    if (/\b(?:leccion\s*3|leccion\s*iii|lec\s*3|l\s*3|quiz\s*3|tercera\s+leccion|3\s*ra\s+leccion|3\s*era\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 3", detected: true };
    }
    if (/\b(?:leccion\s*2|leccion\s*ii|lec\s*2|l\s*2|quiz\s*2|segunda\s+leccion|2\s*da\s+leccion|2\s*nda\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 2", detected: true };
    }
    if (/\b(?:leccion\s*1|leccion\s*i|lec\s*1|l\s*1|quiz\s*1|primera\s+leccion|1\s*ra\s+leccion|1\s*era\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 1", detected: true };
    }
    return { category: "LECCION", subcategory: "Lección 1", detected: true };
  }

  // 2. TALLERES (Taller 1, 2, 3, 4)
  if (/\b(?:taller|tall|workshop|t\s*1|t\s*2|t\s*3|t\s*4)\b/.test(norm)) {
    if (/\b(?:taller\s*4|taller\s*iv|tall\s*4|t\s*4|cuarto\s+taller|4\s*to\s+taller)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 4", detected: true };
    }
    if (/\b(?:taller\s*3|taller\s*iii|tall\s*3|t\s*3|tercer\s+taller|3\s*er\s+taller|3\s*ra\s+taller)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 3", detected: true };
    }
    if (/\b(?:taller\s*2|taller\s*ii|tall\s*2|t\s*2|segundo\s+taller|2\s*do\s+taller)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 2", detected: true };
    }
    if (/\b(?:taller\s*1|taller\s*i|tall\s*1|t\s*1|primer\s+taller|1\s*er\s+taller)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 1", detected: true };
    }
    return { category: "TALLER", subcategory: "Taller 1", detected: true };
  }

  // 3. MATERIAL DE ENTRENAMIENTO / TAREAS (Tareas, Ejercicios Extras, Guía de Problemas, Otro)
  if (
    /\b(?:tarea|tareas|deber|deberes|homework|hw|practica|laboratorio|lab|ejercicio|ejercicios|ejercicios\s+extras|banco\s+de\s+ejercicios|guia\s+de\s+ejercicios|guia\s+de\s+problemas|problemas\s+propuestos|problemas\s+resueltos|problemas)\b/.test(
      norm
    )
  ) {
    if (/\b(?:guia\s+de\s+problemas|guia\s+de\s+ejercicios|guia\s+de\s+estudio|problemas\s+propuestos|problemas\s+resueltos)\b/.test(norm)) {
      return { category: "TAREA", subcategory: "Guía de Problemas", detected: true };
    }
    if (/\b(?:ejercicio|ejercicios|ejercicios\s+extras|banco\s+de\s+ejercicios|banco\s+de\s+preguntas)\b/.test(norm)) {
      return { category: "TAREA", subcategory: "Ejercicios Extras", detected: true };
    }
    return { category: "TAREA", subcategory: "Tareas", detected: true };
  }

  // 4. EXAMEN - Mejoramiento / Gracia / 3ra Evaluación / Evaluación Tercera / 3P
  if (
    /\b(?:mejoramiento|recuperacion|gracia|tercera\s+evaluacion|evaluacion\s+tercera|evaluacion\s*3|evaluacion\s+iii|eval\s*3|eval\s+iii|3\s*ra\s+evaluacion|3\s*era\s+evaluacion|3\s*ra\s+eval|3\s*p|3\s*er\s+parcial|tercer\s+parcial|evaluacion\s+de\s+mejoramiento|evaluacion\s+de\s+gracia|examen\s+de\s+tercera\s+evaluacion|examen\s+de\s+mejoramiento)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Mejoramiento", detected: true };
  }

  // 5. EXAMEN - Final / 2da Evaluación / Evaluación Segunda / 2P
  if (
    /\b(?:final|examen\s+final|evaluacion\s+final|segunda\s+evaluacion|evaluacion\s+segunda|evaluacion\s*2|evaluacion\s+ii|eval\s*2|eval\s+ii|2\s*da\s+evaluacion|2\s*da\s+eval|2\s*p|2\s*do\s+parcial|segundo\s+parcial|examen\s+de\s+segunda\s+evaluacion|segundo\s+examen)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Final", detected: true };
  }

  // 6. EXAMEN - Parcial / 1ra Evaluación / Evaluación Primera / 1P
  if (
    /\b(?:parcial|primer\s+parcial|1\s*er\s+parcial|primera\s+evaluacion|evaluacion\s+primera|evaluacion\s*1|evaluacion\s+i|eval\s*1|eval\s+i|1\s*ra\s+evaluacion|1\s*era\s+evaluacion|1\s*ra\s+eval|1\s*p|examen\s+parcial|evaluacion\s+parcial|examen|evaluacion|examen\s+de\s+primera\s+evaluacion|primer\s+examen)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Parcial", detected: true };
  }

  // 7. CLASES Y APUNTES (Diapositivas, Apuntes de Clase, Guía Teórica)
  if (/\b(?:diapositiva|diapositivas|slide|slides|presentacion|ppt|powerpoint)\b/.test(norm)) {
    return { category: "CLASE", subcategory: "Diapositivas", detected: true };
  }
  if (/\b(?:guia|syllabus|silabo|formulario|formulario\s+oficial|formulario\s+teorico)\b/.test(norm)) {
    return { category: "CLASE", subcategory: "Guía Teórica", detected: true };
  }
  if (/\b(?:apuntes|notas|clase|resumen|teoria|resumenes)\b/.test(norm)) {
    return { category: "CLASE", subcategory: "Apuntes de Clase", detected: true };
  }

  // Por defecto (si no se encuentra coincidencia clara)
  return { category: "EXAMEN", subcategory: "Parcial", detected: false };
}

/**
 * Detecta el término académico (1PAO, 2PAO, PAE) por códigos, términos y meses de calendario ESPOL
 */
function detectPeriodTerm(combinedText: string): { term: "1PAO" | "2PAO" | "PAE"; detected: boolean } {
  const norm = normalizeString(combinedText);

  // 1. Detección directa por nombres de términos oficiales ESPOL
  // PAE (Extraordinario / Intensivo / Verano / 3T / III PAO)
  if (
    /\b(?:pae|pao\s*(?:3|iii|tres)|3\s*pao|iii\s*pao|intensivo|extraordinario|verano|3\s*t|iii\s*t|t\s*3|t\s*iii|3\s*er\s*termino|tercer\s*termino|iii\s*termino|tercer\s*pao|3\s*er\s*pao|tercer\s*periodo)\b/.test(
      norm
    ) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:3|iii|pae|3t)\b/i.test(combinedText)
  ) {
    return { term: "PAE", detected: true };
  }

  // 2PAO (II Término / 2T / 2do Término / II PAO / PAO 2 / PAO II)
  if (
    /\b(?:2\s*pao|ii\s*pao|pao\s*(?:2|ii|dos)|2\s*t|ii\s*t|t\s*2|t\s*ii|2\s*termino|2\s*do\s*termino|segundo\s*termino|ii\s*termino|segundo\s*pao|2\s*do\s*pao|2\s*da\s*pao|2\s*s|2\s*do\s*semestre|segundo\s*semestre|termino\s*(?:2|ii)|segundo\s*periodo|ii\s*periodo)\b/.test(
      norm
    ) ||
    /\b(?:19|20)\d\d\s*[-_./]\s*(?:2|ii|2pao|2t)\b/i.test(combinedText)
  ) {
    return { term: "2PAO", detected: true };
  }

  // 1PAO (I Término / 1T / 1er Término / I PAO / PAO 1 / PAO I)
  if (
    /\b(?:1\s*pao|i\s*pao|pao\s*(?:1|i|uno)|1\s*t|i\s*t|t\s*1|t\s*i|1\s*termino|1\s*er\s*termino|primer\s*termino|i\s*termino|primer\s*pao|1\s*er\s*pao|1\s*era\s*pao|1\s*s|1\s*er\s*semestre|primer\s*semestre|termino\s*(?:1|i)|primer\s*periodo|i\s*periodo)\b/.test(
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
  const dateNumMatch = combinedText.match(/(?:[0-3]?\d[\/\-\.]([0-1]?\d)[\/\-\.](?:19|20)\d\d)|(?:(?:19|20)\d\d[\/\-\.]([0-1]?\d)[\/\-\.][0-3]?\d)/);
  if (dateNumMatch) {
    const monthNum = parseInt(dateNumMatch[1] || dateNumMatch[2], 10);
    if (monthNum >= 3 && monthNum <= 4) return { term: "PAE", detected: true };
    if (monthNum >= 5 && monthNum <= 9) return { term: "1PAO", detected: true };
    if (monthNum >= 10 || monthNum <= 2) return { term: "2PAO", detected: true };
  }

  return { term: "1PAO", detected: false };
}

/**
 * Detecta el año académico del documento (ej. 2024, 2025, o "S/F")
 */
function detectPeriodYear(
  combinedText: string
): { year: string; detected: boolean } {
  // 1. Rangos de año como "2024-2025" o "2024 - 2025"
  const rangeMatch = combinedText.match(/\b(19\d\d|20\d\d)\s*[\-\/]\s*(19\d\d|20\d\d)\b/);
  if (rangeMatch) {
    const firstYear = parseInt(rangeMatch[1], 10);
    return { year: String(firstYear), detected: true };
  }

  // 2. Coincidencias específicas cercanas a palabras clave de encabezado ESPOL
  const headerYearMatch = combinedText.match(/\b(?:periodo|ano|año|fecha|pao)\s*(?:y\s*(?:ano|año))?\s*[:\s\-]*.*?\b(19\d\d|20[0-3]\d)\b/i);
  if (headerYearMatch) {
    const y = parseInt(headerYearMatch[1], 10);
    if (y >= 1995 && y <= new Date().getFullYear() + 2) {
      return { year: String(y), detected: true };
    }
  }

  // 3. Años de 4 dígitos entre 1990 y 2035
  const yearMatches = Array.from(combinedText.matchAll(/\b(199\d|20[0-3]\d)\b/g)).map((m) => parseInt(m[1], 10));

  if (yearMatches.length > 0) {
    const currentYear = new Date().getFullYear();
    const validYears = yearMatches.filter((y) => y >= 1995 && y <= currentYear + 1);
    if (validYears.length > 0) {
      return { year: String(validYears[0]), detected: true };
    }
    return { year: String(yearMatches[0]), detected: true };
  }

  return { year: "S/F", detected: false };
}

/**
 * Detecta la materia comparando con el catálogo de materias de la ESPOL
 */
function detectSubject(
  combinedText: string,
  subjects: SubjectOption[]
): { subjectId?: string; subjectName?: string; subjectCode?: string; detected: boolean } {
  if (!subjects || subjects.length === 0) {
    return { detected: false };
  }

  const norm = normalizeString(combinedText);
  const upperRaw = combinedText.toUpperCase();

  // 1. Búsqueda por CÓDIGO OFICIAL ESPOL (ej: CCPG1043, MATG1001, FISG1002)
  for (const sub of subjects) {
    if (!sub.code) continue;
    const cleanCode = sub.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanCode.length >= 4) {
      const codeRegex = new RegExp(`\\b${cleanCode}\\b`, "i");
      if (codeRegex.test(upperRaw.replace(/[^A-Z0-9\s]/g, " "))) {
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          detected: true,
        };
      }
    }
  }

  // 2. Búsqueda por NOMBRE DE MATERIA (de mayor longitud a menor longitud)
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

  // 3. Coincidencias frecuentes con abreviaturas o nombres alternativos
  const commonAliases: Record<string, string[]> = {
    "fisica 1": ["fisica i", "fisica mecanica", "fisica para ingenieria 1", "fisica 1"],
    "fisica 2": ["fisica ii", "fisica electromagnetismo", "fisica 2"],
    "fisica 3": ["fisica iii", "fisica moderna", "fisica 3"],
    "calculo 1": ["calculo de una variable", "calculo i", "calculo diferencial", "calculo integral"],
    "calculo 2": ["calculo vectorial", "calculo ii", "calculo multivariable"],
    "algebra lineal": ["algebra lineal", "lineal"],
    "ecuaciones diferenciales": ["ecuaciones diferenciales", "edo", "ecua dif"],
    "estadistica": ["estadistica inferencial", "probabilidad y estadistica", "estadistica descriptiva"],
    "fundamentos de programacion": ["fundamentos de programacion", "funda pro", "fundamentos programacion"],
    "estructuras de datos": ["estructuras de datos", "estructura de datos", "ed"],
    "poo": ["programacion orientada a objetos", "poo"],
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
 * 1. Primero evalúa el nombre del archivo.
 * 2. Si faltan datos o para corroborar, analiza el encabezado / texto del documento.
 */
export function detectDocumentMetadata(
  filename: string,
  rawHeaderOrDocumentText: string = "",
  subjects: SubjectOption[] = []
): DetectedDocumentMetadata {
  const cleanFilename = filename.replace(/\.[^/.]+$/, ""); // Remueve extensión
  const headerSample = (rawHeaderOrDocumentText || "").substring(0, 3500);

  // Etapa 1: Análisis del nombre del archivo
  const fileCategory = detectCategoryAndSubcategory(cleanFilename);
  const fileTerm = detectPeriodTerm(cleanFilename);
  const fileYear = detectPeriodYear(cleanFilename);
  const fileSubject = detectSubject(cleanFilename, subjects);

  // Etapa 2: Análisis del encabezado (document text) si algo no se detectó con certeza en el nombre
  const docCategory = !fileCategory.detected && headerSample ? detectCategoryAndSubcategory(headerSample) : fileCategory;
  const docTerm = !fileTerm.detected && headerSample ? detectPeriodTerm(headerSample) : fileTerm;
  const docYear = !fileYear.detected && headerSample ? detectPeriodYear(headerSample) : fileYear;
  const docSubject = !fileSubject.detected && headerSample ? detectSubject(headerSample, subjects) : fileSubject;

  // Consolidar resultados finales
  const finalCategory = docCategory.detected ? docCategory : fileCategory;
  const finalTerm = docTerm.detected ? docTerm.term : fileTerm.detected ? fileTerm.term : "1PAO";
  const finalYear = docYear.detected ? docYear.year : fileYear.detected ? fileYear.year : "S/F";
  const finalSubject = docSubject.detected ? docSubject : fileSubject;

  // Detección de Solución / Solucionario / Rúbrica
  const isSol = detectIsSolution(cleanFilename) || (headerSample ? detectIsSolution(headerSample) : false);

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
