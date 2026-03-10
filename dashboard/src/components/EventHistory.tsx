import { useState, useEffect, useCallback } from "react";
import { getHeadEvents, type HeadEvent } from "../api";

interface Props {
  headId: string;
}

const EVENT_COLORS: Record<string, string> = {
  head_requested: "text-slate-400",
  head_provisioned: "text-blue-400",
  head_initializing: "text-yellow-400",
  participant_committed: "text-amber-400",
  head_opened: "text-emerald-400",
  head_close_requested: "text-orange-400",
  head_closed: "text-orange-400",
  head_finalized: "text-purple-400",
  head_aborted: "text-red-400",
  head_aborted_by_protocol: "text-red-400",
  provisioning_failed: "text-red-400",
  tx_submitted: "text-cyan-400",
  SnapshotConfirmed: "text-green-400",
  TxValid: "text-green-400",
  TxInvalid: "text-red-400",
};

export default function EventHistory({ headId }: Props) {
  const [events, setEvents] = useState<HeadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await getHeadEvents(headId);
      setEvents(data.events);
    } catch {
      // silently fail — events are supplementary
    } finally {
      setLoading(false);
    }
  }, [headId]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  if (loading) {
    return <p className="text-xs text-slate-500">Loading events...</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-slate-500 italic">No events yet.</p>;
  }

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      {events.map((e) => (
        <div key={e.id} className="group">
          <button
            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700/50 transition-colors text-left"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                EVENT_COLORS[e.event_type]
                  ? EVENT_COLORS[e.event_type].replace("text-", "bg-")
                  : "bg-slate-500"
              }`}
            />
            <span
              className={`text-xs font-mono ${
                EVENT_COLORS[e.event_type] || "text-slate-400"
              }`}
            >
              {e.event_type}
            </span>
            <span className="text-xs text-slate-600 ml-auto flex-shrink-0">
              {new Date(e.created_at).toLocaleTimeString()}
            </span>
          </button>
          {expanded === e.id && e.payload != null && (
            <pre className="text-xs text-slate-500 bg-slate-900 rounded p-2 mx-2 mb-1 overflow-x-auto max-h-32">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
