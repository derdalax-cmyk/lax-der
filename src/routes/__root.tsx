import brandIcon192 from "@/assets/derdalax-icon-192.png.asset.json";
import brandIcon512 from "@/assets/derdalax-icon-512.png.asset.json";
import brandAppleTouchIcon from "@/assets/derdalax-apple-touch-icon.png.asset.json";
import brandFavicon32 from "@/assets/derdalax-favicon-32.png.asset.json";
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
import { ListContextRestorer } from "@/components/ListContextRestorer";
import { restorePublicCatalogue } from "@/lib/publicCatalogCache";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CityProvider } from "@/contexts/CityContext";
import { Navbar } from "@/components/Navbar";
import { CityAlert } from "@/components/CityAlert";
import { BottomNav } from "@/components/BottomNav";

import { Toaster } from "@/components/ui/sonner";
import { RoletaReferralCapture } from "@/components/roleta/RoletaHome";
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
  beforeLoad: ({ context }) => restorePublicCatalogue(context.queryClient),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Derdalax" },
      { name: "description", content: "Peças únicas, selecionadas para você. Descubra a coleção Derdalax e receba em todo o Moçambique." },
      { property: "og:title", content: "Derdalax" },
      { name: "twitter:title", content: "Derdalax" },
      { property: "og:description", content: "Peças únicas, selecionadas para você. Descubra a coleção Derdalax e receba em todo o Moçambique." },
      { name: "twitter:description", content: "Peças únicas, selecionadas para você. Descubra a coleção Derdalax e receba em todo o Moçambique." },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Derdalax" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Derdalax" },
      { name: "application-name", content: "Derdalax" },
      { name: "google-site-verification", content: "P9NgOAAqJNbD7Q8jJxiUScib38wAtROxkPqKRJlsDnE" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico?v=der-20261103", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: brandFavicon32.url },
      { rel: "icon", type: "image/png", sizes: "192x192", href: brandIcon192.url },
      { rel: "icon", type: "image/png", sizes: "512x512", href: brandIcon512.url },
      { rel: "apple-touch-icon", sizes: "180x180", href: brandAppleTouchIcon.url },

      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Derdalax",
          alternateName: "Derdalax",
          url: "https://derdalax.co.mz/",
          logo: `https://derdalax.co.mz${brandIcon512.url}`,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Derdalax",
          alternateName: "Derdalax",
          url: "https://derdalax.co.mz/",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: (props) => <ErrorComponent error={props.error as Error} reset={props.reset} />,
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
        <RoletaReferralCapture />
        <ListContextRestorer />
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
        <RoletaReferralCapture />
        <ListContextRestorer />

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

