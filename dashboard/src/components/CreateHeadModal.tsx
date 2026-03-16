import { useState } from "react";
import { createHead } from "../api";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onClose: () => void;
  onCreated: (headId: string) => void;
}

const networks = [
  { id: "preview", label: "Preview", desc: "Bleeding edge testnet" },
  { id: "preprod", label: "Preprod", desc: "Stable testnet" },
  { id: "mainnet", label: "Mainnet", desc: "Production network" },
] as const;

const contestationPresets = [
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "30 min", value: 1800 },
  { label: "1 hr", value: 3600 },
];

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function CreateHeadModal({ onClose, onCreated }: Props) {
  const [network, setNetwork] = useState("preprod");
  const [participants, setParticipants] = useState(2);
  const [contestation, setContestation] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const head = await createHead({
        network,
        participants,
        config: { contestation_period_secs: contestation },
      });
      onCreated(head.head_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create head");
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 bg-black/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.form
          onSubmit={handleSubmit}
          className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-gray-900">Create New Head</h2>

          {/* Network selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Network
            </label>
            <div className="grid grid-cols-3 gap-3">
              {networks.map((n) => {
                const active = network === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNetwork(n.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      active
                        ? "border-primary bg-primary-light"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${active ? "text-primary" : "text-gray-700"}`}>
                      {n.label}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">{n.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Participants
              </label>
              <span className="text-xs text-gray-400">
                {participants} {participants === 1 ? "node" : "nodes"}
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setParticipants(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    participants === n
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Contestation period */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Contestation Period
              </label>
              <span className="text-sm font-mono text-primary">
                {formatDuration(contestation)}
              </span>
            </div>
            <div className="flex gap-2 mb-3">
              {contestationPresets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setContestation(p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    contestation === p.value
                      ? "bg-primary-light text-primary"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={30}
              max={7200}
              step={30}
              value={contestation}
              onChange={(e) => setContestation(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>30s</span>
              <span>2h</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "Creating..." : "Create Head"}
            </button>
          </div>
        </motion.form>
      </div>
    </AnimatePresence>
  );
}
