import { useState } from "react";
import type { Participant } from "../api";
import { Clipboard, Check } from "lucide-react";

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
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary-light text-primary text-xs font-semibold">
            {p.slot_index}
          </span>
          <span className="text-sm font-medium text-gray-900">
            Node {p.slot_index}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${p.commit_status === "committed" ? "bg-emerald-500" : "bg-gray-300"}`} />
          <span className="text-xs text-gray-500 capitalize">
            {p.commit_status}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs text-gray-500 font-mono truncate flex-1">
          {truncated}
        </code>
        {addr && (
          <button
            onClick={copy}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
