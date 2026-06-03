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
