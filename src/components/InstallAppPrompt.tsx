import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    // iOS doesn't fire beforeinstallprompt — show manual hint
    if (isIOS()) setVisible(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIosHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setVisible(false);
    } else if (isIOS()) {
      setShowIosHelp((v) => !v);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto rounded-2xl border border-gold/30 bg-ink text-white shadow-elegant overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold font-display text-2xl">
            D
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm leading-tight">Instalar app DERDALAX</p>
            <p className="text-xs text-white/60 truncate">Acesso rápido, direto do ecrã inicial.</p>
          </div>
          <button
            onClick={install}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-sm font-medium text-ink hover:bg-gold/90 transition-colors shrink-0"
          >
            <Download className="h-4 w-4" /> Instalar
          </button>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {showIosHelp && (
          <div className="border-t border-white/10 px-4 py-3 text-xs text-white/70">
            No iPhone/iPad: toque em{" "}
            <Share className="inline h-3.5 w-3.5 align-text-bottom text-gold" /> (Partilhar) e
            escolha <span className="text-white">“Adicionar ao ecrã principal”</span>.
          </div>
        )}
      </div>
    </div>
  );
}
