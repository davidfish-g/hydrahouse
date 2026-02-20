import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { validateApiKey } from "../api";

export default function Login() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed.startsWith("hh_sk_")) {
      setError("API key must start with hh_sk_");
      return;
    }

    setLoading(true);
    setError("");

    localStorage.setItem("hh_api_key", trimmed);
    const valid = await validateApiKey();

    if (valid) {
      login(trimmed);
      navigate("/", { replace: true });
    } else {
      localStorage.removeItem("hh_api_key");
      setError("Invalid API key");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-400 mb-2">
            HydraHouse
          </h1>
          <p className="text-slate-400 text-sm">
            Managed Hydra Head orchestration
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="api-key"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              placeholder="hh_sk_..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "Validating..." : "Sign in"}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Don't have a key?{" "}
            <code className="text-slate-400">
              curl -X POST /v1/accounts -d '{"{}"}'
            </code>
          </p>
        </form>
      </div>
    </div>
  );
}
