import { Link } from "@tanstack/react-router";

/** Compact floating access to the Roleta (Profile only). Sits above the mobile bottom-nav. */
export function RoletaFloatingButton({ highlight }: { highlight?: boolean }) {
  const slices = 8;
  return (
    <Link
      to="/perfil/roleta"
      aria-label="Abrir Roleta de Descontos"
      title="Roleta de Descontos"
      className="fixed z-40 bottom-24 right-4 md:bottom-8 md:right-8 group"
    >
      <span className="relative block h-14 w-14 rounded-full bg-ink border-2 border-gold shadow-lg transition-transform group-hover:scale-105 group-active:scale-95">
        <svg viewBox="0 0 100 100" className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] transition-transform duration-700 group-hover:rotate-45" aria-hidden="true">
          {Array.from({ length: slices }).map((_, i) => {
            const a0 = (i / slices) * Math.PI * 2;
            const a1 = ((i + 1) / slices) * Math.PI * 2;
            const p = (a: number) => `${50 + 48 * Math.sin(a)} ${50 - 48 * Math.cos(a)}`;
            return (
              <path
                key={i}
                d={`M50 50 L${p(a0)} A48 48 0 0 1 ${p(a1)} Z`}
                className={i % 2 === 0 ? "fill-gold" : "fill-ink"}
                stroke="currentColor"
                strokeWidth="1"
                style={{ color: "var(--gold)" }}
              />
            );
          })}
          <circle cx="50" cy="50" r="11" className="fill-ink" stroke="var(--gold)" strokeWidth="3" />
        </svg>
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-0 w-0 border-x-[6px] border-x-transparent border-t-[9px] border-t-gold" aria-hidden="true" />
        {highlight && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-gold ring-2 ring-ink" aria-hidden="true" />}
      </span>
    </Link>
  );
}
