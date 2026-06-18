import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { Caracterizacion } from "@/pages/Caracterizacion";
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
          <Route path="caracterizacion" element={<Caracterizacion />} />
          <Route path="rendimiento" element={<Rendimiento />} />
          <Route path="eficiencia" element={<Eficiencia />} />
          <Route path="docentes" element={<Docentes />} />
          {/* Admin escolar y general pueden subir archivos / captura manual */}
          <Route element={<ProtectedRoute allowedRoles={["admin_escolar", "admin_general"]} />}>
            <Route path="cargas" element={<Cargas />} />
          </Route>
          {/* Admin escolar y general gestionan usuarios */}
          <Route element={<ProtectedRoute allowedRoles={["admin_escolar", "admin_general"]} />}>
            <Route path="admin/usuarios" element={<Usuarios />} />
          </Route>
          {/* Solo admin general ve la bitácora */}
          <Route element={<ProtectedRoute allowedRoles={["admin_general"]} />}>
            <Route path="admin/auditoria" element={<AuditLog />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
