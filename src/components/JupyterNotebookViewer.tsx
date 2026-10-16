"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Download, 
  Printer, 
  Copy, 
  Check, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Code2
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface JupyterNotebookViewerProps {
  fileUrl: string;
  title: string;
  onDownloadOriginal?: () => void;
  fileSize?: number;
}

interface CellOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string;
  text?: string | string[];
  data?: {
    "text/plain"?: string | string[];
    "text/html"?: string | string[];
    "image/png"?: string;
    "image/jpeg"?: string;
    "image/svg+xml"?: string | string[];
    [key: string]: unknown;
  };
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NotebookCell {
  cell_type: "markdown" | "code" | "raw";
  execution_count?: number | null;
  source: string | string[];
  outputs?: CellOutput[];
}

interface NotebookJSON {
  cells?: NotebookCell[];
  worksheets?: Array<{ cells: NotebookCell[] }>;
  metadata?: {
    language_info?: {
      name?: string;
      version?: string;
    };
    kernelspec?: {
      display_name?: string;
      name?: string;
    };
  };
}

// Limpiar códigos de escape ANSI de terminal (colores de errores en traceback)
function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*[mGKH]/g, "");
}

// Convertir source (string o array de strings) a string único
function getCellSourceText(source: string | string[]): string {
  if (Array.isArray(source)) {
    return source.join("");
  }
  return source || "";
}

