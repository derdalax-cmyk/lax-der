import { useEffect, useState } from "react";

type Props = { until: string; onExpire?: () => void; className?: string };

export function CountdownTimer({ until, onExpire, className }: Props) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()));

  useEffect(() => {
    setLeft(Math.max(0, new Date(until).getTime() - Date.now()));
    const t = setInterval(() => {
      const ms = Math.max(0, new Date(until).getTime() - Date.now());
      setLeft(ms);
      if (ms === 0) { clearInterval(t); onExpire?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [until, onExpire]);

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const fmt = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return <span className={className}>⏳ Reserva expira em {fmt}</span>;
}
