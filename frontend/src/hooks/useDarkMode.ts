import { useEffect, useState } from "react";
import { resolveIsDark, useUiPreferencesStore } from "@/stores/uiPreferences";

export function useDarkMode() {
  const theme = useUiPreferencesStore((s) => s.theme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return resolveIsDark(theme, systemPrefersDark);
}