// Renderizador liviano de Markdown para celdas de Jupyter
function renderMarkdown(md: string) {
  if (!md) return null;

  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 text-zinc-300">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const parseInlineMarkdown = (text: string): React.ReactNode => {
    // Reemplazar imágenes markdown: ![alt](url)
    const imgMatch = text.match(/!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      const parts = text.split(imgMatch[0]);
      return (
        <span>
          {parts[0]}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full rounded my-2 border border-zinc-700" />
          {parts[1]}
        </span>
      );
    }

    // Reemplazar enlaces markdown: [texto](url)
    const linkMatch = text.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const parts = text.split(linkMatch[0]);
      return (
        <span>
          {parts[0]}
          <a href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300">
            {linkMatch[1]}
          </a>
          {parts[1]}
        </span>
      );
    }

    // Negrita **texto** y código `inline`
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return tokens.map((token, idx) => {
      if (token.startsWith("`") && token.endsWith("`")) {
        return (
          <code key={idx} className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-xs text-amber-300 font-mono">
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith("**") && token.endsWith("**")) {
        return (
          <strong key={idx} className="font-bold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith("*") && token.endsWith("*")) {
        return (
          <em key={idx} className="italic text-zinc-300">
            {token.slice(1, -1)}
          </em>
        );
      }
      return token;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bloques de código ```
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div key={`codeblock-${elements.length}`} className="my-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 overflow-x-auto">
            <pre>{codeBlockContent.join("\n")}</pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockContent = [];
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Listas con viñetas
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      listItems.push(line.trim().substring(2));
      continue;
    } else {
      flushList();
    }

    // Encabezados
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl font-bold text-white border-b border-zinc-800 pb-2 mt-4 mb-2">
          {parseInlineMarkdown(line.substring(2))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl font-bold text-white border-b border-zinc-800/60 pb-1 mt-3 mb-2">
          {parseInlineMarkdown(line.substring(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg font-bold text-zinc-100 mt-3 mb-1">
          {parseInlineMarkdown(line.substring(4))}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-base font-semibold text-zinc-200 mt-2 mb-1">
          {parseInlineMarkdown(line.substring(5))}
        </h4>
      );
    } else if (line.trim().startsWith("> ")) {
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-blue-500/50 pl-3 py-1 my-2 text-zinc-300 italic bg-blue-500/5 rounded-r">
          {parseInlineMarkdown(line.trim().substring(2))}
        </blockquote>
      );
    } else if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<hr key={`hr-${i}`} className="border-zinc-800 my-4" />);
    } else if (line.trim() === "") {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
    } else {
      elements.push(
        <p key={`p-${i}`} className="my-1.5 text-zinc-300 leading-relaxed text-sm">
          {parseInlineMarkdown(line)}
        </p>
      );
    }
  }

  flushList();
  return elements;
}

// Resaltado de sintaxis liviano para código Python
function HighlightedCode({ code }: { code: string }) {
  const lines = code.split("\n");

  const highlightPythonLine = (line: string) => {
    // Si la línea es un comentario
    if (line.trim().startsWith("#")) {
      return <span className="text-zinc-500 italic">{line}</span>;
    }

    const commentIdx = line.indexOf("#");
    const codePart = commentIdx !== -1 ? line.substring(0, commentIdx) : line;
    const commentPart = commentIdx !== -1 ? line.substring(commentIdx) : "";

    const keywords = /\b(import|from|as|def|return|class|if|elif|else|for|while|try|except|finally|with|in|is|not|and|or|True|False|None|lambda|yield|break|continue|pass)\b/g;

    const parts = codePart.split(keywords);

    return (
      <span>
        {parts.map((part, idx) => {
          if (keywords.test(part)) {
            return (
              <span key={idx} className="text-purple-400 font-semibold">
                {part}
              </span>
            );
          }
          // Resaltar cadenas de texto simples "..." o '...'
          const strParts = part.split(/(".*?"|'.*?')/g);
          return strParts.map((sub, sIdx) => {
            if ((sub.startsWith('"') && sub.endsWith('"')) || (sub.startsWith("'") && sub.endsWith("'"))) {
              return (
                <span key={sIdx} className="text-emerald-300">
                  {sub}
                </span>
              );
            }
            return sub;
          });
        })}
        {commentPart && <span className="text-zinc-500 italic">{commentPart}</span>}
      </span>
    );
  };

  return (
    <div className="font-mono text-xs leading-relaxed overflow-x-auto select-text">
      {lines.map((line, idx) => (
        <div key={idx} className="table-row">
          <span className="table-cell pr-4 text-right text-zinc-600 select-none font-mono text-[11px] w-8">
            {idx + 1}
          </span>
          <span className="table-cell whitespace-pre">{highlightPythonLine(line)}</span>
        </div>
      ))}
    </div>
  );
}

export function JupyterNotebookViewer({
  fileUrl,
  title,
  onDownloadOriginal,
  fileSize,
}: JupyterNotebookViewerProps) {
  const [notebook, setNotebook] = useState<NotebookJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCellIndex, setCopiedCellIndex] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchNotebook() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(fileUrl);
        if (!res.ok) {
          throw new Error(`Error HTTP ${res.status}: no se pudo obtener el archivo`);
        }

        const text = await res.text();
        const json = JSON.parse(text) as NotebookJSON;

        if (!isCancelled) {
          if (!json.cells && (!json.worksheets || !json.worksheets[0]?.cells)) {
            throw new Error("El archivo no tiene el formato estándar de Jupyter Notebook (.ipynb)");
          }
          setNotebook(json);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error("Error al cargar Jupyter Notebook:", err);
          const errMsg = err instanceof Error ? err.message : "";
          setError(
            errMsg.includes("JSON")
              ? "El archivo .ipynb contiene un formato JSON inválido o está dañado."
              : "No se pudo cargar el archivo Jupyter Notebook para visualización web."
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    if (fileUrl) {
      fetchNotebook();
    }

    return () => {
      isCancelled = true;
    };
  }, [fileUrl]);

  const cells = useMemo(() => {
    if (!notebook) return [];
    if (notebook.cells && Array.isArray(notebook.cells)) {
      return notebook.cells;
    }
    if (notebook.worksheets?.[0]?.cells && Array.isArray(notebook.worksheets[0].cells)) {
      return notebook.worksheets[0].cells;
    }
    return [];
  }, [notebook]);

  const handleCopyCode = (code: string, cellIndex: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCellIndex(cellIndex);
    setTimeout(() => {
      setCopiedCellIndex(null);
    }, 2000);
  };

  const handlePrintToPdf = () => {
    const printArea = document.querySelector(".notebook-print-area");
    if (printArea) {
      printArea.scrollTop = 0;
    }
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-zinc-950 text-zinc-400 p-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Interpretando Jupyter Notebook (.ipynb)...</p>
        <p className="text-xs text-zinc-500">Formateando celdas de código, markdown y salidas gráficas</p>
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-zinc-950 text-zinc-400 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 mb-3 border border-rose-500/20">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h4 className="text-base font-bold text-white mb-1">No se pudo previsualizar el Notebook</h4>
        <p className="text-xs text-zinc-400 max-w-md mb-5 leading-relaxed">
          {error || "El archivo no pudo ser cargado directamente en el visor."}
        </p>
        {onDownloadOriginal && (
          <button
            onClick={onDownloadOriginal}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition shadow-lg shadow-blue-500/20"
          >
            <Download className="h-4 w-4" />
            <span>Descargar archivo original .ipynb</span>
          </button>
        )}
      </div>
    );
  }

  const kernelName = notebook.metadata?.kernelspec?.display_name || notebook.metadata?.language_info?.name || "Python 3";

  return (
    <div className="notebook-viewer-root relative flex flex-col h-full w-full bg-zinc-950 overflow-hidden print:static print:block print:h-auto print:w-full print:bg-white print:overflow-visible">
      {/* Estilos para impresión nativa en PDF de alta fidelidad con paginación fluida */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 15mm 12mm 15mm 12mm;
          }

          /* 1. Resetear html, body y contenedores principales */
          html, body {
            overflow: visible !important;
            height: auto !important;
            min-height: 100% !important;
            width: 100% !important;
            position: static !important;
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. Ocultar absolutamente todo en el body excepto el modal */
          body > *:not(.repol-modal-root) {
            display: none !important;
          }

          /* 3. Desactivar position fixed y scroll en el árbol del modal */
          .repol-modal-root,
          .repol-viewer-container,
          .notebook-viewer-root {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
            z-index: auto !important;
          }

          /* 4. Ocultar barras de herramientas, botones y elementos no imprimibles */
          .notebook-no-print,
          .notebook-no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          /* 5. Área de impresión de celdas */
          .notebook-print-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 6. Cada celda del Notebook no se debe cortar a la mitad ni superponer */
          .notebook-cell-card {
            position: static !important;
            display: block !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            break-inside: avoid-page !important;
            margin-bottom: 14px !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          /* 7. Bloques de código con fondo claro y letra legible */
          .notebook-code-block {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            color: #0f172a !important;
            white-space: pre-wrap !important;
            word-break: break-word !important;
            overflow: visible !important;
          }

          .notebook-code-block pre,
          .notebook-code-block code {
            color: #0f172a !important;
            background: transparent !important;
            white-space: pre-wrap !important;
          }

          /* 8. Textos y encabezados Markdown */
          .notebook-markdown-block,
          .notebook-markdown-block p,
          .notebook-markdown-block h1,
          .notebook-markdown-block h2,
          .notebook-markdown-block h3,
          .notebook-markdown-block span,
          .notebook-markdown-block li,
          .notebook-markdown-block strong,
          .notebook-markdown-block em,
          .notebook-markdown-block table {
            color: #0f172a !important;
          }

          .notebook-markdown-block table {
            border-collapse: collapse !important;
            width: 100% !important;
          }

          .notebook-markdown-block th,
          .notebook-markdown-block td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 10px !important;
            color: #0f172a !important;
          }

          /* 9. Bloques de salida y gráficos */
          .notebook-output-block {
            background: #ffffff !important;
            border-left: 3px solid #94a3b8 !important;
            color: #0f172a !important;
            overflow: visible !important;
          }

          img {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Barra de herramientas específica del Notebook (Oculta al imprimir) */}
      <div className="notebook-no-print flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/90 px-4 py-2 text-xs shrink-0 z-10 backdrop-blur-sm print:hidden">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/20">
            <Code2 className="h-3.5 w-3.5" />
            <span>Jupyter Notebook (.ipynb)</span>
          </span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400 text-[11px] truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {kernelName} • {cells.length} celdas{fileSize ? ` • ${formatBytes(fileSize)}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón para Imprimir / Guardar en PDF directamente desde el navegador */}
          <button
            onClick={handlePrintToPdf}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:text-white transition"
            title="Exportar o imprimir este notebook como documento PDF"
          >
            <Printer className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">Guardar como PDF / Imprimir</span>
          </button>

          {/* Enlace para abrir en Google Colab si se desea */}
          <a
            href="https://colab.research.google.com/#create=true"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white transition"
            title="Abrir Google Colab para ejecutar notebooks en la nube"
          >
            <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden md:inline">Google Colab</span>
          </a>
        </div>
      </div>

      {/* Contenedor con scroll para las celdas del Notebook */}
      <div className="notebook-print-area flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 max-w-5xl mx-auto w-full select-text print:static print:block print:h-auto print:w-full print:max-w-none print:p-0 print:m-0 print:overflow-visible">
        {/* Encabezado visible únicamente al imprimir / guardar en PDF */}
        <div className="hidden print:block mb-6 border-b border-zinc-300 pb-3">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-600 mt-1">
            Jupyter Notebook • {kernelName} • {cells.length} celdas {fileSize ? `• ${formatBytes(fileSize)}` : ""}
          </p>
        </div>

        {cells.map((cell, cellIdx) => {
          const sourceText = getCellSourceText(cell.source);
          if (!sourceText.trim() && (!cell.outputs || cell.outputs.length === 0)) {
            return null;
          }

          // CELDAS DE MARKDOWN / TEXTO
          if (cell.cell_type === "markdown") {
            return (
              <div
                key={cellIdx}
                className="notebook-cell-card notebook-markdown-block rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-4 transition"
              >
                {renderMarkdown(sourceText)}
              </div>
            );
          }

          // CELDAS DE CÓDIGO
          if (cell.cell_type === "code") {
            const hasOutputs = Boolean(cell.outputs && cell.outputs.length > 0);

            return (
              <div
                key={cellIdx}
                className="notebook-cell-card rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm transition"
              >
                {/* Cabecera de la celda de código con In [X] y botón Copiar */}
                <div className="notebook-no-print flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/70 px-3 py-1.5 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-400">
                      In [{cell.execution_count ?? " "}]:
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Python</span>
                  </div>

                  <button
                    onClick={() => handleCopyCode(sourceText, cellIdx)}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-[10px]"
                    title="Copiar código al portapapeles"
                  >
                    {copiedCellIndex === cellIdx ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Bloque de código */}
                <div className="notebook-code-block bg-zinc-950 p-3 overflow-x-auto text-zinc-200">
                  <HighlightedCode code={sourceText} />
                </div>

                {/* Salidas de la celda (Gráficos, texto, errores) */}
                {hasOutputs && (
                  <div className="notebook-output-block border-t border-zinc-800/80 bg-zinc-900/40 p-3 space-y-3">
                    {cell.outputs?.map((output, outIdx) => {
                      // 1. Salida de flujo de texto (stdout / stderr)
                      if (output.output_type === "stream") {
                        const outText = Array.isArray(output.text) ? output.text.join("") : output.text || "";
                        const isErr = output.name === "stderr";
                        return (
                          <div key={outIdx} className="font-mono text-xs overflow-x-auto">
                            <pre className={isErr ? "text-rose-400" : "text-zinc-300"}>
                              {stripAnsi(outText)}
                            </pre>
                          </div>
                        );
                      }

                      // 2. Resultado de ejecución o display_data (Gráficos base64 o texto)
                      if (output.output_type === "execute_result" || output.output_type === "display_data") {
                        const data = output.data || {};
                        const pngBase64 = data["image/png"];
                        const jpegBase64 = data["image/jpeg"];
                        const plainText = Array.isArray(data["text/plain"])
                          ? data["text/plain"].join("")
                          : data["text/plain"] || "";

                        return (
                          <div key={outIdx} className="space-y-2">
                            {/* Gráficos Matplotlib / Seaborn */}
                            {pngBase64 && (
                              <div className="flex justify-center bg-white p-3 rounded-lg border border-zinc-700 shadow-sm max-w-full overflow-x-auto">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`data:image/png;base64,${pngBase64}`}
                                  alt={`Salida gráfica celda ${cellIdx}`}
                                  className="max-h-[500px] object-contain"
                                />
                              </div>
                            )}

                            {jpegBase64 && (
                              <div className="flex justify-center bg-white p-3 rounded-lg border border-zinc-700 shadow-sm max-w-full overflow-x-auto">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`data:image/jpeg;base64,${jpegBase64}`}
                                  alt={`Salida gráfica celda ${cellIdx}`}
                                  className="max-h-[500px] object-contain"
                                />
                              </div>
                            )}

                            {/* Salida de texto plano (ej: arrays, números) */}
                            {!pngBase64 && !jpegBase64 && plainText && (
                              <div className="font-mono text-xs text-zinc-300 overflow-x-auto">
                                <pre className="whitespace-pre-wrap">{stripAnsi(plainText)}</pre>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // 3. Salida de Error / Traceback
                      if (output.output_type === "error") {
                        const trace = (output.traceback || []).map((t) => stripAnsi(t)).join("\n");
                        return (
                          <div
                            key={outIdx}
                            className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 font-mono text-xs text-rose-300 overflow-x-auto"
                          >
                            <div className="font-bold text-rose-400 mb-1">
                              {output.ename}: {output.evalue}
                            </div>
                            <pre className="text-[11px] text-rose-200/90 whitespace-pre-wrap">{trace}</pre>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
