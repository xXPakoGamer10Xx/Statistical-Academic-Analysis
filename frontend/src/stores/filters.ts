import { create } from "zustand";
import type { FilterState } from "@/types";

interface FiltersStore extends FilterState {
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
}

/**
 * Devuelve el ciclo escolar vigente en formato "YYYY-YYYY".
 * Los ciclos en la UPTex van de septiembre (mes 9) a agosto (mes 8).
 * Ejemplo: septiembre 2025 – agosto 2026 → "2025-2026"
 */
function getCurrentCiclo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1 = enero … 12 = diciembre
  const start = month >= 9 ? year : year - 1;
  return `${start}-${start + 1}`;
}

const DEFAULT_CICLO = getCurrentCiclo();

export const useFiltersStore = create<FiltersStore>((set) => ({
  subsistema_id: undefined,
  ciclo_escolar: DEFAULT_CICLO,
  cuatrimestre: undefined,
  programa_educativo: undefined,
  set: (patch) => set((s) => ({ ...s, ...patch })),
  reset: () =>
    set({
      subsistema_id: undefined,
      ciclo_escolar: DEFAULT_CICLO,
      cuatrimestre: undefined,
      programa_educativo: undefined,
    }),
}));
