// Shared, browser-safe rules for Admin communication campaigns.
export const MAX_CAMPAIGN_PRODUCTS = 15;
export const PUSH_TITLE_MAX = 65;
export const PUSH_BODY_MAX = 180;
export const LARGE_CAMPAIGN_THRESHOLD = 500;
export const CAMPAIGN_LIMITS = [50, 75, 100] as const;
export type CampaignLimit = typeof CAMPAIGN_LIMITS[number];
export function campaignRecipientLimit(value: unknown = 50): CampaignLimit {
  if (value === 50 || value === 75 || value === 100) return value;
  throw new Error("Escolha um limite de 50, 75 ou 100 destinatários.");
}
export function campaignQueueCount(available: number, limit: CampaignLimit): number {
  return Math.min(Math.max(0, available), campaignRecipientLimit(limit));
}
export function deterministicRecipients(ids: string[], limit: CampaignLimit): string[] {
  return [...new Set(ids)].sort().slice(0, campaignRecipientLimit(limit));
}
export function campaignDispatchKey(campaignId: string, userId: string, channel: string) {
  return `${campaignId}:${userId}:${channel}`;
}

export type Segment = "incomplete" | "all" | "push" | "email";
export type CampaignType = "message" | "profile_recovery" | "products";
export type AudienceFilters = {
  city?: string;
  province?: string;
  purchases?: "" | "buyers" | "no_purchases";
  role?: "" | "sellers" | "clients";
  created_from?: string;
  created_to?: string;
};

export const PROFILE_RECOVERY_DEFAULTS = {
  title: "Complete o seu perfil na Derdalax",
  body: "Notámos que ainda faltam alguns dados no seu perfil. Complete-os para aproveitar melhor a Derdalax.",
  cta: "Completar perfil",
  url: "/perfil",
};

type ProfileLike = { name?: string | null; phone?: string | null; province?: string | null; city?: string | null };

/** Required profile data; an email (e.g. from Google) never counts as a complete profile. */
export function missingProfileFields(p: ProfileLike): string[] {
  const out: string[] = [];
  if (!p.name?.trim()) out.push("Nome");
  if (!p.phone?.trim()) out.push("Telefone");
  if (!p.province?.trim()) out.push("Província");
  if (!p.city?.trim()) out.push("Cidade");
  return out;
}

const ALLOWED_HOSTS = new Set(["derdalax.co.mz", "www.derdalax.co.mz"]);

/** Internal paths or HTTPS links on the official Derdalax domain only. Returns a normalized path/URL or null. */
export function safeCampaignLink(raw: string): string | null {
  const v = raw.trim();
  if (/^\/(?!\/)[A-Za-z0-9\-_/?.=&%#]*$/.test(v)) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname)) return u.pathname + u.search + u.hash;
  } catch { /* invalid */ }
  return null;
}

export type ProductEligibility = { approval_status: string; status: string };
export function isCampaignEligible(p: ProductEligibility): boolean {
  return p.approval_status === "approved" && (p.status === "available" || p.status === "reserved");
}

/** Strip HTML/control characters: admins write plain text, never raw HTML. */
export function plainText(s: string, max: number): string {
  return s.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export function needsRecentVerification(segment: Segment, estimatedTotal: number): boolean {
  return segment === "all" || estimatedTotal > LARGE_CAMPAIGN_THRESHOLD;
}

export function campaignLink(type: CampaignType, campaignId: string, productIds: string[], ctaUrl: string): string {
  if (type !== "products") return ctaUrl;
  return productIds.length === 1 ? `/produto/${productIds[0]}` : `/campanha/${campaignId}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "—";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`;
}
