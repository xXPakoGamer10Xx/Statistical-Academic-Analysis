import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ciclosApi, indicadoresApi, reportsApi } from "@/api/endpoints";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useFilters, hasActiveFilters } from "@/stores/filters";
import { cn } from "@/lib/utils";
import type { EficienciaPunto } from "@/types";

const MAX_GENERACIONES = 3;

export function Eficiencia() {
  const filters = useFilters("eficiencia");
  const exportDisabled = !hasActiveFilters(filters);

  const { data: catalogoGeneracionesRaw } = useQuery({
    queryKey: ["ciclos", "generacion"],
    queryFn: () => ciclosApi.list({ tipo: "generacion" }),
  });
  // Las generaciones deshabilitadas no se ofrecen para elegir: mostrarlas confunde,
  // ya que no representan datos vigentes.
  const catalogoGeneraciones = useMemo(
    () => catalogoGeneracionesRaw?.filter((g) => g.activo),
    [catalogoGeneracionesRaw],
  );

  const [generaciones, setGeneraciones] = useState<string[]>([]);
  const toggleGeneracion = (valor: string) =>
    setGeneraciones((prev) => {
      if (prev.includes(valor)) return prev.filter((v) => v !== valor);
      if (prev.length >= MAX_GENERACIONES) return prev; // límite RF-06
      return [...prev, valor];
    });

  const { data, error, isLoading } = useQuery({
    queryKey: ["eficiencia", filters, generaciones],
    queryFn: () => indicadoresApi.eficiencia({ ...filters, generaciones }),
  });

  // Desglose por carrera (una fila por programa/generacion, sin agregar): alimenta las
  // tarjetas de pastel + barras por carrera, sin tocar la consulta agregada de la tabla.
  const { data: porProgramaData } = useQuery({
    queryKey: ["eficiencia", "por-programa", filters, generaciones],
    queryFn: () => indicadoresApi.eficiencia({ ...filters, generaciones, agrupar_por_programa: true }),
  });

  // Para cada carrera, la generacion mas reciente entre las seleccionadas (una tarjeta
  // por carrera, no una por cada combinacion carrera/generacion).
  const tarjetasPorCarrera = useMemo(() => {
    const porCarrera = new Map<string, EficienciaPunto>();
    for (const g of porProgramaData?.generaciones ?? []) {
      const actual = porCarrera.get(g.programa_educativo);
      if (!actual || g.generacion > actual.generacion) porCarrera.set(g.programa_educativo, g);
    }
    return [...porCarrera.values()].sort((a, b) => a.programa_educativo.localeCompare(b.programa_educativo));
  }, [porProgramaData]);

  return (
    <div className="space-y-8" id="dashboard-eficiencia">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Eficiencia Terminal y Titulación</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">Comparativa hasta 3 generaciones egresadas</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu
            disabled={exportDisabled}
            disabledHint="Aplica al menos un filtro para exportar"
            onExportHistorical={() => reportsApi.downloadPdf("eficiencia", filters)}
            onExportPdf={() => reportsApi.downloadImagePdf("eficiencia", "charts-eficiencia", filters)}
            onExportImage={() => reportsApi.downloadImage("eficiencia", "charts-eficiencia", filters)}
          />
        </div>
      </div>

      <FilterBar scope="eficiencia" showCiclo={false} showCuatrimestre={false} />

      <Card>
        <CardHeader>
          <CardTitle>Generaciones a comparar <span className="text-sm font-normal text-slate-400">(máx. {MAX_GENERACIONES})</span></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {catalogoGeneraciones?.map((g) => {
              const selected = generaciones.includes(g.valor);
              const disabled = !selected && generaciones.length >= MAX_GENERACIONES;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleGeneracion(g.valor)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                    selected
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {g.valor}
                </button>
              );
            })}
            {catalogoGeneraciones?.length === 0 && (
              <p className="text-sm text-slate-400">No hay generaciones en el catálogo. Agrégalas en Ciclos (admin).</p>
            )}
          </div>
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
          {tarjetasPorCarrera.length > 0 && (
            <div>
              <h2 className="mb-4 text-base font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Por carrera <span className="normal-case font-normal text-slate-400">(generación más reciente de las seleccionadas)</span>
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {tarjetasPorCarrera.map((g) => (
                  <Card key={g.programa_educativo}>
                    <CardHeader>
                      <CardTitle className="text-base">{g.programa_educativo}</CardTitle>
                      <p className="text-xs font-medium text-slate-400">Generación {g.generacion}</p>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Ef. Terminal / Titulación</p>
                        <PieChart
                          height={180}
                          data={[
                            { name: "Ef. Terminal", value: Number(g.eficiencia_terminal.toFixed(2)), color: "#1d4ed8" },
                            { name: "Titulación", value: Number(g.indice_titulacion.toFixed(2)), color: "#10b981" },
                          ]}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Egresados / Titulados</p>
                        <BarChart
                          height={180}
                          categories={["Egresados", "Titulados"]}
                          series={[{ name: g.programa_educativo, data: [g.egresados, g.titulados], color: "#1e40af" }]}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

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
