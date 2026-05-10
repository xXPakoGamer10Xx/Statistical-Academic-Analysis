import { api } from "./client";
import type {
  EficienciaResumen,
  EvaluacionDocenteResumen,
  FilterState,
  IndicadoresOpcionales,
  MatriculaResumen,
  RendimientoResumen,
  DatasetDefinition,
  Subsistema,
  TokenResponse,
  UploadJob,
  User,
} from "@/types";

function extractFilename(contentDisposition?: string): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  return asciiMatch?.[1] ?? asciiMatch?.[2]?.trim() ?? null;
}

function triggerBlobDownload(blob: Blob, fallbackFilename: string, contentDisposition?: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = extractFilename(contentDisposition) ?? fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  
  // Dar tiempo al navegador para procesar la descarga antes de revocar la URL (necesario en Chrome)
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<User>("/users/me").then((r) => r.data),
};

export const usersApi = {
  list: () => api.get<User[]>("/users").then((r) => r.data),
  create: (payload: Partial<User> & { password: string }) =>
    api.post<User>("/users", payload).then((r) => r.data),
  update: (id: string, patch: Partial<User> & { password?: string }) =>
    api.patch<User>(`/users/${id}`, patch).then((r) => r.data),
  disable: (id: string) => api.delete(`/users/${id}`),
};

export const subsistemasApi = {
  list: () => api.get<Subsistema[]>("/subsistemas").then((r) => r.data),
};

export const uploadsApi = {
  list: () => api.get<UploadJob[]>("/uploads").then((r) => r.data),
  get: (id: string) => api.get<UploadJob>(`/uploads/${id}`).then((r) => r.data),
  deleteJob: (id: string) => api.delete(`/uploads/${id}`),
  formats: () => api.get<DatasetDefinition[]>("/templates/formats").then((r) => r.data),
  upload: (subsistemaId: number, datasetType: string, file: File) => {
    const fd = new FormData();
    fd.append("subsistema_id", String(subsistemaId));
    fd.append("dataset_type", datasetType);
    fd.append("file", file);
    return api
      .post<UploadJob>("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  templateUrl: (datasetType: string) => `/api/v1/templates/${datasetType}`,
  downloadTemplate: async (datasetType: string) => {
    const response = await api.get(`/templates/${datasetType}`, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    triggerBlobDownload(blob, `plantilla_${datasetType}.xlsx`, response.headers["content-disposition"]);
  },
};

function buildParams(filters: FilterState) {
  const p: Record<string, string | number> = {};
  if (filters.subsistema_id) p.subsistema_id = filters.subsistema_id;
  if (filters.ciclo_escolar) p.ciclo_escolar = filters.ciclo_escolar;
  if (filters.cuatrimestre) p.cuatrimestre = filters.cuatrimestre;
  if (filters.programa_educativo) p.programa_educativo = filters.programa_educativo;
  return p;
}

export const indicadoresApi = {
  matricula: (filters: FilterState) =>
    api.get<MatriculaResumen>("/matricula", { params: buildParams(filters) }).then((r) => r.data),
  rendimiento: (filters: FilterState) =>
    api.get<RendimientoResumen>("/rendimiento", { params: buildParams(filters) }).then((r) => r.data),
  opcionales: (filters: Pick<FilterState, "subsistema_id" | "ciclo_escolar">) =>
    api.get<IndicadoresOpcionales>("/rendimiento/opcionales", { params: buildParams(filters as FilterState) }).then((r) => r.data),
  eficiencia: (filters: FilterState & { generaciones?: string[] }) =>
    api
      .get<EficienciaResumen>("/eficiencia", {
        params: { ...buildParams(filters), generaciones: filters.generaciones },
      })
      .then((r) => r.data),
  docentes: (filters: FilterState) =>
    api.get<EvaluacionDocenteResumen>("/docentes", { params: buildParams(filters) }).then((r) => r.data),
};

export const reportsApi = {
  pdfUrl: (seccion: string, filters: FilterState) => {
    const params = new URLSearchParams({ seccion });
    if (filters.subsistema_id) params.append("subsistema_id", String(filters.subsistema_id));
    if (filters.ciclo_escolar) params.append("ciclo_escolar", filters.ciclo_escolar);
    return `/api/v1/reports/pdf?${params.toString()}`;
  },
  downloadPdf: async (seccion: string, filters: FilterState) => {
    const response = await api.get("/reports/pdf", {
      params: { seccion, ...buildParams(filters) },
      responseType: "blob",
    });
    triggerBlobDownload(
      response.data,
      `Reporte_Universidad_Politecnica_de_Texcoco_${seccion.charAt(0).toUpperCase() + seccion.slice(1)}.pdf`,
      response.headers["content-disposition"],
    );
  },
  downloadImage: async (seccion: string, elementId: string) => {
    const { toPng } = await import("html-to-image");
    const el = document.getElementById(elementId);
    if (!el) return;
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    const isDark = document.documentElement.classList.contains("dark");
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      skipFonts: true,
    });

    const a = document.createElement("a");
    a.style.display = "none";
    a.href = dataUrl;
    a.download = `Reporte_Universidad_Politecnica_de_Texcoco_${seccion.charAt(0).toUpperCase() + seccion.slice(1)}.png`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
    }, 500);
  },
};
