
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ciclosApi, subsistemasApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useFilters } from "@/stores/filters";

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

  // El admin general puede elegir qué escuela ver (las demás están limitadas a la suya).
  const { data: escuelas } = useQuery({
    queryKey: ["subsistemas"],
    queryFn: subsistemasApi.list,
    enabled: isAdminGeneral,
  });

  // Catalogo administrable de ciclos generacionales (reemplaza la lista hardcodeada).
  const { data: ciclos } = useQuery({
    queryKey: ["ciclos", "ciclo"],
    queryFn: () => ciclosApi.list({ tipo: "ciclo" }),
    enabled: showCiclo,
  });

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
                {c.valor}{!c.activo ? " (deshabilitado)" : ""}
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
            {[1, 2, 3].map((num) => (
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
          <Input
            placeholder="Buscar programa..."
            value={filters.programa_educativo ?? ""}
            maxLength={100}
            onChange={(e) => {
              const val = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "");
              filters.set({ programa_educativo: val || undefined });
            }}
          />
        </div>
      )}
      <Button variant="secondary" className="h-11" onClick={() => filters.reset()}>
        Limpiar filtros
      </Button>
    </div>
  );
}
