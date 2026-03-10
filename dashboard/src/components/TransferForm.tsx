import { useState } from "react";
import { transferL2, type Participant } from "../api";
import { lovelaceToAda } from "../utils";

interface Props {
  headId: string;
  participants: Participant[];
}

export default function TransferForm({ headId, participants }: Props) {
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(participants.length > 1 ? 1 : 0);
  const [lovelace, setLovelace] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(lovelace, 10);
    if (!amount || amount <= 0) return;

    setSubmitting(true);
    setResult(null);

    try {
      const resp = await transferL2(headId, { from, to, lovelace: amount });
      setResult({
        ok: true,
        message: `Transferred ${lovelaceToAda(resp.lovelace, 2)} ADA (fee: ${lovelaceToAda(resp.fee, 4)} ADA)`,
      });
      setLovelace("");
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Transfer failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const adaPreview = lovelace ? lovelaceToAda(parseInt(lovelace, 10)) : "0";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <select
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {participants.map((p) => (
              <option key={p.slot_index} value={p.slot_index}>
                Participant {p.slot_index}{p.cardano_address ? ` (${p.cardano_address.slice(0, 16)}...)` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <select
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {participants.map((p) => (
              <option key={p.slot_index} value={p.slot_index}>
                Participant {p.slot_index}{p.cardano_address ? ` (${p.cardano_address.slice(0, 16)}...)` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">
          Amount (lovelace) &mdash; <span className="text-indigo-400">{adaPreview} ADA</span>
        </label>
        <input
          type="number"
          min="1"
          value={lovelace}
          onChange={(e) => setLovelace(e.target.value)}
          placeholder="e.g. 5000000 (5 ADA)"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !lovelace || from === to}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
        >
          {submitting ? "Transferring..." : "Transfer"}
        </button>
        {from === to && lovelace && (
          <span className="text-xs text-amber-400">Sender and receiver must be different</span>
        )}
        {result && (
          <span className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
