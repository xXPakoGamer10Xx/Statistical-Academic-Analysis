import { useQuery } from "@tanstack/react-query";
import { indicadoresApi, reportsApi } from "@/api/endpoints";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useFilters, hasActiveFilters } from "@/stores/filters";

export function Matricula() {
  const filters = useFilters("matricula");
  const exportDisabled = !hasActiveFilters(filters);

  // Datos filtrados para KPIs, distribución y cuatrimestres
  const { data, isLoading } = useQuery({
    queryKey: ["matricula", filters],
    queryFn: () => indicadoresApi.matricula(filters),
  });

  // Datos históricos SIN filtro de ciclo para la gráfica de líneas
  const historicalFilters = { ...filters, ciclo_escolar: undefined };
  const { data: historicalData } = useQuery({
    queryKey: ["matricula-historical", historicalFilters],
    queryFn: () => indicadoresApi.matricula(historicalFilters),
  });

  const historicalSeries = historicalData?.series ?? [];
  const ciclos = Array.from(new Set(historicalSeries.map((s) => s.ciclo_escolar))).sort();
  const matriculaPorCiclo = ciclos.map((c) =>
    historicalSeries.filter((s) => s.ciclo_escolar === c).reduce((sum, s) => sum + s.matricula_actual, 0)
  );
  const nuevoPorCiclo = ciclos.map((c) =>
    historicalSeries.filter((s) => s.ciclo_escolar === c).reduce((sum, s) => sum + s.nuevo_ingreso, 0)
  );
  const filteredSeries = data?.series ?? [];
  const cuatris = Array.from(new Set(filteredSeries.map((s) => s.cuatrimestre))).sort((a, b) => a - b);
  const matriculaPorCuatri = cuatris.map((c) =>
    filteredSeries.filter((s) => s.cuatrimestre === c).reduce((sum, s) => sum + s.matricula_actual, 0)
  );

  return (
    <div className="space-y-8" id="dashboard-matricula">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Matrícula</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">Indicadores históricos de matrícula institucional</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu
            disabled={exportDisabled}
            disabledHint="Aplica al menos un filtro para exportar"
            onExportHistorical={() => reportsApi.downloadPdf("matricula", filters)}
            onExportPdf={() => reportsApi.downloadImagePdf("matricula", "charts-matricula", filters)}
            onExportImage={() => reportsApi.downloadImage("matricula", "charts-matricula", filters)}
          />
        </div>
      </div>

      <FilterBar scope="matricula" />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm font-medium">Cargando datos...</span>
          </div>
        </div>
      ) : (
        <div id="charts-matricula" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
            <KpiCard label="Matrícula Actual" value={exportDisabled ? "—" : (data?.total_actual ?? 0)} variant="blue" />
            <KpiCard label="Nuevo Ingreso" value={exportDisabled ? "—" : (data?.total_nuevo_ingreso ?? 0)} variant="green" />
            <KpiCard label="Hombres" value={exportDisabled ? "—" : (data?.distribucion_genero.hombres ?? 0)} variant="blue" />
            <KpiCard label="Mujeres" value={exportDisabled ? "—" : (data?.distribucion_genero.mujeres ?? 0)} variant="amber" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Histórico por ciclo escolar</CardTitle></CardHeader>
              <CardContent>
                <LineChart
                  categories={ciclos}
                  series={[
                    { name: "Matrícula", data: matriculaPorCiclo, color: "#1d4ed8" },
                    { name: "Nuevo ingreso", data: nuevoPorCiclo, color: "#10b981" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Distribución por género</CardTitle></CardHeader>
              <CardContent>
                <PieChart
                  data={[
                    { name: "Hombres", value: data?.distribucion_genero.hombres ?? 0, color: "#1d4ed8" },
                    { name: "Mujeres", value: data?.distribucion_genero.mujeres ?? 0, color: "#f59e0b" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Matrícula por cuatrimestre</CardTitle></CardHeader>
              <CardContent>
                <BarChart
                  categories={cuatris.map((c) => `Cuatrimestre ${c}`)}
                  series={[{ name: "Matrícula", data: matriculaPorCuatri, color: "#1e40af" }]}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
