import { useState } from "react";
import { createHead } from "../api";

interface Props {
  onClose: () => void;
  onCreated: (headId: string) => void;
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
        className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4"
      >
        <h2 className="text-lg font-semibold text-slate-100">
          Create New Head
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Network
          </label>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="preprod">Preprod</option>
            <option value="preview">Preview</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Participants
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={participants}
            onChange={(e) => setParticipants(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Contestation Period (seconds)
          </label>
          <input
            type="number"
            min={1}
            value={contestation}
            onChange={(e) => setContestation(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
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
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "Creating..." : "Create Head"}
          </button>
        </div>
      </form>
    </div>
  );
}
