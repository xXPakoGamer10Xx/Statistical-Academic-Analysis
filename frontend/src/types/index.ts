export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "viewer" | "admin_escolar" | "admin_general";
  subsistema_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subsistema {
  id: number;
  nombre: string;
  codigo: string;
  descripcion: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UploadJob {
  id: string;
  subsistema_id: number;
  dataset_type: string;
  filename: string;
  status: string;
  rows_total: number;
  rows_processed: number;
  rows_failed: number;
  file_size_bytes: number;
  file_sha256: string;
  errors: Array<Record<string, unknown>> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface FieldChange {
  field: string;
  old_value: string | null;
  new_value: string | null;
}

export interface RowDiff {
  key: Record<string, string>;
  changes?: FieldChange[] | null;
}

export interface UploadCompareSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

export interface UploadCompareResult {
  dataset_type: string;
  subsistema_id: number;
  baseline_rows: number;
  new_rows_valid: number;
  validation_errors: number;
  identical_to_last_upload: boolean;
  summary: UploadCompareSummary;
  added: RowDiff[];
  removed: RowDiff[];
  modified: RowDiff[];
  truncated: boolean;
}

export interface DatasetField {
  name: string;
  kind: "string" | "int" | "float";
  required: boolean;
  description: string | null;
  allowed_values: string[] | null;
  suggested_values?: string[] | null;
}

export interface DatasetDefinition {
  key: "matricula" | "evaluacion_academica" | "titulacion" | "evaluacion_docente" | "becas" | "caracterizacion";
  label: string;
  description: string;
  fields: DatasetField[];
  /** Catalogo sugerido por valor de otra columna (ej. tipo segun categoria). */
  catalogos?: Record<string, string[]> | null;
}

export interface MatriculaPunto {
  ciclo_escolar: string;
  cuatrimestre: number;
  programa_educativo: string;
  matricula_actual: number;
  nuevo_ingreso: number;
  hombres: number;
  mujeres: number;
}

export interface MatriculaResumen {
  total_actual: number;
  total_nuevo_ingreso: number;
  distribucion_genero: { hombres: number; mujeres: number };
  series: MatriculaPunto[];
}

export interface IndicadorPorcentual {
  ciclo_escolar: string;
  programa_educativo: string;
  valor: number;
}

export interface RendimientoResumen {
  aprovechamiento: IndicadorPorcentual[];
  reprobacion: IndicadorPorcentual[];
  desercion: IndicadorPorcentual[];
}

export interface EficienciaPunto {
  generacion: string;
  programa_educativo: string;
  eficiencia_terminal: number;
  indice_titulacion: number;
  egresados: number;
  titulados: number;
}

export interface EficienciaResumen {
  generaciones: EficienciaPunto[];
}

export interface EvaluacionDocentePunto {
  ciclo_escolar: string;
  docente_id: string;
  docente_nombre: string;
  programa_educativo: string;
  promedio_alumnos: number | null;
  promedio_directivos: number | null;
  promedio_general: number | null;
}

export interface EvaluacionDocenteResumen {
  docentes: EvaluacionDocentePunto[];
  promedio_institucional: number | null;
}

// ---------------------------------------------------------------------------
// Tipos del wizard de upload inteligente
// ---------------------------------------------------------------------------

export interface ColumnMappingItem {
  excel_column: string;
  system_field: string | null;
  confidence: number;
}

export interface DatasetTypeScore {
  dataset_type: string;
  score: number;
  label: string;
}

export interface SheetAnalysis {
  sheet_name: string;
  header_row: number;
  detected_headers: string[];
  header_column_indices?: number[];
  sample_rows: string[][];
  suggested_dataset_type: string | null;
  dataset_type_scores: DatasetTypeScore[];
  column_mapping: ColumnMappingItem[];
  has_merged_cells: boolean;
  total_data_rows: number;
  warnings: string[];
}

export interface ExcelAnalysis {
  sheet_names: string[];
  sheets: SheetAnalysis[];
  recommended_sheet: string | null;
}

export type WizardStep = "upload" | "sheet" | "mapping" | "preview" | "confirm";

export interface WizardState {
  step: WizardStep;
  file: File | null;
  analysis: ExcelAnalysis | null;
  selectedSheet: string | null;
  selectedDatasetType: string;
  headerRow: number;
  columnMapping: Record<string, string | null>;
  subsistemaId: number | "";
}

export interface FilterState {
  subsistema_id?: number;
  ciclo_escolar?: string;
  cuatrimestre?: number;
  programa_educativo?: string;
}

export interface IndicadoresOpcionales {
  cobertura: IndicadorPorcentual[];
  abandono_escolar: IndicadorPorcentual[];
  absorcion: IndicadorPorcentual[];
}

export interface CaracterizacionTipo {
  tipo: string;
  cantidad: number;
}

export interface CaracterizacionCategoria {
  categoria: string;
  total: number;
  tipos: CaracterizacionTipo[];
}

export interface CaracterizacionResumen {
  total: number;
  categorias: CaracterizacionCategoria[];
}
