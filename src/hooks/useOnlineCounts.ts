import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ONLINE_CHANNEL } from "@/hooks/useOnlinePresence";

type Presence = { user_id: string; role: "seller" | "buyer" };

export function useOnlineCounts() {
  const [counts, setCounts] = useState({ total: 0, sellers: 0, buyers: 0 });

  useEffect(() => {
    const channel = supabase.channel(ONLINE_CHANNEL);
    const update = () => {
      const state = channel.presenceState<Presence>();
      let sellers = 0, buyers = 0, total = 0;
      for (const key of Object.keys(state)) {
        const metas = state[key] as Presence[];
        const m = metas[0];
        if (!m) continue;
        total++;
        if (m.role === "seller") sellers++;
        else buyers++;
      }
      setCounts({ total, sellers, buyers });
    };
    channel
      .on("presence", { event: "sync" }, update)
      .on("presence", { event: "join" }, update)
      .on("presence", { event: "leave" }, update)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return counts;
}
