import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Check,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { authApi, subsistemasApi, uploadsApi } from "@/api/endpoints";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { ManualEntry } from "@/pages/cargas/ManualEntry";
import type { WizardState, WizardStep, SheetAnalysis } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATASET_LABELS: Record<string, string> = {
  matricula: "Matrícula",
  evaluacion_academica: "Evaluación Académica",
  titulacion: "Titulación",
  evaluacion_docente: "Evaluación Docente",
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "upload", label: "Archivo" },
  { id: "sheet", label: "Hoja" },
  { id: "mapping", label: "Columnas" },
  { id: "preview", label: "Vista previa" },
  { id: "confirm", label: "Confirmar" },
];

function confidenceColor(c: number) {
  if (c >= 0.8) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (c >= 0.5) return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

const INITIAL_WIZARD: WizardState = {
  step: "upload",
  file: null,
  analysis: null,
  selectedSheet: null,
  selectedDatasetType: "matricula",
  headerRow: 0,
  columnMapping: {},
  subsistemaId: "",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function Cargas() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: subsistemas } = useQuery({ queryKey: ["subsistemas"], queryFn: subsistemasApi.list });
  const { data: formats } = useQuery({ queryKey: ["dataset-formats"], queryFn: uploadsApi.formats });
  const { data: jobs } = useQuery({
    queryKey: ["uploads"],
    queryFn: uploadsApi.list,
    refetchInterval: 3000,
  });

  const [wizard, setWizard] = useState<WizardState>(INITIAL_WIZARD);
  const [advancedMode, setAdvancedMode] = useState(false);

  // Modo legacy (flujo anterior sin wizard)
  const [legacyDatasetType, setLegacyDatasetType] = useState("matricula");
  const [legacyFile, setLegacyFile] = useState<File | null>(null);

  useEffect(() => {
    if (currentUser?.subsistema_id) {
      setWizard((w) => ({ ...w, subsistemaId: currentUser.subsistema_id! }));
    }
  }, [currentUser?.subsistema_id]);

  const updateWizard = (patch: Partial<WizardState>) =>
    setWizard((prev) => ({ ...prev, ...patch }));

  const resetWizard = () =>
    setWizard((prev) => ({ ...INITIAL_WIZARD, subsistemaId: prev.subsistemaId }));

  // --------------------------------------------------------------------------
  // Mutaciones
  // --------------------------------------------------------------------------

  const analyzeMutation = useMutation({
    mutationFn: (file: File) => uploadsApi.analyze(file),
    onSuccess: (data) => {
      const recommended = data.recommended_sheet ?? data.sheet_names[0] ?? null;
      const sheet = data.sheets.find((s) => s.sheet_name === recommended) ?? data.sheets[0];
      const initialMapping: Record<string, string | null> = {};
      if (sheet) {
        sheet.column_mapping.forEach((m) => {
          initialMapping[m.excel_column] = m.system_field;
        });
      }
      updateWizard({
        analysis: data,
        selectedSheet: recommended,
        selectedDatasetType: sheet?.suggested_dataset_type ?? "matricula",
        headerRow: sheet?.header_row ?? 0,
        columnMapping: initialMapping,
        step: (data.sheet_names.length > 1 ? "sheet" : "mapping") as WizardStep,
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      const validMapping: Record<string, string> = {};
      Object.entries(wizard.columnMapping).forEach(([k, v]) => {
        if (v) validMapping[k] = v;
      });
      return uploadsApi.uploadSmart(
        Number(wizard.subsistemaId),
        wizard.selectedDatasetType,
        wizard.file!,
        {
          sheetName: wizard.selectedSheet ?? undefined,
          headerRow: wizard.headerRow,
          columnMapping: Object.keys(validMapping).length > 0 ? validMapping : undefined,
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uploads"] });
      resetWizard();
    },
  });

  const legacyMutation = useMutation({
    mutationFn: () =>
      uploadsApi.upload(Number(wizard.subsistemaId), legacyDatasetType, legacyFile!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uploads"] });
      setLegacyFile(null);
    },
  });

  const deleteJob = useMutation({
    mutationFn: (id: string) => uploadsApi.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["uploads"] }),
  });

  // --------------------------------------------------------------------------
  // Datos derivados del paso actual
  // --------------------------------------------------------------------------

  const currentSheet: SheetAnalysis | undefined = wizard.analysis?.sheets.find(
    (s) => s.sheet_name === wizard.selectedSheet,
  );

  const allSystemFields = formats?.flatMap((f) => f.fields.map((field) => field.name)) ?? [];
  void allSystemFields;

  const currentDatasetDef = formats?.find((f) => f.key === wizard.selectedDatasetType);
  const requiredFields = currentDatasetDef?.fields.filter((f) => f.required).map((f) => f.name) ?? [];
  const mappedRequired = requiredFields.filter(
    (rf) => Object.values(wizard.columnMapping).includes(rf),
  );
  const canProceedFromMapping = mappedRequired.length === requiredFields.length;

  const subsistemaName = currentUser?.subsistema_id
    ? (subsistemas?.find((s) => s.id === currentUser.subsistema_id)?.nombre ?? `Subsistema ${currentUser.subsistema_id}`)
    : "Universidad Politécnica de Texcoco";

  // Paso visual (sheet se omite si solo hay 1 hoja)
  const visibleSteps = wizard.analysis && wizard.analysis.sheet_names.length <= 1
    ? STEPS.filter((s) => s.id !== "sheet")
    : STEPS;

  const currentStepIndex = visibleSteps.findIndex((s) => s.id === wizard.step);

  // --------------------------------------------------------------------------
  // Renderizado de pasos del wizard
  // --------------------------------------------------------------------------

  function renderStep() {
    switch (wizard.step) {
      case "upload":
        return (
          <div className="space-y-6">
            <div className="relative">
              <div
                className={cn(
                  "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-200 cursor-pointer",
                  wizard.file
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/5"
                    : "border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-900/50",
                )}
              >
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    updateWizard({ file: f });
                  }}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center text-center pointer-events-none">
                  <div
                    className={cn(
                      "mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
                      wizard.file
                        ? "bg-brand-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-brand-500",
                    )}
                  >
                    <UploadIcon className="h-7 w-7" />
                  </div>
                  {wizard.file ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{wizard.file.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{(wizard.file.size / 1024).toFixed(1)} KB · listo para analizar</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Haz clic o arrastra tu archivo Excel</p>
                      <p className="mt-1 text-xs text-slate-400">Cualquier .xlsx — el sistema detecta el formato automáticamente</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {analyzeMutation.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                {(analyzeMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                  "No se pudo analizar el archivo. Verifica que sea un Excel válido."}
              </div>
            )}

            <Button
              className="w-full h-12"
              onClick={() => { if (wizard.file) analyzeMutation.mutate(wizard.file); }}
              disabled={!wizard.file || analyzeMutation.isPending}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {analyzeMutation.isPending ? "Analizando archivo..." : "Analizar y continuar"}
            </Button>
          </div>
        );

      case "sheet":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tu archivo tiene <strong>{wizard.analysis!.sheet_names.length}</strong> hojas. Selecciona la que contiene los datos a cargar.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {wizard.analysis!.sheets.map((sheet) => {
                const topScore = sheet.dataset_type_scores[0];
                const isSelected = sheet.sheet_name === wizard.selectedSheet;
                return (
                  <button
                    key={sheet.sheet_name}
                    onClick={() => {
                      const initialMapping: Record<string, string | null> = {};
                      sheet.column_mapping.forEach((m) => { initialMapping[m.excel_column] = m.system_field; });
                      updateWizard({
                        selectedSheet: sheet.sheet_name,
                        selectedDatasetType: sheet.suggested_dataset_type ?? "matricula",
                        headerRow: sheet.header_row,
                        columnMapping: initialMapping,
                      });
                    }}
                    className={cn(
                      "text-left rounded-xl border-2 p-4 transition-all",
                      isSelected
                        ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/10"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-300",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{sheet.sheet_name}</span>
                      {isSelected && <Check className="h-4 w-4 text-brand-500 shrink-0" />}
                    </div>
                    {topScore && topScore.score > 0 && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tipo detectado:</span>
                        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                          {topScore.label} ({pct(topScore.score)})
                        </span>
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-slate-400">
                      {sheet.total_data_rows} filas · {sheet.detected_headers.length} columnas
                    </div>
                    {sheet.detected_headers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sheet.detected_headers.slice(0, 3).map((h) => (
                          <span key={h} className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {h}
                          </span>
                        ))}
                        {sheet.detected_headers.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{sheet.detected_headers.length - 3} más</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {currentSheet?.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {w}
              </div>
            ))}

            <Button
              className="w-full h-11"
              onClick={() => updateWizard({ step: "mapping" })}
              disabled={!wizard.selectedSheet}
            >
              Continuar al mapeo de columnas
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );

      case "mapping": {
        const sheet = currentSheet;
        if (!sheet) return null;
        const colHeaders = sheet.detected_headers;

        return (
          <div className="space-y-5">
            {/* Selector de tipo de dataset */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tipo de datos detectado
                </label>
                <Select
                  value={wizard.selectedDatasetType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    updateWizard({ selectedDatasetType: newType });
                  }}
                >
                  {formats?.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </Select>
              </div>
              <div className="pt-5">
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold",
                  canProceedFromMapping
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                )}>
                  {mappedRequired.length}/{requiredFields.length} requeridas
                </span>
              </div>
            </div>

            {/* Tabla de mapeo */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Campo del sistema</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-center">Req.</th>
                    <th className="px-4 py-3">Columna en tu archivo</th>
                    <th className="px-4 py-3 text-center">Confianza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentDatasetDef?.fields.map((sysField) => {
                    const currentExcelCol = Object.entries(wizard.columnMapping).find(
                      ([, v]) => v === sysField.name,
                    )?.[0] ?? "";
                    const confidence = currentExcelCol
                      ? (sheet.column_mapping.find((m) => m.excel_column === currentExcelCol)?.confidence ?? 0)
                      : 0;

                    return (
                      <tr
                        key={sysField.name}
                        className={cn(
                          "transition-colors",
                          !currentExcelCol && sysField.required
                            ? "bg-red-50/50 dark:bg-red-900/10"
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/30",
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {sysField.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {sysField.kind}
                          {sysField.allowed_values && (
                            <span className="ml-1 text-[10px] text-slate-400">({sysField.allowed_values.join("|")})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {sysField.required ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-red-400" title="Requerido" />
                          ) : (
                            <span className="inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" title="Opcional" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={currentExcelCol}
                            onChange={(e) => {
                              const newExcelCol = e.target.value;
                              const newMapping = { ...wizard.columnMapping };
                              // quitar asignación anterior de este campo
                              Object.keys(newMapping).forEach((k) => {
                                if (newMapping[k] === sysField.name) delete newMapping[k];
                              });
                              if (newExcelCol) newMapping[newExcelCol] = sysField.name;
                              updateWizard({ columnMapping: newMapping });
                            }}
                          >
                            <option value="">— Sin mapear —</option>
                            {colHeaders.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {currentExcelCol ? (
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", confidenceColor(confidence))}>
                              {pct(confidence)}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!canProceedFromMapping && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Faltan {requiredFields.length - mappedRequired.length} columna(s) requerida(s) por asignar.
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => updateWizard({ step: wizard.analysis!.sheet_names.length > 1 ? "sheet" : "upload" })}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
              </Button>
              <Button
                className="flex-1 h-11"
                onClick={() => updateWizard({ step: "preview" })}
                disabled={!canProceedFromMapping}
              >
                Ver vista previa
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      }

      case "preview": {
        const sheet = currentSheet;
        if (!sheet) return null;

        const mappedHeaders = sheet.detected_headers
          .map((h) => ({ excel: h, system: wizard.columnMapping[h] ?? null }))
          .filter((h) => h.system !== null);

        const previewRows = sheet.sample_rows.map((row) =>
          mappedHeaders.map(({ excel }) => {
            const idx = sheet.detected_headers.indexOf(excel);
            return idx >= 0 ? (row[idx] ?? "") : "";
          }),
        );

        return (
          <div className="space-y-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Así quedarán las primeras filas después del mapeo. Verifica que los datos sean correctos.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {mappedHeaders.map(({ system }) => (
                      <th key={system} className="px-3 py-2.5 font-mono whitespace-nowrap">{system}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[150px] truncate">
                          {cell || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewRows.length === 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 p-3 text-xs text-amber-700">
                No hay filas de muestra disponibles. El procesamiento se realizará en el servidor.
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => updateWizard({ step: "mapping" })}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Corregir mapeo
              </Button>
              <Button className="flex-1 h-11" onClick={() => updateWizard({ step: "confirm" })}>
                Confirmar y procesar
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      }

      case "confirm": {
        const validMapping = Object.entries(wizard.columnMapping).filter(([, v]) => v);
        const optionalMapped = validMapping.filter(([, v]) => !requiredFields.includes(v!)).length;

        return (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ["Archivo", wizard.file?.name],
                ["Hoja", wizard.selectedSheet ?? "Primera hoja"],
                ["Tipo de datos", DATASET_LABELS[wizard.selectedDatasetType] ?? wizard.selectedDatasetType],
                ["Institución", subsistemaName],
                ["Columnas mapeadas", `${mappedRequired.length} requeridas + ${optionalMapped} opcionales`],
                ["Filas estimadas", currentSheet?.total_data_rows ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="font-semibold text-slate-800 dark:text-white truncate max-w-[55%] text-right">{String(value)}</span>
                </div>
              ))}
            </div>

            {uploadMutation.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                {(uploadMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                  "Error al procesar la carga."}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => updateWizard({ step: "preview" })}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={() => { uploadMutation.mutate(); }}
                disabled={uploadMutation.isPending}
              >
                <UploadIcon className="mr-2 h-5 w-5" />
                {uploadMutation.isPending ? "Cargando..." : "Iniciar carga de datos"}
              </Button>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  }

  // --------------------------------------------------------------------------
  // Layout principal
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Cargas de bases de datos
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
          Sube tu archivo Excel — el sistema detecta el formato automáticamente
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5 text-brand-600" />
                Nueva carga de datos
              </CardTitle>
              <button
                onClick={() => setAdvancedMode((v) => !v)}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {advancedMode ? "← Modo asistido" : "Modo avanzado →"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {advancedMode ? (
              // Flujo legacy
              <div className="space-y-5">
                <p className="text-xs text-slate-400">
                  Modo avanzado: sube directamente un archivo con las columnas exactas del sistema.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Institución</label>
                    <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-sm text-slate-700 dark:text-slate-300">
                      {subsistemaName}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tipo de datos</label>
                    <Select value={legacyDatasetType} onChange={(e) => setLegacyDatasetType(e.target.value)}>
                      {formats?.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="relative">
                  <div className={cn(
                    "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-200",
                    legacyFile ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/5" : "border-slate-200 dark:border-slate-800 hover:border-brand-400",
                  )}>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setLegacyFile(e.target.files?.[0] ?? null)} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
                    <div className="flex flex-col items-center text-center">
                      <UploadIcon className={cn("h-8 w-8 mb-2", legacyFile ? "text-brand-500" : "text-slate-400")} />
                      {legacyFile ? (
                        <>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{legacyFile.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{(legacyFile.size / 1024).toFixed(1)} KB</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">Haz clic o arrastra (.csv, .xlsx)</p>
                      )}
                    </div>
                  </div>
                </div>
                {legacyMutation.isError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                    {(legacyMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al subir el archivo"}
                  </div>
                )}
                <Button className="w-full h-12" onClick={() => legacyMutation.mutate()} disabled={!legacyFile || legacyMutation.isPending || !wizard.subsistemaId}>
                  <UploadIcon className="mr-2 h-5 w-5" />
                  {legacyMutation.isPending ? "Procesando..." : "Subir archivo"}
                </Button>
              </div>
            ) : (
              // Modo asistido (wizard)
              <>
                {/* Indicador de pasos */}
                {wizard.step !== "upload" && (
                  <div className="flex items-center gap-1 pb-2">
                    {visibleSteps.map((s, i) => {
                      const isDone = i < currentStepIndex;
                      const isActive = s.id === wizard.step;
                      return (
                        <div key={s.id} className="flex items-center gap-1 flex-1">
                          <div className="flex flex-col items-center gap-1">
                            <div className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all",
                              isDone ? "bg-brand-100 border-brand-500 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400" :
                              isActive ? "bg-brand-500 border-brand-500 text-white" :
                              "bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700",
                            )}>
                              {isDone ? <Check className="h-3 w-3" /> : i + 1}
                            </div>
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-wide whitespace-nowrap",
                              isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400",
                            )}>
                              {s.label}
                            </span>
                          </div>
                          {i < visibleSteps.length - 1 && (
                            <div className={cn(
                              "flex-1 h-0.5 mb-4 mx-1 rounded transition-all",
                              isDone ? "bg-brand-400" : "bg-slate-200 dark:bg-slate-700",
                            )} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Institución (siempre visible) */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Institución</label>
                  <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-sm text-slate-700 dark:text-slate-300">
                    {subsistemaName}
                  </div>
                </div>

                {renderStep()}
              </>
            )}
          </CardContent>
        </Card>

        {/* Panel lateral de ayuda */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-brand-500" />
              Plantillas oficiales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Si prefieres usar la plantilla exacta, descárgala y súbela directamente en modo avanzado.
            </p>
            {formats?.map((f) => (
              <button
                key={f.key}
                onClick={() => { void uploadsApi.downloadTemplate(f.key); }}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left text-xs hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <FileText className="h-4 w-4 shrink-0 text-brand-500" />
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-300">{f.label}</div>
                  <div className="text-slate-400">{f.description}</div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <ManualEntry
        formats={formats}
        subsistemas={subsistemas}
        fixedSubsistemaId={currentUser?.role === "admin_general" ? null : (currentUser?.subsistema_id ?? null)}
        isAdminGeneral={currentUser?.role === "admin_general"}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["uploads"] })}
      />

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de cargas recientes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="pb-4 pl-2 font-bold">Fecha</th>
                <th className="pb-4 font-bold">Archivo</th>
                <th className="pb-4 font-bold">Tipo</th>
                <th className="pb-4 font-bold text-center">Estado</th>
                <th className="pb-4 font-bold text-center">Progreso</th>
                <th className="pb-4 font-bold text-center">Errores</th>
                <th className="pb-4 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs?.map((j) => (
                <tr key={j.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="py-4 pl-2">
                    <div className="font-medium text-slate-900 dark:text-white">{new Date(j.created_at).toLocaleDateString("es-MX")}</div>
                    <div className="text-[10px] text-slate-500">{new Date(j.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="truncate max-w-[150px] font-mono text-xs text-slate-600 dark:text-slate-400">{j.filename}</span>
                    </div>
                  </td>
                  <td className="py-4 font-medium text-slate-600 dark:text-slate-400 capitalize">{j.dataset_type.replace("_", " ")}</td>
                  <td className="py-4 text-center">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      j.status === "success" || j.status === "success_with_warnings"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : j.status === "failed"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                    )}>
                      {(j.status === "success" || j.status === "success_with_warnings") && <CheckCircle2 className="h-3 w-3" />}
                      {j.status === "failed" && <XCircle className="h-3 w-3" />}
                      {(j.status === "processing" || j.status === "pending") && <Clock className="h-3 w-3 animate-spin" />}
                      {j.status}
                    </div>
                  </td>
                  <td className="py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{j.rows_processed}</span>
                      <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all"
                          style={{ width: `${(j.rows_processed / (j.rows_total || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-center font-bold text-red-500">{j.rows_failed}</td>
                  <td className="py-4 text-center">
                    <button
                      onClick={() => { if (confirm("¿Eliminar este registro del historial?")) deleteJob.mutate(j.id); }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
