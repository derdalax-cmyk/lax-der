import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SupportMessage = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  is_admin: boolean;
  body: string | null;
  image_url: string | null;
  read: boolean;
  created_at: string;
};

export type SupportThread = {
  id: string;
  user_id: string;
  last_message: string | null;
  last_message_at: string | null;
  user_unread: number;
  admin_unread: number;
  resolved: boolean;
};

export async function openSupportThread(): Promise<string> {
  const { data, error } = await supabase.rpc("open_support_thread");
  if (error) throw error;
  return data as unknown as string;
}

export function useSupportMessages(threadId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["support-messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupportMessage[];
    },
  });

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`support-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          qc.setQueryData<SupportMessage[]>(["support-messages", threadId], (prev = []) =>
            prev.some((m) => m.id === (payload.new as SupportMessage).id) ? prev : [...prev, payload.new as SupportMessage],
          );
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, qc, user?.id]);

  return query;
}
