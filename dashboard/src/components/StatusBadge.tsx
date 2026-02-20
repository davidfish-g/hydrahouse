import type { HeadStatus } from "../api";

const COLORS: Record<string, string> = {
  open: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  requested: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  provisioning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  initializing: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  committing: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  closing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  closed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  fanned_out: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  aborted: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function StatusBadge({ status }: { status: HeadStatus }) {
  const colors = COLORS[status] ?? COLORS.closed;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${colors}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
