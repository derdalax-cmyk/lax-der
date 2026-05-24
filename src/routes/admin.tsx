import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · DERDALAX" }, { name: "description", content: "Painel administrativo." }] }),
  component: Admin,
});

function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);
  if (!isAdmin) return null;
  return (
    <div className="max-w-[1400px] mx-auto px-5 py-16">
      <h1 className="font-display text-4xl mb-3">Painel Admin</h1>
      <p className="text-muted-foreground">Dashboard, produtos, pedidos e utilizadores — em breve.</p>
    </div>
  );
}
