export interface Device {
  id: string;
  device_code: string;
  name: string;
  brand: string;
  model: string;
  workshop: string;
  ip: string;
  port: number;
  slave_id: number;
  template_id: string | null;
  template_name: string | null;
  interval: number;
  enabled: boolean;
  online_status: "online" | "offline";
  run_status: "running" | "standby" | "fault" | "offline";
  last_seen: string | null;
}

export interface DeviceSnapshot {
  id: string;
  device_code: string;
  name: string;
  brand: string;
  model: string;
  workshop: string;
  online_status: string;
  run_status: string;
  current_output: number;
  run_duration_hours: number;
  alarm_info: string | null;
}

export interface DashboardOverview {
  online_count: number;
  total_count: number;
  today_output: number;
  overall_availability: number;
  alarm_count: number;
}

export interface DailyOutput {
  date: string;
  output: number;
  availability: number;
}

export interface WSStatusUpdate {
  type: "status_update";
  devices: Record<string, { online_status: string; run_status: string; last_seen?: string }>;
}

// ── Device Detail ──

export interface MetricItem {
  item_id: string;
  item_name: string;
  value: number;
  unit: string;
  timestamp: string | null;
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
}

export interface AlarmItem {
  id: string;
  alarm_type: string;
  alarm_code: string | null;
  message: string;
  acknowledged: boolean;
  created_at: string | null;
  resolved_at: string | null;
}

export interface AggregationItem {
  period_key: string;
  output_count: number;
  availability: number;
  run_duration: number;
  standby_duration: number;
  fault_duration: number;
  offline_duration: number;
}

// ── Reports ──

export interface ProductionRow {
  device_code: string;
  device_name: string;
  workshop: string;
  period_key: string;
  output_count: number;
  availability: number;
}

export interface OEERow {
  device_id: string;
  device_code: string;
  device_name: string;
  availability: number;
  run_hours: number;
  standby_hours: number;
  fault_hours: number;
  offline_hours: number;
}

export interface WorkshopSummary {
  workshop: string;
  device_count: number;
  online_count: number;
  total_output: number;
  avg_availability: number;
}
