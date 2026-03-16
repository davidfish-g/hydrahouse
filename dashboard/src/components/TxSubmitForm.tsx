import { useState } from "react";
import { submitTx } from "../api";

interface Props {
  headId: string;
  isOpen: boolean;
}

export default function TxSubmitForm({ headId, isOpen }: Props) {
  const [cborHex, setCborHex] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

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
      <p className="text-sm text-gray-400 italic">
        Transaction submission is only available when the head is open.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="cborHex" className="block text-xs font-medium text-gray-500 mb-1">
          Signed Transaction (CBOR hex)
        </label>
        <textarea
          id="cborHex"
          value={cborHex}
          onChange={(e) => setCborHex(e.target.value)}
          placeholder="84a400..."
          rows={3}
          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !cborHex.trim()}
          className="px-4 py-1.5 bg-primary hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm rounded-lg transition-colors"
        >
          {submitting ? "Submitting..." : "Submit Transaction"}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
