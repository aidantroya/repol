"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar opción...",
  searchPlaceholder = "Escribe para buscar...",
  emptyMessage = "No se encontraron resultados",
  disabled = false,
  className = "",
  allowClear = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Enfocar input de búsqueda al abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Normalizar texto para búsqueda sin tildes
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const cleanQuery = normalize(query);
    return options.filter((opt) => {
      const matchLabel = normalize(opt.label).includes(cleanQuery);
      const matchSub = opt.subLabel ? normalize(opt.subLabel).includes(cleanQuery) : false;
      const matchBadge = opt.badge ? normalize(opt.badge).includes(cleanQuery) : false;
      return matchLabel || matchSub || matchBadge;
    });
  }, [options, query]);

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-50" : "z-10"} ${className}`}>
      {/* Botón principal del selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border bg-zinc-950 px-3 py-2 text-left text-xs transition duration-150 ${
          disabled
            ? "opacity-50 cursor-not-allowed border-zinc-800 text-zinc-500"
            : isOpen
            ? "border-blue-500 ring-1 ring-blue-500 text-white"
            : "border-zinc-800 text-zinc-200 hover:border-zinc-700"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {selectedOption.badge && (
                <span className="rounded bg-blue-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-400 border border-blue-500/20 shrink-0">
                  {selectedOption.badge}
                </span>
              )}
              <span className="truncate font-medium text-white">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-[11px] text-zinc-500 truncate hidden sm:inline">
                  ({selectedOption.subLabel})
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-zinc-400">
          {allowClear && selectedOption && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 hover:text-rose-400 rounded-md hover:bg-zinc-800 transition"
              title="Borrar selección"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-400" : ""}`} />
        </div>
      </button>

      {/* Menú Desplegable con Buscador */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 rounded-2xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
          
          {/* Input de Búsqueda Integrado */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-7 text-xs text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lista de Resultados */}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-500">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.badge && (
                        <span
                          className={`rounded px-1.5 py-0.2 font-mono text-[10px] font-semibold shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span
                          className={`text-[10px] truncate ${
                            isSelected ? "text-blue-200" : "text-zinc-500"
                          }`}
                        >
                          ({opt.subLabel})
                        </span>
                      )}
                    </div>

                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
