import { Activity, X, AlertTriangle } from "lucide-react";

type Props = {
  samples: HostSample[];
  error: string | null;
  onClose: () => void;
};

export default function MetricsPanel({ samples, error, onClose }: Props) {
  const latest = samples[samples.length - 1];

  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-10 shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-400/90 tracking-wider uppercase">
          <Activity size={12} />
          Host metrics
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-slate-700/50"
        >
          <X size={13} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 text-[11px] text-red-400/80 bg-red-900/10 border-b border-red-800/20 flex items-start gap-1.5">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {!latest && !error && (
        <div className="flex-1 flex items-center justify-center text-[11px] text-gray-500">
          Sampling…
        </div>
      )}

      {latest && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <Gauge label="CPU" pct={latest.cpuPct} />
          <Sparkline data={samples.map((s) => s.cpuPct)} label="CPU history" />
          <Gauge label="Memory" pct={latest.memUsedPct} />
          <div className="text-[10px] text-gray-500 font-mono">
            {(latest.memFreeKb / 1024 / 1024).toFixed(2)} /{" "}
            {(latest.memTotalKb / 1024 / 1024).toFixed(2)} GB free
          </div>
          <Gauge label="Disk /" pct={latest.diskRootPct} />
          <div className="grid grid-cols-3 gap-1 text-center text-[10px] text-gray-400">
            <div>
              <div className="font-mono text-gray-200">{latest.load1.toFixed(2)}</div>
              <div>1m</div>
            </div>
            <div>
              <div className="font-mono text-gray-200">{latest.load5.toFixed(2)}</div>
              <div>5m</div>
            </div>
            <div>
              <div className="font-mono text-gray-200">{latest.load15.toFixed(2)}</div>
              <div>15m</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-600 text-center">
            polled every 2s · last {new Date(latest.ts).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

function Gauge({ label, pct }: { label: string; pct: number }) {
  const color =
    pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-accent-500";
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-mono text-gray-200">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Sparkline({ data, label }: { data: number[]; label: string }) {
  if (data.length === 0) return null;
  const w = 220;
  const h = 36;
  const max = 100;
  const step = w / Math.max(1, data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-label={label}
      className="bg-slate-950 rounded border border-slate-800/60"
    >
      <polyline
        fill="none"
        stroke="rgb(var(--accent-rgb))"
        strokeWidth={1.5}
        points={points}
      />
    </svg>
  );
}
