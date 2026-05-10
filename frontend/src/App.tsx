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
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="cargas" element={<Cargas />} />
            <Route path="admin/usuarios" element={<Usuarios />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
