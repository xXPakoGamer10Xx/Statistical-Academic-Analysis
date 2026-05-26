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
  downloadImage: async (
    seccion: string,
    elementId: string,
    filters?: import("@/types").FilterState,
  ) => {
    const { toPng } = await import("html-to-image");

    const chartsEl = document.getElementById(elementId);
    if (!chartsEl) return;

    const isDark = document.documentElement.classList.contains("dark");
    const bgColor = isDark ? "#0f172a" : "#ffffff";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const badgeBg = isDark ? "#1e293b" : "#f1f5f9";
    const badgeBorder = isDark ? "#334155" : "#e2e8f0";
    const accentColor = isDark ? "#38bdf8" : "#0ea5e9";

    const sectionTitles: Record<string, string> = {
      matricula: "Matrícula",
      rendimiento: "Rendimiento Académico",
      eficiencia: "Eficiencia Terminal",
      docentes: "Evaluación Docente",
    };
    const title = sectionTitles[seccion] ?? seccion;

    const activeFilters: string[] = [];
    if (filters?.ciclo_escolar) activeFilters.push(`Ciclo: ${filters.ciclo_escolar}`);
    if (filters?.cuatrimestre !== undefined) activeFilters.push(`Cuatrimestre: ${filters.cuatrimestre}`);
    if (filters?.programa_educativo) activeFilters.push(`Programa: ${filters.programa_educativo}`);

    // ── Encabezado inyectado en el elemento original (ya renderizado) ─────────
    const header = document.createElement("div");
    header.style.cssText = [
      "display:flex", "flex-direction:column", "gap:6px",
      "padding:0 0 18px 0", "margin-bottom:16px",
      `border-bottom:1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
    ].join(";");

    const titleEl = document.createElement("div");
    titleEl.style.cssText = `font-size:20px;font-weight:700;color:${isDark ? "#f1f5f9" : "#0f172a"};letter-spacing:-0.3px;font-family:Inter,system-ui,sans-serif`;
    titleEl.textContent = `Universidad Politécnica de Texcoco — ${title}`;
    header.appendChild(titleEl);

    const dateEl = document.createElement("div");
    dateEl.style.cssText = `font-size:11px;color:${textColor};font-family:Inter,system-ui,sans-serif`;
    dateEl.textContent = `Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`;
    header.appendChild(dateEl);

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:2px";
    const filterLabel = document.createElement("span");
    filterLabel.style.cssText = `font-size:11px;font-weight:600;color:${textColor};font-family:Inter,system-ui,sans-serif`;
    filterLabel.textContent = activeFilters.length > 0 ? "Filtros:" : "Sin filtros aplicados — todos los datos";
    filterRow.appendChild(filterLabel);
    activeFilters.forEach((f) => {
      const badge = document.createElement("span");
      badge.style.cssText = `font-size:11px;font-weight:600;color:${accentColor};background:${badgeBg};border:1px solid ${badgeBorder};border-radius:20px;padding:2px 10px;font-family:Inter,system-ui,sans-serif;white-space:nowrap;`;
      badge.textContent = f;
      filterRow.appendChild(badge);
    });
    header.appendChild(filterRow);

    // Insertar encabezado en el elemento original (ya está pintado en pantalla)
    chartsEl.insertBefore(header, chartsEl.firstChild);

    // ── Quitar overflow de ancestros para que html-to-image no recorte ────────
    type OvSave = { el: HTMLElement; ov: string; ovx: string; ovy: string };
    const saved: OvSave[] = [];
    let cursor: HTMLElement | null = chartsEl;
    while (cursor && cursor !== document.documentElement) {
      const cs = getComputedStyle(cursor);
      if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        saved.push({ el: cursor, ov: cursor.style.overflow, ovx: cursor.style.overflowX, ovy: cursor.style.overflowY });
        cursor.style.overflow = "visible";
        cursor.style.overflowX = "visible";
        cursor.style.overflowY = "visible";
      }
      cursor = cursor.parentElement;
    }

    // Hacer scroll para que el elemento esté en el viewport (necesario para canvas)
    chartsEl.scrollIntoView({ block: "start" });

    // Esperar layout estable y re-render de ECharts
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 300));

    const PAD = 20;
    const captureW = chartsEl.scrollWidth + PAD * 2;
    const captureH = chartsEl.scrollHeight + PAD * 2;

    try {
      // Primera pasada: pre-carga fuentes/imágenes externas
      await toPng(chartsEl, { pixelRatio: 2, backgroundColor: bgColor, skipFonts: true, width: captureW, height: captureH });
      // Segunda pasada: imagen final con todo cargado
      const dataUrl = await toPng(chartsEl, {
        pixelRatio: 2,
        backgroundColor: bgColor,
        skipFonts: true,
        width: captureW,
        height: captureH,
        style: { padding: `${PAD}px` },
      });

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = dataUrl;
      a.download = `Reporte_Universidad_Politecnica_de_Texcoco_${seccion.charAt(0).toUpperCase() + seccion.slice(1)}.png`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); }, 500);
    } finally {
      // Restaurar overflow en todos los elementos
      saved.forEach(({ el: e, ov, ovx, ovy }) => {
        e.style.overflow = ov;
        e.style.overflowX = ovx;
        e.style.overflowY = ovy;
      });
      // Eliminar encabezado inyectado
      header.remove();
    }
  },
  downloadImagePdf: async (
    seccion: string,
    elementId: string,
    filters?: import("@/types").FilterState,
  ) => {
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");

    const chartsEl = document.getElementById(elementId);
    if (!chartsEl) return;

    const isDark = document.documentElement.classList.contains("dark");
    const bgColor = isDark ? "#0f172a" : "#ffffff";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const badgeBg = isDark ? "#1e293b" : "#f1f5f9";
    const badgeBorder = isDark ? "#334155" : "#e2e8f0";
    const accentColor = isDark ? "#38bdf8" : "#0ea5e9";

    const sectionTitles: Record<string, string> = {
      matricula: "Matrícula",
      rendimiento: "Rendimiento Académico",
      eficiencia: "Eficiencia Terminal",
      docentes: "Evaluación Docente",
    };
    const title = sectionTitles[seccion] ?? seccion;

    const activeFilters: string[] = [];
    if (filters?.ciclo_escolar) activeFilters.push(`Ciclo: ${filters.ciclo_escolar}`);
    if (filters?.cuatrimestre !== undefined) activeFilters.push(`Cuatrimestre: ${filters.cuatrimestre}`);
    if (filters?.programa_educativo) activeFilters.push(`Programa: ${filters.programa_educativo}`);

    // ── Encabezado inyectado en el elemento original (ya renderizado) ─────────
    const header = document.createElement("div");
    header.style.cssText = [
      "display:flex", "flex-direction:column", "gap:6px",
      "padding:0 0 18px 0", "margin-bottom:16px",
      `border-bottom:1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
    ].join(";");

    const titleEl = document.createElement("div");
    titleEl.style.cssText = `font-size:20px;font-weight:700;color:${isDark ? "#f1f5f9" : "#0f172a"};letter-spacing:-0.3px;font-family:Inter,system-ui,sans-serif`;
    titleEl.textContent = `Universidad Politécnica de Texcoco — ${title}`;
    header.appendChild(titleEl);

    const dateEl = document.createElement("div");
    dateEl.style.cssText = `font-size:11px;color:${textColor};font-family:Inter,system-ui,sans-serif`;
    dateEl.textContent = `Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`;
    header.appendChild(dateEl);

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:2px";
    const filterLabel = document.createElement("span");
    filterLabel.style.cssText = `font-size:11px;font-weight:600;color:${textColor};font-family:Inter,system-ui,sans-serif`;
    filterLabel.textContent = activeFilters.length > 0 ? "Filtros:" : "Sin filtros aplicados — todos los datos";
    filterRow.appendChild(filterLabel);
    activeFilters.forEach((f) => {
      const badge = document.createElement("span");
      badge.style.cssText = `font-size:11px;font-weight:600;color:${accentColor};background:${badgeBg};border:1px solid ${badgeBorder};border-radius:20px;padding:2px 10px;font-family:Inter,system-ui,sans-serif;white-space:nowrap;`;
      badge.textContent = f;
      filterRow.appendChild(badge);
    });
    header.appendChild(filterRow);

    // Insertar encabezado en el elemento original (ya está pintado en pantalla)
    chartsEl.insertBefore(header, chartsEl.firstChild);

    // ── Quitar overflow de ancestros para que html-to-image no recorte ────────
    type OvSave = { el: HTMLElement; ov: string; ovx: string; ovy: string };
    const saved: OvSave[] = [];
    let cursor: HTMLElement | null = chartsEl;
    while (cursor && cursor !== document.documentElement) {
      const cs = getComputedStyle(cursor);
      if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        saved.push({ el: cursor, ov: cursor.style.overflow, ovx: cursor.style.overflowX, ovy: cursor.style.overflowY });
        cursor.style.overflow = "visible";
        cursor.style.overflowX = "visible";
        cursor.style.overflowY = "visible";
      }
      cursor = cursor.parentElement;
    }

    // Hacer scroll para que el elemento esté en el viewport (necesario para canvas)
    chartsEl.scrollIntoView({ block: "start" });

    // Esperar layout estable y re-render de ECharts
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 300));

    const PAD = 20;
    const captureW = chartsEl.scrollWidth + PAD * 2;
    const captureH = chartsEl.scrollHeight + PAD * 2;

    try {
      // Primera pasada: pre-carga fuentes/imágenes externas
      await toPng(chartsEl, { pixelRatio: 2, backgroundColor: bgColor, skipFonts: true, width: captureW, height: captureH });
      // Segunda pasada: imagen final con todo cargado
      const dataUrl = await toPng(chartsEl, {
        pixelRatio: 2,
        backgroundColor: bgColor,
        skipFonts: true,
        width: captureW,
        height: captureH,
        style: { padding: `${PAD}px` },
      });

      const pdf = new jsPDF({
        orientation: captureW > captureH ? "landscape" : "portrait",
        unit: "px",
        format: [captureW, captureH]
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, captureW, captureH);
      pdf.save(`Reporte_Universidad_Politecnica_de_Texcoco_${seccion.charAt(0).toUpperCase() + seccion.slice(1)}_Graficos.pdf`);
    } finally {
      // Restaurar overflow en todos los elementos
      saved.forEach(({ el: e, ov, ovx, ovy }) => {
        e.style.overflow = ov;
        e.style.overflowX = ovx;
        e.style.overflowY = ovy;
      });
      // Eliminar encabezado inyectado
      header.remove();
    }
  },


};

export interface AuditLogEntry {
  id: number;
  user_id: string | null;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const auditApi = {
  list: (params?: { limit?: number; offset?: number; action?: string }) =>
    api.get<AuditLogEntry[]>("/audit-logs", { params }).then((r) => r.data),
};
