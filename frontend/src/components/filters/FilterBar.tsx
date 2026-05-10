import { useQuery } from "@tanstack/react-query";
import { subsistemasApi } from "@/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useFiltersStore } from "@/stores/filters";

interface Props {
  showSubsistema?: boolean;
  showCuatrimestre?: boolean;
  showPrograma?: boolean;
}

export function FilterBar({ showSubsistema = true, showCuatrimestre = true, showPrograma = true }: Props) {
  const filters = useFiltersStore();
  useQuery({
    queryKey: ["subsistemas"],
    queryFn: subsistemasApi.list,
    enabled: showSubsistema,
  });

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      {showSubsistema && (
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Universidad Politécnica de Texcoco</label>
          <Select
            value={filters.subsistema_id ?? ""}
            onChange={(e) =>
              filters.set({ subsistema_id: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Universidad Politécnica de Texcoco</option>
          </Select>
        </div>
      )}
      <div className="min-w-[150px] flex-1">
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ciclo escolar</label>
        <Input
          placeholder="ej. 2025-2026"
          value={filters.ciclo_escolar ?? ""}
          onChange={(e) => filters.set({ ciclo_escolar: e.target.value || undefined })}
        />
      </div>
      {showCuatrimestre && (
        <div className="w-[120px]">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cuatrimestre</label>
          <Input
            type="number"
            min={1}
            max={12}
            value={filters.cuatrimestre ?? ""}
            onChange={(e) =>
              filters.set({ cuatrimestre: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
      )}
      {showPrograma && (
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Programa educativo</label>
          <Input
            placeholder="Buscar programa..."
            value={filters.programa_educativo ?? ""}
            onChange={(e) => filters.set({ programa_educativo: e.target.value || undefined })}
          />
        </div>
      )}
      <Button variant="secondary" className="h-11" onClick={() => filters.reset()}>
        Limpiar filtros
      </Button>
    </div>
  );
}
