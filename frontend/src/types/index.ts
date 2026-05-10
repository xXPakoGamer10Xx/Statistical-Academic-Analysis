export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "usuario";
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

export interface DatasetField {
  name: string;
  kind: "string" | "int" | "float";
  required: boolean;
  description: string | null;
  allowed_values: string[] | null;
}

export interface DatasetDefinition {
  key: "matricula" | "evaluacion_academica" | "titulacion" | "evaluacion_docente";
  label: string;
  description: string;
  fields: DatasetField[];
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
}

export interface EvaluacionDocenteResumen {
  docentes: EvaluacionDocentePunto[];
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
