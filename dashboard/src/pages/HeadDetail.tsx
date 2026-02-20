import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getHead, closeHead, abortHead, type HeadDetail as HeadDetailType } from "../api";
import StatusBadge from "../components/StatusBadge";
import LifecycleBar from "../components/LifecycleBar";
import ParticipantCard from "../components/ParticipantCard";

export default function HeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [head, setHead] = useState<HeadDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHead = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getHead(id);
      setHead(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch head");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchHead();
    const interval = setInterval(fetchHead, 3000);
    return () => clearInterval(interval);
  }, [fetchHead]);

  async function handleClose() {
    if (!id || !confirm("Close this head? This will initiate the contestation period.")) return;
    setActionLoading(true);
    try {
      await closeHead(id);
      fetchHead();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAbort() {
    if (!id || !confirm("Abort this head? Resources will be torn down.")) return;
    setActionLoading(true);
    try {
      await abortHead(id);
      fetchHead();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to abort");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!head) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error || "Head not found"}</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Back to heads
        </button>
      </div>
    );
  }

  const canClose = head.status === "open";
  const canAbort = ["provisioning", "initializing", "committing", "open"].includes(head.status);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate("/")}
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        &larr; All heads
      </button>

      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-slate-100">
                Head
              </h2>
              <StatusBadge status={head.status} />
            </div>
            <p className="text-xs font-mono text-slate-500">{head.head_id}</p>
          </div>
          <div className="flex gap-2">
            {canClose && (
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Close Head
              </button>
            )}
            {canAbort && (
              <button
                onClick={handleAbort}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Abort
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Network</span>
            <p className="text-slate-200 capitalize">{head.network}</p>
          </div>
          <div>
            <span className="text-slate-500">Participants</span>
            <p className="text-slate-200">{head.participant_count}</p>
          </div>
          <div>
            <span className="text-slate-500">Contestation</span>
            <p className="text-slate-200">{head.config.contestation_period_secs}s</p>
          </div>
          <div>
            <span className="text-slate-500">Created</span>
            <p className="text-slate-200">
              {new Date(head.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Lifecycle bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Lifecycle</h3>
        <LifecycleBar status={head.status} />
      </div>

      {/* Participants */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-3">
          Participants
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {head.participants.map((p) => (
            <ParticipantCard key={p.id} p={p} />
          ))}
        </div>
      </div>

      {/* WebSocket URL */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-2">
          WebSocket URL
        </h3>
        <code className="text-xs text-indigo-300 font-mono break-all">
          {head.ws_url}
        </code>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
