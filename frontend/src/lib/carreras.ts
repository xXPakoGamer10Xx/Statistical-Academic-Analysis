import type { Carrera } from "@/types";

export interface GrupoCarrera {
  principal: Carrera;
  par: Carrera | null;
}

/** Agrupa cada carrera profesional (Ingenieria/Lic.) con su TSU emparejado para que
 * aparezcan juntas en los desplegables en vez de sueltas y desordenadas; cada una sigue
 * siendo seleccionable por separado con su nombre real. Las carreras sin pareja quedan
 * sueltas al final. Compartido por FilterBar y ManualEntry para no duplicar la logica. */
export function agruparCarreras(carreras: Carrera[]): GrupoCarrera[] {
  const porId = new Map(carreras.map((c) => [c.id, c]));
  const vistos = new Set<number>();
  const grupos: GrupoCarrera[] = [];

  for (const c of carreras) {
    if (vistos.has(c.id)) continue;
    if (c.nivel === "profesional") {
      const par = c.carrera_par_id ? (porId.get(c.carrera_par_id) ?? null) : null;
      grupos.push({ principal: c, par });
      vistos.add(c.id);
      if (par) vistos.add(par.id);
    }
  }
  for (const c of carreras) {
    if (!vistos.has(c.id)) {
      grupos.push({ principal: c, par: null });
      vistos.add(c.id);
    }
  }
  return grupos;
}
