import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    scrollRestorationBehavior: "instant",
    getScrollRestorationKey: (location) => {
      // Lists retain their session position per URL/filter context; details use history entries.
      const list = /^(\/$|\/explorar$|\/produtos$|\/categorias$|\/loja\/|\/favoritos$|\/perfil\/favoritos$)/.test(location.pathname);
      return list ? location.href : location.state.__TSR_key ?? location.href;
    },
    defaultPreloadStaleTime: 0,
  });

  return router;
};
