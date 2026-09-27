import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { isPublicPath, safeRedirect } from "@/lib/safeRedirect";
import { Suspense, lazy, useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CityProvider } from "@/contexts/CityContext";
import { Navbar } from "@/components/Navbar";
import { CityAlert } from "@/components/CityAlert";
import { BottomNav } from "@/components/BottomNav";

import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useServiceWorker } from "@/hooks/useServiceWorker";

// Non-critical, client-only UI: kept out of the initial bundle so it does not
// block the first render. Behaviour is unchanged, only the load moment differs.
const InstallAppPrompt = lazy(() =>
  import("@/components/InstallAppPrompt").then((m) => ({ default: m.InstallAppPrompt })),
);
const ProfileCompletionModal = lazy(() =>
  import("@/components/ProfileCompletionModal").then((m) => ({ default: m.ProfileCompletionModal })),
);
const PushAutoPrompt = lazy(() =>
  import("@/components/PushAutoPrompt").then((m) => ({ default: m.PushAutoPrompt })),
);



function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <p className="mt-3 text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-gold text-ink px-5 py-2 text-sm font-medium hover:bg-gold/90">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl text-foreground">Algo correu mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DERDALAX" },
      { name: "description", content: "Peças únicas, selecionadas para você. Descubra a coleção DERDALAX e receba em todo o Moçambique." },
      { property: "og:title", content: "DERDALAX" },
      { name: "twitter:title", content: "DERDALAX" },
      { property: "og:description", content: "Peças únicas, selecionadas para você. Descubra a coleção DERDALAX e receba em todo o Moçambique." },
      { name: "twitter:description", content: "Peças únicas, selecionadas para você. Descubra a coleção DERDALAX e receba em todo o Moçambique." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3c125d24-87fe-42e5-afe6-57632fed97bb/id-preview-aca15444--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app-1779644899816.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3c125d24-87fe-42e5-afe6-57632fed97bb/id-preview-aca15444--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app-1779644899816.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "DERDALAX" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "DERDALAX" },
      { name: "application-name", content: "DERDALAX" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "serviceworker", href: "/sw.js" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },

      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,600&display=swap" },
    ],
    scripts: [
      {
        children:
          "if('serviceWorker' in navigator){try{navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});}catch(e){}}",
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DERDALAX",
          alternateName: "Der Dalax",
          url: "https://derdalax.co.mz",
          logo: "https://derdalax.co.mz/icon-512.png",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "DERDALAX",
          url: "https://derdalax.co.mz",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function AppShell() {
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useOnlinePresence();
  useServiceWorker();


  const { loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const publicPath = isPublicPath(location.pathname);
  const blocked = !loading && !user && !publicPath;

  useEffect(() => {
    if (!blocked) return;
    const target = location.pathname + (location.searchStr ?? "");
    const redirect = safeRedirect(target);
    navigate({
      to: "/login",
      search: redirect && redirect !== "/" ? { redirect } : {},
      replace: true,
    });
  }, [blocked, location.pathname, location.searchStr, navigate]);

  // Visitors: same store navigation, with a fixed "Entrar / Criar conta" CTA in the Navbar.
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pb-20 md:pb-0">
          {!publicPath && (loading || blocked) ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">A carregar…</div>
          ) : (
            <Outlet />
          )}
        </main>
        <BottomNav />
        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <CityAlert />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      
      
      <BottomNav />
      <Suspense fallback={null}>
        <ProfileCompletionModal />
        <InstallAppPrompt />
        <PushAutoPrompt />
      </Suspense>
      <Toaster richColors position="top-right" />

    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CityProvider>
          <CartProvider>
            <AppShell />
          </CartProvider>
        </CityProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

