import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endAdminSession } from "@/lib/admin-security.functions";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
};


type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  needsProfileCompletion: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Sessão atual: respostas atrasadas de uma sessão anterior são ignoradas.
  const uidRef = useRef<string | null>(null);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    if (uidRef.current !== uid) return; // a sessão mudou entretanto
    setProfile(p as Profile | null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      uidRef.current = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { loadProfile(s.user.id); }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      uidRef.current = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const needsProfileCompletion = !!user && !!profile && (!profile.city || !profile.phone || !profile.name);

  return (
    <Ctx.Provider value={{
      user, session, profile, isAdmin, loading, needsProfileCompletion,
      refreshProfile: async () => { if (user) await loadProfile(user.id); },
      signOut: async () => {
        // Revogar a sessão administrativa forte (cookie HttpOnly) antes de sair.
        if (isAdmin) {
          try {
            await endAdminSession();
          } catch { /* ignore */ }
        }
        // Limpar estado sensível antes de terminar a sessão.
        try { await queryClient.cancelQueries(); queryClient.clear(); } catch { /* ignore */ }
        try { sessionStorage.removeItem("derdalax_post_login_redirect"); } catch { /* ignore */ }
        try {
          if (typeof caches !== "undefined") {
            const names = await caches.keys();
            await Promise.all(names.filter((n) => n.startsWith("derdalax-")).map((n) => caches.delete(n)));
          }
        } catch { /* ignore */ }
        uidRef.current = null;
        setProfile(null);
        setIsAdmin(false);
        await supabase.auth.signOut();
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const MZ_CITIES = ["Beira", "Maputo", "Nampula", "Quelimane", "Chimoio", "Tete", "Lichinga", "Pemba", "Xai-Xai", "Inhambane"] as const;

export const MZ_PROVINCES = [
  "Maputo Cidade",
  "Maputo Província",
  "Gaza",
  "Inhambane",
  "Sofala",
  "Manica",
  "Tete",
  "Zambézia",
  "Nampula",
  "Cabo Delgado",
  "Niassa",
] as const;
