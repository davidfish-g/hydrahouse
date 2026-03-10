import { useState, useEffect } from "react";
import { listApiKeys, createApiKey, deleteApiKey, type ApiKeyInfo } from "../api";

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    try {
      const res = await listApiKeys();
      setKeys(res.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNewKey(null);
    try {
      const res = await createApiKey(name.trim());
      setNewKey(res.api_key);
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    }
  }

  async function handleDelete(id: string) {
    setError("");
    try {
      await deleteApiKey(id);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (loading) return <p className="text-slate-400">Loading...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">API Keys</h2>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. production)"
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Create
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* New key display */}
      {newKey && (
        <div className="p-4 bg-emerald-900/30 border border-emerald-700 rounded-lg space-y-2">
          <p className="text-sm text-emerald-300 font-medium">
            Copy your API key now. You won't be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-sm text-emerald-200 font-mono break-all">
              {newKey}
            </code>
            <button
              onClick={() => copyToClipboard(newKey)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 rounded-lg transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50">
            <tr className="text-left text-slate-400">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Key ID</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Last Used</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {keys.map((k) => (
              <tr key={k.id} className="text-slate-300">
                <td className="px-4 py-3">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                  ...{k.key_prefix}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {k.last_used_at
                    ? new Date(k.last_used_at).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  {confirmDelete === k.id ? (
                    <span className="space-x-2">
                      <button
                        onClick={() => handleDelete(k.id)}
                        className="text-red-400 hover:text-red-300 text-xs font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-slate-500 hover:text-slate-300 text-xs"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(k.id)}
                      className="text-slate-500 hover:text-red-400 text-xs transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No API keys yet. Create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
