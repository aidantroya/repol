/**
 * Servicio de detección de metadatos de documentos académicos mediante Google Gemini AI.
 * Opera con doble pasada de verificación (Two-Pass Verification) y fallback automático
 * a reglas locales si hay timeout o la cuota se agota.
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

// Configuración de certificados TLS para entornos de desarrollo/servidor
if (typeof process !== "undefined" && process.env && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];

export async function detectMetadataWithGemini(
  filename: string,
  rawDocumentText: string = ""
): Promise<GeminiDetectedMetadata | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  // Tomamos una muestra profunda (hasta 4500 caracteres para leer encabezado y primeras preguntas/rúbrica)
  const headerSample = (rawDocumentText || "").substring(0, 4500).trim();
  if (!headerSample && !filename) {
    return null;
  }

  const prompt = `Actúa como un experto analizador académico de la ESPOL (Escuela Superior Politécnica del Litoral, Ecuador).
Analiza con doble verificación el siguiente documento universitario y extrae sus metadatos exactos.

=== INSTRUCCIONES DE DOBLE VERIFICACIÓN (TWO-PASS ANALYSIS) ===
Paso 1: Extrae la información textual presente en el encabezado, nombre de archivo o cuerpo de ejercicios.
Paso 2: Realiza una verificación cruzada con el sistema académico de ESPOL:
  - Materia y Código: Identifica el nombre de la materia y su código oficial ESPOL (ej: EYAG1044 para Sistemas Digitales I, MATG1045 para Cálculo de una variable, FISG1005 para Física Mecánica/Física I, CCPG1043 para Fundamentos de Programación, etc.).
  - Tipo de Evaluación: Diferencia con precisión entre EXAMEN (Parcial/Final/Mejoramiento), LECCION (Lección 1, 2, 3, etc.), TALLER, CLASE o TAREA.
  - Término Académico:
    * 1PAO: Primer Término (Mayo a Septiembre).
    * 2PAO: Segundo Término (Octubre a Febrero).
    * PAE: Periodo Extraordinario / Verano / Intensivo (Marzo a Abril).
  - Año: Año real de 4 dígitos en que se tomó la evaluación (ej: "2024", "2023", "2022") o "S/F" si no existe fecha.
  - Solución (isSolution): true si incluye resolución, respuestas correctas, rúbrica de calificación o procedimiento resuelto. false si es solo el enunciado en blanco. (El texto del "Compromiso de Honor" no cuenta como solución).

Devuelve ESTRICTAMENTE un objeto JSON válido con este esquema:
{
  "category": "EXAMEN" | "LECCION" | "TALLER" | "CLASE" | "TAREA",
  "subcategory": "Parcial" | "Final" | "Mejoramiento" | "Lección 1" | "Lección 2" | "Lección 3" | "Lección 4" | "Taller 1" | "Taller 2" | "Taller 3" | "Taller 4" | "Apuntes de Clase" | "Diapositivas" | "Tareas",
  "periodYear": "YYYY" | "S/F",
  "periodTerm": "1PAO" | "2PAO" | "PAE",
  "isSolution": true | false,
  "subjectName": "Nombre oficial de la materia",
  "subjectCode": "Código oficial de la materia"
}

Nombre del archivo: "${filename}"
Contenido del documento:
"""
${headerSample}
"""`;

  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 segundos para análisis profundo de Gemini 3.5

      console.log(`[Gemini AI] Solicitando análisis con modelo: ${model}`);
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
        const errText = await response.text();
        console.warn(`[Gemini AI] Modelo ${model} respondió HTTP ${response.status}:`, errText.substring(0, 150));
        continue;
      }

      const data = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) continue;

      const parsed = JSON.parse(rawJson) as GeminiDetectedMetadata;

      // Normalizar categoría
      if (parsed.category && ["EXAMEN", "LECCION", "TALLER", "CLASE", "TAREA"].includes(parsed.category)) {
        let sub = parsed.subcategory || "Parcial";
        if (parsed.category === "EXAMEN") {
          const subNorm = sub.toLowerCase();
          if (subNorm.includes("mejor") || subNorm.includes("tercer") || subNorm.includes("recup")) sub = "Mejoramiento";
          else if (subNorm.includes("final") || subNorm.includes("segund")) sub = "Final";
          else if (subNorm.includes("parcial") || subNorm.includes("primer")) sub = "Parcial";
        }

        let term: "1PAO" | "2PAO" | "PAE" = "1PAO";
        if (parsed.periodTerm && ["1PAO", "2PAO", "PAE"].includes(parsed.periodTerm)) {
          term = parsed.periodTerm;
        }

        console.log(`[Gemini AI] Análisis exitoso con ${model}:`, {
          category: parsed.category,
          subcategory: sub,
          subject: parsed.subjectName,
          tokens: data.usageMetadata?.totalTokenCount
        });

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini AI] Error o timeout con modelo ${model}:`, msg);
      continue;
    }
  }

  // Fallback automático
  return null;
}
