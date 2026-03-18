import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface AuthContextValue {
  email: string | null;
  displayName: string | null;
  login: (email: string, displayName?: string) => void;
  setDisplayName: (name: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(() =>
    localStorage.getItem("hh_email"),
  );
  const [displayName, setDisplayNameState] = useState<string | null>(() =>
    localStorage.getItem("hh_display_name"),
  );

  const login = useCallback((email: string, name?: string) => {
    localStorage.setItem("hh_email", email);
    setEmail(email);
    const dn = name || email;
    localStorage.setItem("hh_display_name", dn);
    setDisplayNameState(dn);
  }, []);

  const setDisplayName = useCallback((name: string) => {
    localStorage.setItem("hh_display_name", name);
    setDisplayNameState(name);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hh_email");
    localStorage.removeItem("hh_display_name");
    setEmail(null);
    setDisplayNameState(null);
    // Fire-and-forget server-side session cleanup
    const BASE_URL = import.meta.env.VITE_API_URL ?? "";
    fetch(`${BASE_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{ email, displayName, login, setDisplayName, logout, isAuthenticated: !!email }}
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
