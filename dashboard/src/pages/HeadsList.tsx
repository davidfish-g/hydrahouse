import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listHeads, type HeadSummary } from "../api";
import StatusBadge from "../components/StatusBadge";
import CreateHeadModal from "../components/CreateHeadModal";

export default function HeadsList() {
  const [heads, setHeads] = useState<HeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const fetchHeads = useCallback(async () => {
    try {
      const data = await listHeads();
      setHeads(data.heads);
    } catch {
      /* handled by api.ts redirect */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeads();
    const interval = setInterval(fetchHeads, 5000);
    return () => clearInterval(interval);
  }, [fetchHeads]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Heads</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Head
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : heads.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">No heads yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create your first head
          </button>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Head ID</th>
                <th className="px-4 py-3 font-medium">Network</th>
                <th className="px-4 py-3 font-medium">Participants</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {heads.map((h) => (
                <tr
                  key={h.head_id}
                  onClick={() => navigate(`/heads/${h.head_id}`)}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {h.head_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-slate-300 capitalize">
                    {h.network}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {h.participant_count}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDate(h.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateHeadModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            navigate(`/heads/${id}`);
          }}
        />
      )}
    </div>
  );
}
