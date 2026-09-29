import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { PushNotificationBanner } from "@/components/PushNotificationBanner";

/**
 * Automatically SHOWS the notification banner to signed-in users who have
 * not enabled push yet. It never requests the system permission by itself:
 * the native Android/TWA dialog only opens when the user taps "Ativar".
 */
export function PushAutoPrompt() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || !user) return null;
  // Seller dashboard already renders the inline banner — avoid duplicates.
  if (pathname === "/vendedor" || pathname === "/vendedor/") return null;
  if (pathname.startsWith("/login")) return null;

  return <PushNotificationBanner floating />;
}
