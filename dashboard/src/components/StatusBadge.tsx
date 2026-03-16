import type { HeadStatus } from "../api";

const COLORS: Record<string, { dot: string; text: string }> = {
  open: { dot: "bg-emerald-500", text: "text-emerald-700" },
  requested: { dot: "bg-amber-500", text: "text-amber-700" },
  provisioning: { dot: "bg-amber-500", text: "text-amber-700" },
  initializing: { dot: "bg-amber-500", text: "text-amber-700" },
  committing: { dot: "bg-amber-500", text: "text-amber-700" },
  closing: { dot: "bg-gray-400", text: "text-gray-600" },
  closed: { dot: "bg-gray-400", text: "text-gray-600" },
  fanned_out: { dot: "bg-gray-400", text: "text-gray-600" },
  aborted: { dot: "bg-red-500", text: "text-red-700" },
};

export default function StatusBadge({ status }: { status: HeadStatus }) {
  const colors = COLORS[status] ?? COLORS.closed;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
      <span className={`text-xs font-medium capitalize ${colors.text}`}>
        {status.replace("_", " ")}
      </span>
    </span>
  );
}
