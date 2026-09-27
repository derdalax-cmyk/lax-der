import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/perfil/excluir-conta")({
  beforeLoad: () => {
    throw redirect({ to: "/perfil/eliminar-conta", replace: true });
  },
});
