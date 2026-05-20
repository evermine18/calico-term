import { Activity } from "lucide-react";

type Props = {
  sample: HostSample | null;
  error: string | null;
  loading: boolean;
  onClick: () => void;
  expanded: boolean;
};

function color(pct: number): string {
  if (pct >= 85) return "text-red-400";
  if (pct >= 60) return "text-amber-400";
  return "text-accent-400";
}

export default function MetricsStatusInline({
  sample,
  error,
  loading,
  onClick,
  expanded,
}: Props) {
  return (
    <button
      onClick={onClick}
      title={
        error
          ? `Metrics error: ${error}`
          : expanded
            ? "Hide host metrics"
            : "Show host metrics"
      }
      className={`flex items-center gap-2 px-2 py-0.5 rounded transition-colors ${
        expanded
          ? "bg-slate-800/80 text-gray-200"
          : "hover:bg-slate-800/60 text-gray-500"
      }`}
    >
      <Activity
        size={11}
        className={
          error
            ? "text-red-400"
            : loading
              ? "text-gray-500 animate-pulse"
              : "text-accent-400/80"
        }
      />
      {error ? (
        <span className="text-red-400/80">metrics offline</span>
      ) : !sample ? (
        <span className="text-gray-500">sampling…</span>
      ) : (
        <>
          <span>
            CPU{" "}
            <span className={`font-mono ${color(sample.cpuPct)}`}>
              {sample.cpuPct.toFixed(0)}%
            </span>
          </span>
          <span className="text-slate-700">·</span>
          <span>
            MEM{" "}
            <span className={`font-mono ${color(sample.memUsedPct)}`}>
              {sample.memUsedPct.toFixed(0)}%
            </span>
          </span>
          <span className="text-slate-700">·</span>
          <span>
            LD{" "}
            <span className="font-mono text-gray-300">
              {sample.load1.toFixed(2)}
            </span>
          </span>
        </>
      )}
    </button>
  );
}
