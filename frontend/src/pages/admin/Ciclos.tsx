import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { ciclosApi } from "@/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { Ciclo } from "@/types";

type Tipo = "ciclo" | "generacion";

const TIPO_LABELS: Record<Tipo, string> = {
  ciclo: "Ciclo escolar",
  generacion: "Generación (Eficiencia Terminal)",
};

const EMPTY = { valor: "", tipo: "ciclo" as Tipo };

export function Ciclos() {
  const qc = useQueryClient();
  const { data: ciclos } = useQuery({ queryKey: ["ciclos"], queryFn: () => ciclosApi.list() });
  const [form, setForm] = useState(EMPTY);

  const create = useMutation({
    mutationFn: () => ciclosApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ciclos"] });
      setForm(EMPTY);
    },
  });

  const toggle = useMutation({
    mutationFn: (c: Ciclo) => ciclosApi.update(c.id, { activo: !c.activo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ciclos"] }),
  });

  const ordenados = [...(ciclos ?? [])].sort((a, b) =>
    a.tipo === b.tipo ? b.valor.localeCompare(a.valor) : a.tipo.localeCompare(b.tipo),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Ciclos Generacionales</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
          Administra el catálogo de ciclos escolares y generaciones disponible en toda la plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-brand-600" />
            Agregar ciclo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor (AAAA-AAAA)</label>
              <Input
                placeholder="ej. 2027-2028"
                required
                pattern="\d{4}-\d{4}"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tipo</label>
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}>
                <option value="ciclo">Ciclo escolar (ej. 2027-2028)</option>
                <option value="generacion">Generación (ej. 2023-2026)</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending} className="w-full">
                <CalendarPlus className="mr-2 h-4 w-4" />
                {create.isPending ? "Agregando..." : "Agregar al catálogo"}
              </Button>
            </div>
          </form>
          {create.isError && (
            <div className="mt-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {(create.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al agregar el ciclo"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Catálogo</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="pb-4 pl-2 font-bold">Valor</th>
                <th className="pb-4 font-bold">Tipo</th>
                <th className="pb-4 text-center font-bold">Estado</th>
                <th className="pb-4 text-center font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ordenados.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="py-4 pl-2 font-semibold text-slate-900 dark:text-white">{c.valor}</td>
                  <td className="py-4 text-slate-600 dark:text-slate-400">{TIPO_LABELS[c.tipo]}</td>
                  <td className="py-4 text-center">
                    <span className={cn(
                      "inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      c.activo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {c.activo ? "Activo" : "Deshabilitado"}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      onClick={() => toggle.mutate(c)}
                      title={c.activo ? "Deshabilitar" : "Reactivar"}
                    >
                      {c.activo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
