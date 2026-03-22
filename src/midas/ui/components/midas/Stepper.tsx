import { Check } from "lucide-react";

const STEPS = [
  "Select Tables",
  "Add Context",
  "Profile & Generate",
  "Review & Edit",
  "Apply Changes",
];

export default function Stepper({
  current,
  onStep,
}: {
  current: number;
  onStep: (s: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => (done || active) && onStep(i)}
              disabled={i > current}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full
                ${active ? "bg-amber-600 text-white" : ""}
                ${done ? "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 cursor-pointer" : ""}
                ${!done && !active ? "bg-slate-800 text-slate-500 cursor-not-allowed" : ""}
              `}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0
                  ${active ? "bg-white text-amber-600" : ""}
                  ${done ? "bg-amber-500 text-white" : ""}
                  ${!done && !active ? "bg-slate-700 text-slate-500" : ""}
                `}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span className="hidden lg:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 min-w-4 ${done ? "bg-amber-500" : "bg-slate-700"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
