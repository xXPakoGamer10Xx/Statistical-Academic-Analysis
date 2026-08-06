import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GrupoCarrera } from "@/lib/carreras";

interface Props {
  value: string;
  onChange: (value: string) => void;
  grupos: GrupoCarrera[];
  /** Texto de la opcion para value="" (ej. "Todas las carreras"). Si se omite, no se ofrece. */
  allLabel?: string;
  placeholder?: string;
  /** Si se pasa, agrega una opcion final para capturar una carrera fuera del catalogo. */
  onAddNew?: () => void;
  addNewLabel?: string;
  className?: string;
}

/**
 * Desplegable de programa educativo: agrupa cada carrera profesional (Ingenieria/Lic.)
 * con su TSU emparejado. A diferencia de <optgroup> nativo -- cuyo label nunca es
 * seleccionable, obligando a repetir el nombre de la carrera una vez como encabezado y
 * otra vez como opcion -- aqui el encabezado del grupo ES la opcion de la carrera
 * profesional (clickeable), y debajo solo aparece su TSU emparejado.
 */
export function CarreraSelect({
  value,
  onChange,
  grupos,
  allLabel,
  placeholder = "Selecciona…",
  onAddNew,
  addNewLabel = "+ Agregar nueva carrera…",
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const select = (v: string) => {
    onChange(v);
    setIsOpen(false);
  };

  const currentLabel = value || allLabel || placeholder;

  return (
    <div className={cn("relative w-full", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 pl-4 pr-3 text-sm text-slate-900 dark:text-white shadow-sm transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500",
          !value && "text-slate-400 dark:text-slate-500",
        )}
      >
        <span className="truncate text-left">{currentLabel}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-80 w-full min-w-[260px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-xl animate-in fade-in slide-in-from-top-2">
          {allLabel && (
            <button
              type="button"
              onClick={() => select("")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0 text-brand-500", value === "" ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{allLabel}</span>
            </button>
          )}

          {grupos.map(({ principal, par }) =>
            par ? (
              <div key={principal.id}>
                <button
                  type="button"
                  onClick={() => select(principal.nombre)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-brand-500", value === principal.nombre ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{principal.nombre}</span>
                </button>
                <button
                  type="button"
                  onClick={() => select(par.nombre)}
                  className="flex w-full items-center gap-2 py-2 pl-8 pr-3 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-brand-500", value === par.nombre ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{par.nombre}</span>
                </button>
              </div>
            ) : (
              <button
                key={principal.id}
                type="button"
                onClick={() => select(principal.nombre)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Check className={cn("h-3.5 w-3.5 shrink-0 text-brand-500", value === principal.nombre ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{principal.nombre}</span>
              </button>
            ),
          )}

          {grupos.length === 0 && !allLabel && (
            <p className="px-3 py-2 text-xs text-slate-400">Sin carreras disponibles.</p>
          )}

          {onAddNew && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                type="button"
                onClick={() => {
                  onAddNew();
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{addNewLabel}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
