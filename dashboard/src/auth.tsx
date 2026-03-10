import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface AuthContextValue {
  email: string | null;
  login: (email: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(() =>
    localStorage.getItem("hh_email"),
  );

  const login = useCallback((email: string) => {
    localStorage.setItem("hh_email", email);
    setEmail(email);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hh_email");
    setEmail(null);
    // Fire-and-forget server-side session cleanup
    const BASE_URL = import.meta.env.VITE_API_URL ?? "";
    fetch(`${BASE_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{ email, login, logout, isAuthenticated: !!email }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
