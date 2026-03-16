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
import ConfirmModal from "../components/ConfirmModal";
import { ArrowLeft, Clipboard, Check } from "lucide-react";

export default function HeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [head, setHead] = useState<HeadDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<"close" | "abort" | null>(null);
  const [wsCopied, setWsCopied] = useState(false);

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
    if (!id) return;
    setConfirmAction(null);
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
    if (!id) return;
    setConfirmAction(null);
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
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!head) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "Head not found"}</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-primary hover:text-primary-hover"
        >
          Back to heads
        </button>
      </div>
    );
  }

  const canClose = head.status === "open";
  const canAbort = ["provisioning", "initializing", "committing", "open"].includes(head.status);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={14} />
        All heads
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <StatusBadge status={head.status} />
            </div>
            <p className="text-xs font-mono text-gray-500 mt-1">{head.head_id}</p>
          </div>
          <div className="flex gap-2">
            {canClose && (
              <button
                onClick={() => setConfirmAction("close")}
                disabled={actionLoading}
                className="px-3 py-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 text-sm rounded-lg transition-colors"
              >
                Close Head
              </button>
            )}
            {canAbort && (
              <button
                onClick={() => setConfirmAction("abort")}
                disabled={actionLoading}
                className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm rounded-lg transition-colors"
              >
                Abort
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Network</span>
            <p className="text-gray-900 capitalize mt-0.5">{head.network}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Participants</span>
            <p className="text-gray-900 mt-0.5">{head.participant_count}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Contestation</span>
            <p className="text-gray-900 mt-0.5">{head.config.contestation_period_secs}s</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Created</span>
            <p className="text-gray-900 mt-0.5">
              {new Date(head.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Lifecycle bar */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Lifecycle</h3>
        <LifecycleBar status={head.status} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column (60%) */}
        <div className="lg:col-span-3 space-y-6">
          {/* L2 UTxO Snapshot */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              L2 UTxO Snapshot
            </h3>
            <UtxoViewer headId={head.head_id} isOpen={head.status === "open"} />
          </div>

          {/* Event History */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Event History
            </h3>
            <EventHistory headId={head.head_id} />
          </div>

          {/* Submit Transaction */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Submit Raw L2 Transaction
            </h3>
            <TxSubmitForm headId={head.head_id} isOpen={head.status === "open"} />
          </div>
        </div>

        {/* Right column (40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Participants */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Participants
            </h3>
            {head.participants.map((p) => (
              <ParticipantCard key={p.id} p={p} />
            ))}
          </div>

          {/* Deposit */}
          {head.status === "open" && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <DepositSection headId={head.head_id} participants={head.participants} />
            </div>
          )}

          {/* Withdraw */}
          {head.status === "open" && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <WithdrawSection headId={head.head_id} participants={head.participants} />
            </div>
          )}

          {/* L2 Transfer */}
          {head.status === "open" && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                L2 Transfer
              </h3>
              <TransferForm headId={head.head_id} participants={head.participants} />
            </div>
          )}
        </div>
      </div>

      {/* WebSocket URL */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          WebSocket URL
        </h3>
        <div className="flex items-center gap-2">
          <code className="text-xs text-primary font-mono break-all flex-1">
            {head.ws_url}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(head.ws_url);
              setWsCopied(true);
              setTimeout(() => setWsCopied(false), 1500);
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {wsCopied ? <Check size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ConfirmModal
        open={confirmAction === "close"}
        title="Close Head"
        message="This will initiate the contestation period. Are you sure you want to close this head?"
        confirmLabel="Close Head"
        destructive={false}
        onConfirm={handleClose}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmModal
        open={confirmAction === "abort"}
        title="Abort Head"
        message="Resources will be torn down and this action cannot be undone. Are you sure?"
        confirmLabel="Abort"
        onConfirm={handleAbort}
        onCancel={() => setConfirmAction(null)}
      />
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
    <>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deposit Funds (L1 → L2)</h3>
      <p className="text-xs text-gray-400 mb-3">
        Send ADA to a participant's Cardano address, then click Deposit to move those funds into the L2 head.
      </p>
      <form onSubmit={handleDeposit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Participant</label>
          <select
            value={slot}
            onChange={(e) => setSlot(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {participants.map((p) => (
              <option key={p.id} value={p.slot_index}>
                Slot {p.slot_index} — {p.cardano_address?.slice(0, 20) ?? "no address"}...
              </option>
            ))}
          </select>
        </div>
        {selectedAddr && (
          <div className="text-xs text-gray-500 font-mono break-all bg-gray-50 p-2 rounded-lg border border-gray-100">
            {selectedAddr}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-gray-200 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Depositing..." : "Deposit"}
        </button>
        {result && <p className="text-sm text-emerald-600">{result}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </>
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
    <>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Withdraw (L2 → L1)</h3>
      <p className="text-xs text-gray-400 mb-3">
        Decommit a UTxO from L2; funds will return to the participant&apos;s Cardano address after the protocol finalizes.
      </p>
      <form onSubmit={handleWithdraw} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Participant slot</label>
          <select
            value={slot}
            onChange={(e) => setSlot(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {participants.map((p) => (
              <option key={p.id} value={p.slot_index}>
                Slot {p.slot_index}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Lovelace to withdraw</label>
          <input
            type="number"
            value={lovelace}
            onChange={(e) => setLovelace(e.target.value)}
            placeholder="e.g. 5000000"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            min={1}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Withdrawing..." : "Withdraw"}
        </button>
        {result && <p className="text-sm text-emerald-600">{result}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </>
  );
}
