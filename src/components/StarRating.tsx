import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  size?: number;
  className?: string;
  onChange?: (v: number) => void;
};

export function StarRating({ value, size = 16, className, onChange }: Props) {
  const interactive = !!onChange;
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = (
          <Star
            className={cn(filled ? "fill-gold text-gold" : "fill-none text-muted-foreground/40")}
            style={{ width: size, height: size }}
          />
        );
        return interactive ? (
          <button
            key={i}
            type="button"
            aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
            onClick={() => onChange(i)}
            className="transition-transform hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={i}>{star}</span>
        );
      })}
    </div>
  );
}
