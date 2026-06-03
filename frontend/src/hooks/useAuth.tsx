import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface UserInfo {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "mmd_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.token || null;
      } catch { /* ignore */ }
    }
    return null;
  });

  const [user, setUser] = useState<UserInfo | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.user || null;
      } catch { /* ignore */ }
    }
    return null;
  });

  const save = useCallback((t: string | null, u: UserInfo | null) => {
    setToken(t);
    setUser(u);
    if (t && u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: u }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    save(data.token, data.user);
  }, [save]);

  const register = useCallback(async (username: string, password: string, role: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Registration failed");
    }
    const data = await res.json();
    save(data.token, data.user);
  }, [save]);

  const logout = useCallback(() => {
    save(null, null);
  }, [save]);

  return (
    <AuthContext.Provider value={{
      token, user, login, register, logout,
      isAuthenticated: !!token && !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
