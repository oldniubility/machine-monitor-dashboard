const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  running:  { color: "text-green-400", bg: "bg-green-400/10", label: "运行中" },
  standby:  { color: "text-yellow-400", bg: "bg-yellow-400/10", label: "待机" },
  fault:    { color: "text-red-400", bg: "bg-red-400/10", label: "故障" },
  offline:  { color: "text-slate-400", bg: "bg-slate-400/10", label: "离线" },
};

interface Props {
  status: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;
  const dotSize = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  const textSize = size === "md" ? "text-sm" : "text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${cfg.bg} ${textSize}`}>
      <span className={`${dotSize} rounded-full ${cfg.color.replace("text-", "bg-")}`} />
      <span className={cfg.color}>{cfg.label}</span>
    </span>
  );
}
