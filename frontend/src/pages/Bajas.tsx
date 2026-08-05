import { useQuery } from "@tanstack/react-query";
import { bajasApi } from "@/api/endpoints";
import { FilterBar } from "@/components/filters/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { useFilters } from "@/stores/filters";
import { formatPercent } from "@/lib/utils";

export function Bajas() {
  const filters = useFilters("bajas");

  const { data, isLoading } = useQuery({
    queryKey: ["bajas", filters],
    queryFn: () => bajasApi.get(filters),
  });

  const porCarrera = data?.por_carrera ?? [];

  return (
    <div className="space-y-8" id="dashboard-bajas">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Bajas</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
          Bajas por reprobación y por deserción, por carrera
        </p>
      </div>

      <FilterBar scope="bajas" />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm font-medium">Cargando datos...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiCard
              label="Total bajas por reprobación"
              value={data?.totales.bajas_reprobacion ?? 0}
              hint={data ? `Reprobación: ${formatPercent(data.totales.reprobacion_pct)}` : undefined}
              variant="amber"
            />
            <KpiCard
              label="Total bajas por deserción"
              value={data?.totales.bajas_desercion ?? 0}
              hint={data ? `Deserción: ${formatPercent(data.totales.desercion_pct)}` : undefined}
              variant="red"
            />
          </div>

          <Card>
            <CardHeader><CardTitle>Bajas por carrera</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-2 pb-2">Carrera</th>
                      <th className="px-2 pb-2 text-right">Bajas por reprobación</th>
                      <th className="px-2 pb-2 text-right">Reprobación %</th>
                      <th className="px-2 pb-2 text-right">Bajas por deserción</th>
                      <th className="px-2 pb-2 text-right">Deserción %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCarrera.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                          Sin datos para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      porCarrera.map((p) => (
                        <tr key={p.programa_educativo} className="border-b border-slate-100 dark:border-slate-800/50">
                          <td className="px-2 py-2 font-medium text-slate-700 dark:text-slate-300">{p.programa_educativo}</td>
                          <td className="px-2 py-2 text-right">{p.bajas_reprobacion}</td>
                          <td className="px-2 py-2 text-right">{formatPercent(p.reprobacion_pct)}</td>
                          <td className="px-2 py-2 text-right">{p.bajas_desercion}</td>
                          <td className="px-2 py-2 text-right">{formatPercent(p.desercion_pct)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {porCarrera.length > 0 && data && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                        <td className="px-2 py-2">Total</td>
                        <td className="px-2 py-2 text-right">{data.totales.bajas_reprobacion}</td>
                        <td className="px-2 py-2 text-right">{formatPercent(data.totales.reprobacion_pct)}</td>
                        <td className="px-2 py-2 text-right">{data.totales.bajas_desercion}</td>
                        <td className="px-2 py-2 text-right">{formatPercent(data.totales.desercion_pct)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
