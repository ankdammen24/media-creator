import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiBase } from "./api";

export type AuthUser = {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  [k: string]: unknown;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "soundloom.auth";

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): AuthState {
  if (typeof window === "undefined") return { user: null, accessToken: null, refreshToken: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as AuthState;
    return {
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, refreshToken: null });

  useEffect(() => {
    setState(readStored());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = (next: AuthState) => {
    setState(next);
    if (typeof window !== "undefined") {
      if (next.accessToken) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error("Network error. Please try again.");
    }
    if (!res.ok) {
      throw new Error("Invalid email or password");
    }
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
      user?: AuthUser;
      token?: string;
    };
    const accessToken = data.accessToken ?? data.token ?? null;
    const refreshToken = data.refreshToken ?? null;
    if (!accessToken) throw new Error("Invalid email or password");
    persist({ user: data.user ?? { email }, accessToken, refreshToken });
  };

  const logout = () => {
    const token = state.accessToken;
    if (token) {
      fetch(`${apiBase()}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    persist({ user: null, accessToken: null, refreshToken: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}