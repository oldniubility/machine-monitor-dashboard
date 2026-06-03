import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Monitor, LogIn } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in
  if (isAuthenticated) {
    const from = (location.state as { from?: string })?.from || "/";
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      const from = (location.state as { from?: string })?.from || "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Monitor size={36} className="text-accent mx-auto mb-2" />
          <h1 className="text-lg font-semibold">机床监控看板</h1>
          <p className="text-xs text-muted mt-1">请登录以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-alt border border-border rounded-lg p-6">
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 text-xs text-danger mb-4">
              {error}
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs text-muted mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent/30"
              placeholder="admin"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-muted mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent/30"
              placeholder="••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white rounded py-2 text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <LogIn size={14} />
            {loading ? "登录中…" : "登 录"}
          </button>

          <p className="text-[10px] text-muted text-center mt-4">
            演示账号：admin / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
