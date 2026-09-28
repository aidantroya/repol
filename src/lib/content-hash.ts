import crypto from "crypto";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import JSZip from "jszip";

/**
 * Normaliza un texto removiendo espacios en blanco redundantes, signos,
 * tildes y saltos de línea para que dos documentos con el mismo contenido
 * produzcan exactamente la misma cadena textual.
 */
export function normalizeTextForHashing(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos y diacríticos
    .replace(/[^\w\d]/g, "") // Remueve signos de puntuación, espacios y saltos de línea
    .trim();
}

/**
 * Extrae texto y huellas de imágenes de un archivo DOCX (Word)
 */
export async function extractDocxFingerprint(buffer: Buffer): Promise<{
  normalizedText: string;
  imageHashes: string[];
  rawTextLength: number;
}> {
  let normalizedText = "";
  let rawTextLength = 0;
  const imageHashes: string[] = [];

  try {
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value || "";
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

  return { normalizedText, imageHashes, rawTextLength };
}

/**
 * Extrae texto de un archivo PDF
 */
export async function extractPdfFingerprint(buffer: Buffer): Promise<{
  normalizedText: string;
  imageHashes: string[];
  rawTextLength: number;
}> {
  let normalizedText = "";
  let rawTextLength = 0;
  const imageHashes: string[] = [];

  try {
    const result = await extractText(new Uint8Array(buffer));
    let rawText = "";
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

  return { normalizedText, imageHashes, rawTextLength };
}

/**
 * Calcula la huella digital semántica y multimodal (SHA-256 del contenido normalizado).
 * Si un archivo se sube en .docx y otro en .pdf pero contienen el mismo texto/examen,
 * el `contentHash` resultará IDÉNTICO.
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
}> {
  const rawSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const isDocx =
    filename.toLowerCase().endsWith(".docx") ||
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword");
  const isPdf = filename.toLowerCase().endsWith(".pdf") || mimeType.includes("pdf");

  let normalizedText = "";
  let imageHashes: string[] = [];
  let textLength = 0;

  if (isDocx) {
    const fp = await extractDocxFingerprint(buffer);
    normalizedText = fp.normalizedText;
    imageHashes = fp.imageHashes;
    textLength = fp.rawTextLength;
  } else if (isPdf) {
    const fp = await extractPdfFingerprint(buffer);
    normalizedText = fp.normalizedText;
    imageHashes = fp.imageHashes;
    textLength = fp.rawTextLength;
  }

  // Si contiene suficiente texto normalizado (más de 25 caracteres clave)
  if (normalizedText.length >= 25) {
    const payload = `text:${normalizedText}${imageHashes.length > 0 ? `|img:${imageHashes.join(",")}` : ""}`;
    const contentHash = "sem_" + crypto.createHash("sha256").update(payload).digest("hex");
    return { contentHash, rawSha256, isDocx, isPdf, hasText: true, textLength };
  }

  // Si es un documento basado en imágenes internas identificadas
  if (imageHashes.length > 0) {
    const payload = `img:${imageHashes.join(",")}`;
    const contentHash = "img_" + crypto.createHash("sha256").update(payload).digest("hex");
    return { contentHash, rawSha256, isDocx, isPdf, hasText: false, textLength };
  }

  // Fallback a hash binario si no se pudo extraer texto estructurado
  return { contentHash: rawSha256, rawSha256, isDocx, isPdf, hasText: false, textLength };
}
