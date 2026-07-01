
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { subsistemasApi } from "@/api/endpoints";
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

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
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
      {showCiclo && (
        <div className="min-w-[150px] flex-1">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ciclo escolar</label>
          <div className="relative group">
            <Input
              list="ciclos"
              placeholder="ej. 2025-2026"
              className="pr-10"
              value={filters.ciclo_escolar ?? ""}
              maxLength={9}
              onChange={(e) => {
                let val = e.target.value.replace(/[^0-9-]/g, "");
                if (val.startsWith("0")) val = val.slice(1);
                filters.set({ ciclo_escolar: val || undefined });
              }}
            />
            <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
              <ChevronDown className="h-4 w-4 stroke-[2.5px]" />
            </div>
          </div>
          <datalist id="ciclos">
            <option value="2018-2019" />
            <option value="2019-2020" />
            <option value="2020-2021" />
            <option value="2021-2022" />
            <option value="2022-2023" />
            <option value="2023-2024" />
            <option value="2024-2025" />
            <option value="2025-2026" />
          </datalist>
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
