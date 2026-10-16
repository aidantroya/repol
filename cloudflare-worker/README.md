# 🚀 RePol PDF Stamper (Cloudflare Worker)

Este Worker de Cloudflare estampa de forma ultra rápida (en milisegundos) y con **$0 costo de ancho de banda y 0 consumo en Vercel** el pie de página interactivo:
> **[R] Descargado de RePol** (con hipervínculo cliqueable a https://repol.vercel.app)

---

## Opción 1: Despliegue en 2 minutos desde el Panel Web de Cloudflare (Recomendado)

1. Inicia sesión en tu cuenta de Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com)
2. En el menú lateral izquierdo, haz clic en **Workers & Pages** (Workers y Pages).
3. Haz clic en el botón azul **Create application** (Crear aplicación) -> pestaña **Workers** -> **Create Worker**.
4. Nómbralo: `repol-pdf-stamper` y dale a **Deploy**.
5. En la pantalla de confirmación, haz clic en **Edit code** (Editar código).
6. En el editor de código, borra todo el contenido existente y **pega el contenido del archivo `dist/index.js`** (que ya viene 100% empaquetado y listo sin requerir npm).
7. Haz clic en **Save and deploy** (Guardar y desplegar).
8. ¡Listo! Cloudflare te dará la URL pública de tu Worker, que luce así:
   `https://repol-pdf-stamper.<tu-subdominio>.workers.dev`

---

## Opción 2: Despliegue mediante Wrangler CLI

Si tienes instalado Wrangler en tu terminal:

```bash
cd cloudflare-worker
npx wrangler deploy
```

---

## Configuración en RePol

Una vez que tengas la URL de tu Worker, simplemente agrégala en las variables de entorno de tu proyecto en el archivo `.env` (y en el panel de Vercel):

```env
WATERMARK_WORKER_URL="https://repol-pdf-stamper.<tu-subdominio>.workers.dev"
```
