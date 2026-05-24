import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Perfil · DERDALAX" }, { name: "description", content: "O seu perfil." }] }),
  component: Perfil,
});

function Perfil() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  if (!user) return null;
  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <h1 className="font-display text-4xl mb-6">O meu perfil</h1>
      <div className="bg-card border border-border rounded-xl p-6 space-y-2">
        <div><span className="text-muted-foreground text-sm">Nome:</span> <span className="font-medium">{profile?.name || "—"}</span></div>
        <div><span className="text-muted-foreground text-sm">Email:</span> <span className="font-medium">{profile?.email || user.email}</span></div>
        <div><span className="text-muted-foreground text-sm">Telefone:</span> <span className="font-medium">{profile?.phone || "—"}</span></div>
        <div><span className="text-muted-foreground text-sm">Cidade:</span> <span className="font-medium">{profile?.city || "—"}</span></div>

      </div>
      <Button className="mt-6" variant="outline" onClick={() => signOut()}>Terminar sessão</Button>
    </div>
  );
}
