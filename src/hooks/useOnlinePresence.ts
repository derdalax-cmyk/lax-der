import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";

export const ONLINE_CHANNEL = "online-users";

/** Tracks the current user in a global presence channel while the tab is open. */
export function useOnlinePresence() {
  const { user } = useAuth();
  const { seller } = useSeller();

  useEffect(() => {
    if (!user) return;
    const role: "seller" | "buyer" = seller?.status === "approved" ? "seller" : "buyer";
    const channel = supabase.channel(ONLINE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {}).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, role, online_at: new Date().toISOString() });
      }
    });

    const onHide = () => { channel.untrack(); };
    window.addEventListener("beforeunload", onHide);

    return () => {
      window.removeEventListener("beforeunload", onHide);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user, seller?.status]);
}
