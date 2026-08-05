import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { resolveIsDark, useUiPreferencesStore } from "./stores/uiPreferences";
import "./index.css";

// Se lee el store persistido de forma sincrona (fuera de React, antes del primer render)
// para evitar un parpadeo del tema incorrecto al cargar.
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme() {
  const isDark = resolveIsDark(useUiPreferencesStore.getState().theme, darkQuery.matches);
  document.documentElement.classList.toggle("dark", isDark);
}

applyTheme();
darkQuery.addEventListener("change", applyTheme);
useUiPreferencesStore.subscribe(applyTheme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
