import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Save, ClipboardList } from "lucide-react";
import { uploadsApi } from "@/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { DatasetDefinition, DatasetField, Subsistema } from "@/types";

interface Props {
  formats: DatasetDefinition[] | undefined;
  subsistemas: Subsistema[] | undefined;
  /** Escuela fija para admin_escolar; null/undefined para admin_general (puede elegir). */
  fixedSubsistemaId: number | null;
  isAdminGeneral: boolean;
  onSuccess: () => void;
}

type Row = Record<string, string>;

function emptyRow(def: DatasetDefinition | undefined): Row {
  const r: Row = {};
  def?.fields.forEach((f) => (r[f.name] = ""));
  return r;
}

export function ManualEntry({ formats, subsistemas, fixedSubsistemaId, isAdminGeneral, onSuccess }: Props) {
  const [datasetType, setDatasetType] = useState("matricula");
  const [subsistemaId, setSubsistemaId] = useState<number | "">(fixedSubsistemaId ?? "");

  const def = useMemo(() => formats?.find((f) => f.key === datasetType), [formats, datasetType]);
  const [rows, setRows] = useState<Row[]>([emptyRow(def)]);

  // Columna cuyos valores son las llaves del catalogo (ej. "categoria" → beca/discapacidad/etnia).
  const catalogDriver = useMemo(() => {
    if (!def?.catalogos) return null;
    const keys = Object.keys(def.catalogos).sort().join(",");
    const driver = def.fields.find(
      (f) => f.allowed_values && [...f.allowed_values].sort().join(",") === keys,
    );
    return driver?.name ?? null;
  }, [def]);

  // Sugerencias para un campo en una fila: catalogo dependiente de la categoria o lista plana.
  const suggestionsFor = (field: DatasetField, row: Row): string[] | null => {
    if (def?.catalogos && catalogDriver && field.suggested_values) {
      const sel = row[catalogDriver];
      if (sel && def.catalogos[sel]) return def.catalogos[sel];
    }
    return field.suggested_values ?? null;
  };

  // Al cambiar el tipo de dataset, reiniciar las filas con los campos correctos
  const changeDataset = (key: string) => {
    setDatasetType(key);
    const newDef = formats?.find((f) => f.key === key);
    setRows([emptyRow(newDef)]);
  };

  const setCell = (rowIdx: number, field: string, value: string) =>
    setRows((rs) => rs.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((rs) => [...rs, emptyRow(def)]);
  const removeRow = (idx: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs));

  const submit = useMutation({
    mutationFn: () => {
      const sid = isAdminGeneral ? Number(subsistemaId) : (fixedSubsistemaId ?? Number(subsistemaId));
      // Enviar solo filas con al menos un valor
      const filled = rows.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
      return uploadsApi.uploadManual(sid, datasetType, filled);
    },
    onSuccess: (res) => {
      onSuccess();
      if (res.rows_failed === 0) setRows([emptyRow(def)]);
    },
  });

  const canSubmit =
    !submit.isPending &&
    (isAdminGeneral ? subsistemaId !== "" : fixedSubsistemaId !== null) &&
    rows.some((r) => Object.values(r).some((v) => v.trim() !== ""));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-brand-600" />
          Captura manual (sin archivo)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-slate-400">
          Captura los datos campo por campo. Se validan y guardan igual que una carga de archivo.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tipo de datos</label>
            <Select value={datasetType} onChange={(e) => changeDataset(e.target.value)}>
              {formats?.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Escuela</label>
            {isAdminGeneral ? (
              <Select value={subsistemaId === "" ? "" : String(subsistemaId)} onChange={(e) => setSubsistemaId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Selecciona una escuela…</option>
                {subsistemas?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            ) : (
              <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-sm text-slate-700 dark:text-slate-300">
                {subsistemas?.find((s) => s.id === fixedSubsistemaId)?.nombre ?? "Tu escuela"}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {def?.fields.map((f) => (
                  <th key={f.name} className="px-2 pb-2 font-bold whitespace-nowrap">
                    {f.name}{f.required && <span className="text-red-400"> *</span>}
                  </th>
                ))}
                <th className="px-2 pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-800/50">
                  {def?.fields.map((f) => {
                    const suggestions = suggestionsFor(f, row);
                    const listId = `dl-${rowIdx}-${f.name}`;
                    return (
                      <td key={f.name} className="px-1 py-1.5">
                        {f.allowed_values && f.allowed_values.length > 0 ? (
                          <Select value={row[f.name] ?? ""} onChange={(e) => setCell(rowIdx, f.name, e.target.value)}>
                            <option value="">—</option>
                            {f.allowed_values.map((v) => <option key={v} value={v}>{v}</option>)}
                          </Select>
                        ) : suggestions && suggestions.length > 0 ? (
                          <>
                            <Input
                              list={listId}
                              value={row[f.name] ?? ""}
                              onChange={(e) => setCell(rowIdx, f.name, e.target.value)}
                              placeholder="Elige o escribe…"
                              className="min-w-[140px]"
                            />
                            <datalist id={listId}>
                              {suggestions.map((v) => <option key={v} value={v} />)}
                            </datalist>
                          </>
                        ) : (
                          <Input
                            type={f.kind === "int" || f.kind === "float" ? "number" : "text"}
                            step={f.kind === "float" ? "0.01" : undefined}
                            value={row[f.name] ?? ""}
                            onChange={(e) => setCell(rowIdx, f.name, e.target.value)}
                            className="min-w-[120px]"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1.5">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeRow(rowIdx)}>
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={addRow}>
            <Plus className="mr-1 h-4 w-4" /> Agregar fila
          </Button>
          <Button size="sm" onClick={() => submit.mutate()} disabled={!canSubmit}>
            <Save className="mr-1 h-4 w-4" />
            {submit.isPending ? "Guardando…" : "Guardar captura"}
          </Button>
        </div>

        {submit.isError && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
            {(() => {
              const detail = (submit.error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
              if (typeof detail === "string") return detail;
              if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: unknown }).message);
              return "Error al guardar la captura";
            })()}
          </div>
        )}

        {submit.isSuccess && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400">
            Procesadas {submit.data.rows_processed} fila(s).{submit.data.rows_failed > 0 ? ` ${submit.data.rows_failed} con errores (revisa los campos requeridos).` : " Sin errores."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
