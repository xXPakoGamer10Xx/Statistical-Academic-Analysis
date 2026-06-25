import { useQuery } from "@tanstack/react-query";
import { indicadoresApi, reportsApi } from "@/api/endpoints";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { KpiCard } from "@/components/ui/KpiCard";
import { useFilters, hasActiveFilters } from "@/stores/filters";
import type { CaracterizacionCategoria } from "@/types";

const CATEGORIA_META: Record<string, { label: string; colors: string[] }> = {
  beca: { label: "Becas", colors: ["#10b981", "#059669", "#34d399", "#6ee7b7", "#047857"] },
  discapacidad: { label: "Discapacidad", colors: ["#f59e0b", "#d97706", "#fbbf24", "#fcd34d", "#b45309"] },
  etnia: { label: "Etnia", colors: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#1e40af"] },
};

function meta(categoria: string) {
  return (
    CATEGORIA_META[categoria] ?? {
      label: categoria.charAt(0).toUpperCase() + categoria.slice(1),
      colors: ["#6366f1", "#818cf8", "#a5b4fc", "#4f46e5"],
    }
  );
}

function CategoriaCard({ cat }: { cat: CaracterizacionCategoria }) {
  const m = meta(cat.categoria);
  const pieData = cat.tipos.map((t, i) => ({ name: t.tipo, value: t.cantidad, color: m.colors[i % m.colors.length] }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {m.label} — {cat.total} alumno(s)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cat.tipos.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin registros</p>
        ) : (
          <>
            <PieChart data={pieData} />
            <BarChart
              categories={cat.tipos.map((t) => t.tipo)}
              series={[{ name: "Alumnos", data: cat.tipos.map((t) => t.cantidad), color: m.colors[0] }]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function Caracterizacion() {
  const filters = useFilters("caracterizacion");
  const exportDisabled = !hasActiveFilters(filters);

  const { data, isLoading } = useQuery({
    queryKey: ["caracterizacion", filters],
    queryFn: () => indicadoresApi.caracterizacion(filters),
  });

  const activo = hasActiveFilters(filters);
  const categorias = data?.categorias ?? [];
  const totalDe = (cat: string) => categorias.find((c) => c.categoria === cat)?.total ?? 0;

  return (
    <div className="space-y-8" id="dashboard-caracterizacion">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Caracterización del alumnado
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
            Desglose por tipo de beca, discapacidad y etnia — apoyo para la asignación de becas
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu
            disabled={exportDisabled}
            disabledHint="Aplica al menos un filtro para exportar"
            onExportHistorical={() => reportsApi.downloadPdf("caracterizacion", filters)}
            onExportPdf={() => reportsApi.downloadImagePdf("caracterizacion", "charts-caracterizacion", filters)}
            onExportImage={() => reportsApi.downloadImage("caracterizacion", "charts-caracterizacion", filters)}
          />
        </div>
      </div>

      <FilterBar scope="caracterizacion" showCuatrimestre={false} />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm font-medium">Cargando datos...</span>
          </div>
        </div>
      ) : (
        <div id="charts-caracterizacion" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
            <KpiCard label="Total caracterizados" value={data?.total ?? 0} variant="blue" />
            <KpiCard label="Becados" value={totalDe("beca")} variant="green" />
            <KpiCard label="Con discapacidad" value={totalDe("discapacidad")} variant="amber" />
            <KpiCard label="Pertenecen a una etnia" value={totalDe("etnia")} variant="blue" />
          </div>

          {categorias.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">
                {activo
                  ? "No hay datos de caracterización para los filtros seleccionados. Captúralos en Cargas (Becas o Caracterización)."
                  : "Aplica un filtro (ciclo escolar) para ver el desglose."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {categorias.map((cat) => (
                <CategoriaCard key={cat.categoria} cat={cat} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
