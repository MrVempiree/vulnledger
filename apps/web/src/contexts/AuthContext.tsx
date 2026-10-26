import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api";

export interface User {
  id: string;
  email: string;
  role: "admin" | "member";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/session")
      .then((data: any) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {
        // No session — unauthenticated, not an error
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post("/auth/login", { email, password });
    setUser(data.user);
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  };

  const isAuthenticated = () => !!user;
  const isAdmin = () => user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
