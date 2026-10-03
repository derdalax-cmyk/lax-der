import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Conversation = {
  id: string;
  role: "buyer" | "seller";
  kind: "general" | "order";
  seller_id: string;
  product_id: string | null;
  order_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread: number;
  name: string;
  avatar: string | null;
  phone: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

/** Minutes during which a message can still be edited by its author (enforced server-side). */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function orderRef(orderId: string | null | undefined): string {
  return orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : "";
}

/** Start (or reuse) the general pre-purchase conversation with a seller. */
export async function startConversation(sellerId: string, productId?: string | null): Promise<string> {
  const { data, error } = await supabase.rpc("start_conversation", {
    _seller_id: sellerId,
    _product_id: productId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

/** Resolve the single conversation for (order, store). Callable by the buyer or the store owner. */
export async function getOrCreateOrderConversation(orderId: string, sellerId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_order_conversation", {
    _order_id: orderId,
    _seller_id: sellerId,
  });
  if (error) throw error;
  return data as unknown as string;
}

/** @deprecated use getOrCreateOrderConversation */
export const startOrderConversation = getOrCreateOrderConversation;

export const conversationsKey = (userId?: string) => ["my-conversations", userId] as const;

/** List the current user's conversations, kept live via realtime. */
export function useConversations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: conversationsKey(user?.id),
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_conversations");
      if (error) throw error;
      return (data ?? []) as unknown as Conversation[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => qc.invalidateQueries({ queryKey: conversationsKey(user.id) });
    const channel = supabase
      .channel(`conversations-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `buyer_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `seller_user_id=eq.${user.id}` }, refresh)
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
