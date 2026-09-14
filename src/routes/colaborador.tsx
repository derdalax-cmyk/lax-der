import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/colaborador")({
  head: () => ({
    meta: [
      { title: "Área do Colaborador · DERDALAX" },
      { name: "description", content: "Cadastro de produtos das lojas que lhe foram atribuídas." },
    ],
  }),
  component: CollaboratorLayout,
});

function CollaboratorLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/colaborador" className="font-display text-lg tracking-[0.2em] text-gold">DERDALAX</Link>
          <span className="text-xs text-muted-foreground">Área do colaborador</span>
          <Link to="/perfil" className="ml-auto text-sm text-muted-foreground hover:text-foreground">Perfil</Link>
        </div>
      </header>
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
