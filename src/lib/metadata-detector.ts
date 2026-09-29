/**
 * Detector inteligente de metadatos académicos para documentos de la ESPOL en RePol.
 * 
 * Analiza en 2 etapas:
 * 1. Etapa 1: Nombre del archivo (e.g. "Examen_Final_CCPG1043_2024_1PAO.pdf").
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
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
  subcategory: string;
  periodYear: string; // "2024", "2025", "S/F"
  periodTerm: "1PAO" | "2PAO" | "PAE";
  confidence: {
    subject: boolean;
    category: boolean;
    periodYear: boolean;
    periodTerm: boolean;
  };
}

/**
 * Normaliza cadenas para comparación fonética/semántica:
 * Remueve tildes, símbolos, mayúsculas y reduce espacios.
 */
function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta la categoría y subcategoría a partir de texto (nombre de archivo o encabezado)
 */
function detectCategoryAndSubcategory(
  combinedText: string
): { category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN"; subcategory: string; detected: boolean } {
  const norm = normalizeString(combinedText);

  // 1. EXAMEN - Mejoramiento / Gracia / 3ra Evaluación / 3P
  if (
    /\b(?:mejoramiento|recuperacion|gracia|tercera\s+evaluacion|3ra\s+evaluacion|3ra\s+eval|3p|3er\s+parcial|tercer\s+parcial)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Mejoramiento", detected: true };
  }

  // 2. EXAMEN - Final / 2da Evaluación / 2P
  if (
    /\b(?:final|examen\s+final|segunda\s+evaluacion|2da\s+evaluacion|2da\s+eval|2p|2do\s+parcial|segundo\s+parcial)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Final", detected: true };
  }

  // 3. EXAMEN - Parcial / 1ra Evaluación / 1P
  if (
    /\b(?:parcial|primer\s+parcial|1er\s+parcial|primera\s+evaluacion|1ra\s+evaluacion|1ra\s+eval|1p|examen\s+parcial|examen)\b/.test(
      norm
    )
  ) {
    return { category: "EXAMEN", subcategory: "Parcial", detected: true };
  }

  // 4. LECCIÓN (1, 2, 3, 4, etc.)
  if (/\b(?:leccion|leccion\s*#?|control\s+de\s+lectura|quiz|l1|l2|l3|l4)\b/.test(norm)) {
    if (/\b(?:leccion\s*4|leccion\s*iv|l4|quiz\s*4|cuarta\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 4", detected: true };
    }
    if (/\b(?:leccion\s*3|leccion\s*iii|l3|quiz\s*3|tercera\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 3", detected: true };
    }
    if (/\b(?:leccion\s*2|leccion\s*ii|l2|quiz\s*2|segunda\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 2", detected: true };
    }
    if (/\b(?:leccion\s*1|leccion\s*i|l1|quiz\s*1|primera\s+leccion)\b/.test(norm)) {
      return { category: "LECCION", subcategory: "Lección 1", detected: true };
    }
    return { category: "LECCION", subcategory: "Lección 1", detected: true };
  }

  // 5. TALLER / TAREA / DEBER / PRÁCTICA
  if (/\b(?:taller|taller\s*#?|deber|tarea|homework|hw|practica|laboratorio|lab|t1|t2|t3|t4)\b/.test(norm)) {
    if (/\b(?:taller\s*4|taller\s*iv|t4|deber\s*4|tarea\s*4|practica\s*4|lab\s*4)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 4", detected: true };
    }
    if (/\b(?:taller\s*3|taller\s*iii|t3|deber\s*3|tarea\s*3|practica\s*3|lab\s*3)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 3", detected: true };
    }
    if (/\b(?:taller\s*2|taller\s*ii|t2|deber\s*2|tarea\s*2|practica\s*2|lab\s*2)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 2", detected: true };
    }
    if (/\b(?:taller\s*1|taller\s*i|t1|deber\s*1|tarea\s*1|practica\s*1|lab\s*1)\b/.test(norm)) {
      return { category: "TALLER", subcategory: "Taller 1", detected: true };
    }
    return { category: "TALLER", subcategory: "Taller 1", detected: true };
  }

  // 6. MATERIAL DE CLASE (Diapositivas, Apuntes, Guías)
  if (/\b(?:diapositiva|diapositivas|slide|slides|presentacion|ppt|powerpoint)\b/.test(norm)) {
    return { category: "CLASE", subcategory: "Diapositivas", detected: true };
  }
  if (/\b(?:guia|syllabus|silabo|libro|bibliografia|formulario|formulario\s+oficial)\b/.test(norm)) {
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

  // 1. Detección directa por nombres de términos
  // PAE (Extraordinario / Intensivo / Verano / 3T)
  if (/\b(?:pae|intensivo|extraordinario|verano|3t|3\s*t|iii\s*t|3er\s*termino|tercer\s*termino)\b/.test(norm)) {
    return { term: "PAE", detected: true };
  }

  // 1PAO (I Término / 1T / 1er Término)
  if (
    /\b(?:1pao|1\s*pao|i\s*pao|1t|1\s*t|1\s*termino|1er\s*termino|primer\s*termino|i\s*termino)\b/.test(
      norm
    )
  ) {
    return { term: "1PAO", detected: true };
  }

  // 2PAO (II Término / 2T / 2do Término)
  if (
    /\b(?:2pao|2\s*pao|ii\s*pao|2t|2\s*t|2\s*termino|2do\s*termino|segundo\s*termino|ii\s*termino)\b/.test(
      norm
    )
  ) {
    return { term: "2PAO", detected: true };
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

  // Detección por fecha numérica DD/MM/YYYY o YYYY-MM-DD
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
    // Si el término es 2PAO y cruza fin de año (ej. 2024-2025), el año base es el primero
    return { year: String(firstYear), detected: true };
  }

  // 2. Años de 4 dígitos entre 1990 y 2035
  const yearMatches = Array.from(combinedText.matchAll(/\b(199\d|20[0-3]\d)\b/g)).map((m) => parseInt(m[1], 10));

  if (yearMatches.length > 0) {
    // Si hay un año en contexto de fecha reciente o primer match relevante
    const currentYear = new Date().getFullYear();
    // Priorizar años razonables cercanos al año actual
    const validYears = yearMatches.filter((y) => y >= 1995 && y <= currentYear + 1);
    if (validYears.length > 0) {
      return { year: String(validYears[0]), detected: true };
    }
    return { year: String(yearMatches[0]), detected: true };
  }

  // Si no se encontró año en ninguna parte
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

  // 1. Búsqueda por CÓDIGO OFICIAL ESPOL (ej: CCPG1043, MATG1001, FISG1002, FIEC-0123)
  for (const sub of subjects) {
    if (!sub.code) continue;
    const cleanCode = sub.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanCode.length >= 4) {
      // Buscar el código en el texto original o normalizado
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

  // 2. Búsqueda por NOMBRE DE MATERIA (de mayor longitud a menor longitud para evitar falsos positivos)
  const sortedSubjects = [...subjects].sort((a, b) => b.name.length - a.name.length);

  for (const sub of sortedSubjects) {
    const subNorm = normalizeString(sub.name);
    if (subNorm.length < 4) continue;

    // Coincidencia exacta del nombre completo de la materia
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
        // Encontrar la materia que coincida con este alias
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
  const cleanFilename = filename.replace(/\.[^/.]+$/, ""); // Remueve extensión .pdf/.docx
  // Primeros 3500 caracteres del documento contienen el encabezado completo, fecha, materia y evaluación
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

  return {
    subjectId: finalSubject.subjectId,
    subjectName: finalSubject.subjectName,
    subjectCode: finalSubject.subjectCode,
    category: finalCategory.category,
    subcategory: finalCategory.subcategory,
    periodYear: finalYear,
    periodTerm: finalTerm,
    confidence: {
      subject: finalSubject.detected,
      category: finalCategory.detected,
      periodYear: docYear.detected || fileYear.detected,
      periodTerm: docTerm.detected || fileTerm.detected,
    },
  };
}
