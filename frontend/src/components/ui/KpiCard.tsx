import { Card, CardContent } from "./Card";
import { formatNumber } from "@/lib/utils";

interface Props {
  label: string;
  value: number | string;
  hint?: string;
  variant?: "blue" | "green" | "amber" | "red";
}

const colors: Record<NonNullable<Props["variant"]>, { text: string; bg: string; darkBg: string; blob: string }> = {
  blue: { text: "text-brand-600 dark:text-brand-400", bg: "bg-brand-50/50", darkBg: "dark:bg-brand-950/20", blob: "bg-brand-500" },
  green: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/50", darkBg: "dark:bg-emerald-950/20", blob: "bg-emerald-500" },
  amber: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/50", darkBg: "dark:bg-amber-950/20", blob: "bg-amber-500" },
  red: { text: "text-red-600 dark:text-red-400", bg: "bg-red-50/50", darkBg: "dark:bg-red-950/20", blob: "bg-red-500" },
};

export function KpiCard({ label, value, hint, variant = "blue" }: Props) {
  const variantStyles = colors[variant];
  return (
    <Card
      whileHover={{ y: -4, scale: 1.01 }}
      className={`relative overflow-hidden ${variantStyles.bg} ${variantStyles.darkBg} border-slate-200/50 dark:border-slate-800/50`}
    >
      <CardContent className="relative z-10 p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
        <div className={`mt-3 text-4xl font-extrabold tracking-tight ${variantStyles.text}`}>
          {typeof value === "number" ? formatNumber(value) : value}
        </div>
        {hint && <div className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">{hint}</div>}
      </CardContent>
      {/* Decorative gradient blob */}
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 dark:opacity-10 blur-2xl ${variantStyles.blob} pointer-events-none`} />
    </Card>
  );
}
