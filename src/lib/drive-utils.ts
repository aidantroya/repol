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
): Promise<{
  fileHash: string;
  semanticHash?: string;
  fileSize: number;
  mimeType: string;
  rawText?: string;
  extractedFilename?: string;
}> {
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
        rawText: "",
        extractedFilename: filename,
      };
    }

    const disposition = res.headers.get("content-disposition") || "";
    let extractedFilename = filename;
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      extractedFilename = decodeURIComponent(match[1]).trim();
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileSize = buffer.length;
    const contentType = res.headers.get("content-type") || "application/pdf";

    // Intentar calcular huella semántica si es docx o pdf
    try {
      const semResult = await computeSemanticContentHash(buffer, extractedFilename || filename, contentType);
      return {
        fileHash: semResult.contentHash || rawSha256,
        semanticHash: semResult.contentHash,
        fileSize,
        mimeType: contentType,
        rawText: semResult.rawText || "",
        extractedFilename,
      };
    } catch {
      return {
        fileHash: rawSha256,
        fileSize,
        mimeType: contentType,
        rawText: "",
        extractedFilename,
      };
    }
  } catch (error) {
    console.warn("Could not stream Google Drive file directly, falling back to ID-based hash:", error);
    const fallbackHash = crypto.createHash("sha256").update(`gdrive:${fileId}`).digest("hex");
    return {
      fileHash: fallbackHash,
      fileSize: 1024 * 1024,
      mimeType: "application/pdf",
      rawText: "",
      extractedFilename: filename,
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

function isDriveFolder(entryName: string, entryContent: string, entryId = ""): boolean {
  const lowerName = entryName.toLowerCase().trim();
  const lowerContent = entryContent.toLowerCase();

  // 1. Si el nombre tiene extensión de archivo conocida, NUNCA es carpeta
  const fileExtensions = [
    ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls",
    ".zip", ".rar", ".7z", ".txt", ".csv", ".png", ".jpg", ".jpeg",
    ".mp4", ".ipynb", ".py", ".c", ".cpp", ".java", ".sql", ".epub"
  ];
  if (fileExtensions.some((ext) => lowerName.endsWith(ext))) {
    return false;
  }

  // 2. Si el contenido contiene enlace explícito a un archivo o visor de documento de Drive
  if (
    lowerContent.includes("/file/d/") ||
    lowerContent.includes("docs.google.com") ||
    lowerContent.includes("drive.google.com/file") ||
    lowerContent.includes("open?id=") ||
    lowerContent.includes("flipview-icon-file") ||
    lowerContent.includes("icon-file") ||
    lowerContent.includes("icon-pdf") ||
    lowerContent.includes("icon-doc") ||
    lowerContent.includes("icon-presentation") ||
    lowerContent.includes("icon-spreadsheet") ||
    lowerContent.includes("data-target=\"file\"")
  ) {
    return false;
  }

  // 3. Si contiene identificadores de carpeta o enlaces a vistas de carpeta
  if (
    lowerContent.includes("flipview-icon-folder") ||
    lowerContent.includes("folder-icon") ||
    lowerContent.includes("icon-folder") ||
    lowerContent.includes("drive-icon-folder") ||
    lowerContent.includes("/drive/folders/") ||
    (entryId && lowerContent.includes(`id=${entryId}`)) ||
    lowerContent.includes("embeddedfolderview?id=") ||
    lowerContent.includes("data-target=\"folder\"") ||
    lowerContent.includes("aria-label=\"carpeta\"") ||
    lowerContent.includes("aria-label=\"folder\"")
  ) {
    return true;
  }

  // 4. Si no tiene enlace a archivo /file/d/ ni extensión, es una carpeta contenedora
  return true;
}

export interface CrawlResult {
  items: DriveItem[];
  debug: {
    folderId: string;
    totalFound: number;
    subFoldersFound: number;
    htmlLength?: number;
    status?: number;
    logs: string[];
  };
}

/**
 * Obtiene recursivamente todos los archivos dentro de una carpeta y sus subcarpetas en Google Drive
 */
export async function fetchGoogleDriveFolderFiles(
  folderId: string,
  currentPath = "",
  currentDepth = 0,
  maxDepth = 4,
  visitedFolders = new Set<string>(),
  debugLogs: string[] = []
): Promise<DriveItem[]> {
  if (currentDepth > maxDepth || visitedFolders.has(folderId)) {
    debugLogs.push(`[Skip] Depth ${currentDepth} > ${maxDepth} or already visited ${folderId}`);
    return [];
  }
  visitedFolders.add(folderId);

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const allItems: DriveItem[] = [];

  // 1. Si existe API Key de Google Drive, usar API oficial v3 de Google (método idéntico a google-api-python-client)
  if (apiKey) {
    try {
      let pageToken: string | undefined = undefined;
      do {
        const queryParams = new URLSearchParams({
          q: `'${folderId}' in parents and trashed = false`,
          fields: "files(id, name, mimeType, size, webViewLink, webContentLink), nextPageToken",
          pageSize: "1000",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
          key: apiKey,
        });
        if (pageToken) {
          queryParams.set("pageToken", pageToken);
        }

        const apiUrl = `https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`;
        const res = await fetch(apiUrl);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`Error API Drive v3 (${res.status}): ${errData.error?.message || res.statusText}`);
        }

        const data = await res.json();
        if (data.files && Array.isArray(data.files)) {
          debugLogs.push(`[API v3] Carpeta ${folderId} retornó ${data.files.length} elementos`);
          for (const f of data.files) {
            const isFolder = f.mimeType === "application/vnd.google-apps.folder";
            if (isFolder) {
              const subPath = currentPath ? `${currentPath} / ${f.name}` : f.name;
              debugLogs.push(`[API v3 Subcarpeta] Entrando a: ${subPath} (${f.id})`);
              const subFiles = await fetchGoogleDriveFolderFiles(
                f.id,
                subPath,
                currentDepth + 1,
                maxDepth,
                visitedFolders,
                debugLogs
              );
              allItems.push(...subFiles);
            } else {
              debugLogs.push(`[API v3 Archivo] Encontrado: ${f.name} (${f.id})`);
              allItems.push({
                id: f.id,
                name: f.name,
                mimeType: f.mimeType,
                fileSize: f.size ? parseInt(f.size, 10) : undefined,
                folderPath: currentPath || undefined,
              });
            }
          }
        }
        pageToken = data.nextPageToken;
      } while (pageToken);

      return allItems;
    } catch (err) {
      debugLogs.push(`[API v3 Error] ${err instanceof Error ? err.message : String(err)}`);
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

    debugLogs.push(`[Scraper] Folder ${folderId} -> HTTP Status: ${res.status}`);

    if (!res.ok) {
      throw new Error(`Google Drive respondió con HTTP ${res.status} al consultar la carpeta ${folderId}.`);
    }

    const html = await res.text();
    debugLogs.push(`[Scraper] Folder ${folderId} -> HTML Length: ${html.length}`);

    const seenIds = new Set<string>();
    const subFoldersToCrawl: Array<{ id: string; name: string }> = [];

    // Parsear cada entrada de tabla o contenedor de la vista
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
      const isFolder = isDriveFolder(entryName, entryContent, entryId);

      if (isFolder) {
        debugLogs.push(`[Subfolder detected] ${entryName} (${entryId})`);
        subFoldersToCrawl.push({ id: entryId, name: entryName });
      } else {
        debugLogs.push(`[File detected] ${entryName} (${entryId})`);
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

    // Fallback genérico por id="entry-XXXX" si trRegex no coincidió
    if (subFoldersToCrawl.length === 0 && allItems.length === 0) {
      const entryRegex = /id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<div[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/div>/gi;
      let match: RegExpExecArray | null;
      while ((match = entryRegex.exec(html)) !== null) {
        const fId = match[1];
        const fName = match[2].trim();
        if (!seenIds.has(fId) && fId !== folderId && !visitedFolders.has(fId)) {
          seenIds.add(fId);
          allItems.push({
            id: fId,
            name: fName,
            mimeType: fName.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : fName.toLowerCase().endsWith(".docx")
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
        visitedFolders,
        debugLogs
      );
      allItems.push(...subFiles);
    }

    return allItems;
  } catch (err) {
    debugLogs.push(`[Error in ${folderId}] ${String(err)}`);
    if (currentDepth === 0 && allItems.length === 0) {
      throw new Error(
        `No se pudo leer el contenido de la carpeta de Google Drive: ${err instanceof Error ? err.message : String(err)}`
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
