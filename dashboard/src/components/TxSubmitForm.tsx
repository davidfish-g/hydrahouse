import { useState } from "react";
import { submitTx } from "../api";

interface Props {
  headId: string;
  isOpen: boolean;
}

export default function TxSubmitForm({ headId, isOpen }: Props) {
  const [cborHex, setCborHex] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cborHex.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const resp = await submitTx(headId, cborHex.trim());
      setResult({ ok: true, message: `Transaction ${resp.status}` });
      setCborHex("");
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Submission failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <p className="text-sm text-slate-500 italic">
        Transaction submission is only available when the head is open.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="cborHex"
          className="block text-xs text-slate-500 mb-1"
        >
          Signed Transaction (CBOR hex)
        </label>
        <textarea
          id="cborHex"
          value={cborHex}
          onChange={(e) => setCborHex(e.target.value)}
          placeholder="84a400..."
          rows={3}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !cborHex.trim()}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
        >
          {submitting ? "Submitting..." : "Submit Transaction"}
        </button>
        {result && (
          <span
            className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}
          >
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
