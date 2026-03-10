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
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      </div>
      <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
    </div>
  );
}

export default function Concepts() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Concepts</h1>
      <p className="text-slate-400 mb-8">
        Core ideas behind Hydra heads and HydraHouse.
      </p>

      {/* Lifecycle state machine diagram */}
      <div className="mb-8 bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4 text-center">
          Head Lifecycle State Machine
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
          {[
            { label: "Requested", color: "text-slate-400 border-slate-600 bg-slate-800" },
            { label: "Provisioning", color: "text-slate-400 border-slate-600 bg-slate-800" },
            { label: "Initializing", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
            { label: "Committing", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
            { label: "Open", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
            { label: "Closing", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
            { label: "Closed", color: "text-slate-400 border-slate-600 bg-slate-800" },
            { label: "Fanned Out", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
          ].map((state, i, arr) => (
            <div key={state.label} className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1.5 rounded-md border ${state.color}`}
              >
                {state.label}
              </span>
              {i < arr.length - 1 && (
                <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center mt-3">
          A head can also be <span className="text-red-400">Aborted</span> from
          any state before Fanned Out.
        </p>
      </div>

      <div className="space-y-4">
        <ConceptCard
          title="Hydra Heads"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
            </svg>
          }
        >
          A Hydra head is a multi-party state channel on Cardano. A fixed set of
          participants runs Hydra nodes that share an L2 ledger. Funds are
          committed (locked) on L1 and mirrored on L2; transactions run off-chain
          for speed and low cost, then can be closed so that the final state is
          applied back on L1.
        </ConceptCard>

        <ConceptCard
          title="Lifecycle"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          }
        >
          <p className="mb-2">
            A head moves through states: <strong className="text-slate-300">requested</strong> →{" "}
            <strong className="text-slate-300">provisioning</strong> →{" "}
            <strong className="text-slate-300">initializing</strong> →{" "}
            <strong className="text-slate-300">committing</strong> →{" "}
            <strong className="text-emerald-400">open</strong>.
          </p>
          <p>
            Once open, you can deposit, transfer, and submit L2 transactions. To
            finish: <strong className="text-slate-300">close</strong> → contestation period →{" "}
            <strong className="text-indigo-300">fanned out</strong> (UTxOs back on L1).
          </p>
        </ConceptCard>

        <ConceptCard
          title="L2 Transactions"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
        >
          While the head is open, transactions are proposed over the Hydra
          protocol (e.g. via the node WebSocket or HTTP). Valid transactions
          update the shared UTxO set. No L1 fees until you close or do incremental
          commits/withdrawals.
        </ConceptCard>

        <div className="grid sm:grid-cols-2 gap-4">
          <ConceptCard
            title="Deposit"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            }
          >
            Send ADA to a participant's L1 address, then the system commits that
            UTxO into the head so it appears on L2. Incremental — no need to close
            the head.
          </ConceptCard>

          <ConceptCard
            title="Withdraw"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
              </svg>
            }
          >
            Remove a UTxO from L2 and return it to L1. Also incremental — funds
            return to the participant's Cardano address after the protocol
            finalizes.
          </ConceptCard>
        </div>
      </div>
    </div>
  );
}
