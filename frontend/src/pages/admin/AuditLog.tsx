import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { auditApi, AuditLogEntry } from "@/api/endpoints";
import { Card, CardContent } from "@/components/ui/Card";

const ACTION_LABELS: Record<string, string> = {
  user_created: "Usuario creado",
  user_updated: "Usuario actualizado",
  user_disabled: "Usuario deshabilitado",
  upload: "Archivo cargado",
};

const ACTION_COLORS: Record<string, string> = {
  user_created: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  user_updated: "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400",
  user_disabled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  upload: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};

const LIMIT = 50;

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "—";
  const parts: string[] = [];
  if (details.old_role && details.new_role) {
    parts.push(`Rol: ${details.old_role} → ${details.new_role}`);
  }
  if (details.email) parts.push(`Email: ${details.email}`);
  if (details.role && !details.old_role) parts.push(`Rol: ${details.role}`);
  if (details.dataset_type) parts.push(`Dataset: ${details.dataset_type}`);
  if (details.filename) parts.push(`Archivo: ${details.filename}`);
  if (details.subsistema_id) parts.push(`Subsistema: ${details.subsistema_id}`);
  if (parts.length === 0) return JSON.stringify(details);
  return parts.join(" · ");
}

export function AuditLog() {
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", offset, actionFilter],
    queryFn: () =>
      auditApi.list({ limit: LIMIT, offset, action: actionFilter || undefined }),
  });

  const hasPrev = offset > 0;
  const hasNext = logs.length === LIMIT;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
          <ClipboardList className="h-7 w-7 text-violet-500" />
          Bitácora de auditoría
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Registro inmutable de todas las acciones sensibles del sistema
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400 shrink-0" />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
          className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              Cargando bitácora…
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              Sin registros para los filtros seleccionados.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Fecha</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actor</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acción</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((entry: AuditLogEntry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString("es-MX", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      {entry.actor_name ?? <span className="text-slate-400 italic">Sistema</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_COLORS[entry.action] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {formatDetails(entry.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>Mostrando {offset + 1}–{offset + logs.length}</span>
        <div className="flex gap-2">
          <button
            disabled={!hasPrev}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </button>
          <button
            disabled={!hasNext}
            onClick={() => setOffset((o) => o + LIMIT)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
