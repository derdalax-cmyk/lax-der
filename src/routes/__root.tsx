import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CityProvider } from "@/contexts/CityContext";
import { Navbar } from "@/components/Navbar";
import { CityAlert } from "@/components/CityAlert";
import { BottomNav } from "@/components/BottomNav";

import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { ProfileCompletionModal } from "@/components/ProfileCompletionModal";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { PushAutoPrompt } from "@/components/PushAutoPrompt";


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
      { title: "DERDALAX · Moda com história" },
      { name: "description", content: "Loja de moda em Moçambique. Peças únicas e coleções selecionadas." },
      { property: "og:title", content: "DERDALAX · Moda com história" },
      { name: "twitter:title", content: "DERDALAX · Moda com história" },
      { property: "og:description", content: "Loja de moda em Moçambique. Peças únicas e coleções selecionadas." },
      { name: "twitter:description", content: "Loja de moda em Moçambique. Peças únicas e coleções selecionadas." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3c125d24-87fe-42e5-afe6-57632fed97bb/id-preview-aca15444--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app-1779644899816.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3c125d24-87fe-42e5-afe6-57632fed97bb/id-preview-aca15444--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app-1779644899816.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "DERDALAX" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" },
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

  const { loading } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <CityAlert />
      <main className="flex-1 pb-20 md:pb-0">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">A carregar…</div>
        ) : (
          <Outlet />
        )}
      </main>
      
      <BottomNav />
      <ProfileCompletionModal />
      <InstallAppPrompt />
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

