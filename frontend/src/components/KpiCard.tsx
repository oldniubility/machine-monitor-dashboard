import type { ReactNode } from "react";

interface Props {
  title: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: "default" | "success" | "warning" | "danger";
}

const accentMap = {
  default: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export default function KpiCard({ title, value, sub, icon, accent = "default" }: Props) {
  return (
    <div className="bg-surface-alt border border-border rounded-lg p-4 flex items-center gap-4">
      <div className={`text-2xl ${accentMap[accent]}`}>{icon}</div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-muted uppercase tracking-wider">{title}</span>
        <span className="text-xl font-semibold text-text">{value}</span>
        {sub && <span className="text-xs text-muted mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}
