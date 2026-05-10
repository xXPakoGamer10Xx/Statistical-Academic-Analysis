import { useQuery } from "@tanstack/react-query";
import { indicadoresApi } from "@/api/endpoints";
import { FilterBar } from "@/components/filters/FilterBar";
import { KpiCard } from "@/components/ui/KpiCard";
import { useAuth } from "@/hooks/useAuth";
import { useFiltersStore } from "@/stores/filters";

export function Dashboard() {
  const { user } = useAuth();
  const filters = useFiltersStore();

  const { data: matricula } = useQuery({
    queryKey: ["matricula", filters],
    queryFn: () => indicadoresApi.matricula(filters),
  });

  return (
    <div className="space-y-8 lg:space-y-12">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors">
          Bienvenido, {user?.full_name}
        </h1>
        <p className="mt-2 text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium">
          Resumen de indicadores institucionales
        </p>
      </div>

      <FilterBar showCuatrimestre={false} showPrograma={false} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <KpiCard label="Matrícula Actual" value={matricula?.total_actual ?? 0} variant="blue" />
        <KpiCard label="Nuevo Ingreso" value={matricula?.total_nuevo_ingreso ?? 0} variant="green" />
        <KpiCard label="Hombres" value={matricula?.distribucion_genero.hombres ?? 0} variant="blue" />
        <KpiCard label="Mujeres" value={matricula?.distribucion_genero.mujeres ?? 0} variant="amber" />
      </div>

      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 text-sm md:text-base text-slate-600 dark:text-slate-400 shadow-sm transition-colors">
        <p className="leading-relaxed">
          Navega por las secciones del menú lateral para consultar dashboards detallados de matrícula,
          rendimiento académico, eficiencia terminal, titulación y evaluación docente. Usa los filtros
          superiores para segmentar la información.
        </p>
      </div>
    </div>
  );
}
