import { Wrench, AlertTriangle } from "lucide-react";
import StatusBadge from "./StatusBadge";
import type { DeviceSnapshot } from "../types";

interface Props {
  devices: DeviceSnapshot[];
  onSelect: (id: string) => void;
}

export default function DeviceTable({ devices, onSelect }: Props) {
  if (devices.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        <Wrench className="mx-auto mb-2 opacity-30" size={32} />
        <p className="text-sm">暂无设备数据</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-left">
            <th className="py-3 px-4 font-medium">状态</th>
            <th className="py-3 px-4 font-medium">设备编号</th>
            <th className="py-3 px-4 font-medium">设备名称</th>
            <th className="py-3 px-4 font-medium">品牌/型号</th>
            <th className="py-3 px-4 font-medium">车间</th>
            <th className="py-3 px-4 font-medium text-right">今日产量</th>
            <th className="py-3 px-4 font-medium text-right">运行时长</th>
            <th className="py-3 px-4 font-medium">报警</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="border-b border-border/50 hover:bg-white/5 cursor-pointer transition-colors"
            >
              <td className="py-3 px-4">
                <StatusBadge status={d.online_status === "offline" ? "offline" : d.run_status} />
              </td>
              <td className="py-3 px-4 font-mono text-xs">{d.device_code}</td>
              <td className="py-3 px-4">{d.name}</td>
              <td className="py-3 px-4 text-muted">{d.brand} / {d.model}</td>
              <td className="py-3 px-4 text-muted">{d.workshop}</td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">{d.current_output.toLocaleString()}</td>
              <td className="py-3 px-4 text-right text-muted tabular-nums">{d.run_duration_hours.toFixed(1)}h</td>
              <td className="py-3 px-4">
                {d.alarm_info ? (
                  <span className="inline-flex items-center gap-1 text-xs text-danger">
                    <AlertTriangle size={12} />
                    {d.alarm_info}
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
