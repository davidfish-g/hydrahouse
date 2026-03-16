import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listHeads, getAccount, type HeadSummary } from "../api";
import StatusBadge from "../components/StatusBadge";
import CreateHeadModal from "../components/CreateHeadModal";
import { Plus, Layers, ChevronRight } from "lucide-react";

const ACTIVE_STATUSES = ["requested", "provisioning", "initializing", "committing", "open"];

export default function HeadsList() {
  const [heads, setHeads] = useState<HeadSummary[]>([]);
  const [hasBilling, setHasBilling] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
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

  useEffect(() => {
    getAccount()
      .then((a) => setHasBilling(a.has_billing))
      .catch(() => setHasBilling(null));
  }, []);

  const activeCount = heads.filter((h) => ACTIVE_STATUSES.includes(h.status)).length;
  const canCreateHead = hasBilling === null || hasBilling || activeCount < 1;
  const thisMonth = heads.filter((h) => {
    const d = new Date(h.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  function handleNewHeadClick() {
    if (!canCreateHead && activeCount >= 1) {
      setShowUpgradePrompt(true);
      return;
    }
    setShowCreate(true);
  }

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
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-semibold text-gray-900">Heads</h2>
        <button
          onClick={handleNewHeadClick}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Head
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">Manage your Hydra head instances</p>

      {/* Stats */}
      {!loading && heads.length > 0 && (
        <div className="flex items-center gap-4 mb-6 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-gray-600">{activeCount} active</span>
          </span>
          <span className="text-gray-400">{heads.length} total</span>
          <span className="text-gray-400">{thisMonth} this month</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : heads.length === 0 ? (
        <div className="text-center py-20">
          <Layers size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No heads yet</p>
          <button
            onClick={handleNewHeadClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create your first head
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Head ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Network</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Participants</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {heads.map((h) => (
                <tr
                  key={h.head_id}
                  onClick={() => navigate(`/heads/${h.head_id}`)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {h.head_id.slice(0, 12)}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 capitalize">
                    {h.network}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {h.participant_count}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(h.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={16} className="text-gray-300" />
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

      {showUpgradePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <p className="text-gray-700 mb-4">
              Free plan is limited to 1 concurrent head. Upgrade in Billing to open more heads.
            </p>
            <div className="flex gap-3">
              <Link
                to="/billing"
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg text-center"
              >
                Go to Billing
              </Link>
              <button
                onClick={() => setShowUpgradePrompt(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
