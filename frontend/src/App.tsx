import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { Cargas } from "@/pages/Cargas";
import { Dashboard } from "@/pages/Dashboard";
import { Docentes } from "@/pages/Docentes";
import { Eficiencia } from "@/pages/Eficiencia";
import { Login } from "@/pages/Login";
import { Matricula } from "@/pages/Matricula";
import { Rendimiento } from "@/pages/Rendimiento";
import { AuditLog } from "@/pages/admin/AuditLog";
import { Usuarios } from "@/pages/admin/Usuarios";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="matricula" element={<Matricula />} />
          <Route path="rendimiento" element={<Rendimiento />} />
          <Route path="eficiencia" element={<Eficiencia />} />
          <Route path="docentes" element={<Docentes />} />
          {/* Solo admin puede subir archivos */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="cargas" element={<Cargas />} />
          </Route>
          {/* Admin y directivo gestionan usuarios */}
          <Route element={<ProtectedRoute allowedRoles={["admin", "directivo"]} />}>
            <Route path="admin/usuarios" element={<Usuarios />} />
          </Route>
          {/* Solo directivo ve la bitácora */}
          <Route element={<ProtectedRoute allowedRoles={["directivo"]} />}>
            <Route path="admin/auditoria" element={<AuditLog />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
