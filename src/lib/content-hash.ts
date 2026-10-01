import crypto from "crypto";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import JSZip from "jszip";

/**
 * Normaliza un texto removiendo absolutamente cualquier variación de formato:
 * tildes, signos, mayúsculas, guiones bajos, saltos de línea, espacios múltiples,
 * encabezados de número de página, etc., dejando únicamente una cadena alfanumérica pura.
 * 
 * Esto garantiza que el mismo documento exportado desde Word (.docx) o impreso a PDF (.pdf)
 * produzca EXACTAMENTE la misma huella semántica.
 */
export function normalizeTextForHashing(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/([a-zA-Z])\s*[\u00b4\u0060\'\^~˜\u02DC\u0300-\u036f]\s*([a-zA-Z])/g, "$1$2")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos y diacríticos
    .replace(/\b(?:pagina|page|pao|periodo|ano|seccion)\s*\d+(?:\s*(?:de|\/)\s*\d+)?\b/gi, "") // Remueve paginaciones
    .replace(/[^a-z0-9]/g, "") // Estrictamente alfanumérico puro (elimina _, espacios, puntuaciones)
    .trim();
}

/**
 * Extrae texto y huellas de imágenes de un archivo DOCX (Word)
 */
export async function extractDocxFingerprint(buffer: Buffer): Promise<{
  normalizedText: string;
  imageHashes: string[];
  rawTextLength: number;
  rawText: string;
}> {
  let normalizedText = "";
  let rawTextLength = 0;
  let rawText = "";
  const imageHashes: string[] = [];

  try {
    const textResult = await mammoth.extractRawText({ buffer });
    rawText = textResult.value || "";
    rawTextLength = rawText.length;
    normalizedText = normalizeTextForHashing(rawText);
  } catch (e) {
    console.warn("Error al extraer texto de DOCX con mammoth:", e);
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.keys(zip.files).filter(
      (path) => path.startsWith("word/media/") && !zip.files[path].dir
    );

    for (const mediaPath of mediaFiles) {
      const fileData = await zip.files[mediaPath].async("nodebuffer");
      const imgHash = crypto.createHash("sha256").update(fileData).digest("hex").substring(0, 16);
      imageHashes.push(imgHash);
    }
    imageHashes.sort();
  } catch (e) {
    console.warn("Error al extraer imágenes de DOCX:", e);
  }

  return { normalizedText, imageHashes, rawTextLength, rawText };
}

/**
 * Extrae texto de un archivo PDF
 */
export async function extractPdfFingerprint(buffer: Buffer): Promise<{
  normalizedText: string;
  imageHashes: string[];
  rawTextLength: number;
  rawText: string;
}> {
  let normalizedText = "";
  let rawTextLength = 0;
  let rawText = "";
  const imageHashes: string[] = [];

  try {
    const result = await extractText(new Uint8Array(buffer));
    if (typeof result === "string") {
      rawText = result;
    } else if (result && Array.isArray(result.text)) {
      rawText = result.text.join(" ");
    } else if (result && typeof (result as unknown as { text?: string }).text === "string") {
      rawText = (result as unknown as { text: string }).text;
    }
    rawTextLength = rawText.length;
    normalizedText = normalizeTextForHashing(rawText);
  } catch (e) {
    console.warn("Error al extraer texto de PDF con unpdf:", e);
  }

  return { normalizedText, imageHashes, rawTextLength, rawText };
}

/**
 * Calcula la huella digital semántica universal.
 * Si un archivo se sube en .docx y otro en .pdf pero contienen el mismo texto/examen,
 * el `contentHash` resultará IDÉNTICO e infalible.
 */
export async function computeSemanticContentHash(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{
  contentHash: string;
  rawSha256: string;
  isDocx: boolean;
  isPdf: boolean;
  hasText: boolean;
  textLength: number;
  rawText: string;
}> {
  const rawSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const isDocx =
    filename.toLowerCase().endsWith(".docx") ||
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword");
  const isPdf = filename.toLowerCase().endsWith(".pdf") || mimeType.includes("pdf");

  let normalizedText = "";
  let rawText = "";
  let imageHashes: string[] = [];
  let textLength = 0;

  if (isDocx) {
    const fp = await extractDocxFingerprint(buffer);
    normalizedText = fp.normalizedText;
    rawText = fp.rawText;
    imageHashes = fp.imageHashes;
    textLength = fp.rawTextLength;
  } else if (isPdf) {
    const fp = await extractPdfFingerprint(buffer);
    normalizedText = fp.normalizedText;
    rawText = fp.rawText;
    imageHashes = fp.imageHashes;
    textLength = fp.rawTextLength;
  }

  // 1. Si contiene texto normalizado suficiente (más de 15 caracteres)
  // El hash textual canónico es universal para DOCX, PDF, etc.
  if (normalizedText.length >= 15) {
    const payload = `text:${normalizedText}`;
    const contentHash = "sem_" + crypto.createHash("sha256").update(payload).digest("hex");
    return { contentHash, rawSha256, isDocx, isPdf, hasText: true, textLength, rawText };
  }

  // 2. Si no contiene texto pero contiene imágenes internas (ej. fotos o esquemas)
  if (imageHashes.length > 0) {
    const payload = `img:${imageHashes.join(",")}`;
    const contentHash = "img_" + crypto.createHash("sha256").update(payload).digest("hex");
    return { contentHash, rawSha256, isDocx, isPdf, hasText: false, textLength, rawText };
  }

  // 3. Fallback a hash binario puro
  return { contentHash: rawSha256, rawSha256, isDocx, isPdf, hasText: false, textLength, rawText };
}
