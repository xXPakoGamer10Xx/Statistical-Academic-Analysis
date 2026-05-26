import { useState, useRef, useEffect } from "react";
import { Download, Image as ImageIcon, ChevronDown, FileText, Table } from "lucide-react";
import { Button } from "./Button";

interface Props {
  onExportPdf?: () => void;
  onExportImage?: () => void;
  onExportHistorical?: () => void;
}

export function ExportMenu({ onExportPdf, onExportImage, onExportHistorical }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!onExportPdf && !onExportImage && !onExportHistorical) return null;

  return (
    <div className="relative" ref={menuRef} data-export-menu>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(!isOpen)} className="gap-2">
        <Download className="h-4 w-4" />
        <span>Exportar</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col py-1">
            {onExportHistorical && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onExportHistorical();
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors w-full text-left"
              >
                <Table className="h-4 w-4 text-blue-500" />
                Histórico (Datos)
              </button>
            )}
            {onExportPdf && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onExportPdf();
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors w-full text-left"
              >
                <FileText className="h-4 w-4 text-brand-500" />
                PDF (Gráficos)
              </button>
            )}
            {onExportImage && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onExportImage();
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors w-full text-left"
              >
                <ImageIcon className="h-4 w-4 text-emerald-500" />
                Como Imagen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
