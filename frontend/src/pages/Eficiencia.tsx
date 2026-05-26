import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { indicadoresApi, reportsApi } from "@/api/endpoints";
import { BarChart } from "@/components/charts/BarChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useFiltersStore } from "@/stores/filters";
import { cn } from "@/lib/utils";

export function Eficiencia() {
  const filters = useFiltersStore();

  const [genInput, setGenInput] = useState("");
  const generaciones = genInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const { data, error, isLoading } = useQuery({
    queryKey: ["eficiencia", filters, generaciones],
    queryFn: () => indicadoresApi.eficiencia({ ...filters, generaciones }),
  });

  const cats = data?.generaciones.map((g) => `${g.generacion} · ${g.programa_educativo}`) ?? [];
  const efTerminal = data?.generaciones.map((g) => Number(g.eficiencia_terminal.toFixed(2))) ?? [];
  const titulacion = data?.generaciones.map((g) => Number(g.indice_titulacion.toFixed(2))) ?? [];

  return (
    <div className="space-y-8" id="dashboard-eficiencia">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Eficiencia Terminal y Titulación</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">Comparativa hasta 3 generaciones egresadas</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu 
            onExportHistorical={() => reportsApi.downloadPdf("eficiencia", filters)}
            onExportPdf={() => reportsApi.downloadImagePdf("eficiencia", "charts-eficiencia", filters)}
            onExportImage={() => reportsApi.downloadImage("eficiencia", "charts-eficiencia", filters)}
          />
        </div>
      </div>

      <FilterBar showCuatrimestre={false} />

      <Card>
        <CardHeader>
          <CardTitle>Generaciones a comparar <span className="text-sm font-normal text-slate-400">(máx. 3, separadas por coma)</span></CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="ej. 2020-2023, 2021-2024, 2022-2025"
            value={genInput}
            onChange={(e) => setGenInput(e.target.value)}
          />
          {error && (
            <div className="mt-2 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al cargar datos"}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm font-medium">Cargando datos...</span>
          </div>
        </div>
      ) : (
        <div id="charts-eficiencia" className="space-y-6">
          {data?.generaciones.length === 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-400 dark:text-slate-500">
              <p className="text-sm font-medium">No hay datos de titulación disponibles.</p>
              <p className="mt-1 text-xs">Sube un archivo de tipo <span className="font-bold text-slate-600 dark:text-slate-300">Titulación</span> en la sección Cargas.</p>
            </div>
          )}
          <Card>
            <CardHeader><CardTitle>Eficiencia Terminal vs Índice de Titulación (%)</CardTitle></CardHeader>
            <CardContent>
              <BarChart
                categories={cats}
                series={[
                  { name: "Eficiencia Terminal", data: efTerminal, color: "#1d4ed8" },
                  { name: "Índice Titulación", data: titulacion, color: "#10b981" },
                ]}
                formatter="%"
                height={400}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Detalle por generación</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="pb-4 pl-2 font-bold">Generación</th>
                    <th className="pb-4 font-bold">Programa</th>
                    <th className="pb-4 text-center font-bold">Egresados</th>
                    <th className="pb-4 text-center font-bold">Titulados</th>
                    <th className="pb-4 text-center font-bold">Ef. Terminal</th>
                    <th className="pb-4 text-center font-bold">Titulación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.generaciones.map((g, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 pl-2 font-semibold text-slate-900 dark:text-white">{g.generacion}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{g.programa_educativo}</td>
                      <td className="py-3 text-center font-bold text-slate-900 dark:text-white">{g.egresados}</td>
                      <td className="py-3 text-center font-bold text-slate-900 dark:text-white">{g.titulados}</td>
                      <td className="py-3 text-center">
                        <span className={cn(
                          "inline-block rounded-full px-2.5 py-1 text-xs font-bold",
                          g.eficiencia_terminal >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          g.eficiencia_terminal >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {g.eficiencia_terminal.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={cn(
                          "inline-block rounded-full px-2.5 py-1 text-xs font-bold",
                          g.indice_titulacion >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          g.indice_titulacion >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {g.indice_titulacion.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
