
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { carrerasApi, ciclosApi, subsistemasApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useFilters } from "@/stores/filters";
import type { Carrera } from "@/types";

interface Props {
  /** Identificador de la vista para mantener filtros independientes por pantalla. */
  scope: string;
  showCiclo?: boolean;
  showCuatrimestre?: boolean;
  showPrograma?: boolean;
}

export function FilterBar({ scope, showCiclo = true, showCuatrimestre = true, showPrograma = true }: Props) {
  const filters = useFilters(scope);
  const { user } = useAuth();
  const isAdminGeneral = user?.role === "admin_general";
  const effectiveSubsistemaId = isAdminGeneral ? filters.subsistema_id : user?.subsistema_id ?? undefined;

  // El admin general puede elegir qué escuela ver (las demás están limitadas a la suya).
  const { data: escuelas } = useQuery({
    queryKey: ["subsistemas"],
    queryFn: subsistemasApi.list,
    enabled: isAdminGeneral,
  });

  // Catalogo administrable de carreras (reemplaza la lista de sugerencias NO estricta).
  // Las carreras deshabilitadas no se ofrecen para elegir: mostrarlas confunde al usuario.
  const { data: carrerasRaw } = useQuery({
    queryKey: ["carreras", effectiveSubsistemaId],
    queryFn: () => carrerasApi.list(effectiveSubsistemaId ? { subsistema_id: effectiveSubsistemaId } : undefined),
    enabled: showPrograma,
  });
  const carreras = useMemo(() => carrerasRaw?.filter((c) => c.activo), [carrerasRaw]);

  // Agrupa cada carrera profesional con su TSU emparejado (misma pareja que /admin/carreras)
  // para que aparezcan juntas en el desplegable en vez de sueltas y desordenadas; cada una
  // sigue siendo una opción seleccionable por separado con su nombre real.
  const gruposPrograma = useMemo(() => {
    const lista = carreras ?? [];
    const porId = new Map(lista.map((c) => [c.id, c]));
    const vistos = new Set<number>();
    const grupos: { principal: Carrera; par: Carrera | null }[] = [];

    for (const c of lista) {
      if (vistos.has(c.id)) continue;
      if (c.nivel === "profesional") {
        const par = c.carrera_par_id ? porId.get(c.carrera_par_id) ?? null : null;
        grupos.push({ principal: c, par });
        vistos.add(c.id);
        if (par) vistos.add(par.id);
      }
    }
    for (const c of lista) {
      if (!vistos.has(c.id)) {
        grupos.push({ principal: c, par: null });
        vistos.add(c.id);
      }
    }
    return grupos;
  }, [carreras]);

  // Catalogo administrable de ciclos generacionales (reemplaza la lista hardcodeada).
  // Los ciclos deshabilitados no se ofrecen para elegir: mostrarlos confunde al usuario.
  const { data: ciclosRaw } = useQuery({
    queryKey: ["ciclos", "ciclo"],
    queryFn: () => ciclosApi.list({ tipo: "ciclo" }),
    enabled: showCiclo,
  });
  const ciclos = useMemo(() => ciclosRaw?.filter((c) => c.activo), [ciclosRaw]);

  // Al entrar a una vista sin ciclo seleccionado, preseleccionar el más reciente
  // (evita pantallas vacías al abrir por primera vez).
  useEffect(() => {
    if (showCiclo && !filters.ciclo_escolar && ciclos && ciclos.length > 0) {
      const masReciente = [...ciclos].sort((a, b) => b.valor.localeCompare(a.valor))[0];
      filters.set({ ciclo_escolar: masReciente.valor });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCiclo, ciclos]);

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      {showCiclo && (
        <div className="min-w-[150px] flex-1">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ciclo generacional</label>
          <Select
            value={filters.ciclo_escolar ?? ""}
            onChange={(e) => filters.set({ ciclo_escolar: e.target.value || undefined })}
          >
            <option value="">Todos los ciclos</option>
            {ciclos?.map((c) => (
              <option key={c.id} value={c.valor}>
                {c.valor}
              </option>
            ))}
          </Select>
        </div>
      )}
      {isAdminGeneral && (
        <div className="min-w-[180px]">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Escuela</label>
          <Select
            value={filters.subsistema_id !== undefined ? String(filters.subsistema_id) : ""}
            onChange={(e) =>
              filters.set({ subsistema_id: e.target.value !== "" ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Todas las escuelas</option>
            {escuelas?.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>
      )}
      {showCuatrimestre && (
        <div className="w-[120px]">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cuatrimestre</label>
          <Select
            value={filters.cuatrimestre !== undefined ? String(filters.cuatrimestre) : ""}
            onChange={(e) =>
              filters.set({ cuatrimestre: e.target.value !== "" ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Todos</option>
            {Array.from({ length: 11 }, (_, num) => num).map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </Select>
        </div>
      )}
      {showPrograma && (
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Programa educativo</label>
          <Select
            value={filters.programa_educativo ?? ""}
            onChange={(e) => filters.set({ programa_educativo: e.target.value || undefined })}
          >
            <option value="">Todas las carreras</option>
            {gruposPrograma.map(({ principal, par }) =>
              par ? (
                <optgroup key={principal.id} label={principal.nombre}>
                  <option value={principal.nombre}>{principal.nombre}</option>
                  <option value={par.nombre}>{par.nombre}</option>
                </optgroup>
              ) : (
                <option key={principal.id} value={principal.nombre}>
                  {principal.nombre}
                </option>
              ),
            )}
          </Select>
        </div>
      )}
      <Button variant="secondary" className="h-11" onClick={() => filters.reset()}>
        Limpiar filtros
      </Button>
    </div>
  );
}
