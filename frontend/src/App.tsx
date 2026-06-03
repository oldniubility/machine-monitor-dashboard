import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate } from "react-router-dom";
import { Monitor, BarChart3, Settings, Bell, LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useWebSocket } from "./hooks/useWebSocket";
import Dashboard from "./pages/Dashboard";
import DeviceDetail from "./pages/DeviceDetail";
import Reports from "./pages/Reports";
import AlarmsPage from "./pages/AlarmsPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";

const NAV_ITEMS = [
  { to: "/", icon: Monitor, label: "车间总览" },
  { to: "/reports", icon: BarChart3, label: "统计报表" },
  { to: "/alarms", icon: Bell, label: "报警记录" },
  { to: "/settings", icon: Settings, label: "系统配置" },
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [alarmBadge, setAlarmBadge] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/alarms/unresolved-count");
        const data = await res.json();
        setAlarmBadge(data.count || 0);
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, [isAuthenticated]);

  useWebSocket(undefined, (data: Record<string, unknown>) => {
    if (data.type === "alarm_new") {
      fetch("/api/alarms/unresolved-count")
        .then(r => r.json())
        .then(d => setAlarmBadge(d.count || 0));
    }
  });

  return (
    <div className="min-h-screen flex flex-col">
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
                `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors relative ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-text hover:bg-white/5"
                }`
              }
            >
              <Icon size={14} />
              {label}
              {to === "/alarms" && alarmBadge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full text-[9px] flex items-center justify-center text-white font-medium">
                  {alarmBadge > 99 ? "99+" : alarmBadge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-[10px] text-muted">
                {user.username}
                <span className="ml-1 px-1 py-0.5 rounded bg-accent/10 text-accent text-[9px]">
                  {user.role === "admin" ? "管理员" : user.role === "operator" ? "操作员" : "查看者"}
                </span>
              </span>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="p-1 rounded hover:bg-white/5 text-muted hover:text-text transition-colors"
                title="退出"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="text-xs text-muted hover:text-text transition-colors"
            >
              登录
            </button>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/device/:id" element={<ProtectedRoute><DeviceDetail /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/alarms" element={<ProtectedRoute><AlarmsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}
