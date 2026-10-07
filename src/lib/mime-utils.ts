/**
 * Utilidades de detección de tipos MIME y extensiones de archivos para RePol
 */

const MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/x-sql": ".sql",
  "application/sql": ".sql",
  "text/sql": ".sql",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "application/x-rar-compressed": ".rar",
  "application/x-7z-compressed": ".7z",
  "application/x-python": ".py",
  "text/x-python": ".py",
  "text/x-c": ".c",
  "text/x-c++": ".cpp",
  "text/x-java": ".java",
  "application/json": ".json",
  "application/x-ipynb+json": ".ipynb",
};

const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".sql": "text/x-sql",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".7z": "application/x-7z-compressed",
  ".py": "text/x-python",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".java": "text/x-java",
  ".json": "application/json",
  ".ipynb": "application/x-ipynb+json",
};

/**
 * Detecta la extensión adecuada basada en nombre, tipo MIME o bytes mágicos del Buffer
 */
export function getExtensionFromMimeOrBuffer(
  name: string,
  mimeType?: string | null,
  buffer?: Buffer | null
): string {
  // Si el nombre ya termina con una extensión válida de 2 a 5 letras, conservarla
  const existingExtMatch = name.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (existingExtMatch) {
    return `.${existingExtMatch[1].toLowerCase()}`;
  }

  // Comprobar números mágicos en el buffer binario
  if (buffer && buffer.length >= 4) {
    // PDF: %PDF- (0x25 0x50 0x44 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return ".pdf";
    }
    // PNG: \x89PNG (0x89 0x50 0x4E 0x47)
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return ".png";
    }
    // JPEG / JPG: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return ".jpg";
    }
    // GIF: GIF8
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return ".gif";
    }
    // ZIP / DOCX / PPTX / XLSX (0x50 0x4B 0x03 0x04)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      if (
        mimeType?.includes("wordprocessingml") ||
        mimeType?.includes("docx") ||
        name.toLowerCase().includes("doc") ||
        buffer.includes(Buffer.from("word/"))
      ) {
        return ".docx";
      }
      if (
        mimeType?.includes("presentationml") ||
        mimeType?.includes("pptx") ||
        name.toLowerCase().includes("ppt") ||
        buffer.includes(Buffer.from("ppt/"))
      ) {
        return ".pptx";
      }
      if (
        mimeType?.includes("spreadsheetml") ||
        mimeType?.includes("xlsx") ||
        name.toLowerCase().includes("xls") ||
        buffer.includes(Buffer.from("xl/"))
      ) {
        return ".xlsx";
      }
      return ".zip";
    }
  }

  // Búsqueda por MIME type
  if (mimeType) {
    const cleanMime = mimeType.toLowerCase().split(";")[0].trim();
    if (MIME_TO_EXTENSION[cleanMime]) {
      return MIME_TO_EXTENSION[cleanMime];
    }
  }

  // Heurística de contenido de texto (SQL, Python, JSON, etc.)
  if (buffer && buffer.length > 0) {
    const sample = buffer.subarray(0, 500).toString("utf8").toLowerCase();
    if (
      sample.includes("create table") ||
      sample.includes("drop database") ||
      sample.includes("insert into") ||
      sample.includes("select * from") ||
      sample.includes("alter table")
    ) {
      return ".sql";
    }
    if (sample.includes("import ") || sample.includes("def ") || sample.includes("print(")) {
      return ".py";
    }
    if (sample.trim().startsWith("{") || sample.trim().startsWith("[")) {
      try {
        JSON.parse(buffer.toString("utf8"));
        return ".json";
      } catch {
        // Not JSON
      }
    }
  }

  // Default a .pdf para documentos académicos si no se identifica otra cosa
  return ".pdf";
}

/**
 * Sanitiza el nombre de archivo y asegura que posea una extensión válida
 */
export function sanitizeFileNameWithExtension(
  name: string,
  mimeType?: string | null,
  buffer?: Buffer | null
): string {
  const cleanName = name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .trim();

  const existingExtMatch = cleanName.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (existingExtMatch) {
    return cleanName;
  }

  const ext = getExtensionFromMimeOrBuffer(name, mimeType, buffer);
  return `${cleanName}${ext}`;
}

/**
 * Obtiene el Content-Type adecuado basado en la extensión o buffer
 */
export function getMimeTypeFromFilenameOrBuffer(
  name: string,
  buffer?: Buffer | null,
  fallbackMime = "application/pdf"
): string {
  if (buffer && buffer.length >= 4) {
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return "application/pdf";
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return "image/png";
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return "image/jpeg";
    }
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      if (name.toLowerCase().endsWith(".docx") || buffer.includes(Buffer.from("word/"))) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
      if (name.toLowerCase().endsWith(".pptx") || buffer.includes(Buffer.from("ppt/"))) {
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      }
      if (name.toLowerCase().endsWith(".xlsx") || buffer.includes(Buffer.from("xl/"))) {
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }
      return "application/zip";
    }
  }

  const extMatch = name.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (extMatch) {
    const ext = `.${extMatch[1].toLowerCase()}`;
    if (EXTENSION_TO_MIME[ext]) {
      return EXTENSION_TO_MIME[ext];
    }
  }

  return fallbackMime;
}

/**
 * Limpia el título del documento evitando la duplicación de año y término,
 * y prepara un nombre legible.
 */
export function cleanDocumentTitle(
  title: string,
  year?: number | null,
  term?: string | null
): string {
  let cleaned = title.replace(/\.[a-zA-Z0-9]{2,5}$/i, "");
  cleaned = cleaned.replace(/^gdrive:[a-zA-Z0-9_-]+\s*/i, "");

  if (year && year > 0) {
    cleaned = cleaned.replace(new RegExp(`\\b${year}\\b`, "gi"), "");
  }
  if (term && term !== "General" && term !== "SF") {
    cleaned = cleaned.replace(new RegExp(`\\b${term}\\b`, "gi"), "");
  }
  // Remover términos y años residuales si ya están en el prefijo
  cleaned = cleaned.replace(/\b(1PAO|2PAO|3PAO|PAE|1T|2T|3T|1S|2S)\b/gi, "");
  cleaned = cleaned.replace(/\b(19\d\d|20\d\d)\b/g, "");

  // Limpiar caracteres inválidos
  cleaned = cleaned
    .replace(/[/\\?%*:|"<>]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    cleaned = title.replace(/[/\\?%*:|"<>]/g, "-").trim();
  }

  return cleaned.replace(/\s+/g, "_");
}

/**
 * Genera el nombre de archivo estandarizado con el formato:
 * {AÑO}_{TERMINO}_{TITULO_LIMPIO}_{CODIGO_MATERIA}.{EXTENSION}
 */
export function formatStandardDocumentFileName(params: {
  title: string;
  year?: number | null;
  term?: string | null;
  subjectCode?: string | null;
  mimeType?: string | null;
  buffer?: Buffer | null;
}): string {
  const { title, year, term, subjectCode, mimeType, buffer } = params;
  const yearLabel = year && year > 0 ? `${year}` : "SF";
  const termLabel = term && term.trim() ? term.trim() : "General";
  const cleanedTitle = cleanDocumentTitle(title, year, term);
  const codeSuffix = subjectCode && subjectCode.trim() ? `_${subjectCode.trim().replace(/[/\\?%*:|"<>]/g, "_")}` : "";

  const baseName = `${yearLabel}_${termLabel}_${cleanedTitle}${codeSuffix}`;
  return sanitizeFileNameWithExtension(baseName, mimeType, buffer);
}

