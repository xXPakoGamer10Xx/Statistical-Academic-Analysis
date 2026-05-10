import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { authApi } from "@/api/endpoints";
import { useAuthStore } from "@/stores/auth";

export function useAuth() {
  const { accessToken, user, setUser, logout } = useAuthStore();

  const query = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: Boolean(accessToken) && !user,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
    if (query.error) logout();
  }, [query.data, query.error, setUser, logout]);

  // Si tenemos token pero no usuario, estamos "cargando" el perfil
  const isLoading = Boolean(accessToken) && !user && (query.isLoading || query.isFetching);

  return {
    isAuthenticated: Boolean(accessToken),
    user,
    isLoading,
    logout,
  };
}
