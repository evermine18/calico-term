import { Activity } from "lucide-react";

type Props = {
  sample: HostSample | null;
  error: string | null;
  loading: boolean;
  onClick: () => void;
  expanded: boolean;
};

function color(pct: number): string {
  if (pct >= 85) return "text-danger";
  if (pct >= 60) return "text-warning";
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
          ? "bg-elevated/80 text-ink"
          : "hover:bg-elevated/60 text-ink-subtle"
      }`}
    >
      <Activity
        size={11}
        className={
          error
            ? "text-danger"
            : loading
              ? "text-ink-subtle animate-pulse"
              : "text-accent-400/80"
        }
      />
      {error ? (
        <span className="text-danger/80">metrics offline</span>
      ) : !sample ? (
        <span className="text-ink-subtle">sampling…</span>
      ) : (
        <>
          <span>
            CPU{" "}
            <span className={`font-mono ${color(sample.cpuPct)}`}>
              {sample.cpuPct.toFixed(0)}%
            </span>
          </span>
          <span className="text-ink-subtle">·</span>
          <span>
            MEM{" "}
            <span className={`font-mono ${color(sample.memUsedPct)}`}>
              {sample.memUsedPct.toFixed(0)}%
            </span>
          </span>
          <span className="text-ink-subtle">·</span>
          <span>
            LD{" "}
            <span className="font-mono text-ink-muted">
              {sample.load1.toFixed(2)}
            </span>
          </span>
        </>
      )}
    </button>
  );
}
