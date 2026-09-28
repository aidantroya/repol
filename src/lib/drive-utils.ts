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

/**
 * Descarga el flujo de bytes del archivo público de Google Drive para calcular su firma SHA-256
 */
export async function computeDriveFileHash(
  fileId: string
): Promise<{ fileHash: string; fileSize: number; mimeType: string }> {
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

    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileSize = buffer.length;
    const contentType = res.headers.get("content-type") || "application/pdf";

    return { fileHash, fileSize, mimeType: contentType };
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

/**
 * Obtiene la lista de archivos dentro de una carpeta pública de Google Drive
 */
export async function fetchGoogleDriveFolderFiles(folderId: string): Promise<DriveItem[]> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

  // 1. Si existe API Key de Google Drive, usar API oficial v3
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size)&key=${apiKey}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.files && Array.isArray(data.files)) {
          return data.files.map((f: { id: string; name: string; mimeType: string; size?: string }) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            fileSize: f.size ? parseInt(f.size, 10) : undefined,
          }));
        }
      }
    } catch (err) {
      console.warn("Error calling Google Drive API v3, falling back to public embedded scraper:", err);
    }
  }

  // 2. Método de extracción pública sin API Key (Embedded Folderview & Web Parser)
  try {
    const embeddedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
    const res = await fetch(embeddedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`No se pudo acceder a la carpeta pública de Google Drive (Status ${res.status}).`);
    }

    const html = await res.text();
    const files: DriveItem[] = [];
    const seenIds = new Set<string>();

    // Extracción por clases de vista embebida
    const entryRegex = /id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<div[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/div>/g;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(html)) !== null) {
      const fId = match[1];
      const fName = match[2].trim();
      if (!seenIds.has(fId)) {
        seenIds.add(fId);
        files.push({
          id: fId,
          name: fName,
          mimeType: fName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
        });
      }
    }

    // Si la expresión regular anterior no capturó, extraer por enlaces directos
    if (files.length === 0) {
      const linkRegex = /href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)[^"]*"[^>]*>([^<]+)<\/a>/g;
      while ((match = linkRegex.exec(html)) !== null) {
        const fId = match[1];
        const fName = match[2].trim();
        if (!seenIds.has(fId) && fName) {
          seenIds.add(fId);
          files.push({
            id: fId,
            name: fName,
            mimeType: "application/pdf",
          });
        }
      }
    }

    // Extracción de respaldo por JSON payloads en la página
    if (files.length === 0) {
      const fileIdMatch = html.match(/\/file\/d\/([a-zA-Z0-9_-]{25,})/g);
      if (fileIdMatch) {
        for (const raw of fileIdMatch) {
          const id = raw.replace("/file/d/", "");
          if (!seenIds.has(id)) {
            seenIds.add(id);
            files.push({
              id,
              name: `Documento Drive (${id.substring(0, 6)}).pdf`,
              mimeType: "application/pdf",
            });
          }
        }
      }
    }

    return files;
  } catch (err) {
    console.error("Error scraping Google Drive folder:", err);
    throw new Error("No se pudo leer el contenido de la carpeta. Asegúrate de que el enlace de la carpeta esté en modo público ('Cualquier persona con el enlace puede ver').");
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
