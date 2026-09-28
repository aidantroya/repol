import crypto from "crypto";

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  fileSize?: number;
}

/**
 * Extrae el ID de una carpeta de Google Drive
 */
export function extractGoogleDriveFolderId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return null;
}

/**
 * Extrae el ID único de un archivo de Google Drive
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;

  // Si es una carpeta, no tratarlo como archivo
  if (url.includes("/folders/")) return null;

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function getGoogleDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function getGoogleDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

import { computeSemanticContentHash } from "./content-hash";

/**
 * Descarga el flujo de bytes del archivo público de Google Drive para calcular su firma SHA-256
 * y huella de contenido semántico (para cotejar DOCX con PDF con exactitud)
 */
export async function computeDriveFileHash(
  fileId: string,
  filename = ""
): Promise<{ fileHash: string; semanticHash?: string; fileSize: number; mimeType: string }> {
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  try {
    const res = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RePol-Academic-Agent",
      },
    });

    if (!res.ok) {
      const fallbackHash = crypto.createHash("sha256").update(`gdrive:${fileId}`).digest("hex");
      return {
        fileHash: fallbackHash,
        fileSize: 1024 * 1024,
        mimeType: "application/pdf",
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileSize = buffer.length;
    const contentType = res.headers.get("content-type") || "application/pdf";

    // Intentar calcular huella semántica si es docx o pdf
    try {
      const semResult = await computeSemanticContentHash(buffer, filename, contentType);
      return {
        fileHash: semResult.contentHash || rawSha256,
        semanticHash: semResult.contentHash,
        fileSize,
        mimeType: contentType,
      };
    } catch {
      return { fileHash: rawSha256, fileSize, mimeType: contentType };
    }
  } catch (error) {
    console.warn("Could not stream Google Drive file directly, falling back to ID-based hash:", error);
    const fallbackHash = crypto.createHash("sha256").update(`gdrive:${fileId}`).digest("hex");
    return {
      fileHash: fallbackHash,
      fileSize: 1024 * 1024,
      mimeType: "application/pdf",
    };
  }
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  fileSize?: number;
  folderPath?: string;
  isFolder?: boolean;
}

function isDriveFolder(entryName: string, entryContent: string): boolean {
  const lowerName = entryName.toLowerCase().trim();
  const lowerContent = entryContent.toLowerCase();

  // 1. Si tiene extensión de archivo conocida, NUNCA es carpeta
  const fileExtensions = [
    ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls",
    ".zip", ".rar", ".7z", ".txt", ".csv", ".png", ".jpg", ".jpeg",
    ".mp4", ".ipynb", ".py", ".c", ".cpp", ".java", ".sql", ".epub"
  ];
  if (fileExtensions.some((ext) => lowerName.endsWith(ext))) {
    return false;
  }

  // 2. Si contiene enlace explícito a archivo, documento o visor de Drive
  if (
    lowerContent.includes("/file/d/") ||
    lowerContent.includes("docs.google.com") ||
    lowerContent.includes("flipview-icon-file") ||
    lowerContent.includes("icon-file") ||
    lowerContent.includes("icon-pdf") ||
    lowerContent.includes("icon-doc") ||
    lowerContent.includes("icon-presentation") ||
    lowerContent.includes("icon-spreadsheet") ||
    lowerContent.includes("open?id=")
  ) {
    return false;
  }

  // 3. Si contiene iconos o atributos explícitos de carpeta
  if (
    lowerContent.includes("flipview-icon-folder") ||
    lowerContent.includes("folder-icon") ||
    lowerContent.includes("icon-folder") ||
    lowerContent.includes("drive-icon-folder") ||
    lowerContent.includes("/drive/folders/") ||
    lowerContent.includes("data-target=\"folder\"") ||
    lowerContent.includes("aria-label=\"carpeta\"") ||
    lowerContent.includes("aria-label=\"folder\"")
  ) {
    return true;
  }

  // 4. Si el nombre sugiere una carpeta contenedora
  const folderKeywords = ["clases", "clase", "examenes", "examen", "lecciones", "leccion", "talleres", "taller", "deberes", "unidad", "capitulo", "parcial", "final", "apuntes"];
  if (folderKeywords.some((kw) => lowerName === kw || lowerName.startsWith(kw + " "))) {
    return true;
  }

  // Por defecto, tratar como archivo
  return false;
}

/**
 * Obtiene recursivamente todos los archivos dentro de una carpeta y sus subcarpetas en Google Drive
 */
