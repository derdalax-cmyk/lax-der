import { useEffect, useState } from "react";

type Props = { prizes: number[]; result: number | null; spinning: boolean; onDone?: () => void };

/** Visual-only wheel. The result always comes from the server. */
export function RoletaWheel({ prizes, result, spinning, onDone }: Props) {
  const segs = prizes.length ? prizes : [0, 5, 10, 15, 20, 25, 30];
  const n = segs.length;
  const step = 360 / n;
  const [rot, setRot] = useState(0);

  useEffect(() => {
    if (result === null) return;
    const idx = Math.max(0, segs.indexOf(result));
    // segment idx center sits at angle idx*step + step/2 (clockwise from top); bring it under the pointer
    const target = 360 * 6 + (360 - (idx * step + step / 2));
    setRot((r) => r - (r % 360) + target);
    const t = setTimeout(() => onDone?.(), 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const R = 100;
  const pt = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return [R + R * Math.cos(rad), R + R * Math.sin(rad)];
  };

  return (
    <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72">
      <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-gold drop-shadow" />
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full rounded-full border-4 border-gold shadow-[0_0_30px_-5px_var(--gold)]"
        style={{ transform: `rotate(${rot}deg)`, transition: result !== null ? "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)" : "none", animation: spinning && result === null ? "spin 1s linear infinite" : undefined }}
      >
        {segs.map((p, i) => {
          const [x1, y1] = pt(i * step);
          const [x2, y2] = pt((i + 1) * step);
          const [tx, ty] = (() => { const rad = ((i * step + step / 2 - 90) * Math.PI) / 180; return [R + 64 * Math.cos(rad), R + 64 * Math.sin(rad)]; })();
          return (
            <g key={i}>
              <path d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`} fill={i % 2 === 0 ? "var(--ink)" : "var(--gold)"} stroke="var(--gold)" strokeWidth="0.5" />
              <text x={tx} y={ty} fill={i % 2 === 0 ? "var(--gold)" : "var(--ink)"} fontSize="11" fontWeight="700" textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${i * step + step / 2} ${tx} ${ty})`}>
                {p === 0 ? "—" : `${p}%`}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="16" fill="var(--ink)" stroke="var(--gold)" strokeWidth="2" />
      </svg>
    </div>
  );
}
