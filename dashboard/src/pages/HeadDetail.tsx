import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getHead, closeHead, abortHead, deposit, decommit, type HeadDetail as HeadDetailType } from "../api";
import { lovelaceToAda } from "../utils";
import StatusBadge from "../components/StatusBadge";
import LifecycleBar from "../components/LifecycleBar";
import ParticipantCard from "../components/ParticipantCard";
import UtxoViewer from "../components/UtxoViewer";
import EventHistory from "../components/EventHistory";
import TxSubmitForm from "../components/TxSubmitForm";
import TransferForm from "../components/TransferForm";

export default function HeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [head, setHead] = useState<HeadDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHead = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getHead(id);
      setHead(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch head");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchHead();
    const interval = setInterval(fetchHead, 3000);
    return () => clearInterval(interval);
  }, [fetchHead]);

  async function handleClose() {
    if (!id || !confirm("Close this head? This will initiate the contestation period.")) return;
    setActionLoading(true);
    try {
      await closeHead(id);
      fetchHead();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAbort() {
    if (!id || !confirm("Abort this head? Resources will be torn down.")) return;
    setActionLoading(true);
    try {
      await abortHead(id);
      fetchHead();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to abort");
    } finally {
      setActionLoading(false);
    }
  }



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!head) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error || "Head not found"}</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Back to heads
        </button>
      </div>
    );
  }

  const canClose = head.status === "open";
  const canAbort = ["provisioning", "initializing", "committing", "open"].includes(head.status);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate("/")}
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        &larr; All heads
      </button>

      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-slate-100">
                Head
              </h2>
              <StatusBadge status={head.status} />
            </div>
            <p className="text-xs font-mono text-slate-500">{head.head_id}</p>
          </div>
          <div className="flex gap-2">
            {canClose && (
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Close Head
              </button>
            )}
            {canAbort && (
              <button
                onClick={handleAbort}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Abort
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Network</span>
            <p className="text-slate-200 capitalize">{head.network}</p>
          </div>
          <div>
            <span className="text-slate-500">Participants</span>
            <p className="text-slate-200">{head.participant_count}</p>
          </div>
          <div>
            <span className="text-slate-500">Contestation</span>
            <p className="text-slate-200">{head.config.contestation_period_secs}s</p>
          </div>
          <div>
            <span className="text-slate-500">Created</span>
            <p className="text-slate-200">
              {new Date(head.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Lifecycle bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Lifecycle</h3>
        <LifecycleBar status={head.status} />
      </div>

      {/* Participants */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-3">
          Participants
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {head.participants.map((p) => (
            <ParticipantCard key={p.id} p={p} />
          ))}
        </div>
      </div>

      {/* Deposit funds into open head */}
      {head.status === "open" && (
        <DepositSection headId={head.head_id} participants={head.participants} />
      )}

      {/* Withdraw (L2 → L1) */}
      {head.status === "open" && (
        <WithdrawSection headId={head.head_id} participants={head.participants} />
      )}

      {/* L2 Transfer */}
      {head.status === "open" && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">
            L2 Transfer
          </h3>
          <TransferForm headId={head.head_id} participants={head.participants} />
        </div>
      )}

      {/* L2 UTxO Snapshot */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">
          L2 UTxO Snapshot
        </h3>
        <UtxoViewer headId={head.head_id} isOpen={head.status === "open"} />
      </div>

      {/* Submit Transaction (raw CBOR) */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">
          Submit Raw L2 Transaction
        </h3>
        <TxSubmitForm headId={head.head_id} isOpen={head.status === "open"} />
      </div>

      {/* Event History */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">
          Event History
        </h3>
        <EventHistory headId={head.head_id} />
      </div>

      {/* WebSocket URL */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-2">
          WebSocket URL
        </h3>
        <code className="text-xs text-indigo-300 font-mono break-all">
          {head.ws_url}
        </code>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

function DepositSection({ headId, participants }: { headId: string; participants: { id: string; slot_index: number; cardano_address: string | null }[] }) {
  const [slot, setSlot] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const resp = await deposit(headId, { slot });
      setResult(`Deposited ${lovelaceToAda(resp.lovelace, 2)} ADA (tx: ${resp.tx_id})`);
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedAddr = participants.find((p) => p.slot_index === slot)?.cardano_address;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Deposit Funds (L1 → L2)</h3>
      <p className="text-xs text-slate-500 mb-3">
        Send ADA to a participant's Cardano address, then click Deposit to move those funds into the L2 head.
      </p>
      <form onSubmit={handleDeposit} className="space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Participant</label>
          <select
            value={slot}
            onChange={(e) => setSlot(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100"
          >
            {participants.map((p) => (
              <option key={p.id} value={p.slot_index}>
                Slot {p.slot_index} — {p.cardano_address?.slice(0, 20) ?? "no address"}...
              </option>
            ))}
          </select>
        </div>
        {selectedAddr && (
          <div className="text-xs text-slate-500 font-mono break-all bg-slate-900 p-2 rounded">
            {selectedAddr}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Depositing..." : "Deposit"}
        </button>
        {result && <p className="text-sm text-emerald-400">{result}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}
      </form>
    </div>
  );
}

function WithdrawSection({ headId, participants }: { headId: string; participants: { id: string; slot_index: number; cardano_address: string | null }[] }) {
  const [slot, setSlot] = useState(0);
  const [lovelace, setLovelace] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(lovelace, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setErr("Enter a positive lovelace amount");
      return;
    }
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const resp = await decommit(headId, { slot, lovelace: amount });
      setResult(`Withdrawal submitted: ${lovelaceToAda(resp.lovelace, 2)} ADA (UTxO: ${resp.utxo_ref?.slice(0, 16)}...). ${resp.message}`);
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Withdraw (L2 → L1)</h3>
      <p className="text-xs text-slate-500 mb-3">
        Decommit a UTxO from L2; funds will return to the participant&apos;s Cardano address after the protocol finalizes.
      </p>
      <form onSubmit={handleWithdraw} className="space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Participant slot</label>
          <select
            value={slot}
            onChange={(e) => setSlot(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100"
          >
            {participants.map((p) => (
              <option key={p.id} value={p.slot_index}>
                Slot {p.slot_index}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Lovelace to withdraw</label>
          <input
            type="number"
            value={lovelace}
            onChange={(e) => setLovelace(e.target.value)}
            placeholder="e.g. 5000000"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-100"
            min={1}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Withdrawing..." : "Withdraw"}
        </button>
        {result && <p className="text-sm text-emerald-400">{result}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}
      </form>
    </div>
  );
}
