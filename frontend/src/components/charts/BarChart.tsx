import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useDarkMode } from "@/hooks/useDarkMode";

interface Props {
  title?: string;
  categories: string[];
  series: { name: string; data: number[]; color?: string; stack?: string }[];
  height?: number;
  formatter?: string;
}

export function BarChart({ title, categories, series, height = 320, formatter }: Props) {
  const isDark = useDarkMode();
  const textColor = isDark ? "#e2e8f0" : "#475569";

  const option: EChartsOption = {
    title: title ? { text: title, left: "left", textStyle: { fontSize: 14, fontWeight: 600, color: textColor } } : undefined,
    tooltip: { trigger: "axis", valueFormatter: formatter ? (v) => `${v}${formatter}` : undefined, backgroundColor: isDark ? "#1e293b" : "#ffffff", textStyle: { color: textColor } },
    legend: { bottom: 0, textStyle: { color: textColor } },
    grid: { left: 50, right: 20, top: title ? 40 : 20, bottom: categories.length > 6 ? 90 : 50 },
    xAxis: { type: "category", data: categories, axisLabel: { interval: 0, rotate: categories.length > 6 ? 45 : 0, color: textColor, width: 90, overflow: "truncate" }, axisLine: { lineStyle: { color: isDark ? "#334155" : "#cbd5e1" } } },
    yAxis: { type: "value", axisLabel: { formatter: formatter ? `{value}${formatter}` : "{value}", color: textColor }, splitLine: { lineStyle: { color: isDark ? "#334155" : "#cbd5e1" } } },
    series: series.map((s) => ({
      name: s.name,
      type: "bar",
      data: s.data,
      stack: s.stack,
      itemStyle: s.color ? { color: s.color } : undefined,
      emphasis: { focus: "series" },
    })),
  };
  return <ReactECharts option={option} style={{ height }} notMerge />;
}
