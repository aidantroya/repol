import crypto from "crypto";
import { computeSemanticContentHash } from "./content-hash";

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  fileSize?: number;
  folderPath?: string;
  isFolder?: boolean;
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
  return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
}

/**
 * Obtiene metadatos de un archivo en Google Drive usando la API oficial v3 si está disponible
 */
export async function getDriveFileMetadata(fileId: string): Promise<{
  id: string;
  name?: string;
  mimeType?: string;
  fileSize?: number;
} | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return null;

  try {
    const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size&key=${apiKey}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RePol-Academic",
      },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        name: data.name,
        mimeType: data.mimeType,
        fileSize: data.size ? parseInt(data.size, 10) : undefined,
      };
    }
  } catch (err) {
    console.warn(`Error getting Drive file metadata for ${fileId}:`, err);
  }
  return null;
}

/**
 * Verifica si un buffer binario corresponde a una página HTML de advertencia o error
 */
function isHtmlBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length === 0) return false;
  const sample = buffer.subarray(0, 300).toString("utf8").trim().toLowerCase();
  return (
    sample.startsWith("<!doctype html") ||
    sample.startsWith("<html") ||
    sample.includes("<title>google drive") ||
    sample.includes("virus scan warning")
  );
}

/**
 * Descarga el contenido binario de un archivo público de Google Drive como Buffer
 * Soporta descarga directa mediante API v3 oficial y fallback con manejo de advertencias de virus.
 */
export async function downloadDriveFileBuffer(fileId: string): Promise<Buffer | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

  // 1. Método preferido y 100% fiable: API oficial v3 de Google Drive
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RePol-Academic",
        },
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (!isHtmlBuffer(buffer)) {
          return buffer;
        }
      }
    } catch (e) {
      console.warn(`[Drive v3 API Download Error] fileId ${fileId}:`, e);
    }
  }

  // 2. Fallbacks de descarga pública directa
  const downloadUrls = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  ];

  for (const url of downloadUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Si no es HTML, hemos descargado el archivo binario exitosamente
        if (!contentType.includes("text/html") && !isHtmlBuffer(buffer)) {
          return buffer;
        }

        // Si es una página HTML de advertencia de virus de Google Drive, intentar extraer el token confirm y cookies
        if (contentType.includes("text/html") || isHtmlBuffer(buffer)) {
          const html = buffer.toString("utf8");

          // Extraer enlace de confirmación o action del formulario
          const confirmMatch =
            html.match(/href="(\/uc\?export=download[^"]+confirm=[^"]+)"/i) ||
            html.match(/action="([^"]+)"[^>]*id="download-form"/i) ||
            html.match(/confirm=([0-9a-zA-Z_-]+)/i);

          const cookiesHeader = res.headers.get("set-cookie") || "";

          if (confirmMatch) {
            let confirmUrl = "";
            if (confirmMatch[1].startsWith("http")) {
              confirmUrl = confirmMatch[1];
            } else if (confirmMatch[1].startsWith("/")) {
              confirmUrl = `https://drive.google.com${confirmMatch[1]}`;
            } else {
              confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
            }

            const confirmRes = await fetch(confirmUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ...(cookiesHeader ? { Cookie: cookiesHeader } : {}),
              },
              redirect: "follow",
            });

            if (confirmRes.ok) {
              const confirmBuf = Buffer.from(await confirmRes.arrayBuffer());
              if (!isHtmlBuffer(confirmBuf)) {
                return confirmBuf;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error downloading drive file ${fileId} from ${url}:`, e);
    }
  }

  return null;
}

/**
 * Descarga el flujo de bytes del archivo público de Google Drive para calcular su firma SHA-256
 * y huella de contenido semántico
 */
/**
 * Extrae el nombre real del archivo de Google Drive desde la página web pública de vista previa
 */
export async function extractDriveTitleFromViewPage(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://drive.google.com/file/d/${fileId}/view`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (res.ok) {
      const html = await res.text();
      const ogMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (ogMatch && ogMatch[1] && ogMatch[1].trim() && !ogMatch[1].includes("Google Drive")) {
        return ogMatch[1].trim();
      }
      const titleMatch = html.match(/<title>([^<]+)\s*-\s*Google\s*Drive<\/title>/i);
      if (titleMatch && titleMatch[1] && titleMatch[1].trim()) {
        return titleMatch[1].trim();
      }
    }
  } catch (err) {
    console.warn(`Error extracting title from drive view page for ${fileId}:`, err);
  }
  return null;
}

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
  try {
    const meta = await getDriveFileMetadata(fileId);
    const pageTitle = !meta?.name ? await extractDriveTitleFromViewPage(fileId) : null;
    const effectiveFilename = meta?.name || pageTitle || filename || "Documento Drive";
    let mimeType = meta?.mimeType || "application/pdf";

    const buffer = await downloadDriveFileBuffer(fileId);

    if (!buffer) {
      const fallbackHash = crypto.createHash("sha256").update(`gdrive:${fileId}`).digest("hex");
      return {
        fileHash: fallbackHash,
        fileSize: meta?.fileSize || 1024 * 1024,
        mimeType,
        rawText: "",
        extractedFilename: effectiveFilename,
      };
    }

    const rawSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileSize = buffer.length;

    // Si el tipo devuelto por metadatos es octet-stream o no está claro, inferir
    if (mimeType === "application/octet-stream" || !mimeType) {
      if (effectiveFilename.toLowerCase().endsWith(".docx")) {
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (effectiveFilename.toLowerCase().endsWith(".pdf")) {
        mimeType = "application/pdf";
      } else if (effectiveFilename.toLowerCase().endsWith(".sql")) {
        mimeType = "text/x-sql";
      } else if (effectiveFilename.toLowerCase().endsWith(".png")) {
        mimeType = "image/png";
      } else if (effectiveFilename.toLowerCase().endsWith(".jpg") || effectiveFilename.toLowerCase().endsWith(".jpeg")) {
        mimeType = "image/jpeg";
      }
    }

    // Intentar calcular huella semántica si es docx o pdf
    try {
      const semResult = await computeSemanticContentHash(buffer, effectiveFilename, mimeType);
      return {
        fileHash: semResult.contentHash || rawSha256,
        semanticHash: semResult.contentHash,
        fileSize,
        mimeType,
        rawText: semResult.rawText || "",
        extractedFilename: effectiveFilename,
      };
    } catch {
      return {
        fileHash: rawSha256,
        fileSize,
        mimeType,
        rawText: "",
        extractedFilename: effectiveFilename,
      };
    }
  } catch (error) {
    console.warn("Could not compute Google Drive file hash:", error);
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

  // 1. Si existe API Key de Google Drive, usar API oficial v3 de Google
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

    const trRegex = /<tr[^>]*id="entry-([a-zA-Z0-9_-]+)"([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;

    while ((trMatch = trRegex.exec(html)) !== null) {
      const entryId = trMatch[1];
      const entryContent = trMatch[2];

      if (entryId === folderId || visitedFolders.has(entryId) || seenIds.has(entryId)) {
        continue;
      }
      seenIds.add(entryId);

      const titleMatch =
        entryContent.match(/<div[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/div>/i) ||
        entryContent.match(/<a[^>]*>([^<]+)<\/a>/i);
      const entryName = titleMatch ? titleMatch[1].trim() : `Elemento ${entryId}`;

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
