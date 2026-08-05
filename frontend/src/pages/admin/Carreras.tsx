import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, GraduationCap, Power, PowerOff } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { carrerasApi, subsistemasApi } from "@/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Carrera } from "@/types";

type Nivel = "tsu" | "profesional";

interface FormState {
  subsistema_id: number | null;
  nombre: string;
  nivel: Nivel;
  carrera_par_id: number | null;
}

export function Carreras() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const isEscolar = me?.role === "admin_escolar";
  const lockedSubsistemaId = isEscolar ? (me?.subsistema_id ?? null) : null;

  const { data: subsistemas } = useQuery({ queryKey: ["subsistemas"], queryFn: subsistemasApi.list });
  const [filtroSubsistema, setFiltroSubsistema] = useState<number | null>(lockedSubsistemaId);
  const [form, setForm] = useState<FormState>({
    subsistema_id: lockedSubsistemaId, nombre: "", nivel: "profesional", carrera_par_id: null,
  });

  const { data: carreras } = useQuery({
    queryKey: ["carreras", filtroSubsistema],
    queryFn: () => carrerasApi.list(filtroSubsistema ? { subsistema_id: filtroSubsistema } : undefined),
  });

  // Candidatas a "carrera par": mismo subsistema del formulario, nivel opuesto, sin par ya asignado.
  const candidatasPar = (carreras ?? []).filter(
    (c) => c.subsistema_id === form.subsistema_id && c.nivel !== form.nivel && !c.carrera_par_id,
  );

  const create = useMutation({
    mutationFn: () => carrerasApi.create({
      subsistema_id: form.subsistema_id as number,
      nombre: form.nombre,
      nivel: form.nivel,
      carrera_par_id: form.carrera_par_id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carreras"] });
      setForm({ subsistema_id: lockedSubsistemaId, nombre: "", nivel: "profesional", carrera_par_id: null });
    },
  });

  const toggle = useMutation({
    mutationFn: (c: Carrera) => carrerasApi.update(c.id, { activo: !c.activo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carreras"] }),
  });

  // Agrupa cada Ingeniería/Lic. junto con su TSU emparejado (se muestran juntos, el TSU
  // con nombre chico debajo), y deja las carreras sin par al final, sueltas.
  const filas = useMemo(() => {
    const lista = carreras ?? [];
    const porId = new Map(lista.map((c) => [c.id, c]));
    const vistos = new Set<number>();
    const grupos: { principal: Carrera; par: Carrera | null }[] = [];

    for (const c of lista) {
      if (vistos.has(c.id)) continue;
      if (c.nivel === "profesional") {
        const par = c.carrera_par_id ? porId.get(c.carrera_par_id) ?? null : null;
        grupos.push({ principal: c, par });
        vistos.add(c.id);
        if (par) vistos.add(par.id);
      }
    }
    for (const c of lista) {
      if (!vistos.has(c.id)) {
        grupos.push({ principal: c, par: null });
        vistos.add(c.id);
      }
    }
    return grupos;
  }, [carreras]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Carreras</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
          Administra el catálogo de carreras por escuela y su TSU emparejado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-brand-600" />
            Agregar carrera
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Escuela</label>
              {isEscolar ? (
                <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-sm text-slate-700 dark:text-slate-300">
                  {subsistemas?.find((s) => s.id === lockedSubsistemaId)?.nombre ?? "Tu escuela"}
                </div>
              ) : (
                <Select
                  value={form.subsistema_id ?? ""}
                  onChange={(e) => setForm({ ...form, subsistema_id: e.target.value ? Number(e.target.value) : null, carrera_par_id: null })}
                >
                  <option value="">Selecciona una escuela…</option>
                  {subsistemas?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </Select>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nombre de la carrera</label>
              <Input
                placeholder="ej. INGENIERÍA EN LOGÍSTICA"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nivel</label>
              <Select
                value={form.nivel}
                onChange={(e) => setForm({ ...form, nivel: e.target.value as Nivel, carrera_par_id: null })}
              >
                <option value="profesional">Ingeniería / Licenciatura</option>
                <option value="tsu">TSU</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Carrera par ({form.nivel === "tsu" ? "Ingeniería/Lic." : "TSU"}) — opcional
              </label>
              <Select
                value={form.carrera_par_id ?? ""}
                onChange={(e) => setForm({ ...form, carrera_par_id: e.target.value ? Number(e.target.value) : null })}
                disabled={!form.subsistema_id}
              >
                <option value="">Sin carrera par</option>
                {candidatasPar.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </div>
            <div className="flex items-end lg:col-span-4">
              <Button type="submit" disabled={create.isPending || !form.subsistema_id} className="w-full md:w-auto">
                <GraduationCap className="mr-2 h-4 w-4" />
                {create.isPending ? "Agregando..." : "Agregar al catálogo"}
              </Button>
            </div>
          </form>
          {create.isError && (
            <div className="mt-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {(create.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al agregar la carrera"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Catálogo</CardTitle>
            {!isEscolar && (
              <div className="min-w-[200px]">
                <Select
                  value={filtroSubsistema ?? ""}
                  onChange={(e) => setFiltroSubsistema(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Todas las escuelas</option>
                  {subsistemas?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="pb-4 pl-2 font-bold">Carrera</th>
                <th className="pb-4 text-center font-bold">Estado</th>
                <th className="pb-4 text-center font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ principal, par }) => (
                <Fragment key={principal.id}>
                  <tr
                    className={cn(
                      "hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors",
                      par ? "" : "border-b border-slate-100 dark:border-slate-800/50",
                    )}
                  >
                    <td className="pt-4 pb-1 pl-2 font-semibold text-slate-900 dark:text-white">{principal.nombre}</td>
                    <td className="pt-4 pb-1 text-center">
                      <span className={cn(
                        "inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        principal.activo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {principal.activo ? "Activo" : "Deshabilitado"}
                      </span>
                    </td>
                    <td className="pt-4 pb-1 text-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0"
                        onClick={() => toggle.mutate(principal)}
                        title={principal.activo ? "Deshabilitar" : "Reactivar"}
                      >
                        {principal.activo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                  {par && (
                    <tr
                      key={par.id}
                      className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="pt-0 pb-4 pl-2">
                        <span className="inline-flex items-center gap-1.5 pl-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                          {par.nombre}
                        </span>
                      </td>
                      <td className="pt-0 pb-4 text-center">
                        <span className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                          par.activo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {par.activo ? "Activo" : "Deshabilitado"}
                        </span>
                      </td>
                      <td className="pt-0 pb-4 text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 w-7 p-0"
                          onClick={() => toggle.mutate(par)}
                          title={par.activo ? "Deshabilitar" : "Reactivar"}
                        >
                          {par.activo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
