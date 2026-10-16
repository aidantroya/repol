import { PDFDocument, rgb, StandardFonts, PDFName, PDFString } from 'pdf-lib';
import { REPOL_LOGO_BASE64 } from './logo-b64.js';

export default {
  async fetch(request, env, ctx) {
    // 1. Manejar preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Método no permitido', { status: 405 });
    }

    const url = new URL(request.url);
    const driveId = url.searchParams.get('driveId');
    const directUrl = url.searchParams.get('url');
    const filename = url.searchParams.get('name') || 'documento.pdf';
    const siteUrl = env?.SITE_URL || url.searchParams.get('siteUrl') || 'https://repol-ten.vercel.app/';

    if (!driveId && !directUrl) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>RePol PDF Watermark Worker</title>
            <style>
              body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #1e293b; }
              h1 { color: #3b82f6; }
              code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>🚀 RePol PDF Watermark Worker Activo</h1>
            <p>Este worker inyecta de forma segura el sello y link oficial de RePol en los PDFs descargados.</p>
            <p><strong>Uso esperado:</strong></p>
            <ul>
              <li><code>?driveId=ID_GOOGLE_DRIVE&name=archivo.pdf</code></li>
              <li><code>?url=URL_DIRECTA_R2&name=archivo.pdf</code></li>
            </ul>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    try {
      let pdfBytes;

      // 2. Descargar el archivo fuente
      if (driveId) {
        // Enlace directo de descarga de Google Drive con bypass de confirmación
        const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`;
        const driveRes = await fetch(driveDownloadUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!driveRes.ok) {
          return new Response(`Error al obtener archivo desde Google Drive: HTTP ${driveRes.status}`, { status: 502 });
        }

        const initialBuffer = await driveRes.arrayBuffer();
        
        // Comprobar si Google Drive devolvió una página HTML de advertencia de virus para archivos grandes
        const initialText = new TextDecoder().decode(initialBuffer.slice(0, 1000));
        if (initialText.includes('download-form') || initialText.includes('confirm=')) {
          const match = initialText.match(/confirm=([0-9A-Za-z_-]+)/);
          const confirmToken = match ? match[1] : 't';
          const confirmedUrl = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=${confirmToken}`;
          const retryRes = await fetch(confirmedUrl);
          if (retryRes.ok) {
            pdfBytes = await retryRes.arrayBuffer();
          } else {
            pdfBytes = initialBuffer;
          }
        } else {
          pdfBytes = initialBuffer;
        }
      } else if (directUrl) {
        const directRes = await fetch(directUrl);
        if (!directRes.ok) {
          return new Response(`Error al obtener archivo desde URL remota: HTTP ${directRes.status}`, { status: 502 });
        }
        pdfBytes = await directRes.arrayBuffer();
      }

      // Si no es un PDF válido (no inicia con %PDF), devolver los bytes originales sin modificar
      const headerBytes = new Uint8Array(pdfBytes.slice(0, 5));
      const isPdf = headerBytes[0] === 0x25 && headerBytes[1] === 0x50 && headerBytes[2] === 0x44 && headerBytes[3] === 0x46; // %PDF

      if (!isPdf) {
        return new Response(pdfBytes, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 3. Modificar el PDF con pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Incrustar el logo oficial de RePol (ícono del libro con degradado azul)
      let logoImage = null;
      try {
        const logoBinary = atob(REPOL_LOGO_BASE64);
        const logoBytes = new Uint8Array(logoBinary.length);
        for (let i = 0; i < logoBinary.length; i++) {
          logoBytes[i] = logoBinary.charCodeAt(i);
        }
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (logoErr) {
        console.warn('No se pudo incrustar el logo PNG, usando fallback gráfico:', logoErr);
      }

      const pages = pdfDoc.getPages();

      for (const page of pages) {
        const cropBox = page.getCropBox() || { x: 0, y: 0 };
        const originX = cropBox.x || 0;
        const originY = cropBox.y || 0;

        // Coordenadas en la esquina inferior izquierda con margen respetando cropBox
        const x = originX + 24;
        const y = originY + 22;
        const badgeSize = 16;
        const pillWidth = 148;
        const pillHeight = 24;

        // 1. Pastilla protectora blanca con borde suave para máxima legibilidad sobre cualquier fondo
        page.drawRectangle({
          x: x - 4,
          y: y - 4,
          width: pillWidth,
          height: pillHeight,
          color: rgb(1, 1, 1),
          opacity: 0.95,
          borderColor: rgb(0.8, 0.85, 0.95),
          borderWidth: 1,
          borderRadius: 6,
        });

        // 2. Logotipo oficial de RePol (o isotipo fallback)
        if (logoImage) {
          page.drawImage(logoImage, {
            x: x,
            y: y,
            width: badgeSize,
            height: badgeSize,
          });
        } else {
          page.drawRectangle({
            x: x,
            y: y,
            width: badgeSize,
            height: badgeSize,
            color: rgb(0.24, 0.44, 0.94),
            opacity: 0.9,
            borderRadius: 3.5,
          });
          page.drawText('R', {
            x: x + 4.5,
            y: y + 4,
            size: 9,
            font: fontBold,
            color: rgb(1, 1, 1),
            opacity: 1,
          });
        }

        // 4. Texto descriptivo con opacidad sutil
        page.drawText('Descargado de ', {
          x: x + 21,
          y: y + 4,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.35, 0.42, 0.52),
          opacity: 0.85,
        });

        // 5. Nombre de la plataforma en negrita
        page.drawText('RePol', {
          x: x + 84,
          y: y + 4,
          size: 8.5,
          font: fontBold,
          color: rgb(0.2, 0.4, 0.9),
          opacity: 1,
        });

        // 6. Hipervínculo cliqueable interactivo que abarca toda la pastilla
        const linkAnnotation = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x - 4, y - 4, x - 4 + pillWidth, y - 4 + pillHeight],
          Border: [0, 0, 0],
          C: [0, 0, 0],
          A: {
            Type: 'Action',
            S: 'URI',
            URI: PDFString.of(siteUrl),
          },
        });

        const linkRef = pdfDoc.context.register(linkAnnotation);
        let annots = page.node.lookup(PDFName.of('Annots'));
        if (!annots) {
          annots = pdfDoc.context.obj([]);
          page.node.set(PDFName.of('Annots'), annots);
        }
        if (typeof annots.push === 'function') {
          annots.push(linkRef);
        }
      }

      // 4. Serializar el PDF modificado
      const modifiedPdfBytes = await pdfDoc.save();

      return new Response(modifiedPdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': modifiedPdfBytes.byteLength.toString(),
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      console.error('Error procesando PDF en Cloudflare Worker:', err);
      return new Response(`Error interno al estampar PDF: ${err.message}`, { status: 500 });
    }
  },
};
