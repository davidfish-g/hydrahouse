import { useState, useEffect } from "react";
import { listApiKeys, createApiKey, deleteApiKey, type ApiKeyInfo } from "../api";
import { Plus, Shield, Clipboard, Check } from "lucide-react";

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">API Keys</h2>
        <p className="text-sm text-gray-500 mt-1">Create and manage your API keys for programmatic access</p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. production)"
          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* New key display */}
      {newKey && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-emerald-600" />
            <p className="text-sm text-emerald-700 font-medium">
              Copy your API key now. You won't be able to see it again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-emerald-100 rounded-lg text-sm text-emerald-800 font-mono break-all">
              {newKey}
            </code>
            <button
              onClick={() => copyToClipboard(newKey)}
              className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-sm rounded-lg transition-colors shrink-0"
            >
              {copied ? <Check size={16} className="text-emerald-500" /> : <Clipboard size={16} className="text-gray-500" />}
            </button>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Key ID</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Used</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-gray-100 last:border-0 text-gray-700">
                <td className="px-4 py-3 font-medium">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  ...{k.key_prefix}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {k.last_used_at
                    ? new Date(k.last_used_at).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  {confirmDelete === k.id ? (
                    <span className="space-x-2">
                      <button
                        onClick={() => handleDelete(k.id)}
                        className="text-red-600 hover:text-red-700 text-xs font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(k.id)}
                      className="text-gray-400 hover:text-red-600 text-xs transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
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
