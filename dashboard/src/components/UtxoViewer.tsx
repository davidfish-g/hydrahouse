import { useState, useEffect, useCallback } from "react";
import { getSnapshot } from "../api";
import { lovelaceToAda } from "../utils";

interface Props {
  headId: string;
  isOpen: boolean;
}

export default function UtxoViewer({ headId, isOpen }: Props) {
  const [utxo, setUtxo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchUtxo = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const data = await getSnapshot(headId);
      setUtxo(data.utxo);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch snapshot");
    } finally {
      setLoading(false);
    }
  }, [headId, isOpen]);

  useEffect(() => {
    fetchUtxo();
  }, [fetchUtxo]);

  if (!isOpen) {
    return (
      <div className="text-sm text-slate-500 italic">
        UTxO snapshot is only available when the head is open.
      </div>
    );
  }

  const entries = utxo ? Object.entries(utxo) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {entries.length} UTxO{entries.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={fetchUtxo}
          disabled={loading}
          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-slate-600"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {entries.length === 0 && !error && (
        <p className="text-sm text-slate-500 italic">No UTxOs in head yet.</p>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {entries.map(([ref, output]) => {
          const out = output as Record<string, unknown>;
          const value = out.value as Record<string, unknown> | undefined;
          const lovelace = value?.lovelace as number | undefined;

          return (
            <div
              key={ref}
              className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs"
            >
              <p className="font-mono text-slate-400 break-all mb-1">{ref}</p>
              <div className="flex gap-4">
                {out.address != null && (
                  <span className="text-slate-500">
                    addr:{" "}
                    <span className="text-slate-300 font-mono">
                      {(out.address as string).slice(0, 20)}...
                    </span>
                  </span>
                )}
                {lovelace !== undefined && (
                  <span className="text-emerald-400">
                    {lovelaceToAda(lovelace)} ADA
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
