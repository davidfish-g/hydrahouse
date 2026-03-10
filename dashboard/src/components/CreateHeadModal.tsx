import { useState } from "react";
import { createHead } from "../api";

interface Props {
  onClose: () => void;
  onCreated: (headId: string) => void;
}

const networks = [
  {
    id: "preview",
    label: "Preview",
    desc: "Bleeding edge testnet",
    color: "purple",
  },
  {
    id: "preprod",
    label: "Preprod",
    desc: "Stable testnet",
    color: "indigo",
  },
  {
    id: "mainnet",
    label: "Mainnet",
    desc: "Production network",
    color: "emerald",
  },
] as const;

const networkStyles: Record<string, { selected: string; ring: string; dot: string }> = {
  purple: {
    selected: "border-purple-500 bg-purple-500/10",
    ring: "ring-purple-500",
    dot: "bg-purple-400",
  },
  indigo: {
    selected: "border-indigo-500 bg-indigo-500/10",
    ring: "ring-indigo-500",
    dot: "bg-indigo-400",
  },
  emerald: {
    selected: "border-emerald-500 bg-emerald-500/10",
    ring: "ring-emerald-500",
    dot: "bg-emerald-400",
  },
};

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg space-y-6"
      >
        <h2 className="text-lg font-semibold text-slate-100">
          Create New Head
        </h2>

        {/* Network selector — cards */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Network
          </label>
          <div className="grid grid-cols-3 gap-3">
            {networks.map((n) => {
              const active = network === n.id;
              const styles = networkStyles[n.color];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNetwork(n.id)}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    active
                      ? `${styles.selected} ring-1 ${styles.ring}`
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        active ? styles.dot : "bg-slate-600"
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold ${
                        active ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {n.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{n.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Participants — segmented control */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-sm font-medium text-slate-300">
              Participants
            </label>
            <span className="text-xs text-slate-500">
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
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : participants > n
                      ? "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
                      : "bg-slate-900 text-slate-500 hover:text-slate-400 hover:bg-slate-700"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Contestation period — presets + slider */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-sm font-medium text-slate-300">
              Contestation Period
            </label>
            <span className="text-sm font-mono text-indigo-400">
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
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
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
            className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-indigo-500/30"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>30s</span>
            <span>2h</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "Creating..." : "Create Head"}
          </button>
        </div>
      </form>
    </div>
  );
}
