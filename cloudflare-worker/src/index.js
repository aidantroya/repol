import { PDFDocument, rgb, StandardFonts, PDFName, PDFString } from 'pdf-lib';

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
    const siteUrl = url.searchParams.get('siteUrl') || 'https://repol.vercel.app';

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

      const pages = pdfDoc.getPages();

      for (const page of pages) {
        // Coordenadas en la esquina inferior izquierda (con margen seguro)
        const x = 24;
        const y = 22;
        const badgeSize = 16;

        // Cuadrado redondeado distintivo de RePol (azul/índigo)
        page.drawRectangle({
          x: x,
          y: y,
          width: badgeSize,
          height: badgeSize,
          color: rgb(0.24, 0.44, 0.94),
          opacity: 0.8,
          borderRadius: 3.5,
        });

        // Letra 'R' estilizada en el interior del isotipo
        page.drawText('R', {
          x: x + 4.5,
          y: y + 4,
          size: 9,
          font: fontBold,
          color: rgb(1, 1, 1),
          opacity: 1,
        });

        // Texto descriptivo con opacidad sutil
        page.drawText('Descargado de ', {
          x: x + 20,
          y: y + 4,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.35, 0.42, 0.52),
          opacity: 0.8,
        });

        // Nombre de la plataforma en negrita
        page.drawText('RePol', {
          x: x + 82,
          y: y + 4,
          size: 8.5,
          font: fontBold,
          color: rgb(0.2, 0.4, 0.9),
          opacity: 0.95,
        });

        // Hipervínculo cliqueable interactivo que abarca todo el badge y texto
        const linkAnnotation = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x - 2, y - 2, x + 120, y + badgeSize + 2],
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
