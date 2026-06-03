import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Monitor, BarChart3, Settings, Bell } from "lucide-react";
import Dashboard from "./pages/Dashboard";

const NAV_ITEMS = [
  { to: "/", icon: Monitor, label: "车间总览" },
  { to: "/reports", icon: BarChart3, label: "统计报表" },
  { to: "/alarms", icon: Bell, label: "报警记录" },
  { to: "/settings", icon: Settings, label: "系统配置" },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Top Nav */}
        <header className="h-14 bg-surface-alt border-b border-border flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2 mr-8">
            <Monitor size={20} className="text-accent" />
            <span className="font-semibold text-sm">机床监控看板</span>
          </div>
          <nav className="flex gap-1">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:text-text hover:bg-white/5"
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Bell size={16} className="text-muted cursor-pointer hover:text-text" />
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent">
              管
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/reports" element={<Placeholder title="统计报表" />} />
            <Route path="/alarms" element={<Placeholder title="报警记录" />} />
            <Route path="/settings" element={<Placeholder title="系统配置" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6 flex items-center justify-center h-64 text-muted text-sm">
      {title} — 即将上线
    </div>
  );
}
