// Shared Web Push delivery used by the dispatch route and Admin campaigns.
// Invalid subscriptions (404/410) are removed exactly as before.
export type PushPayload = { title: string; body?: string; url?: string; tag?: string; image?: string };

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number; total: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, keys").eq("user_id", userId);
  if (error) throw new Error("push_subscriptions_read_failed");
  if (!subs || subs.length === 0) return { sent: 0, removed: 0, total: 0 };

  const webpushMod = (await import("web-push")) as unknown as { default?: typeof import("web-push") } & typeof import("web-push");
  const webpush = webpushMod.default ?? webpushMod;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:suporte@derdalax.co.mz",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/",
    tag: payload.tag ?? "derdalax",
    ...(payload.image ? { image: payload.image } : {}),
  });

  let sent = 0;
  const toDelete: string[] = [];
  await Promise.all(subs.map(async (row) => {
    const keys = row.keys as { p256dh?: string; auth?: string } | null;
    if (!keys?.p256dh || !keys?.auth) return;
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, body, { TTL: 60 * 60 * 24 });
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) toDelete.push(row.id);
      else console.error("push send failed", status);
    }
  }));
  if (toDelete.length > 0) await supabaseAdmin.from("push_subscriptions").delete().in("id", toDelete);
  return { sent, removed: toDelete.length, total: subs.length };
}
