import { create } from "zustand";
import type { FilterState } from "@/types";

interface FiltersStore extends FilterState {
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersStore>((set) => ({
  subsistema_id: undefined,
  ciclo_escolar: undefined,
  cuatrimestre: undefined,
  programa_educativo: undefined,
  set: (patch) => set((s) => ({ ...s, ...patch })),
  reset: () =>
    set({
      subsistema_id: undefined,
      ciclo_escolar: undefined,
      cuatrimestre: undefined,
      programa_educativo: undefined,
    }),
}));
