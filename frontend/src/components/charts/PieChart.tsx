import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useDarkMode } from "@/hooks/useDarkMode";

interface Props {
  title?: string;
  data: { name: string; value: number; color?: string }[];
  height?: number;
}

export function PieChart({ title, data, height = 320 }: Props) {
  const isDark = useDarkMode();
  const textColor = isDark ? "#e2e8f0" : "#475569";

  const option: EChartsOption = {
    title: title ? { text: title, left: "left", textStyle: { fontSize: 14, fontWeight: 600, color: textColor } } : undefined,
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)", backgroundColor: isDark ? "#1e293b" : "#ffffff", textStyle: { color: textColor } },
    legend: { bottom: 0, textStyle: { color: textColor } },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: true,
        label: { show: true, formatter: "{b}\n{d}%", color: textColor },
        data: data.map((d) => ({ name: d.name, value: d.value, itemStyle: d.color ? { color: d.color } : undefined })),
      },
    ],
  };
  return <ReactECharts option={option} style={{ height }} notMerge />;
}
