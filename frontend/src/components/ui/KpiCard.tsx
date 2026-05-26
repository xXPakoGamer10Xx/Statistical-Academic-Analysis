import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent } from "./Card";
import { formatNumber } from "@/lib/utils";

interface Props {
  label: string;
  value: number | string;
  hint?: string;
  variant?: "blue" | "green" | "amber" | "red";
  active?: boolean;
  onClick?: () => void;
  detailTo?: string;
  summary?: string;
  badge?: string;
}

const colors: Record<NonNullable<Props["variant"]>, { text: string; bg: string; darkBg: string; blob: string; ring: string }> = {
  blue: { text: "text-brand-600 dark:text-brand-400", bg: "bg-brand-50/50", darkBg: "dark:bg-brand-950/20", blob: "bg-brand-500", ring: "ring-brand-500/50" },
  green: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/50", darkBg: "dark:bg-emerald-950/20", blob: "bg-emerald-500", ring: "ring-emerald-500/50" },
  amber: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/50", darkBg: "dark:bg-amber-950/20", blob: "bg-amber-500", ring: "ring-amber-500/50" },
  red: { text: "text-red-600 dark:text-red-400", bg: "bg-red-50/50", darkBg: "dark:bg-red-950/20", blob: "bg-red-500", ring: "ring-red-500/50" },
};

export function KpiCard({ label, value, hint, variant = "blue", active, onClick, detailTo, summary, badge }: Props) {
  const variantStyles = colors[variant];
  const isClickable = !!onClick || !!summary;
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleClick = () => {
    if (summary) setIsExpanded((prev) => !prev);
    if (onClick) onClick();
  };

  return (
    <Card
      whileHover={isClickable ? { y: -4, scale: 1.02 } : undefined}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      onClick={handleClick}
      layout
      className={`relative overflow-hidden ${variantStyles.bg} ${variantStyles.darkBg} 
        border-slate-200/50 dark:border-slate-800/50 transition-all duration-300
        ${isClickable ? "cursor-pointer hover:shadow-lg" : ""}
        ${active ? `ring-2 ${variantStyles.ring} shadow-md` : ""}
      `}
    >
      <CardContent className="relative z-10 p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
          {badge && (
            <div className="rounded-full bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 backdrop-blur-sm">
              {badge}
            </div>
          )}
        </div>
        <div className={`mt-3 text-4xl font-extrabold tracking-tight ${variantStyles.text}`}>
          {typeof value === "number" ? formatNumber(value) : value}
        </div>
        {hint && <div className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">{hint}</div>}
        {detailTo && !summary && (
          <Link
            to={detailTo}
            onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
          >
            Ver detalle <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>

      <AnimatePresence>
        {isExpanded && summary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 px-6 pb-6 overflow-hidden"
          >
            <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                {summary}
              </p>
              {detailTo && (
                <Link
                  to={detailTo}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  Ver análisis detallado <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative gradient blob */}
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 dark:opacity-10 blur-2xl ${variantStyles.blob} pointer-events-none`} />
    </Card>
  );
}
