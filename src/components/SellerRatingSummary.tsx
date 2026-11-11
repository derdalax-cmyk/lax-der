import { StarRating } from "@/components/StarRating";
import { sellerRatingSummary, type PublicSeller } from "@/lib/sellerRatings";

export function SellerRatingSummary({ seller, size = 16 }: { seller: PublicSeller; size?: number }) {
  const summary = sellerRatingSummary(seller);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" aria-label={`${summary.average} · ${summary.reviews}`}>
      <StarRating value={summary.rating} size={size} />
      <span className="text-sm font-medium">{summary.average}</span>
      <span className="text-sm text-muted-foreground">· {summary.reviews}</span>
    </span>
  );
}