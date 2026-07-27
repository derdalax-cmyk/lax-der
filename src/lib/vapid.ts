// Public VAPID key exposed to the browser. This is safe to hardcode:
// VAPID public keys are non-secret by design (the browser sends them to
// the push service so it can validate the matching private-key signature).
export const VAPID_PUBLIC_KEY =
  "BNFSrFx8fODoN0EjwuBp_9ZSjXau7ewer9Go4RRMKz7D5BC4UPo4jrxpmPdkSSVGhPTlC1Wqv91DgVxrV0zGOh4";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
