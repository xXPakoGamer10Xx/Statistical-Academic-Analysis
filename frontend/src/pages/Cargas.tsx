import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload as UploadIcon, FileText, Info, CheckCircle2, XCircle, Clock, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { authApi, subsistemasApi, uploadsApi } from "@/api/endpoints";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

export function Cargas() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  // Refresh user data to pick up any subsistema_id changes since login
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

  const [subsistemaId, setSubsistemaId] = useState<number | "">(5);

  // Sync subsistemaId when user data loads/updates
  useEffect(() => {
    if (currentUser?.subsistema_id) {
      setSubsistemaId(currentUser.subsistema_id);
    }
  }, [currentUser?.subsistema_id]);
  const [datasetType, setDatasetType] = useState("matricula");
  const [file, setFile] = useState<File | null>(null);

  const selectedType = formats?.find((format) => format.key === datasetType) ?? formats?.[0];

  const downloadTemplate = async () => {
    if (!selectedType) return;

    const XLSX = await import("xlsx");
    const columns = selectedType.fields.map((field) => field.name);
    const worksheet = XLSX.utils.aoa_to_sheet([columns]);
    worksheet["!cols"] = columns.map((column) => ({
      wch: Math.max(column.length + 4, 16),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    XLSX.writeFile(workbook, `plantilla_${selectedType.key}.xlsx`);
  };

  const mutation = useMutation({
    mutationFn: () => uploadsApi.upload(Number(subsistemaId), datasetType, file!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uploads"] });
      setFile(null);
    },
  });

  const deleteJob = useMutation({
    mutationFn: (id: string) => uploadsApi.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["uploads"] }),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Cargas de bases de datos</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Sube archivos CSV para actualizar las estadísticas institucionales</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadIcon className="h-5 w-5 text-brand-600" />
              Nueva carga de datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Institución</label>
                <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-sm text-slate-700 dark:text-slate-300">
                  {currentUser?.subsistema_id
                    ? (subsistemas?.find((s) => s.id === currentUser.subsistema_id)?.nombre ?? `Subsistema ${currentUser.subsistema_id}`)
                    : "Universidad Politécnica de Texcoco"}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tipo de datos</label>
                <Select value={datasetType} onChange={(e) => setDatasetType(e.target.value)}>
                  {formats?.map((format) => (
                    <option key={format.key} value={format.key}>{format.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            
            <div className="relative">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Archivo CSV</label>
              <div className={cn(
                "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-200",
                file ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/5" : "border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
              )}>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center text-center">
                  <div className={cn(
                    "mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                    file ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-brand-500"
                  )}>
                    <UploadIcon className="h-6 w-6" />
                  </div>
                  {file ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{file.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB · Listo para subir</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Haz clic o arrastra un archivo</p>
                      <p className="mt-1 text-xs text-slate-400">Soporta .xlsx o .csv (hasta 10MB)</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12"
              onClick={() => mutation.mutate()}
              disabled={!subsistemaId || !file || mutation.isPending}
            >
              <UploadIcon className="mr-2 h-5 w-5" />
              {mutation.isPending ? "Procesando carga..." : "Comenzar subida de datos"}
            </Button>
            
            {mutation.isError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                {(mutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al subir el archivo"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-500" />
              Guía de Formato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-6 dark:border-brand-900/30 dark:bg-brand-900/10">
              <h3 className="text-sm font-bold text-brand-900 dark:text-brand-100 mb-2">Descarga la plantilla oficial</h3>
              <p className="text-xs text-brand-700/70 dark:text-brand-400 mb-4 leading-relaxed">
                Utiliza nuestro formato predefinido para asegurar que los datos se procesen correctamente. Puedes abrirlo y editarlo en Excel.
              </p>
              <Button 
                variant="primary" 
                className="w-full shadow-lg shadow-brand-500/20"
                onClick={() => { void downloadTemplate(); }}
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla Excel
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="mt-1 shrink-0"><FileSpreadsheet className="h-4 w-4 text-brand-500" /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedType?.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedType?.description}</p>
                </div>
              </div>
              {selectedType && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <div>
                    Columnas requeridas: {selectedType.fields.filter((field) => field.required).map((field) => field.name).join(", ")}
                  </div>
                  {selectedType.fields.some((field) => !field.required) && (
                    <div className="mt-2">
                      Columnas opcionales: {selectedType.fields.filter((field) => !field.required).map((field) => field.name).join(", ")}
                    </div>
                  )}
                </div>
              )}
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
                Tip: Completa la plantilla en Excel y súbela directamente. El sistema soporta archivos .xlsx y .csv.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <div className="text-[10px] text-slate-500">{new Date(j.created_at).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="truncate max-w-[150px] font-mono text-xs text-slate-600 dark:text-slate-400">{j.filename}</span>
                    </div>
                  </td>
                  <td className="py-4 font-medium text-slate-600 dark:text-slate-400 capitalize">{j.dataset_type.replace('_', ' ')}</td>
                  <td className="py-4 text-center">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      j.status === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      j.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {j.status === "success" && <CheckCircle2 className="h-3 w-3" />}
                      {j.status === "failed" && <XCircle className="h-3 w-3" />}
                      {j.status === "processing" && <Clock className="h-3 w-3 animate-spin" />}
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
