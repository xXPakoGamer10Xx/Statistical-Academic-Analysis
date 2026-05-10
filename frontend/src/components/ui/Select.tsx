import { SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative group w-full">
      <select
        ref={ref}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 pl-4 pr-10 text-sm text-slate-900 dark:text-white transition-all duration-200 shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
        <ChevronDown className="h-4 w-4 stroke-[2.5px]" />
      </div>
    </div>
  )
);
Select.displayName = "Select";
