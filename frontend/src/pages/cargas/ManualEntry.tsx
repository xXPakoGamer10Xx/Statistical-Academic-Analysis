import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Save, ClipboardList } from "lucide-react";
import { ciclosApi, indicadoresApi, suggestionsApi, uploadsApi } from "@/api/endpoints";
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

const MADRES_SOLTERAS = "madres solteras";
// Sentinel para "+ Agregar nueva carrera" en los desplegables de programa_educativo:
// el catalogo de carreras es solo de sugerencia (no estricto), asi que siempre debe
// poder capturarse una carrera nueva que aun no exista en la BD (ej. un TSU nuevo).
const NUEVA_CARRERA = "__nueva_carrera__";

function emptyRow(def: DatasetDefinition | undefined): Row {
  const r: Row = {};
  def?.fields.forEach((f) => (r[f.name] = ""));
  return r;
}

// "evaluacion_docente" usa un layout de fila propio (ver componente): un docente,
// dos puntajes (alumnos/directivos) y un promedio calculado, en vez del campo
// generico "evaluador_tipo" + "puntaje" (que obligaria a 2 filas por docente).
function emptyDocenteRow(): Row {
  return {
    ciclo_escolar: "",
    puesto: "",
    docente_nombre: "",
    programa_educativo: "",
    puntaje_alumnos: "",
    puntaje_directivos: "",
  };
}

/**
 * Filtra en tiempo real lo que el usuario escribe en un campo numerico: quita
 * signos/letras (ningun campo del sistema admite negativos) y limita al maximo
 * mientras se escribe. El atributo HTML min/max por si solo NO bloquea el teclado
 * (el navegador solo lo marca como invalido), asi que esto es lo que realmente
 * impide capturar "-1" o valores fuera de rango.
 */
function sanitizeNumericInput(raw: string, max?: number | null): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  if (max != null && cleaned !== "" && cleaned !== ".") {
    const num = Number(cleaned);
    if (!Number.isNaN(num) && num > max) cleaned = String(max);
  }
  return cleaned;
}

function promedioDocente(row: Row): string {
  const a = row.puntaje_alumnos?.trim() ? Number(row.puntaje_alumnos) : null;
  const d = row.puntaje_directivos?.trim() ? Number(row.puntaje_directivos) : null;
  const vals = [a, d].filter((v): v is number => v !== null && !Number.isNaN(v));
  if (vals.length === 0) return "—";
  return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
}

/** 1 fila de captura -> hasta 2 filas de API (una por evaluador_tipo, solo si se capturo). */
function docenteRowsToApi(rows: Row[]): Row[] {
  const out: Row[] = [];
  for (const r of rows) {
    if (!Object.values(r).some((v) => v.trim() !== "")) continue;
    const base = {
      ciclo_escolar: r.ciclo_escolar,
      puesto: r.puesto,
      docente_nombre: r.docente_nombre,
      programa_educativo: r.programa_educativo,
    };
    if (r.puntaje_alumnos?.trim()) {
      out.push({ ...base, evaluador_tipo: "alumno", puntaje: r.puntaje_alumnos });
    }
    if (r.puntaje_directivos?.trim()) {
      out.push({ ...base, evaluador_tipo: "directivo", puntaje: r.puntaje_directivos });
    }
  }
  return out;
}

