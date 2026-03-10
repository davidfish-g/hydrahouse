function StepCard({
  num,
  title,
  children,
  icon,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
        {num}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-slate-400">{icon}</span>
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        </div>
        <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function QuickStart() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Quick Start</h1>
      <p className="text-slate-400 mb-8">
        Get a Hydra head running in minutes using the dashboard or the API.
      </p>

      {/* Visual flow overview */}
      <div className="mb-10 bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {["Sign Up", "Create Head", "Deposit", "Transact", "Close"].map(
            (label, i, arr) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <svg
                    className="w-5 h-5 text-slate-600 shrink-0 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <div className="space-y-4">
        <StepCard
          num="1"
          title="Create an account"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          }
        >
          Use the dashboard login flow to create an account. You'll receive an
          API key (e.g. <code className="text-indigo-300 text-xs bg-slate-900 px-1.5 py-0.5 rounded">hh_sk_...</code>).
          Store it securely — you'll use it for all API requests.
        </StepCard>

        <StepCard
          num="2"
          title="Create a head"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }
        >
          <p className="mb-2">
            From the dashboard, click <strong className="text-slate-300">New Head</strong>. Choose
            network (e.g. preprod), number of participants (1–10), and optional contestation period.
          </p>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 font-mono text-xs overflow-x-auto">
            <span className="text-slate-500">POST</span>{" "}
            <span className="text-indigo-300">/v1/heads</span>
            <span className="text-slate-600">{" { "}</span>
            <span className="text-emerald-400">"network"</span>
            <span className="text-slate-600">: </span>
            <span className="text-emerald-400">"preprod"</span>
            <span className="text-slate-600">, </span>
            <span className="text-emerald-400">"participants"</span>
            <span className="text-slate-600">: </span>
            <span className="text-amber-400">2</span>
            <span className="text-slate-600">{" }"}</span>
          </div>
          <p className="mt-2">
            The head will provision and move through{" "}
            <span className="text-indigo-300">initializing</span> →{" "}
            <span className="text-indigo-300">committing</span> →{" "}
            <span className="text-emerald-400">open</span>.
          </p>
        </StepCard>

        <StepCard
          num="3"
          title="Deposit"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          }
        >
          Once the head is <strong className="text-emerald-400">open</strong>, open the head detail
          and use <strong className="text-slate-300">Deposit</strong>. Send ADA to the participant's
          Cardano address shown, then click Deposit to commit those UTxOs into the head. Funds appear
          on L2 after the commit is confirmed.
        </StepCard>

        <StepCard
          num="4"
          title="Transfer and use L2"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          }
        >
          Use <strong className="text-slate-300">L2 Transfer</strong> to move ADA between
          participants, or <strong className="text-slate-300">Submit Raw L2 Transaction</strong> with
          a signed CBOR hex. View the <strong className="text-slate-300">L2 UTxO Snapshot</strong> to
          see current state.
        </StepCard>

        <StepCard
          num="5"
          title="Withdraw (optional)"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
            </svg>
          }
        >
          Use <strong className="text-slate-300">Withdraw (L2 → L1)</strong> to decommit a UTxO. Funds
          return to the participant's Cardano address after the protocol finalizes.
        </StepCard>

        <StepCard
          num="6"
          title="Close the head"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          When done, click <strong className="text-slate-300">Close Head</strong>. After the contestation
          period, finalize to fan out remaining UTxOs back to L1. You can also{" "}
          <strong className="text-slate-300">Abort</strong> to tear down without closing.
        </StepCard>
      </div>
    </div>
  );
}
