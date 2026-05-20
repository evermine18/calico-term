import { useEffect, useState } from "react";

const MAX_HISTORY = 60;

export type MetricsConn = {
  id: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
  identityKeyId?: string;
  hasPassword?: boolean;
  credentialId?: string;
  passwordRef?: { provider: SecretProvider; ref: string };
  jumpHosts?: {
    host: string;
    port: number;
    username: string;
    identityFile?: string;
    identityKeyId?: string;
  }[];
};

export function useMetrics(
  sessionId: string | null,
  conn: MetricsConn | null,
) {
  const [samples, setSamples] = useState<HostSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId || !conn) {
      setSamples([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setSamples([]);
    setError(null);
    setLoading(true);

    const offData = window.api.metrics.onSample(
      ({ sessionId: sid, sample }) => {
        if (sid !== sessionId || cancelled) return;
        setSamples((prev) => {
          const next = [...prev, sample];
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
        setLoading(false);
      },
    );
    const offErr = window.api.metrics.onError(
      ({ sessionId: sid, error: e }) => {
        if (sid !== sessionId || cancelled) return;
        setError(e);
        setLoading(false);
      },
    );

    window.api.metrics.start(sessionId, conn, 2000).then((r) => {
      if (cancelled) return;
      if (!r.ok && r.error) {
        setError(r.error);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      window.api.metrics.stop(sessionId);
      offData();
      offErr();
    };
  }, [sessionId, conn?.id]);

  return { samples, error, loading, latest: samples[samples.length - 1] ?? null };
}
