import { Box, RefreshCw, Zap, Upload, Download } from "lucide-react";

function ConceptCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center text-primary">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="text-sm text-gray-500 leading-relaxed">{children}</div>
    </div>
  );
}

export default function Concepts() {
  return (
    <div className="max-w-[720px]">
      <h1 className="text-[28px] font-bold text-gray-900 mb-2">Concepts</h1>
      <p className="text-gray-500 mb-8">
        Core ideas behind Hydra heads and HydraHouse.
      </p>

      {/* Lifecycle state machine */}
      <div className="mb-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">
          Head Lifecycle State Machine
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
          {[
            { label: "Requested", color: "text-gray-600 border-gray-200 bg-gray-50" },
            { label: "Provisioning", color: "text-gray-600 border-gray-200 bg-gray-50" },
            { label: "Initializing", color: "text-amber-700 border-amber-200 bg-amber-50" },
            { label: "Committing", color: "text-amber-700 border-amber-200 bg-amber-50" },
            { label: "Open", color: "text-emerald-700 border-emerald-200 bg-emerald-50" },
            { label: "Closing", color: "text-amber-700 border-amber-200 bg-amber-50" },
            { label: "Closed", color: "text-gray-600 border-gray-200 bg-gray-50" },
            { label: "Fanned Out", color: "text-primary border-primary/20 bg-primary-light" },
          ].map((state, i, arr) => (
            <div key={state.label} className="flex items-center gap-2">
              <span className={`px-2.5 py-1.5 rounded-md border ${state.color}`}>
                {state.label}
              </span>
              {i < arr.length - 1 && (
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-3">
          A head can also be <span className="text-red-600">Aborted</span> from
          any state before Fanned Out.
        </p>
      </div>

      <div className="space-y-4">
        <ConceptCard title="Hydra Heads" icon={<Box size={18} />}>
          A Hydra head is a multi-party state channel on Cardano. A fixed set of
          participants runs Hydra nodes that share an L2 ledger. Funds are
          committed (locked) on L1 and mirrored on L2; transactions run off-chain
          for speed and low cost, then can be closed so that the final state is
          applied back on L1.
        </ConceptCard>

        <ConceptCard title="Lifecycle" icon={<RefreshCw size={18} />}>
          <p className="mb-2">
            A head moves through states: <strong className="text-gray-700">requested</strong> →{" "}
            <strong className="text-gray-700">provisioning</strong> →{" "}
            <strong className="text-gray-700">initializing</strong> →{" "}
            <strong className="text-gray-700">committing</strong> →{" "}
            <strong className="text-emerald-600">open</strong>.
          </p>
          <p>
            Once open, you can deposit, transfer, and submit L2 transactions. To
            finish: <strong className="text-gray-700">close</strong> → contestation period →{" "}
            <strong className="text-primary">fanned out</strong> (UTxOs back on L1).
          </p>
        </ConceptCard>

        <ConceptCard title="L2 Transactions" icon={<Zap size={18} />}>
          While the head is open, transactions are proposed over the Hydra
          protocol (e.g. via the node WebSocket or HTTP). Valid transactions
          update the shared UTxO set. No L1 fees until you close or do incremental
          commits/withdrawals.
        </ConceptCard>

        <div className="grid sm:grid-cols-2 gap-4">
          <ConceptCard title="Deposit" icon={<Upload size={18} />}>
            Send ADA to a participant's L1 address, then the system commits that
            UTxO into the head so it appears on L2. Incremental — no need to close
            the head.
          </ConceptCard>

          <ConceptCard title="Withdraw" icon={<Download size={18} />}>
            Remove a UTxO from L2 and return it to L1. Also incremental — funds
            return to the participant's Cardano address after the protocol
            finalizes.
          </ConceptCard>
        </div>
      </div>
    </div>
  );
}
