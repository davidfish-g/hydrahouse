import type { HeadStatus } from "../api";
import { Check, X } from "lucide-react";
import { motion } from "framer-motion";

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
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
          <X size={14} className="text-red-600" />
        </div>
        <span className="text-sm text-red-700 font-medium">Aborted</span>
      </div>
    );
  }

  const currentIdx = STEPS.indexOf(status);

  return (
    <div className="flex items-start">
      {STEPS.map((step, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              {isCurrent ? (
                <motion.div
                  className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center"
                  animate={{ boxShadow: ["0 0 0 0px rgba(10,110,92,0.3)", "0 0 0 6px rgba(10,110,92,0)", "0 0 0 0px rgba(10,110,92,0.3)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="w-2 h-2 rounded-full bg-primary" />
                </motion.div>
              ) : isPast ? (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-200" />
              )}
              <span
                className={`text-[11px] mt-1.5 whitespace-nowrap ${
                  isCurrent ? "text-gray-900 font-medium" : "text-gray-400"
                }`}
              >
                {step.replace("_", " ")}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-3 mx-1 ${isPast ? "bg-primary" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
