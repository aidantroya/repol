/**
 * Servicio de detección de metadatos de documentos académicos mediante Google Gemini AI.
 * Opera como capa inteligente primaria con fallback automático a reglas locales si la cuota se agota o hay timeout.
 */

export interface GeminiDetectedMetadata {
  category?: "EXAMEN" | "LECCION" | "TALLER" | "CLASE" | "TAREA";
  subcategory?: string;
  periodYear?: string;
  periodTerm?: "1PAO" | "2PAO" | "PAE";
  isSolution?: boolean;
  subjectName?: string;
  subjectCode?: string;
}

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

export async function detectMetadataWithGemini(
  filename: string,
  rawDocumentText: string = ""
): Promise<GeminiDetectedMetadata | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  // Tomamos una muestra compacta (primeros 2500 caracteres)
  const headerSample = (rawDocumentText || "").substring(0, 2500).trim();
  if (!headerSample && !filename) {
    return null;
  }

  const prompt = `Analiza el siguiente documento universitario de la ESPOL (Escuela Superior Politécnica del Litoral, Ecuador).
Determina los siguientes campos con exactitud y devuélvelos estrictamente en formato JSON:

1. "category": EXACTAMENTE uno de ["EXAMEN", "LECCION", "TALLER", "CLASE", "TAREA"].
2. "subcategory": 
   - Si es EXAMEN: "Parcial" (1ra Evaluación), "Final" (2da Evaluación), o "Mejoramiento" (3ra Evaluación / Recuperación).
   - Si es LECCION: "Lección 1", "Lección 2", "Lección 3", "Lección 4", o "Lección".
   - Si es TALLER: "Taller 1", "Taller 2", "Taller 3", "Taller 4", o "Taller".
   - Si es CLASE: "Diapositivas", "Apuntes de Clase", o "Guía Teórica".
   - Si es TAREA: "Tareas", "Ejercicios Extras", o "Guía de Problemas".
3. "periodYear": Año de 4 dígitos del examen/lección (ej. "2024", "2023", "2022") o "S/F" si no se menciona año.
4. "periodTerm": EXACTAMENTE uno de ["1PAO", "2PAO", "PAE"]:
   - "1PAO": 1er Término / Mayo a Septiembre.
   - "2PAO": 2do Término / Octubre a Febrero.
   - "PAE": Extraordinario / Verano / Intensivo / Marzo a Abril.
5. "isSolution": boolean (true si contiene soluciones, desarrollo resuelto de respuestas o rúbrica de calificación; false si es solo el enunciado en blanco). NOTA: El texto del "Compromiso de Honor" no cuenta como solución.
6. "subjectName": Nombre de la materia académica de la ESPOL si aparece (ej. "Cálculo de una variable", "Física Mecánica", "Fundamentos de Programación").
7. "subjectCode": Código oficial de la materia si aparece (ej. "MATG1045", "CCPG1043", "FISG1005").

Nombre del archivo: "${filename}"
Texto del documento:
"""
${headerSample}
"""`;

  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2800); // 2.8s timeout máximo

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Si hay error 404, 429 o 503, intentar siguiente modelo o saltar a fallback
        continue;
      }

      const data = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) continue;

      const parsed = JSON.parse(rawJson) as GeminiDetectedMetadata;

      // Normalizar categoría
      if (parsed.category && ["EXAMEN", "LECCION", "TALLER", "CLASE", "TAREA"].includes(parsed.category)) {
        // Normalizar subcategoría si fue devuelta como texto largo
        let sub = parsed.subcategory || "Parcial";
        if (parsed.category === "EXAMEN") {
          const subNorm = sub.toLowerCase();
          if (subNorm.includes("mejor") || subNorm.includes("tercer") || subNorm.includes("recup")) sub = "Mejoramiento";
          else if (subNorm.includes("final") || subNorm.includes("segund")) sub = "Final";
          else if (subNorm.includes("parcial") || subNorm.includes("primer")) sub = "Parcial";
        }

        // Normalizar término
        let term: "1PAO" | "2PAO" | "PAE" = "1PAO";
        if (parsed.periodTerm && ["1PAO", "2PAO", "PAE"].includes(parsed.periodTerm)) {
          term = parsed.periodTerm;
        }

        return {
          category: parsed.category,
          subcategory: sub,
          periodYear: parsed.periodYear && parsed.periodYear !== "S/F" ? parsed.periodYear : "S/F",
          periodTerm: term,
          isSolution: Boolean(parsed.isSolution),
          subjectName: parsed.subjectName,
          subjectCode: parsed.subjectCode,
        };
      }
    } catch {
      // Ignorar y probar siguiente modelo o activar fallback por reglas
      continue;
    }
  }

  // Si todos los modelos de IA fallan o se agota la cuota diaria, retornamos null para activar el fallback
  return null;
}
