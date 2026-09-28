"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  UploadCloud, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  GraduationCap,
  Lock,
  HardDrive,
  Paperclip,
  Trash2,
  Plus,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCode
} from "lucide-react";
import { calculateSHA256, formatBytes } from "@/lib/utils";
import { SearchableSelect, SearchableOption } from "@/components/SearchableSelect";

interface DriveFolderChildItem {
  fileId: string;
  name: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  fileUrl: string;
  downloadUrl: string;
  folderPath?: string;
  exists?: boolean;
  duplicateMessage?: string;
}

interface Career {
  id: string;
  name: string;
  code: string;
  slug: string;
  subjects: Array<{ id: string; name: string; code: string; slug: string; semester: number }>;
}

export interface AttachmentUploadItem {
  id: string;
  name: string;
  file?: File;
  driveUrl?: string;
  fileSize: number;
  mimeType: string;
  fileUrl?: string;
}

export interface UploadQueueItem {
  id: string;
  mode: "FILE" | "GDRIVE";
  file?: File;
  driveUrl?: string;
  title: string;
  description: string;
  careerId?: string;
  subjectId: string;
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
  subcategory: string;
  customDescription: string;
  periodYear: string;
  periodTerm: string;
  fileHash: string;
  isHashing: boolean;
  duplicateCheck: {
    exists: boolean;
    type?: string;
    message?: string;
  } | null;
  driveVerifiedData?: {
    fileId: string;
    fileHash: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
    fileUrl: string;
    downloadUrl: string;
  } | null;
  attachments: AttachmentUploadItem[];
  status: "idle" | "uploading" | "success" | "error";
  errorMessage?: string;
  isExpanded: boolean;
}

