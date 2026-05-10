import { useQuery } from "@tanstack/react-query";
import { Download, Image } from "lucide-react";
import { indicadoresApi, reportsApi } from "@/api/endpoints";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { useFiltersStore } from "@/stores/filters";

export function Matricula() {
  const filters = useFiltersStore();
  const { data, isLoading } = useQuery({
    queryKey: ["matricula", filters],
    queryFn: () => indicadoresApi.matricula(filters),
  });

  const series = data?.series ?? [];
  const ciclos = Array.from(new Set(series.map((s) => s.ciclo_escolar))).sort();
  const matriculaPorCiclo = ciclos.map((c) =>
    series.filter((s) => s.ciclo_escolar === c).reduce((sum, s) => sum + s.matricula_actual, 0)
  );
  const nuevoPorCiclo = ciclos.map((c) =>
    series.filter((s) => s.ciclo_escolar === c).reduce((sum, s) => sum + s.nuevo_ingreso, 0)
  );
  const cuatris = Array.from(new Set(series.map((s) => s.cuatrimestre))).sort((a, b) => a - b);
  const matriculaPorCuatri = cuatris.map((c) =>
    series.filter((s) => s.cuatrimestre === c).reduce((sum, s) => sum + s.matricula_actual, 0)
  );

  return (
    <div className="space-y-8" id="dashboard-matricula">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Matrícula</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">Indicadores históricos de matrícula institucional</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => reportsApi.downloadImage("matricula", "charts-matricula")}>
            <Image className="mr-2 h-4 w-4" />
            Imagen
          </Button>
          <Button variant="secondary" size="sm" onClick={() => reportsApi.downloadPdf("matricula", filters)}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <FilterBar />

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
            <KpiCard label="Matrícula Actual" value={data?.total_actual ?? 0} variant="blue" />
            <KpiCard label="Nuevo Ingreso" value={data?.total_nuevo_ingreso ?? 0} variant="green" />
            <KpiCard label="Hombres" value={data?.distribucion_genero.hombres ?? 0} variant="blue" />
            <KpiCard label="Mujeres" value={data?.distribucion_genero.mujeres ?? 0} variant="amber" />
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
