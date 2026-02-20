import type { HeadStatus } from "../api";

const STEPS: HeadStatus[] = [
  "requested",
  "provisioning",
  "initializing",
  "committing",
  "open",
  "closing",
  "closed",
  "fanned_out",
];

export default function LifecycleBar({ status }: { status: HeadStatus }) {
  if (status === "aborted") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-sm text-red-400 font-medium">Aborted</span>
      </div>
    );
  }

  const currentIdx = STEPS.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`w-6 h-0.5 ${
                  isPast ? "bg-indigo-500" : "bg-slate-700"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isCurrent
                    ? "border-indigo-400 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                    : isPast
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-slate-600 bg-slate-800"
                }`}
              />
              <span
                className={`text-[10px] leading-none ${
                  isCurrent
                    ? "text-indigo-300 font-medium"
                    : isPast
                      ? "text-slate-400"
                      : "text-slate-600"
                }`}
              >
                {step.replace("_", " ")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