export default function UploadPage() {
  const { status } = useSession();
  const router = useRouter();

  // Materias y configuración global de lote
  const [careers, setCareers] = useState<Career[]>([]);
  const [globalSubjectId, setGlobalSubjectId] = useState("");
  const [globalCategory, setGlobalCategory] = useState<"CLASE" | "LECCION" | "TALLER" | "EXAMEN">("EXAMEN");
  const [globalSubcategory, setGlobalSubcategory] = useState("Parcial");

  // Cola de documentos a subir
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Input temporal de Drive
  const [inputDriveUrl, setInputDriveUrl] = useState("");
  const [isVerifyingSingleDrive, setIsVerifyingSingleDrive] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [driveDebugLogs, setDriveDebugLogs] = useState<string[]>([]);

  // Input de anexos con Google Drive
  const [activeDriveAttachmentItemId, setActiveDriveAttachmentItemId] = useState<string | null>(null);
  const [attDriveUrl, setAttDriveUrl] = useState("");
  const [attDriveName, setAttDriveName] = useState("");

  // Cargar lista de carreras y consolidar materias
  useEffect(() => {
    async function loadCareers() {
      try {
        const res = await fetch("/api/careers");
        const data = await res.json();
        if (data.careers) {
          setCareers(data.careers);
          if (data.careers.length > 0 && data.careers[0].subjects.length > 0) {
            setGlobalSubjectId(data.careers[0].subjects[0].id);
          }
        }
      } catch (e) {
        console.error("Error al cargar materias:", e);
      }
    }
    loadCareers();
  }, []);

  // Lista consolidada de todas las materias únicas de la ESPOL
  const allSubjectOptions: SearchableOption[] = useMemo(() => {
    const map = new Map<string, SearchableOption>();
    for (const car of careers) {
      for (const sub of car.subjects) {
        if (!map.has(sub.id)) {
          map.set(sub.id, {
            value: sub.id,
            label: sub.name,
            badge: sub.code,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [careers]);

  // Función para obtener subcategorías dinámicas
  const getSubcategoryOptions = (cat: "CLASE" | "LECCION" | "TALLER" | "EXAMEN") => {
    switch (cat) {
      case "LECCION":
        return ["Lección 1", "Lección 2", "Lección 3", "Lección 4", "Otro"];
      case "TALLER":
        return ["Taller 1", "Taller 2", "Taller 3", "Taller 4", "Otro"];
      case "EXAMEN":
        return ["Parcial", "Final", "Mejoramiento"];
      case "CLASE":
        return ["Apuntes de Clase", "Diapositivas", "Guía Teórica", "Bibliografía", "Otro"];
      default:
        return ["Otro"];
    }
  };

  // Función para verificar duplicados por hash
  const checkDuplicate = async (hash: string, subjectId: string, category: string, subcategory: string) => {
    try {
      const res = await fetch("/api/documents/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileHash: hash, subjectId, category, subcategory }),
      });
      return await res.json();
    } catch {
      return { exists: false };
    }
  };

  // Procesar archivos locales soltados o seleccionados
  const handleAddLocalFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newItems: UploadQueueItem[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const currentFile = fileArray[i];
      const cleanName = currentFile.name.replace(/\.[^/.]+$/, "");
      const itemId = `doc-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;

      const item: UploadQueueItem = {
        id: itemId,
        mode: "FILE",
        file: currentFile,
        title: cleanName,
        description: "",
        subjectId: globalSubjectId || allSubjectOptions[0]?.value || "",
        category: globalCategory,
        subcategory: globalSubcategory,
        customDescription: "",
        periodYear: new Date().getFullYear().toString(),
        periodTerm: "1PAO",
        fileHash: "",
        isHashing: true,
        duplicateCheck: null,
        attachments: [],
        status: "idle",
        isExpanded: true,
      };

      newItems.push(item);
    }

    setQueue((prev) => [...prev, ...newItems]);

    // Calcular Hash SHA-256 / Semántico de forma asíncrona para cada archivo agregado
    for (const item of newItems) {
      if (item.file) {
        try {
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("subjectId", item.subjectId);
          formData.append("category", item.category);
          formData.append("subcategory", item.subcategory);

          const res = await fetch("/api/documents/check-duplicate", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const dupRes = await res.json();
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      fileHash: dupRes.fileHash || q.fileHash,
                      isHashing: false,
                      duplicateCheck: dupRes.exists
                        ? { exists: true, type: dupRes.type, message: dupRes.message }
                        : { exists: false },
                    }
                  : q
              )
            );
          } else {
            const hash = await calculateSHA256(item.file);
            const dupRes = await checkDuplicate(hash, item.subjectId, item.category, item.subcategory);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      fileHash: hash,
                      isHashing: false,
                      duplicateCheck: dupRes.exists
                        ? { exists: true, type: dupRes.type, message: dupRes.message }
                        : { exists: false },
                    }
                  : q
              )
            );
          }
        } catch (err) {
          console.error("Error al hashear archivo:", err);
          try {
            const hash = await calculateSHA256(item.file);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, fileHash: hash, isHashing: false, duplicateCheck: { exists: false } }
                  : q
              )
            );
          } catch {
            setQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, isHashing: false, errorMessage: "Error calculando hash" } : q))
            );
          }
        }
      }
    }
  };

  // Agregar enlace de Google Drive a la cola
  const handleAddDriveLink = async () => {
    if (!inputDriveUrl.trim()) return;
    setIsVerifyingSingleDrive(true);
    setDriveError("");

    try {
      const res = await fetch("/api/documents/process-drive-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveUrl: inputDriveUrl,
          subjectId: globalSubjectId || allSubjectOptions[0]?.value || "",
          category: "LECCION",
          subcategory: "Lección 1",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.debugLogs && Array.isArray(data.debugLogs)) {
          setDriveDebugLogs(data.debugLogs);
        }
        throw new Error(data.error || "No se pudo procesar el enlace de Google Drive");
      }

      if (data.isFolder && Array.isArray(data.items)) {
        // Carpeta de Google Drive: agregar todos los archivos contenidos como ítems individuales
        const folderItems: UploadQueueItem[] = data.items.map((item: DriveFolderChildItem, idx: number) => {
          const combinedPath = `${item.folderPath || ""} ${item.name}`.toLowerCase();
          let itemCategory: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" = globalCategory;
          let itemSubcategory = globalSubcategory;

          if (combinedPath.includes("examen") || combinedPath.includes("exam")) {
            itemCategory = "EXAMEN";
            if (combinedPath.includes("final")) itemSubcategory = "Final";
            else if (combinedPath.includes("mejoramiento")) itemSubcategory = "Mejoramiento";
            else itemSubcategory = "Parcial";
          } else if (combinedPath.includes("leccion") || combinedPath.includes("lección")) {
            itemCategory = "LECCION";
            if (combinedPath.includes("1") || combinedPath.includes("uno")) itemSubcategory = "Lección 1";
            else if (combinedPath.includes("2") || combinedPath.includes("dos")) itemSubcategory = "Lección 2";
            else if (combinedPath.includes("3") || combinedPath.includes("tres")) itemSubcategory = "Lección 3";
            else if (combinedPath.includes("4") || combinedPath.includes("cuatro")) itemSubcategory = "Lección 4";
            else itemSubcategory = "Lección 1";
          } else if (combinedPath.includes("taller") || combinedPath.includes("deber") || combinedPath.includes("tarea")) {
            itemCategory = "TALLER";
            if (combinedPath.includes("1")) itemSubcategory = "Taller 1";
            else if (combinedPath.includes("2")) itemSubcategory = "Taller 2";
            else if (combinedPath.includes("3")) itemSubcategory = "Taller 3";
            else if (combinedPath.includes("4")) itemSubcategory = "Taller 4";
            else itemSubcategory = "Taller 1";
          } else if (
            combinedPath.includes("clase") ||
            combinedPath.includes("apunte") ||
            combinedPath.includes("diapositiva") ||
            combinedPath.includes("guia") ||
            combinedPath.includes("guía")
          ) {
            itemCategory = "CLASE";
            if (combinedPath.includes("diapositiva")) itemSubcategory = "Diapositivas";
            else if (combinedPath.includes("guia") || combinedPath.includes("guía")) itemSubcategory = "Guía Teórica";
            else itemSubcategory = "Apuntes de Clase";
          }

          return {
            id: `drive-f-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            mode: "GDRIVE",
            driveUrl: item.fileUrl,
            title: item.name || `Documento ${idx + 1}`,
            description: item.folderPath ? `Carpeta: ${item.folderPath}` : "",
            subjectId: globalSubjectId || allSubjectOptions[0]?.value || "",
            category: itemCategory,
            subcategory: itemSubcategory,
            customDescription: "",
            periodYear: new Date().getFullYear().toString(),
            periodTerm: "1PAO",
            fileHash: item.fileHash,
            isHashing: false,
            duplicateCheck: item.exists
              ? { exists: true, message: item.duplicateMessage || "Documento duplicado detectado" }
              : { exists: false },
            driveVerifiedData: {
              fileId: item.fileId,
              fileHash: item.fileHash,
              fileSize: item.fileSize,
              mimeType: item.mimeType,
              storageKey: item.storageKey,
              fileUrl: item.fileUrl,
              downloadUrl: item.downloadUrl,
            },
            attachments: [],
            status: "idle",
            isExpanded: true,
          };
        });

        setQueue((prev) => [...prev, ...folderItems]);
        setInputDriveUrl("");
        return;
      }

      // Archivo único de Google Drive
      const itemId = `drive-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newItem: UploadQueueItem = {
        id: itemId,
        mode: "GDRIVE",
        driveUrl: inputDriveUrl,
        title: data.name || `Material Drive - ${new Date().toLocaleDateString()}`,
        description: "",
        subjectId: globalSubjectId || allSubjectOptions[0]?.value || "",
        category: globalCategory,
        subcategory: globalSubcategory,
        customDescription: "",
        periodYear: new Date().getFullYear().toString(),
        periodTerm: "1PAO",
        fileHash: data.fileHash,
        isHashing: false,
        duplicateCheck: data.exists
          ? { exists: true, type: data.type, message: data.message }
          : { exists: false },
        driveVerifiedData: data,
        attachments: [],
        status: "idle",
        isExpanded: true,
      };

      setQueue((prev) => [...prev, newItem]);
      setInputDriveUrl("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al conectar con Google Drive";
      setDriveError(msg);
    } finally {
      setIsVerifyingSingleDrive(false);
    }
  };

  // Actualizar un campo de un ítem en la cola
  const updateQueueItem = (id: string, updates: Partial<UploadQueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, ...updates };
      })
    );
  };

  // Añadir archivos adjuntos complementarios a un ítem
  const handleAddAttachmentToItem = (itemId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentUploadItem[] = Array.from(files).map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: f.name,
      file: f,
      fileSize: f.size,
      mimeType: f.type || "application/octet-stream",
    }));

    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, attachments: [...item.attachments, ...newAttachments] };
      })
    );
  };

  // Añadir anexo de enlace de Google Drive
  const handleAddDriveAttachment = (itemId: string) => {
    if (!attDriveUrl.trim()) return;
    const cleanUrl = attDriveUrl.trim();
    const cleanName = attDriveName.trim() || "Material en Google Drive";

    const newAtt: AttachmentUploadItem = {
      id: `att-drive-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      driveUrl: cleanUrl,
      fileUrl: cleanUrl,
      fileSize: 0,
      mimeType: "application/pdf",
    };

    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, attachments: [...item.attachments, newAtt] };
      })
    );

    setActiveDriveAttachmentItemId(null);
    setAttDriveUrl("");
    setAttDriveName("");
  };

  // Eliminar un anexo de un ítem
  const handleRemoveAttachment = (itemId: string, attachmentId: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          attachments: item.attachments.filter((a) => a.id !== attachmentId),
        };
      })
    );
  };

  // Eliminar un ítem de la cola
  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Aplicar Materia, Categoría y Subcategoría global a todos los ítems de la lista
  const handleApplyGlobalToAll = () => {
    setQueue((prev) =>
      prev.map((item) => ({
        ...item,
        subjectId: globalSubjectId,
        category: globalCategory,
        subcategory: globalSubcategory,
      }))
    );
  };

  // Subir un archivo a Cloudflare R2
  const uploadFileToR2 = async (file: File, category = "docs") => {
    const presignedRes = await fetch("/api/upload/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/pdf",
        category,
        fileSize: file.size,
      }),
    });

    const presignedData = await presignedRes.json();
    if (!presignedRes.ok) {
      throw new Error(presignedData.error || "No se pudo preparar el almacenamiento.");
    }

    const { uploadUrl, key, publicUrl, isMock } = presignedData;

    if (!isMock && uploadUrl) {
      const uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/pdf" },
      });

      if (!uploadResult.ok) {
        throw new Error(`Fallo al transferir "${file.name}" a Cloudflare R2.`);
      }
      return { fileUrl: publicUrl, storageKey: key };
    }

    return { fileUrl: `/api/documents/download?key=${encodeURIComponent(key)}`, storageKey: key };
  };

  // Enviar toda la cola de documentos al servidor
  const handleSubmitAll = async () => {
    if (queue.length === 0) return;

    setIsSubmittingBatch(true);

    for (const item of queue) {
      if (item.status === "success") {
        continue;
      }

      if (item.duplicateCheck?.exists) {
        updateQueueItem(item.id, {
          status: "error",
          errorMessage: "Documento duplicado detectado.",
        });
        continue;
      }

      if (!item.title.trim()) {
        updateQueueItem(item.id, {
          status: "error",
          errorMessage: "El título es obligatorio.",
        });
        continue;
      }

      updateQueueItem(item.id, { status: "uploading", errorMessage: undefined });

      try {
        let finalStorageKey = "";
        let finalFileUrl = "";
        let finalFileSize = 0;
        let finalMimeType = "application/pdf";
        const finalHash = item.fileHash;

        // 1. Subir archivo principal si es local
        if (item.mode === "FILE" && item.file) {
          const r2Res = await uploadFileToR2(item.file, item.category);
          finalStorageKey = r2Res.storageKey;
          finalFileUrl = r2Res.fileUrl;
          finalFileSize = item.file.size;
          finalMimeType = item.file.type || "application/pdf";
        } else if (item.mode === "GDRIVE" && item.driveVerifiedData) {
          finalStorageKey = item.driveVerifiedData.storageKey;
          finalFileUrl = item.driveVerifiedData.fileUrl;
          finalFileSize = item.driveVerifiedData.fileSize;
          finalMimeType = item.driveVerifiedData.mimeType;
        }

        // 2. Subir anexos complementarios si existen
        const processedAttachments: Array<{
          name: string;
          fileUrl: string;
          fileSize: number;
          mimeType: string;
          storageKey?: string;
        }> = [];

        for (const att of item.attachments) {
          if (att.file) {
            const attR2 = await uploadFileToR2(att.file, "anexos");
            processedAttachments.push({
              name: att.name,
              fileUrl: attR2.fileUrl,
              fileSize: att.file.size,
              mimeType: att.file.type || "application/octet-stream",
              storageKey: attR2.storageKey,
            });
          } else if (att.driveUrl || att.fileUrl) {
            processedAttachments.push({
              name: att.name || "Archivo en Google Drive",
              fileUrl: att.driveUrl || att.fileUrl || "",
              fileSize: att.fileSize || 0,
              mimeType: att.mimeType || "application/pdf",
            });
          }
        }

        // 3. Registrar en la base de datos como Submission
        const subRes = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            description: item.description,
            fileHash: finalHash,
            fileSize: finalFileSize,
            mimeType: finalMimeType,
            storageKey: finalStorageKey,
            fileUrl: finalFileUrl,
            attachments: processedAttachments.length > 0 ? processedAttachments : null,
            category: item.category,
            subcategory: item.subcategory,
            customDescription: item.subcategory === "Otro" ? item.customDescription : null,
            periodYear: parseInt(item.periodYear, 10),
            periodTerm: item.periodTerm,
            subjectId: item.subjectId,
          }),
        });

        const subData = await subRes.json();
        if (!subRes.ok) {
          throw new Error(subData.error || "Error al registrar la solicitud");
        }

        updateQueueItem(item.id, { status: "success", errorMessage: undefined });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error durante el procesamiento";
        updateQueueItem(item.id, { status: "error", errorMessage: msg });
      }
    }

    setIsSubmittingBatch(false);
  };

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-10 backdrop-blur-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Inicia sesión para contribuir</h2>
          <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
            Para mantener la calidad y moderación del repositorio, debes identificarte con tu cuenta institucional o Google.
          </p>
          <button
            onClick={() => router.push("/auth/signin")}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    );
  }

  const allSuccess = queue.length > 0 && queue.every((item) => item.status === "success");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      
      {/* Encabezado Principal */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400 mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Subida Múltiple & Anexos Complementarios</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
          Contribuir Material Académico
        </h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-3xl">
          Sube uno o varios exámenes, lecciones o talleres a la vez. Al ser materias globales compartidas entre mallas, solo selecciona la materia y se organizará automáticamente en todas las carreras.
        </p>
      </div>

      {/* Selector Rápido Global (Para aplicar a todo el lote) */}
      <div className="relative z-30 mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Configuración Rápida para Lotes de Documentos</h3>
          </div>
          {queue.length > 0 && (
            <button
              onClick={handleApplyGlobalToAll}
              type="button"
              className="flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-blue-400 transition"
              title="Aplica esta materia, tipo y subcategoría a todos los archivos de tu cola actual"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Aplicar a todos los ({queue.length}) documentos</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
          {/* Materia Global */}
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-medium text-zinc-400 mb-1">Materia Global</label>
            <SearchableSelect
              options={allSubjectOptions}
              value={globalSubjectId}
              onChange={(sId) => setGlobalSubjectId(sId)}
              placeholder="Seleccionar materia..."
              searchPlaceholder="Escribe código (ej. CCPG1043) o nombre..."
            />
          </div>

          {/* Categoría / Tipo Global */}
          <div className="w-full sm:w-44 shrink-0">
            <label className="block text-xs font-medium text-zinc-400 mb-1">Tipo / Categoría</label>
            <select
              value={globalCategory}
              onChange={(e) => {
                const newCat = e.target.value as "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
                setGlobalCategory(newCat);
                const subOpts = getSubcategoryOptions(newCat);
                setGlobalSubcategory(subOpts[0]);
              }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="EXAMEN">Examen</option>
              <option value="LECCION">Lección</option>
              <option value="TALLER">Taller / Deber</option>
              <option value="CLASE">Clase / Diapositivas</option>
            </select>
          </div>

          {/* Subcategoría Global */}
          <div className="w-full sm:w-44 shrink-0">
            <label className="block text-xs font-medium text-zinc-400 mb-1">Subcategoría</label>
            <select
              value={globalSubcategory}
              onChange={(e) => setGlobalSubcategory(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              {getSubcategoryOptions(globalCategory).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Zona de Arrastre / Selección de Múltiples Archivos o Enlace de Drive */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* Subida de Archivos Locales (Múltiple) */}
        <div className="md:col-span-2 relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center hover:border-blue-500/50 hover:bg-zinc-900/50 transition">
          <input
            type="file"
            multiple
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={(e) => {
              if (e.target.files) handleAddLocalFiles(e.target.files);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            title="Arrastra o selecciona uno o varios PDFs o archivos Word (.docx)"
          />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h4 className="text-base font-semibold text-white mb-1">
            Arrastra aquí tus archivos PDF o Word (.docx) o haz clic para explorar
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm">
            Puedes seleccionar <strong>múltiples archivos a la vez</strong> (.pdf y .docx). El sistema coteja el contenido semántico e imágenes para evitar duplicados exactos.
          </p>
        </div>

        {/* Añadir vía Enlace o Carpeta de Google Drive */}
        <div className="flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              <HardDrive className="h-5 w-5" />
              <h4 className="text-sm font-bold text-white">Google Drive (Archivo o Carpeta)</h4>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Pega el link de un documento o de una <strong>carpeta entera</strong> de Drive.
            </p>
            <input
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={inputDriveUrl}
              onChange={(e) => setInputDriveUrl(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none mb-2"
            />
            {driveError && (
              <div className="mb-3">
                <p className="text-[11px] text-rose-400 font-medium">{driveError}</p>
                {driveDebugLogs.length > 0 && (
                  <details className="mt-2 rounded-lg bg-zinc-950 p-2 text-[10px] text-zinc-400 border border-zinc-800">
                    <summary className="cursor-pointer font-mono text-zinc-300 select-none hover:text-white">
                      Ver diagnóstico técnico ({driveDebugLogs.length} eventos)
                    </summary>
                    <pre className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-zinc-400 leading-tight">
                      {driveDebugLogs.join("\n")}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleAddDriveLink}
            disabled={isVerifyingSingleDrive || !inputDriveUrl.trim()}
            type="button"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2.5 text-xs font-bold text-white transition"
          >
            {isVerifyingSingleDrive ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analizando Drive...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Agregar a la lista</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Lista / Cola de Documentos a Subir */}
      {queue.length > 0 && (
        <div className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">Documentos en Cola ({queue.length})</h3>
              <span className="rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
                {queue.filter((q) => q.status === "success").length} de {queue.length} completados
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setQueue([])}
                type="button"
                className="text-xs font-medium text-zinc-400 hover:text-rose-400 px-3 py-1.5 transition"
              >
                Limpiar lista
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {queue.map((item, index) => {
              return (
                <div
                  key={item.id}
                  className={`relative rounded-2xl border transition-all duration-200 ${
                    item.status === "success"
                      ? "border-emerald-500/30 bg-emerald-950/10"
                      : item.status === "error"
                      ? "border-rose-500/40 bg-rose-950/10"
                      : "border-zinc-800 bg-zinc-900/60"
                  } p-5`}
                >
                  
                  {/* Fila Superior: Resumen del Archivo y Controles de Colapso */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 truncate">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300">
                        {index + 1}
                      </span>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md">
                            {item.title || "Sin título"}
                          </span>
                          {item.mode === "GDRIVE" && (
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                              Google Drive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span>{item.file ? formatBytes(item.file.size) : "Enlace Drive"}</span>
                          <span>•</span>
                          <span>{item.category} - {item.subcategory}</span>
                          {item.attachments.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-400 flex items-center gap-0.5">
                                <Paperclip className="h-3 w-3" />
                                +{item.attachments.length} anexos
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Estado del Hash / Duplicado */}
                      {item.isHashing ? (
                        <span className="flex items-center gap-1 text-xs text-blue-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="hidden sm:inline">Calculando hash...</span>
                        </span>
                      ) : item.duplicateCheck?.exists ? (
                        <span className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Duplicado</span>
                        </span>
                      ) : item.fileHash ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <FileCheck className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Hash OK</span>
                        </span>
                      ) : null}

                      {/* Estado de Subida */}
                      {item.status === "uploading" && (
                        <span className="flex items-center gap-1 text-xs text-blue-400 font-semibold">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Subiendo...</span>
                        </span>
                      )}
                      {item.status === "success" && (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Enviado</span>
                        </span>
                      )}

                      {/* Botón Desplegar / Colapsar */}
                      <button
                        onClick={() => updateQueueItem(item.id, { isExpanded: !item.isExpanded })}
                        type="button"
                        className="rounded-lg border border-zinc-800 bg-zinc-800/80 p-1.5 text-zinc-400 hover:text-white"
                      >
                        {item.isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {/* Botón Eliminar */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        type="button"
                        disabled={item.status === "uploading"}
                        className="rounded-lg border border-zinc-800 bg-zinc-800/80 p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                        title="Quitar de la lista"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mensaje de error individual si ocurrió */}
                  {item.errorMessage && (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                      {item.errorMessage}
                    </div>
                  )}

                  {/* Formulario Expandible del Documento */}
                  {item.isExpanded && (
                    <div className="mt-5 border-t border-zinc-800/80 pt-4 space-y-4">
                      
                      {/* Título y Descripción */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Título del Documento *
                          </label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateQueueItem(item.id, { title: e.target.value })}
                            placeholder="Ej. Examen Parcial 2024-1T resuelto"
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Descripción / Observación
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateQueueItem(item.id, { description: e.target.value })}
                            placeholder="Ej. Con rúbrica y solución del Prof. X"
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Materia, Categoría, Subcategoría, Año y Periodo */}
                      <div className="flex flex-wrap lg:flex-nowrap items-end gap-3">
                        
                        {/* Materia Global (Búsqueda en las 713 materias de ESPOL) */}
                        <div className="flex-1 min-w-[220px]">
                          <label className="block text-xs font-medium text-zinc-400 mb-1">Materia *</label>
                          <SearchableSelect
                            options={allSubjectOptions}
                            value={item.subjectId}
                            onChange={(sId) => updateQueueItem(item.id, { subjectId: sId })}
                            placeholder="Seleccionar materia..."
                            searchPlaceholder="Escribe código (ej. CCPG1043) o nombre..."
                          />
                        </div>

                        {/* Categoría */}
                        <div className="w-full sm:w-36 shrink-0">
                          <label className="block text-xs font-medium text-zinc-400 mb-1">Categoría</label>
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const newCat = e.target.value as "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
                              const subOpts = getSubcategoryOptions(newCat);
                              updateQueueItem(item.id, {
                                category: newCat,
                                subcategory: subOpts[0],
                              });
                            }}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          >
                            <option value="LECCION">Lección</option>
                            <option value="EXAMEN">Examen</option>
                            <option value="TALLER">Taller / Deber</option>
                            <option value="CLASE">Clase / Diapositivas</option>
                          </select>
                        </div>

                        {/* Subcategoría */}
                        <div className="w-full sm:w-36 shrink-0">
                          <label className="block text-xs font-medium text-zinc-400 mb-1">Subcategoría</label>
                          <select
                            value={item.subcategory}
                            onChange={(e) => updateQueueItem(item.id, { subcategory: e.target.value })}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          >
                            {getSubcategoryOptions(item.category).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Año (Reducido a tamaño exacto) */}
                        <div className="w-24 shrink-0">
                          <label className="block text-xs font-medium text-zinc-400 mb-1">Año</label>
                          <input
                            type="number"
                            min="1990"
                            max="2099"
                            step="1"
                            value={item.periodYear}
                            onChange={(e) => updateQueueItem(item.id, { periodYear: e.target.value })}
                            placeholder="2025"
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none text-center font-mono"
                          />
                        </div>

                        {/* Periodo (Reducido a tamaño exacto) */}
                        <div className="w-24 shrink-0">
                          <label className="block text-xs font-medium text-zinc-400 mb-1">Periodo</label>
                          <select
                            value={item.periodTerm}
                            onChange={(e) => updateQueueItem(item.id, { periodTerm: e.target.value })}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-white focus:border-blue-500 focus:outline-none text-center font-semibold"
                          >
                            <option value="1PAO">1PAO</option>
                            <option value="2PAO">2PAO</option>
                            <option value="PAE">PAE</option>
                          </select>
                        </div>
                      </div>

                      {/* Campo especial para descripción si eligió "Otro" */}
                      {item.subcategory === "Otro" && (
                        <div>
                          <label className="block text-xs font-medium text-amber-400 mb-1">
                            Especifica qué tipo de documento es: *
                          </label>
                          <input
                            type="text"
                            value={item.customDescription}
                            onChange={(e) => updateQueueItem(item.id, { customDescription: e.target.value })}
                            placeholder="Ej. Proyecto Final, Guía de Laboratorio 4, Formulario"
                            className="w-full rounded-xl border border-amber-500/30 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* SECCIÓN DE ANEXOS / ARCHIVOS COMPLEMENTARIOS */}
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                            <Paperclip className="h-3.5 w-3.5 text-amber-400" />
                            <span>Archivos Complementarios / Anexos Opcionales</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Botón para adjuntar archivo local */}
                            <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-medium border border-zinc-700 transition">
                              <Plus className="h-3 w-3" />
                              <span>Archivo Local</span>
                              <input
                                type="file"
                                multiple
                                onChange={(e) => handleAddAttachmentToItem(item.id, e.target.files)}
                                className="hidden"
                              />
                            </label>

                            {/* Botón para adjuntar enlace de Drive */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDriveAttachmentItemId(
                                  activeDriveAttachmentItemId === item.id ? null : item.id
                                );
                                setAttDriveUrl("");
                                setAttDriveName("");
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition"
                            >
                              <HardDrive className="h-3 w-3" />
                              <span>Enlace Drive</span>
                            </button>
                          </div>
                        </div>

                        {/* Formulario inline para agregar enlace de Drive como anexo */}
                        {activeDriveAttachmentItemId === item.id && (
                          <div className="mb-3 rounded-xl border border-emerald-500/30 bg-zinc-900/90 p-3 animate-in fade-in duration-150">
                            <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                              <HardDrive className="h-3.5 w-3.5" />
                              <span>Adjuntar enlace de Google Drive</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                              <input
                                type="url"
                                placeholder="https://drive.google.com/..."
                                value={attDriveUrl}
                                onChange={(e) => setAttDriveUrl(e.target.value)}
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                              />
                              <input
                                type="text"
                                placeholder="Nombre (ej. Dataset CSV, Rúbrica, Código)"
                                value={attDriveName}
                                onChange={(e) => setAttDriveName(e.target.value)}
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveDriveAttachmentItemId(null)}
                                className="px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddDriveAttachment(item.id)}
                                disabled={!attDriveUrl.trim()}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white transition"
                              >
                                Agregar Anexo Drive
                              </button>
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-zinc-500 mb-3">
                          Útil si este documento requiere un enunciado separado, código (.zip, .py, .cpp), rúbrica o dataset. Puedes adjuntar archivos locales o enlaces directos de Google Drive.
                        </p>

                        {/* Lista de anexos añadidos */}
                        {item.attachments.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  {att.driveUrl ? (
                                    <HardDrive className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <FileCode className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  )}
                                  <span className="truncate text-zinc-300">{att.name}</span>
                                  <span className="text-[10px] text-zinc-500">
                                    {att.driveUrl ? "(Drive)" : `(${formatBytes(att.fileSize)})`}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachment(item.id, att.id)}
                                  className="text-zinc-500 hover:text-rose-400 p-1 transition"
                                  title="Quitar anexo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-zinc-600 italic">
                            Sin archivos anexos. (Solo se enviará el documento principal)
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Botón de Enviar Todo el Lote */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 backdrop-blur-md">
            <div>
              <h4 className="text-sm font-bold text-white">¿Listo para enviar tus aportes?</h4>
              <p className="text-xs text-zinc-400">
                Tus aportes pasarán al panel de revisión para ser aprobados por moderadores y administradores.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={isSubmittingBatch || queue.length === 0 || allSuccess}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition"
            >
              {isSubmittingBatch ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando Lote de Documentos...</span>
                </>
              ) : allSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>¡Todos los documentos fueron enviados!</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>Subir los ({queue.length}) Documentos</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Guía de Calidad y Recompensas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <CheckCircle2 className="h-4 w-4" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Sin Duplicados</h4>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Cada archivo es validado por SHA-256 para garantizar que no existan documentos repetidos en la plataforma.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Paperclip className="h-4 w-4" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Anexos Múltiples</h4>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Si un taller o examen incluye enunciado aparte o código ejecutable, puedes anexarlo directamente al mismo post.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Sparkles className="h-4 w-4" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Rol Administrador</h4>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Alcanza 10 aportes aprobados por la comunidad para solicitar tu ascenso a Moderador/Administrador en tu perfil.
          </p>
        </div>
      </div>

    </div>
  );
}
