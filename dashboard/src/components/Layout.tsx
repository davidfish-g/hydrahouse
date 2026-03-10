import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

const docLinks = [
  { to: "/docs", label: "Quick Start", end: true },
  { to: "/docs/concepts", label: "Concepts" },
  { to: "/docs/sdk", label: "SDK Guide" },
  { to: "/docs/api", label: "API Reference" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? "bg-indigo-600/20 text-indigo-300"
      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <Link to="/" className="text-lg font-bold tracking-tight text-indigo-400">
            HydraHouse
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLink to="/heads" end className={navClass}>
            Heads
          </NavLink>
          <NavLink to="/keys" className={navClass}>
            API Keys
          </NavLink>
          <NavLink to="/billing" className={navClass}>
            Billing
          </NavLink>

          {/* Docs collapsible section */}
          <button
            onClick={() => setDocsOpen(!docsOpen)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDocsPage
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            Docs
            <svg
              className={`w-4 h-4 transition-transform ${docsOpen ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {docsOpen && (
            <div className="ml-3 space-y-0.5">
              {docLinks.map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} className={navClass}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={() => { logout(); window.location.href = "/"; }}
            className="w-full px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-slate-700 bg-slate-800/50 flex items-center px-6 justify-between">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {email}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`}
              title={connected ? "Connected" : "Disconnected"}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