export async function fetchGoogleDriveFolderFiles(
  folderId: string,
  currentPath = "",
  currentDepth = 0,
  maxDepth = 4,
  visitedFolders = new Set<string>()
): Promise<DriveItem[]> {
  if (currentDepth > maxDepth || visitedFolders.has(folderId)) {
    return [];
  }
  visitedFolders.add(folderId);

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const allItems: DriveItem[] = [];

  // 1. Si existe API Key de Google Drive, usar API oficial v3
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size)&key=${apiKey}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.files && Array.isArray(data.files)) {
          for (const f of data.files) {
            const isFolder = f.mimeType === "application/vnd.google-apps.folder";
            if (isFolder) {
              const subPath = currentPath ? `${currentPath} / ${f.name}` : f.name;
              const subFiles = await fetchGoogleDriveFolderFiles(
                f.id,
                subPath,
                currentDepth + 1,
                maxDepth,
                visitedFolders
              );
              allItems.push(...subFiles);
            } else {
              allItems.push({
                id: f.id,
                name: f.name,
                mimeType: f.mimeType,
                fileSize: f.size ? parseInt(f.size, 10) : undefined,
                folderPath: currentPath || undefined,
              });
            }
          }
          return allItems;
        }
      }
    } catch (err) {
      console.warn("Error en API de Drive v3, continuando con extractor embebido recursivo:", err);
    }
  }

  // 2. Extracción mediante embedded folderview & scraper recursivo
  try {
    const embeddedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
    const res = await fetch(embeddedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`No se pudo acceder a la carpeta pública de Google Drive (Status ${res.status}).`);
    }

    const html = await res.text();
    const seenIds = new Set<string>();
    const subFoldersToCrawl: Array<{ id: string; name: string }> = [];

    // Parsear cada fila <tr id="entry-XXXX"> de la vista de Google Drive
    const trRegex = /<tr[^>]*id="entry-([a-zA-Z0-9_-]+)"([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;

    while ((trMatch = trRegex.exec(html)) !== null) {
      const entryId = trMatch[1];
      const entryContent = trMatch[2];

      if (entryId === folderId || visitedFolders.has(entryId) || seenIds.has(entryId)) {
        continue;
      }
      seenIds.add(entryId);

      // Extraer título / nombre del elemento
      const titleMatch =
        entryContent.match(/<div[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/div>/i) ||
        entryContent.match(/<a[^>]*>([^<]+)<\/a>/i);
      const entryName = titleMatch ? titleMatch[1].trim() : `Elemento ${entryId}`;

      // Determinar si es una CARPETA o un ARCHIVO con precisión
      const isFolder = isDriveFolder(entryName, entryContent);

      if (isFolder) {
        subFoldersToCrawl.push({ id: entryId, name: entryName });
      } else {
        // Es un archivo real (.pdf, .docx, diapositivas, hojas, etc.)
        allItems.push({
          id: entryId,
          name: entryName,
          mimeType: entryName.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : entryName.toLowerCase().endsWith(".docx")
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/octet-stream",
          folderPath: currentPath || undefined,
        });
      }
    }

    // Fallback: Detectar carpetas explícitas por enlace si no hubo filas de tabla
    if (subFoldersToCrawl.length === 0 && allItems.length === 0) {
      const folderLinkRegex =
        /href="(?:\/drive\/folders\/|https:\/\/drive\.google\.com\/drive\/folders\/|embeddedfolderview\?id=)([a-zA-Z0-9_-]+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
      let fMatch: RegExpExecArray | null;
      while ((fMatch = folderLinkRegex.exec(html)) !== null) {
        const fId = fMatch[1];
        const fName = fMatch[2].trim();
        if (fId !== folderId && !visitedFolders.has(fId) && !seenIds.has(fId)) {
          seenIds.add(fId);
          subFoldersToCrawl.push({ id: fId, name: fName });
        }
      }

      // Fallback: Detectar archivos por enlace directo
      const fileLinkRegex =
        /href="(?:\/file\/d\/|https:\/\/drive\.google\.com\/file\/d\/|open\?id=)([a-zA-Z0-9_-]+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
      let fileMatch: RegExpExecArray | null;
      while ((fileMatch = fileLinkRegex.exec(html)) !== null) {
        const fileId = fileMatch[1];
        const fileName = fileMatch[2].trim();
        if (!seenIds.has(fileId)) {
          seenIds.add(fileId);
          allItems.push({
            id: fileId,
            name: fileName,
            mimeType: fileName.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : fileName.toLowerCase().endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/octet-stream",
            folderPath: currentPath || undefined,
          });
        }
      }
    }

    // Rastrear recursivamente todas las subcarpetas encontradas
    for (const subF of subFoldersToCrawl) {
      const subPath = currentPath ? `${currentPath} / ${subF.name}` : subF.name;
      const subFiles = await fetchGoogleDriveFolderFiles(
        subF.id,
        subPath,
        currentDepth + 1,
        maxDepth,
        visitedFolders
      );
      allItems.push(...subFiles);
    }

    return allItems;
  } catch (err) {
    console.error("Error al procesar carpeta de Google Drive:", err);
    if (currentDepth === 0 && allItems.length === 0) {
      throw new Error(
        "No se pudo leer el contenido de la carpeta. Asegúrate de que el enlace de la carpeta esté en modo público ('Cualquier persona con el enlace puede ver')."
      );
    }
    return allItems;
  }
}

/**
 * Descarga el contenido binario de un archivo público de Google Drive como Buffer
 */
export async function downloadDriveFileBuffer(fileId: string): Promise<Buffer | null> {
  const downloadUrls = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  ];

  for (const url of downloadUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RePol/1.0",
        },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch (e) {
      console.warn(`Error downloading drive file ${fileId} from ${url}:`, e);
    }
  }
  return null;
}
