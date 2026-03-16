import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { Layers, Key, CreditCard, BookOpen, ChevronRight, LogOut } from "lucide-react";

const docLinks = [
  { to: "/docs", label: "Quick Start", end: true },
  { to: "/docs/concepts", label: "Concepts" },
  { to: "/docs/sdk", label: "SDK Guide" },
  { to: "/docs/api", label: "API Reference" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
    isActive
      ? "text-gray-900 font-semibold border-l-2 border-primary -ml-px"
      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
  }`;
}


export default function Layout() {
  const { email, logout } = useAuth();
  const location = useLocation();
  const isDocsPage = location.pathname.startsWith("/docs");
  const [docsOpen, setDocsOpen] = useState(isDocsPage);
  const [connected, setConnected] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const base = import.meta.env.VITE_API_URL ?? "";
        const res = await fetch(`${base}/healthz`, { method: "GET" });
        setConnected(res.ok);
      } catch {
        setConnected(false);
      }
    };
    checkHealth();
    intervalRef.current = setInterval(checkHealth, 30_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const initial = email ? email.charAt(0).toUpperCase() : "?";

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L28.66 9.5V24.5L16 32L3.34 24.5V9.5L16 2Z" fill="#0A6E5C" opacity="0.1" stroke="#0A6E5C" strokeWidth="1.5"/>
              <text x="16" y="21" textAnchor="middle" fill="#0A6E5C" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">H</text>
            </svg>
            <span className="text-base font-semibold text-gray-900 tracking-tight">HydraHouse</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLink to="/heads" end className={navClass}>
            <Layers size={18} />
            Heads
          </NavLink>
          <NavLink to="/keys" className={navClass}>
            <Key size={18} />
            API Keys
          </NavLink>
          <NavLink to="/billing" className={navClass}>
            <CreditCard size={18} />
            Billing
          </NavLink>

          <button
            onClick={() => setDocsOpen(!docsOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDocsPage
                ? "text-gray-900 font-semibold"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <BookOpen size={18} />
            Docs
            <ChevronRight
              size={14}
              className={`ml-auto transition-transform ${docsOpen ? "rotate-90" : ""}`}
            />
          </button>
          {docsOpen && (
            <div className="ml-8 space-y-0.5">
              {docLinks.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `block px-3 py-1.5 text-sm transition-colors rounded-lg ${
                      isActive
                        ? "text-gray-900 font-semibold"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 truncate">{email}</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="text-[11px] text-gray-400">{connected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => { logout(); window.location.href = "/"; }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
