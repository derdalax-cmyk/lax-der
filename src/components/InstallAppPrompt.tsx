import brandIcon192 from "@/assets/derdalax-icon-192.png.asset.json";
import { useEffect, useState } from "react";
import { Download, X, Share, Zap, Bell, Smartphone, WifiOff, ChevronUp } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-session";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
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
  const [expanded, setExpanded] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

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
      sessionStorage.setItem(DISMISS_KEY, "1");
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

  const benefits = [
    { icon: Zap, text: "Mais rápido — abre num instante, sem browser" },
    { icon: WifiOff, text: "Funciona mesmo com internet fraca" },
    { icon: Bell, text: "Receba avisos de pedidos e novidades" },
    { icon: Smartphone, text: "Atalho direto no ecrã inicial" },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto rounded-2xl border border-gold/30 bg-ink text-white shadow-elegant overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold font-display text-2xl overflow-hidden">
            <img src={brandIcon192.url} alt="Derdalax" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm leading-tight">Instalar app Derdalax</p>
            <p className="text-xs text-white/60 truncate">
              {expanded ? "Toque em Instalar para adicionar ao ecrã inicial." : "Mais rápido, offline e com notificações."}
            </p>
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

        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-white/50 hover:text-gold py-1.5 border-t border-white/5 transition-colors"
        >
          {expanded ? "Ocultar detalhes" : "Porquê instalar?"}
          <ChevronUp className={`h-3 w-3 transition-transform ${expanded ? "" : "rotate-180"}`} />
        </button>

        {expanded && (
          <ul className="border-t border-white/10 px-4 py-3 space-y-2.5">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-xs text-white/80">
                <Icon className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        )}

        {showIosHelp && (
          <div className="border-t border-white/10 px-4 py-3 text-xs text-white/70">
            No iPhone/iPad: toque em{" "}
            <Share className="inline h-3.5 w-3.5 align-text-bottom text-gold" /> (Partilhar) e
            escolha <span className="text-white">"Adicionar ao ecrã principal"</span>.
          </div>
        )}
      </div>
    </div>
  );
}
