import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function getCategoryLabel(category: string): string {
  switch (category) {
    case "CLASE":
      return "Clase / Apuntes";
    case "LECCION":
      return "Lección";
    case "TALLER":
      return "Taller";
    case "EXAMEN":
      return "Examen";
    default:
      return category;
  }
}

export function getCategoryBadgeColor(category: string): string {
  switch (category) {
    case "CLASE":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "LECCION":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "TALLER":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "EXAMEN":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    default:
      return "bg-gray-500/15 text-gray-400 border-gray-500/30";
  }
}

export async function calculateSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatPeriodTerm(term: string): string {
  if (!term) return "1PAO";
  const upper = term.toUpperCase().trim();
  if (upper === "1T" || upper === "1PAO" || upper === "1-PAO" || upper === "1 PAO" || upper === "1") return "1PAO";
  if (upper === "2T" || upper === "2PAO" || upper === "2-PAO" || upper === "2 PAO" || upper === "2") return "2PAO";
  if (upper === "PAE" || upper === "3T" || upper === "3PAO" || upper === "INTENSIVO" || upper === "VACACIONAL") return "PAE";
  return term;
}


