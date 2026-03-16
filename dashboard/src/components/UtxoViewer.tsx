import { useState, useEffect, useCallback } from "react";
import { getSnapshot } from "../api";
import { lovelaceToAda } from "../utils";
import { RefreshCw } from "lucide-react";

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
      <div className="text-sm text-gray-400 italic">
        UTxO snapshot is only available when the head is open.
      </div>
    );
  }

  const entries = utxo ? Object.entries(utxo) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {entries.length} UTxO{entries.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={fetchUtxo}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover disabled:text-gray-300 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {entries.length === 0 && !error && (
        <p className="text-sm text-gray-400 italic">No UTxOs in head yet.</p>
      )}

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {entries.map(([ref, output], i) => {
          const out = output as Record<string, unknown>;
          const value = out.value as Record<string, unknown> | undefined;
          const lovelace = value?.lovelace as number | undefined;

          return (
            <div
              key={ref}
              className={`rounded-lg p-3 text-xs ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
            >
              <p className="font-mono text-gray-500 break-all mb-1">{ref}</p>
              <div className="flex gap-4 justify-between">
                {out.address != null && (
                  <span className="text-gray-400 font-mono truncate">
                    {(out.address as string).slice(0, 24)}...
                  </span>
                )}
                {lovelace !== undefined && (
                  <span className="text-primary font-semibold whitespace-nowrap">
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
