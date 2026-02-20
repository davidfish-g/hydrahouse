import { useState } from "react";
import type { Participant } from "../api";

export default function ParticipantCard({ p }: { p: Participant }) {
  const [copied, setCopied] = useState(false);
  const addr = p.cardano_address;
  const truncated = addr
    ? `${addr.slice(0, 16)}...${addr.slice(-8)}`
    : "pending";

  function copy() {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">
          Node {p.slot_index}
        </span>
        <span className="text-xs text-slate-500 capitalize">
          {p.commit_status}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs text-slate-400 font-mono truncate flex-1">
          {truncated}
        </code>
        {addr && (
          <button
            onClick={copy}
            className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}
