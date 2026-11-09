// Pure, client-safe renderer for Derdalax campaign emails. All admin content is escaped; no raw HTML accepted.
export const CAMPAIGN_EMAIL_FROM = "Derdalax <campanhas@news.derdalax.co.mz>";
export const SITE_URL = "https://derdalax.co.mz";

export type EmailProduct = { id: string; title: string; price: number; image: string | null };
export type CampaignEmailInput = {
  type: "message" | "profile_recovery" | "products";
  title: string; body: string; ctaLabel?: string | null; ctaUrl: string;
  products?: EmailProduct[]; unsubscribeUrl: string;
};

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const VALID_EMAIL = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$/i;
export const isValidEmail = (e: string | null | undefined) => !!e && VALID_EMAIL.test(e.trim());

export function absoluteUrl(path: string): string {
  if (/^https:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
export const httpsImage = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u : null);

export function formatPrice(n: number) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MT`;
}

export function campaignEmailCta(input: Pick<CampaignEmailInput, "type" | "ctaUrl" | "products">): string {
  if (input.type === "profile_recovery") return absoluteUrl("/perfil");
  if (input.type === "products") {
    const p = input.products ?? [];
    return absoluteUrl(p.length === 1 ? `/produto/${p[0].id}` : "/explorar");
  }
  return absoluteUrl(input.ctaUrl || "/");
}

export function renderCampaignEmail(input: CampaignEmailInput): { subject: string; html: string; text: string } {
  const gold = "#e4b363", black = "#0a0a0a";
  const cta = campaignEmailCta(input);
  const label = escapeHtml(input.ctaLabel?.trim() || (input.type === "profile_recovery" ? "Completar perfil" : input.type === "products" ? "Ver produtos" : "Ver agora"));
  const products = input.type === "products" ? (input.products ?? []) : [];
  const cells = products.map((p) => {
    const url = escapeHtml(absoluteUrl(`/produto/${p.id}`));
    const img = httpsImage(p.image);
    return `<td width="50%" valign="top" style="padding:8px;">
<a href="${url}" style="text-decoration:none;color:${black};display:block;">
${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" width="260" style="width:100%;max-width:260px;height:auto;border-radius:8px;display:block;border:0;" />` : ""}
<p style="margin:8px 0 2px;font-size:14px;line-height:1.3;color:${black};">${escapeHtml(p.title)}</p>
<p style="margin:0;font-size:15px;font-weight:bold;color:#b8862f;">${escapeHtml(formatPrice(p.price))}</p></a></td>`;
  });
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`);
  const grid = rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">${rows.join("")}</table>` : "";
  const body = escapeHtml(input.body).replace(/\n/g, "<br />");
  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:${black};padding:18px 24px;border-radius:12px 12px 0 0;"><span style="color:${gold};font-size:22px;font-weight:bold;letter-spacing:1px;">Derdalax</span></td></tr>
<tr><td style="padding:24px;border:1px solid #eeeeee;border-top:0;">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${black};">${escapeHtml(input.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#333333;">${body}</p>
${grid}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="background:${black};border-radius:8px;">
<a href="${escapeHtml(cta)}" style="display:inline-block;padding:12px 24px;color:${gold};font-weight:bold;font-size:15px;text-decoration:none;">${label}</a></td></tr></table>
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;line-height:1.5;color:#888888;">Recebe este email porque tem uma conta na Derdalax e aceitou novidades por email.<br />
<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#888888;">Cancelar subscrição</a> · <a href="${SITE_URL}/perfil" style="color:#888888;">Gerir preferências</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [input.title, "", input.body, "", ...products.map((p) => `${p.title} — ${formatPrice(p.price)} — ${absoluteUrl(`/produto/${p.id}`)}`), "", cta, "", `Cancelar subscrição: ${input.unsubscribeUrl}`].join("\n");
  return { subject: input.title, html, text };
}
