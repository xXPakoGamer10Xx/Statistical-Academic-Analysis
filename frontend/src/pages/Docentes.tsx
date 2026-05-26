import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { indicadoresApi, reportsApi } from "@/api/endpoints";
import { BarChart } from "@/components/charts/BarChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useFiltersStore } from "@/stores/filters";

export function Docentes() {
  const filters = useFiltersStore();

  const { data } = useQuery({
    queryKey: ["docentes", filters],
    queryFn: () => indicadoresApi.docentes(filters),
  });

  const docentes = data?.docentes ?? [];
  const cats = docentes.map((d) => d.docente_nombre);
  const alumnos = docentes.map((d) => d.promedio_alumnos ?? 0);
  const directivos = docentes.map((d) => d.promedio_directivos ?? 0);

  return (
    <div className="space-y-6" id="dashboard-docentes">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Evaluación Docente</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Comparativa de evaluaciones por alumnos y directivos</p>
        </div>
        <ExportMenu
          onExportHistorical={() => reportsApi.downloadPdf("docentes", filters)}
          onExportPdf={() => reportsApi.downloadImagePdf("docentes", "charts-docentes", filters)}
          onExportImage={() => reportsApi.downloadImage("docentes", "charts-docentes", filters)}
        />
      </div>

      <FilterBar showCuatrimestre={false} />

      {docentes.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-400 dark:text-slate-500">
          <p className="text-sm font-medium">No hay datos de evaluación docente disponibles.</p>
          <p className="mt-1 text-xs">Sube un archivo de tipo <span className="font-bold text-slate-600 dark:text-slate-300">Evaluación Docente</span> en la sección Cargas.</p>
        </div>
      )}

      <div id="charts-docentes" className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Promedios comparados</CardTitle></CardHeader>
        <CardContent>
          <BarChart
            categories={cats}
            series={[
              { name: "Alumnos", data: alumnos, color: "#1d4ed8" },
              { name: "Directivos", data: directivos, color: "#10b981" },
            ]}
            height={420}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detalle</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Ciclo</th>
                <th>Docente</th>
                <th>Programa</th>
                <th>Alumnos</th>
                <th>Directivos</th>
              </tr>
            </thead>
            <tbody>
              {docentes.map((d, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2">{d.ciclo_escolar}</td>
                  <td>{d.docente_nombre}</td>
                  <td>{d.programa_educativo}</td>
                  <td>{d.promedio_alumnos?.toFixed(2) ?? "—"}</td>
                  <td>{d.promedio_directivos?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
