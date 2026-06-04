import { create } from "zustand";
import type { FilterState } from "@/types";

const DEFAULT_CICLO = "2024-2025";

/** Estado inicial de un scope nuevo (con ciclo por defecto para mostrar datos al entrar). */
const initialState = (): FilterState => ({
  subsistema_id: undefined,
  ciclo_escolar: DEFAULT_CICLO,
  cuatrimestre: undefined,
  programa_educativo: undefined,
});

interface FiltersStore {
  /** Filtros independientes por vista (clave = scope). */
  scopes: Record<string, FilterState>;
  set: (scope: string, patch: Partial<FilterState>) => void;
  reset: (scope: string) => void;
}

const useFiltersBase = create<FiltersStore>((set) => ({
  scopes: {},
  set: (scope, patch) =>
    set((s) => ({
      scopes: {
        ...s.scopes,
        [scope]: { ...(s.scopes[scope] ?? initialState()), ...patch },
      },
    })),
  reset: (scope) =>
    set((s) => ({
      scopes: {
        ...s.scopes,
        // "Limpiar filtros" deja TODO vacío (incluido el ciclo) → el total queda vacío.
        [scope]: {
          subsistema_id: undefined,
          ciclo_escolar: undefined,
          cuatrimestre: undefined,
          programa_educativo: undefined,
        },
      },
    })),
}));

export interface ScopedFilters extends FilterState {
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
}

/**
 * Filtros independientes por vista. Cada página pasa su propio `scope`
 * (ej. "matricula", "rendimiento") para que los filtros no se compartan entre vistas.
 */
export function useFilters(scope: string): ScopedFilters {
  const scoped = useFiltersBase((s) => s.scopes[scope]);
  const setFn = useFiltersBase((s) => s.set);
  const resetFn = useFiltersBase((s) => s.reset);
  const state = scoped ?? initialState();
  return {
    ...state,
    set: (patch) => setFn(scope, patch),
    reset: () => resetFn(scope),
  };
}

/** True si hay al menos un filtro aplicado (para habilitar la exportación). */
export function hasActiveFilters(f: FilterState): boolean {
  return Boolean(f.ciclo_escolar || f.cuatrimestre || f.programa_educativo || f.subsistema_id);
}