export function ManualEntry({ formats, subsistemas, fixedSubsistemaId, isAdminGeneral, onSuccess }: Props) {
  const [datasetType, setDatasetType] = useState("matricula");
  const [subsistemaId, setSubsistemaId] = useState<number | "">(fixedSubsistemaId ?? "");

  const def = useMemo(() => formats?.find((f) => f.key === datasetType), [formats, datasetType]);
  const isDocente = datasetType === "evaluacion_docente";
  const [rows, setRows] = useState<Row[]>([emptyRow(def)]);
  // Filas cuyo campo "programa_educativo" esta en modo "escribir carrera nueva" (Input)
  // en vez del desplegable de carreras existentes.
  const [customProgramaRows, setCustomProgramaRows] = useState<Set<number>>(new Set());

  const effectiveSubsistemaId = isAdminGeneral
    ? (subsistemaId === "" ? undefined : Number(subsistemaId))
    : (fixedSubsistemaId ?? undefined);

  const hasCicloField = def?.fields.some((f) => f.name === "ciclo_escolar") ?? false;
  const hasGeneracionField = def?.key === "titulacion";
  const hasProgramaField = def?.fields.some((f) => f.name === "programa_educativo") ?? false;

  // Catalogo de ciclos generacionales (ya existe, usado tambien en FilterBar/Eficiencia).
  // Solo se ofrecen los ACTIVOS: no tiene sentido capturar contra un ciclo deshabilitado
  // (el backend ya rechaza esas cargas).
  const { data: ciclosCatalogo } = useQuery({
    queryKey: ["ciclos", "ciclo"],
    queryFn: () => ciclosApi.list({ tipo: "ciclo" }),
    enabled: hasCicloField,
  });
  const ciclosActivos = useMemo(() => (ciclosCatalogo ?? []).filter((c) => c.activo), [ciclosCatalogo]);

  const { data: generacionesCatalogo } = useQuery({
    queryKey: ["ciclos", "generacion"],
    queryFn: () => ciclosApi.list({ tipo: "generacion" }),
    enabled: hasGeneracionField,
  });
  const generacionesActivas = useMemo(
    () => (generacionesCatalogo ?? []).filter((c) => c.activo),
    [generacionesCatalogo],
  );

  // Sugerencias (catalogo NO estricto) de valores ya existentes en BD.
  const { data: programaSugerencias } = useQuery({
    queryKey: ["suggestions", "programa_educativo", effectiveSubsistemaId],
    queryFn: () => suggestionsApi.list("programa_educativo", effectiveSubsistemaId),
    enabled: hasProgramaField && effectiveSubsistemaId !== undefined,
  });
  const { data: docenteSugerencias } = useQuery({
    queryKey: ["suggestions", "docente_nombre", effectiveSubsistemaId],
    queryFn: () => suggestionsApi.list("docente_nombre", effectiveSubsistemaId),
    enabled: isDocente && effectiveSubsistemaId !== undefined,
  });

  // Columna cuyos valores son las llaves del catalogo (ej. "categoria" → beca/discapacidad/etnia).
  const catalogDriver = useMemo(() => {
    if (!def?.catalogos) return null;
    const keys = Object.keys(def.catalogos).sort().join(",");
    const driver = def.fields.find(
      (f) => f.allowed_values && [...f.allowed_values].sort().join(",") === keys,
    );
    return driver?.name ?? null;
  }, [def]);

  // Sugerencias para un campo en una fila: catalogo dependiente de la categoria,
  // catalogo dinamico (programa/docente ya capturados), o lista plana estatica.
  const suggestionsFor = (field: DatasetField, row: Row): string[] | null => {
    if (def?.catalogos && catalogDriver && field.suggested_values) {
      const sel = row[catalogDriver];
      if (sel && def.catalogos[sel]) return def.catalogos[sel];
    }
    if (field.name === "programa_educativo" && programaSugerencias?.length) return programaSugerencias;
    if (field.name === "docente_nombre" && docenteSugerencias?.length) return docenteSugerencias;
    return field.suggested_values ?? null;
  };

  // --- Beca "Madres solteras": no debe exceder las mujeres matriculadas conocidas ---
  // para esa combinacion (ciclo, programa). Capa de UX anticipada; el backend ya
  // valida esto mismo al guardar (upload_validations.py::check_madres_solteras).
  const madresSolterasKeys = useMemo(() => {
    if (datasetType !== "becas") return [] as string[];
    const keys = new Set<string>();
    rows.forEach((r) => {
      if (r.tipo?.trim().toLowerCase() === MADRES_SOLTERAS && r.ciclo_escolar && r.programa_educativo) {
        keys.add(`${r.ciclo_escolar}|||${r.programa_educativo}`);
      }
    });
    return [...keys];
  }, [datasetType, rows]);

  const mujeresQueries = useQueries({
    queries: madresSolterasKeys.map((key) => {
      const [ciclo_escolar, programa_educativo] = key.split("|||");
      return {
        queryKey: ["matricula-mujeres", effectiveSubsistemaId, ciclo_escolar, programa_educativo],
        queryFn: () =>
          indicadoresApi.matricula({ subsistema_id: effectiveSubsistemaId, ciclo_escolar, programa_educativo }),
        enabled: effectiveSubsistemaId !== undefined,
        staleTime: 60_000,
      };
    }),
  });

  const maxMujeresPorKey = useMemo(() => {
    const map = new Map<string, number>();
    madresSolterasKeys.forEach((key, i) => {
      const data = mujeresQueries[i]?.data;
      if (data && data.series.length > 0) {
        map.set(key, Math.max(...data.series.map((p) => p.mujeres)));
      }
    });
    return map;
  }, [madresSolterasKeys, mujeresQueries]);

  const madresSolterasError = (row: Row): string | null => {
    if (datasetType !== "becas") return null;
    if (row.tipo?.trim().toLowerCase() !== MADRES_SOLTERAS) return null;
    if (!row.ciclo_escolar || !row.programa_educativo || !row.cantidad?.trim()) return null;
    const maxMujeres = maxMujeresPorKey.get(`${row.ciclo_escolar}|||${row.programa_educativo}`);
    if (maxMujeres === undefined) return null;
    const cantidad = Number(row.cantidad);
    if (Number.isFinite(cantidad) && cantidad > maxMujeres) {
      return `Excede las ${maxMujeres} mujeres matriculadas en ese programa/ciclo.`;
    }
    return null;
  };

  // Al cambiar el tipo de dataset, reiniciar las filas con los campos correctos
  const changeDataset = (key: string) => {
    setDatasetType(key);
    setCustomProgramaRows(new Set());
    if (key === "evaluacion_docente") {
      setRows([emptyDocenteRow()]);
      return;
    }
    const newDef = formats?.find((f) => f.key === key);
    setRows([emptyRow(newDef)]);
  };

  const setCell = (rowIdx: number, field: string, value: string) =>
    setRows((rs) => rs.map((r, i) => {
      if (i !== rowIdx) return r;
      const updated = { ...r, [field]: value };
      // "Madres solteras" solo aplica a mujeres: forzar el sexo al elegir ese tipo.
      if (datasetType === "becas" && field === "tipo" && value.trim().toLowerCase() === MADRES_SOLTERAS) {
        updated.sexo = "Mujer";
      }
      return updated;
    }));

  // Selecciono "+ Agregar nueva carrera": pasa esa fila a modo texto libre.
  const enterCustomPrograma = (rowIdx: number) => {
    setCustomProgramaRows((s) => new Set(s).add(rowIdx));
    setCell(rowIdx, "programa_educativo", "");
  };
  // "Elegir de la lista": vuelve esa fila al desplegable de carreras existentes.
  const exitCustomPrograma = (rowIdx: number) => {
    setCustomProgramaRows((s) => {
      const next = new Set(s);
      next.delete(rowIdx);
      return next;
    });
    setCell(rowIdx, "programa_educativo", "");
  };

  const addRow = () => setRows((rs) => [...rs, isDocente ? emptyDocenteRow() : emptyRow(def)]);
  const removeRow = (idx: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs));

  const submit = useMutation({
    mutationFn: () => {
      const sid = isAdminGeneral ? Number(subsistemaId) : (fixedSubsistemaId ?? Number(subsistemaId));
      const filled = isDocente
        ? docenteRowsToApi(rows)
        : rows.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
      return uploadsApi.uploadManual(sid, datasetType, filled);
    },
    onSuccess: (res) => {
      onSuccess();
      if (res.rows_failed === 0) setRows([isDocente ? emptyDocenteRow() : emptyRow(def)]);
    },
  });

  const hasMadresSolterasError = rows.some((r) => madresSolterasError(r) !== null);

  const canSubmit =
    !submit.isPending &&
    (isAdminGeneral ? subsistemaId !== "" : fixedSubsistemaId !== null) &&
    rows.some((r) => Object.values(r).some((v) => v.trim() !== "")) &&
    !hasMadresSolterasError;

  const puestoOptions = def?.fields.find((f) => f.name === "puesto")?.allowed_values ?? [];
  const puntajeField = def?.fields.find((f) => f.name === "puntaje");
  const puntajeMax = puntajeField?.max_value ?? undefined;
  const puntajeMin = puntajeField?.min_value ?? 0;

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
            {isDocente ? (
              <>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-2 pb-2 font-bold whitespace-nowrap">Ciclo</th>
                    <th className="px-2 pb-2 font-bold whitespace-nowrap">Puesto</th>
                    <th className="px-2 pb-2 font-bold whitespace-nowrap">Docente</th>
                    <th className="px-2 pb-2 font-bold whitespace-nowrap">Programa</th>
                    <th className="px-2 pb-2 font-bold whitespace-nowrap">Puntaje alumnos</th>
                    <th className="px-2 pb-2 font-bold whitespace-nowrap">Puntaje directivos</th>
                    <th className="px-2 pb-2 font-bold whitespace-nowrap">Promedio</th>
                    <th className="px-2 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const docenteListId = `dl-${rowIdx}-docente_nombre`;
                    const programaListId = `dl-${rowIdx}-programa_educativo`;
                    return (
                      <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="px-1 py-1.5">
                          <Select value={row.ciclo_escolar ?? ""} onChange={(e) => setCell(rowIdx, "ciclo_escolar", e.target.value)}>
                            <option value="">—</option>
                            {ciclosActivos.map((c) => <option key={c.id} value={c.valor}>{c.valor}</option>)}
                          </Select>
                        </td>
                        <td className="px-1 py-1.5">
                          <Select value={row.puesto ?? ""} onChange={(e) => setCell(rowIdx, "puesto", e.target.value)}>
                            <option value="">—</option>
                            {puestoOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                          </Select>
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            list={docenteListId}
                            value={row.docente_nombre ?? ""}
                            onChange={(e) => setCell(rowIdx, "docente_nombre", e.target.value)}
                            placeholder="Elige o escribe…"
                            className="min-w-[160px]"
                          />
                          <datalist id={docenteListId}>
                            {docenteSugerencias?.map((v) => <option key={v} value={v} />)}
                          </datalist>
                        </td>
                        <td className="px-1 py-1.5">
                          {programaSugerencias && programaSugerencias.length > 0 && !customProgramaRows.has(rowIdx) ? (
                            <Select
                              value={row.programa_educativo ?? ""}
                              onChange={(e) =>
                                e.target.value === NUEVA_CARRERA
                                  ? enterCustomPrograma(rowIdx)
                                  : setCell(rowIdx, "programa_educativo", e.target.value)
                              }
                              className="min-w-[160px]"
                            >
                              <option value="">—</option>
                              {programaSugerencias.map((v) => <option key={v} value={v}>{v}</option>)}
                              <option value={NUEVA_CARRERA}>+ Agregar nueva carrera…</option>
                            </Select>
                          ) : (
                            <div className="space-y-1">
                              <Input
                                list={programaListId}
                                value={row.programa_educativo ?? ""}
                                onChange={(e) => setCell(rowIdx, "programa_educativo", e.target.value)}
                                placeholder="Escribe la carrera…"
                                className="min-w-[160px]"
                              />
                              {programaSugerencias && programaSugerencias.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => exitCustomPrograma(rowIdx)}
                                  className="text-[11px] font-medium text-brand-600 hover:underline"
                                >
                                  Elegir de la lista
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            type="number"
                            min={puntajeMin}
                            max={puntajeMax}
                            step="0.01"
                            value={row.puntaje_alumnos ?? ""}
                            onChange={(e) => setCell(rowIdx, "puntaje_alumnos", sanitizeNumericInput(e.target.value, puntajeMax))}
                            className="min-w-[100px]"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            type="number"
                            min={puntajeMin}
                            max={puntajeMax}
                            step="0.01"
                            value={row.puntaje_directivos ?? ""}
                            onChange={(e) => setCell(rowIdx, "puntaje_directivos", sanitizeNumericInput(e.target.value, puntajeMax))}
                            className="min-w-[100px]"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {promedioDocente(row)}
                        </td>
                        <td className="px-1 py-1.5">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeRow(rowIdx)}>
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            ) : (
              <>
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
                        const cellError = f.name === "cantidad" && datasetType === "becas" ? madresSolterasError(row) : null;
                        return (
                          <td key={f.name} className="px-1 py-1.5 align-top">
                            {f.name === "ciclo_escolar" ? (
                              <Select value={row[f.name] ?? ""} onChange={(e) => setCell(rowIdx, f.name, e.target.value)}>
                                <option value="">—</option>
                                {ciclosActivos.map((c) => <option key={c.id} value={c.valor}>{c.valor}</option>)}
                              </Select>
                            ) : f.name === "generacion" ? (
                              <Select value={row[f.name] ?? ""} onChange={(e) => setCell(rowIdx, f.name, e.target.value)}>
                                <option value="">—</option>
                                {generacionesActivas.map((c) => <option key={c.id} value={c.valor}>{c.valor}</option>)}
                              </Select>
                            ) : f.name === "cuatrimestre" ? (
                              <Select value={row[f.name] ?? ""} onChange={(e) => setCell(rowIdx, f.name, e.target.value)}>
                                <option value="">—</option>
                                {Array.from({ length: 11 }, (_, n) => n).map((n) => <option key={n} value={n}>{n}</option>)}
                              </Select>
                            ) : f.name === "sexo" && datasetType === "becas" && row.tipo?.trim().toLowerCase() === MADRES_SOLTERAS ? (
                              // "Madres solteras" solo aplica a mujeres: sin opcion de eleccion.
                              <Select value="Mujer" disabled onChange={() => {}}>
                                <option value="Mujer">Mujer</option>
                              </Select>
                            ) : f.name === "programa_educativo" && programaSugerencias && programaSugerencias.length > 0 && !customProgramaRows.has(rowIdx) ? (
                              // Carrera: desplegable con las carreras ya existentes, mas opcion de agregar una nueva.
                              <Select
                                value={row[f.name] ?? ""}
                                onChange={(e) =>
                                  e.target.value === NUEVA_CARRERA
                                    ? enterCustomPrograma(rowIdx)
                                    : setCell(rowIdx, f.name, e.target.value)
                                }
                              >
                                <option value="">—</option>
                                {programaSugerencias.map((v) => <option key={v} value={v}>{v}</option>)}
                                <option value={NUEVA_CARRERA}>+ Agregar nueva carrera…</option>
                              </Select>
                            ) : f.name === "programa_educativo" && customProgramaRows.has(rowIdx) ? (
                              <div className="space-y-1">
                                <Input
                                  value={row[f.name] ?? ""}
                                  onChange={(e) => setCell(rowIdx, f.name, e.target.value)}
                                  placeholder="Escribe la carrera…"
                                  className="min-w-[140px]"
                                />
                                {programaSugerencias && programaSugerencias.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => exitCustomPrograma(rowIdx)}
                                    className="text-[11px] font-medium text-brand-600 hover:underline"
                                  >
                                    Elegir de la lista
                                  </button>
                                )}
                              </div>
                            ) : f.allowed_values && f.allowed_values.length > 0 ? (
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
                                min={f.kind === "int" || f.kind === "float" ? f.min_value ?? 0 : undefined}
                                max={f.kind === "int" || f.kind === "float" ? f.max_value ?? undefined : undefined}
                                value={row[f.name] ?? ""}
                                onChange={(e) =>
                                  setCell(
                                    rowIdx,
                                    f.name,
                                    f.kind === "int" || f.kind === "float"
                                      ? sanitizeNumericInput(e.target.value, f.max_value)
                                      : e.target.value,
                                  )
                                }
                                className="min-w-[120px]"
                              />
                            )}
                            {cellError && (
                              <p className="mt-1 text-[11px] font-medium text-red-500">{cellError}</p>
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
              </>
            )}
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
