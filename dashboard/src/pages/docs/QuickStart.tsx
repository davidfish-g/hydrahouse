import { UserPlus, Plus, Upload, ArrowLeftRight, LogOut } from "lucide-react";

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
    <div className="flex gap-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-primary font-bold text-sm">
        {num}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-gray-400">{icon}</span>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="text-sm text-gray-500 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function QuickStart() {
  return (
    <div className="max-w-[720px]">
      <h1 className="text-[28px] font-bold text-gray-900 mb-2">Quick Start</h1>
      <p className="text-gray-500 mb-8">
        Get a Hydra head running in minutes using the dashboard or the API.
      </p>

      {/* Visual flow */}
      <div className="mb-10 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {["Sign Up", "Create Head", "Deposit", "Transact", "Close"].map(
            (label, i, arr) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <svg
                    className="w-5 h-5 text-gray-300 shrink-0 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <div className="space-y-4">
        <StepCard num="1" title="Create an account" icon={<UserPlus size={18} />}>
          Use the dashboard login flow to create an account. You'll receive an
          API key (e.g. <code className="text-primary text-xs bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-mono">hh_sk_...</code>).
          Store it securely — you'll use it for all API requests.
        </StepCard>

        <StepCard num="2" title="Create a head" icon={<Plus size={18} />}>
          <p className="mb-2">
            From the dashboard, click <strong className="text-gray-700">New Head</strong>. Choose
            network (e.g. preprod), number of participants (1–10), and optional contestation period.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-xs overflow-x-auto">
            <span className="text-gray-400">POST</span>{" "}
            <span className="text-primary">/v1/heads</span>
            <span className="text-gray-400">{" { "}</span>
            <span className="text-emerald-600">"network"</span>
            <span className="text-gray-400">: </span>
            <span className="text-emerald-600">"preprod"</span>
            <span className="text-gray-400">, </span>
            <span className="text-emerald-600">"participants"</span>
            <span className="text-gray-400">: </span>
            <span className="text-amber-600">2</span>
            <span className="text-gray-400">{" }"}</span>
          </div>
          <p className="mt-2">
            The head will provision and move through{" "}
            <span className="text-primary">initializing</span> →{" "}
            <span className="text-primary">committing</span> →{" "}
            <span className="text-emerald-600">open</span>.
          </p>
        </StepCard>

        <StepCard num="3" title="Deposit" icon={<Upload size={18} />}>
          Once the head is <strong className="text-emerald-600">open</strong>, open the head detail
          and use <strong className="text-gray-700">Deposit</strong>. Send ADA to the participant's
          Cardano address shown, then click Deposit to commit those UTxOs into the head.
        </StepCard>

        <StepCard num="4" title="Transfer and use L2" icon={<ArrowLeftRight size={18} />}>
          Use <strong className="text-gray-700">L2 Transfer</strong> to move ADA between
          participants, or <strong className="text-gray-700">Submit Raw L2 Transaction</strong> with
          a signed CBOR hex. View the <strong className="text-gray-700">L2 UTxO Snapshot</strong> to
          see current state.
        </StepCard>

        <StepCard num="5" title="Withdraw (optional)" icon={<Upload size={18} />}>
          Use <strong className="text-gray-700">Withdraw (L2 → L1)</strong> to decommit a UTxO. Funds
          return to the participant's Cardano address after the protocol finalizes.
        </StepCard>

        <StepCard num="6" title="Close the head" icon={<LogOut size={18} />}>
          When done, click <strong className="text-gray-700">Close Head</strong>. After the contestation
          period, finalize to fan out remaining UTxOs back to L1. You can also{" "}
          <strong className="text-gray-700">Abort</strong> to tear down without closing.
        </StepCard>
      </div>
    </div>
  );
}
