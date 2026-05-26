import { useQuery } from "@tanstack/react-query";
import { Download, Image } from "lucide-react";
import { indicadoresApi, reportsApi } from "@/api/endpoints";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useFiltersStore } from "@/stores/filters";

export function Rendimiento() {
  const filters = useFiltersStore();


  const { data, isLoading } = useQuery({
    queryKey: ["rendimiento", filters],
    queryFn: () => indicadoresApi.rendimiento(filters),
  });

  const { data: opcionales } = useQuery({
    queryKey: ["opcionales", filters],
    queryFn: () => indicadoresApi.opcionales(filters),
  });

  const ciclos = Array.from(
    new Set([
      ...(data?.aprovechamiento.map((a) => a.ciclo_escolar) ?? []),
      ...(data?.reprobacion.map((r) => r.ciclo_escolar) ?? []),
      ...(data?.desercion.map((d) => d.ciclo_escolar) ?? []),
    ])
  ).sort();

  const sumarPorCiclo = (arr: { ciclo_escolar: string; valor: number }[] | undefined) =>
    ciclos.map((c) => {
      const items = arr?.filter((x) => x.ciclo_escolar === c) ?? [];
      return items.length ? items.reduce((s, x) => s + x.valor, 0) / items.length : 0;
    });

  // Indicadores opcionales — promediar por ciclo
  const ciclosOpc = Array.from(new Set([
    ...(opcionales?.cobertura.map((x) => x.ciclo_escolar) ?? []),
  ])).sort();
  const avgOpc = (arr: { ciclo_escolar: string; valor: number }[] | undefined) =>
    ciclosOpc.map((c) => {
      const items = arr?.filter((x) => x.ciclo_escolar === c) ?? [];
      return items.length ? items.reduce((s, x) => s + x.valor, 0) / items.length : 0;
    });

  return (
    <div className="space-y-8" id="dashboard-rendimiento">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Rendimiento Académico</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">Aprovechamiento, reprobación y deserción</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu 
            onExportHistorical={() => reportsApi.downloadPdf("rendimiento", filters)}
            onExportPdf={() => reportsApi.downloadImagePdf("rendimiento", "charts-rendimiento", filters)}
            onExportImage={() => reportsApi.downloadImage("rendimiento", "charts-rendimiento", filters)}
          />
        </div>
      </div>

      <FilterBar showCuatrimestre={false} />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm font-medium">Cargando datos...</span>
          </div>
        </div>
      ) : (
        <div id="charts-rendimiento" className="space-y-6">
          {/* Indicadores básicos */}
          <div>
            <h2 className="mb-4 text-base font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Indicadores Básicos</h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Aprovechamiento académico</CardTitle></CardHeader>
                <CardContent>
                  <LineChart
                    categories={ciclos}
                    series={[{ name: "Promedio", data: sumarPorCiclo(data?.aprovechamiento), color: "#10b981" }]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Tasa de reprobación (%)</CardTitle></CardHeader>
                <CardContent>
                  <BarChart
                    categories={ciclos}
                    series={[{ name: "Reprobación", data: sumarPorCiclo(data?.reprobacion), color: "#f59e0b" }]}
                    formatter="%"
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Tasa de deserción (%)</CardTitle></CardHeader>
                <CardContent>
                  <LineChart
                    categories={ciclos}
                    series={[{ name: "Deserción", data: sumarPorCiclo(data?.desercion), color: "#dc2626" }]}
                    formatter="%"
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Indicadores opcionales */}
          {opcionales && (
            <div>
              <h2 className="mb-4 text-base font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Indicadores Opcionales</h2>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <KpiCard
                  label="Cobertura"
                  value={Number((opcionales.cobertura.reduce((s, x) => s + x.valor, 0) / (opcionales.cobertura.length || 1)).toFixed(1))}
                  variant="blue"
                />
                <KpiCard
                  label="Abandono Escolar"
                  value={Number((opcionales.abandono_escolar.reduce((s, x) => s + x.valor, 0) / (opcionales.abandono_escolar.length || 1)).toFixed(1))}
                  variant="amber"
                />
                <KpiCard
                  label="Absorción"
                  value={Number((opcionales.absorcion.reduce((s, x) => s + x.valor, 0) / (opcionales.absorcion.length || 1)).toFixed(1))}
                  variant="green"
                />
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader><CardTitle>Cobertura (%)</CardTitle></CardHeader>
                  <CardContent>
                    <BarChart
                      categories={ciclosOpc}
                      series={[{ name: "Cobertura", data: avgOpc(opcionales.cobertura), color: "#1d4ed8" }]}
                      formatter="%"
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Abandono Escolar (%)</CardTitle></CardHeader>
                  <CardContent>
                    <BarChart
                      categories={ciclosOpc}
                      series={[{ name: "Abandono", data: avgOpc(opcionales.abandono_escolar), color: "#f59e0b" }]}
                      formatter="%"
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Absorción (%)</CardTitle></CardHeader>
                  <CardContent>
                    <BarChart
                      categories={ciclosOpc}
                      series={[{ name: "Absorción", data: avgOpc(opcionales.absorcion), color: "#10b981" }]}
                      formatter="%"
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
