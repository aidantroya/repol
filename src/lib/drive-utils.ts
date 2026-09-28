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
              const subPath = currentPath ? `${currentPath}/${f.name}` : f.name;
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

    // Detectar carpetas hijas dentro de la vista
    const folderRegex = /href="https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)[^"]*"[^>]*>([^<]+)<\/a>/g;
    let folderMatch: RegExpExecArray | null;
    while ((folderMatch = folderRegex.exec(html)) !== null) {
      const fId = folderMatch[1];
      const fName = folderMatch[2].trim();
      if (fId !== folderId && !visitedFolders.has(fId)) {
        subFoldersToCrawl.push({ id: fId, name: fName });
      }
    }

    // Detectar archivos por entrada de tabla
    const entryRegex = /id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<div[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/div>/g;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(html)) !== null) {
      const fId = match[1];
      const fName = match[2].trim();
      if (!seenIds.has(fId)) {
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

    // Detectar archivos por enlace directo
    if (allItems.length === 0) {
      const linkRegex = /href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)[^"]*"[^>]*>([^<]+)<\/a>/g;
      while ((match = linkRegex.exec(html)) !== null) {
        const fId = match[1];
        const fName = match[2].trim();
        if (!seenIds.has(fId) && fName) {
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

    // Rastrear subcarpetas detectadas
    for (const subF of subFoldersToCrawl) {
      const subPath = currentPath ? `${currentPath}/${subF.name}` : subF.name;
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
