import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface AuthContextValue {
  apiKey: string | null;
  login: (key: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(() =>
    localStorage.getItem("hh_api_key"),
  );

  const login = useCallback((key: string) => {
    localStorage.setItem("hh_api_key", key);
    setApiKey(key);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hh_api_key");
    setApiKey(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ apiKey, login, logout, isAuthenticated: !!apiKey }}
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
