import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, BookOpen, GraduationCap, UserCheck, ArrowRight } from "lucide-react";
import { indicadoresApi } from "@/api/endpoints";
import { FilterBar } from "@/components/filters/FilterBar";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useFilters, hasActiveFilters } from "@/stores/filters";
import { LineChart } from "@/components/charts/LineChart";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/utils";

const modules = [
  {
    to: "/matricula",
    icon: Users,
    title: "Matrícula",
    description: "Análisis detallado de inscripciones por ciclo, cuatrimestre y programa.",
    color: "text-brand-500",
    bg: "bg-brand-50/60 dark:bg-brand-950/20",
  },
  {
    to: "/rendimiento",
    icon: BookOpen,
    title: "Rendimiento Académico",
    description: "Indicadores de aprobación, reprobación y aprovechamiento.",
    color: "text-emerald-500",
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
  },
  {
    to: "/eficiencia",
    icon: GraduationCap,
    title: "Eficiencia Terminal",
    description: "Tasas de graduación y deserción por generación.",
    color: "text-violet-500",
    bg: "bg-violet-50/60 dark:bg-violet-950/20",
  },
  {
    to: "/docentes",
    icon: UserCheck,
    title: "Evaluación Docente",
    description: "Resultados y tendencias de evaluaciones al personal docente.",
    color: "text-amber-500",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
  },
];

type MetricType = "actual" | "nuevo" | "hombres" | "mujeres";

export function Dashboard() {
  const { user } = useAuth();
  const filters = useFilters("dashboard");
  const noFilters = !hasActiveFilters(filters);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("actual");

  // Initialize cycle for Dashboard only if it's empty
  useEffect(() => {
    if (!filters.ciclo_escolar) {
      filters.set({ ciclo_escolar: "2025-2026" });
    }
  }, []); // Run once on mount

  const { data: matricula } = useQuery({
    queryKey: ["matricula", filters],
    queryFn: () => indicadoresApi.matricula(filters),
  });

  const chartData = useMemo(() => {
    if (!matricula?.series) return { categories: [], series: [] };

    // Group by cycle to avoid duplicates if multiple terms/programs exist
    const aggregated = matricula.series.reduce((acc, curr) => {
      if (!acc[curr.ciclo_escolar]) {
        acc[curr.ciclo_escolar] = { actual: 0, nuevo: 0, hombres: 0, mujeres: 0 };
      }
      acc[curr.ciclo_escolar].actual += curr.matricula_actual;
      acc[curr.ciclo_escolar].nuevo += curr.nuevo_ingreso;
      acc[curr.ciclo_escolar].hombres += curr.hombres;
      acc[curr.ciclo_escolar].mujeres += curr.mujeres;
      return acc;
    }, {} as Record<string, { actual: number; nuevo: number; hombres: number; mujeres: number }>);

    const categories = Object.keys(aggregated).sort();
    
    let data: number[] = [];
    let name = "";
    let color = "";

    if (selectedMetric === "actual") {
      data = categories.map((c) => aggregated[c].actual);
      name = "Matrícula Actual";
      color = "#3b82f6"; // brand-500
    } else if (selectedMetric === "nuevo") {
      data = categories.map((c) => aggregated[c].nuevo);
      name = "Nuevo Ingreso";
      color = "#10b981"; // emerald-500
    } else if (selectedMetric === "hombres") {
      data = categories.map((c) => aggregated[c].hombres);
      name = "Hombres";
      color = "#3b82f6"; // brand-500
    } else {
      data = categories.map((c) => aggregated[c].mujeres);
      name = "Mujeres";
      color = "#f59e0b"; // amber-500
    }

    return { categories, series: [{ name, data, color }] };
  }, [matricula, selectedMetric]);

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

      <FilterBar scope="dashboard" showCuatrimestre={true} showPrograma={false} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6 items-start">
        <KpiCard
          label="Matrícula Actual"
          value={noFilters ? "—" : (matricula?.total_actual ?? 0)}
          variant="blue"
          active={selectedMetric === "actual"}
          onClick={() => setSelectedMetric("actual")}
          detailTo="/matricula"
          summary={`El total de alumnos inscritos registrados para los filtros actuales es de ${formatNumber(matricula?.total_actual ?? 0)} estudiantes.`}
          badge={filters.ciclo_escolar || "Todos los ciclos"}
        />
        <KpiCard
          label="Nuevo Ingreso"
          value={noFilters ? "—" : (matricula?.total_nuevo_ingreso ?? 0)}
          variant="green"
          active={selectedMetric === "nuevo"}
          onClick={() => setSelectedMetric("nuevo")}
          detailTo="/matricula"
          summary={`Se registraron ${formatNumber(matricula?.total_nuevo_ingreso ?? 0)} alumnos de nuevo ingreso, lo que representa el ${((matricula?.total_nuevo_ingreso ?? 0) / (matricula?.total_actual || 1) * 100).toFixed(1)}% de la matrícula total.`}
          badge={filters.ciclo_escolar || "Todos los ciclos"}
        />
        <KpiCard
          label="Hombres"
          value={noFilters ? "—" : (matricula?.distribucion_genero.hombres ?? 0)}
          variant="blue"
          active={selectedMetric === "hombres"}
          onClick={() => setSelectedMetric("hombres")}
          detailTo="/matricula"
          summary={`Los estudiantes de género masculino conforman el ${((matricula?.distribucion_genero.hombres ?? 0) / (matricula?.total_actual || 1) * 100).toFixed(1)}% de la matrícula actual.`}
          badge={filters.ciclo_escolar || "Todos los ciclos"}
        />
        <KpiCard
          label="Mujeres"
          value={noFilters ? "—" : (matricula?.distribucion_genero.mujeres ?? 0)}
          variant="amber"
          active={selectedMetric === "mujeres"}
          onClick={() => setSelectedMetric("mujeres")}
          detailTo="/matricula"
          summary={`Las estudiantes de género femenino conforman el ${((matricula?.distribucion_genero.mujeres ?? 0) / (matricula?.total_actual || 1) * 100).toFixed(1)}% de la matrícula actual.`}
          badge={filters.ciclo_escolar || "Todos los ciclos"}
        />
      </div>

      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm transition-colors">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tendencia Histórica</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Evolución de los indicadores seleccionados</p>
          </div>
          <Link to="/matricula">
            <Button variant="primary">Ver análisis detallado →</Button>
          </Link>
        </div>
        {chartData.categories.length > 0 ? (
          <LineChart
            categories={chartData.categories}
            series={chartData.series}
            height={350}
          />
        ) : (
          <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-600 text-sm">
            Sin datos para el ciclo / cuatrimestre seleccionado.
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-base font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Módulos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(({ to, icon: Icon, title, description, color, bg }) => (
            <Link key={to} to={to} className="group block">
              <Card
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`h-full cursor-pointer transition-all duration-300 hover:shadow-lg ${bg}`}
              >
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
                  </div>
                  <span className={`mt-auto inline-flex items-center gap-1 text-xs font-semibold ${color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Abrir módulo <ArrowRight className="h-3 w-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
