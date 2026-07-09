import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Conversation = {
  id: string;
  role: "buyer" | "seller";
  seller_id: string;
  product_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread: number;
  name: string;
  avatar: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
};

/** Start (or reuse) a conversation with a seller and return its id. */
export async function startConversation(sellerId: string, productId?: string | null): Promise<string> {
  const { data, error } = await supabase.rpc("start_conversation", {
    _seller_id: sellerId,
    _product_id: productId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

/** List the current user's conversations, kept live via realtime. */
export function useConversations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["my-conversations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_conversations");
      if (error) throw error;
      return (data ?? []) as unknown as Conversation[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("conversations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["my-conversations", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  return query;
}

/** Total unread messages across all conversations (for the nav badge). */
export function useUnreadMessages() {
  const { data = [] } = useConversations();
  return data.reduce((sum, c) => sum + (c.unread || 0), 0);
}
