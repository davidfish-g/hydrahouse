import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
  const { apiKey, logout } = useAuth();
  const truncatedKey = apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : "";

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-tight text-indigo-400">
            HydraHouse
          </h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`
            }
          >
            Heads
          </NavLink>
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={logout}
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
            <span className="text-xs font-mono text-slate-500">
              {truncatedKey}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
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
