import { useState, useEffect, useCallback } from "react";
import { getHeadEvents, type HeadEvent } from "../api";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  headId: string;
}

const EVENT_COLORS: Record<string, string> = {
  head_requested: "bg-gray-400",
  head_provisioned: "bg-blue-500",
  head_initializing: "bg-amber-500",
  participant_committed: "bg-amber-500",
  head_opened: "bg-emerald-500",
  head_close_requested: "bg-orange-500",
  head_closed: "bg-orange-500",
  head_finalized: "bg-primary",
  head_aborted: "bg-red-500",
  head_aborted_by_protocol: "bg-red-500",
  provisioning_failed: "bg-red-500",
  tx_submitted: "bg-cyan-500",
  SnapshotConfirmed: "bg-emerald-500",
  TxValid: "bg-emerald-500",
  TxInvalid: "bg-red-500",
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
      // silently fail
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
    return <p className="text-xs text-gray-400">Loading events...</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-gray-400 italic">No events yet.</p>;
  }

  return (
    <div className="relative max-h-80 overflow-y-auto">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />

      <div className="space-y-1">
        {events.map((e) => (
          <div key={e.id}>
            <button
              onClick={() => setExpanded(expanded === e.id ? null : e.id)}
              className="w-full flex items-center gap-3 px-0 py-1.5 hover:bg-gray-50 rounded transition-colors text-left relative"
            >
              <span
                className={`w-[15px] h-[15px] rounded-full flex-shrink-0 border-2 border-white relative z-10 ${
                  EVENT_COLORS[e.event_type] ?? "bg-gray-400"
                }`}
              />
              <span className="text-xs font-mono text-gray-700">
                {e.event_type}
              </span>
              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
            </button>
            <AnimatePresence>
              {expanded === e.id && e.payload != null && (
                <motion.pre
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 ml-6 mb-1 overflow-x-auto max-h-32"
                >
                  {JSON.stringify(e.payload, null, 2)}
                </motion.pre>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
