import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

type Props = {
  recording: RecordingMeta;
  onClose: () => void;
};

type Frame = { t: number; data: string };

export default function RecordingPlayerDialog({ recording, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const framesRef = useRef<Frame[]>([]);
  const indexRef = useRef(0);
  const startedAtRef = useRef(0);
  const elapsedAtPauseRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const totalDurationSec = (() => {
    const f = framesRef.current;
    if (f.length === 0) return recording.durationMs / 1000;
    return f[f.length - 1].t;
  })();

  useEffect(() => {
    const term = new Terminal({
      cols: recording.cols,
      rows: recording.rows,
      fontSize: 12,
      theme: {
        background:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--term-bg")
            .trim() || "#020617",
        foreground:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--term-fg")
            .trim() || "#e2e8f0",
      },
      disableStdin: true,
      scrollback: 5000,
    });
    if (containerRef.current) term.open(containerRef.current);
    termRef.current = term;

    let cancelled = false;
    window.api.recording.load(recording.id).then((text) => {
      if (cancelled || !text) return;
      const lines = text.split("\n").filter(Boolean);
      const frames: Frame[] = [];
      for (let i = 1; i < lines.length; i++) {
        try {
          const arr = JSON.parse(lines[i]);
          if (Array.isArray(arr) && arr[1] === "o") {
            frames.push({ t: arr[0], data: arr[2] });
          }
        } catch {
          /* skip */
        }
      }
      framesRef.current = frames;
      // Auto-start
      start();
    });

    return () => {
      cancelled = true;
      stopTimer();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = () => {
    const frames = framesRef.current;
    const term = termRef.current;
    if (!term || indexRef.current >= frames.length) {
      setPlaying(false);
      return;
    }
    const now = (Date.now() - startedAtRef.current) / 1000;
    const next = frames[indexRef.current];
    const delay = Math.max(0, (next.t - now) * 1000);
    timerRef.current = window.setTimeout(() => {
      term.write(next.data);
      indexRef.current++;
      const t = next.t;
      setProgress(totalDurationSec > 0 ? Math.min(100, (t / totalDurationSec) * 100) : 0);
      scheduleNext();
    }, delay);
  };

  const start = () => {
    const frames = framesRef.current;
    if (frames.length === 0) return;
    setPlaying(true);
    startedAtRef.current = Date.now() - elapsedAtPauseRef.current * 1000;
    scheduleNext();
  };

  const pause = () => {
    stopTimer();
    elapsedAtPauseRef.current = (Date.now() - startedAtRef.current) / 1000;
    setPlaying(false);
  };

  const restart = () => {
    stopTimer();
    termRef.current?.reset();
    indexRef.current = 0;
    elapsedAtPauseRef.current = 0;
    setProgress(0);
    start();
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[900px] bg-panel border-hairline/40 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-ink text-sm flex items-center gap-2">
            <Play size={14} className="text-accent-400" />
            {recording.title} · {new Date(recording.createdAt).toLocaleString()}
          </DialogTitle>
        </DialogHeader>

        <div
          ref={containerRef}
          className="bg-surface rounded-md p-2 h-[420px] overflow-hidden"
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={playing ? pause : start}
            variant="outline"
            size="icon"
            className="h-8 w-8 border-hairline/50 bg-elevated/60"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </Button>
          <Button
            onClick={restart}
            variant="outline"
            size="icon"
            className="h-8 w-8 border-hairline/50 bg-elevated/60"
            title="Restart"
          >
            <RotateCcw size={13} />
          </Button>
          <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full bg-accent-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-hairline text-ink-muted hover:bg-elevated"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
