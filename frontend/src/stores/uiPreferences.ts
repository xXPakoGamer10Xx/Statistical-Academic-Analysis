import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NavStyle = "dock" | "sidebar";
export type Theme = "light" | "dark" | "system";

interface UiPreferencesState {
  navStyle: NavStyle;
  theme: Theme;
  /** Solo aplica al navStyle "sidebar": expandido (icono + texto) vs angosto (solo icono). */
  sidebarCollapsed: boolean;
  setNavStyle: (navStyle: NavStyle) => void;
  toggleNavStyle: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebarCollapsed: () => void;
}

/** "system" seguia el SO como hoy: se conserva como valor inicial para no forzar un
 * cambio de tema abrupto en usuarios existentes; el boton de tema nunca lo vuelve a
 * seleccionar, solo alterna explicitamente entre light/dark. */
export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set, get) => ({
      navStyle: "dock",
      theme: "system",
      sidebarCollapsed: false,
      setNavStyle: (navStyle) => set({ navStyle }),
      toggleNavStyle: () => set({ navStyle: get().navStyle === "dock" ? "sidebar" : "dock" }),
      setTheme: (theme) => set({ theme }),
      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    { name: "ui-preferences-storage" }
  )
);

export function resolveIsDark(theme: Theme, systemPrefersDark: boolean): boolean {
  return theme === "system" ? systemPrefersDark : theme === "dark";
}
