import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, UserPlus, Shield, User as UserIcon, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useState } from "react";
import { subsistemasApi, usersApi } from "@/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

interface FormState {
  email: string;
  full_name: string;
  password: string;
  role: "admin" | "usuario" | "directivo";
  subsistema_id: number | null;
}

const EMPTY: FormState = { email: "", full_name: "", password: "", role: "usuario", subsistema_id: null };

export function Usuarios() {
  const qc = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const { data: subsistemas } = useQuery({ queryKey: ["subsistemas"], queryFn: subsistemasApi.list });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FormState & { confirmPassword?: string }>>({});
  const [showPassword, setShowPassword] = useState(false);

  const create = useMutation({
    mutationFn: (payload: FormState) =>
      usersApi.create({ ...payload, subsistema_id: payload.subsistema_id ?? undefined } as Partial<User> & { password: string }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setForm(EMPTY); },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<FormState> }) =>
      usersApi.update(id, { ...patch, subsistema_id: patch.subsistema_id ?? undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setEditingId(null); setEditForm({}); setShowPassword(false); },
  });

  const disable = useMutation({
    mutationFn: (id: string) => usersApi.disable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditForm({ email: u.email, full_name: u.full_name, role: u.role, subsistema_id: u.subsistema_id, password: "", confirmPassword: "" });
    setShowPassword(false);
  };

  const passwordsMatch = !editForm.password || editForm.password === editForm.confirmPassword;
  const isSaveDisabled = !!(update.isPending || !passwordsMatch || (editForm.password && editForm.password.length < 8));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Gestión de Usuarios</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">Crea, edita y deshabilita cuentas de acceso</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-brand-600" />
            Nuevo usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</label>
              <Input type="email" placeholder="correo@institucion.edu.mx" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nombre completo</label>
              <Input placeholder="Nombre Apellido" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Contraseña (mín. 8)</label>
              <Input type="password" placeholder="••••••••" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Rol</label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "usuario" })}>
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Universidad Politécnica de Texcoco</label>
              <Select value={form.subsistema_id ?? ""} onChange={(e) => setForm({ ...form, subsistema_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Universidad Politécnica de Texcoco</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending} className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                {create.isPending ? "Creando..." : "Crear usuario"}
              </Button>
            </div>
          </form>
          {create.isError && (
            <div className="mt-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {(create.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al crear usuario"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usuarios registrados</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="pb-4 pl-2 font-bold">Email</th>
                <th className="pb-4 font-bold">Nombre</th>
                <th className="pb-4 font-bold text-center">Rol</th>
                  <th className="pb-4 font-bold text-center">Universidad Politécnica de Texcoco</th>
                <th className="pb-4 text-center font-bold">Estado</th>
                <th className="pb-4 text-center font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users?.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="py-4 pl-2 font-medium text-slate-900 dark:text-white">
                    <div className="flex flex-col">
                      <span className="font-semibold">{u.email}</span>
                      <span className="text-[10px] text-slate-400">ID: {u.id.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{u.full_name}</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      u.role === "admin" 
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" 
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {u.role === "admin" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 text-center text-slate-600 dark:text-slate-400">
                    <span className="inline-block rounded-md bg-slate-50 dark:bg-slate-800/50 px-2 py-1 text-xs font-medium border border-slate-200/50 dark:border-slate-700/50">
                      {subsistemas?.find((s) => s.id === u.subsistema_id)?.nombre ?? "Global"}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <span className={cn(
                      "inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      u.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {u.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 w-8 p-0"
                        onClick={() => startEdit(u)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {u.is_active && u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="danger"
                          className="h-8 w-8 p-0"
                          onClick={() => { if (confirm(`¿Deshabilitar a ${u.email}?`)) disable.mutate(u.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal de Edición */}
      <Modal 
        isOpen={!!editingId} 
        onClose={() => { setEditingId(null); setEditForm({}); }}
        title="Editar Usuario"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Correo electrónico</label>
              <Input
                type="email"
                placeholder="correo@institucion.edu.mx"
                value={editForm.email ?? ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nombre completo</label>
              <Input
                placeholder="Nombre Apellido"
                value={editForm.full_name ?? ""}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Rol</label>
                <Select 
                  value={editForm.role ?? ""} 
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "admin" | "usuario" })}
                >
                  <option value="usuario">Usuario</option>
                  <option value="admin">Administrador</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Universidad Politécnica de Texcoco</label>
                <Select 
                  value={editForm.subsistema_id ?? ""} 
                  onChange={(e) => setEditForm({ ...editForm, subsistema_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Universidad Politécnica de Texcoco</option>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Seguridad (Cambio de contraseña)</p>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nueva Contraseña</label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="pr-10"
                      value={editForm.password ?? ""} 
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirmar Contraseña</label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="pr-10"
                      value={editForm.confirmPassword ?? ""} 
                      onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {!passwordsMatch && editForm.confirmPassword && (
                <div className="flex items-center gap-2 text-[11px] font-medium text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  Las contraseñas no coinciden
                </div>
              )}
              {editForm.password && editForm.password.length < 8 && (
                <div className="flex items-center gap-2 text-[11px] font-medium text-amber-500">
                  <AlertCircle className="h-3 w-3" />
                  La contraseña debe tener al menos 8 caracteres
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="secondary" 
              className="flex-1"
              onClick={() => { setEditingId(null); setEditForm({}); }}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1"
              disabled={isSaveDisabled}
              onClick={() => editingId && update.mutate({ id: editingId, patch: editForm })}
            >
              {update.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
