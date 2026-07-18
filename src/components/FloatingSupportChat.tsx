import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { SupportChat } from "./SupportChat";
import { cn } from "@/lib/utils";

export function FloatingSupportChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar chat" : "Abrir chat de suporte"}
        className={cn(
          "fixed z-50 bottom-24 md:bottom-6 right-4 md:right-6",
          "w-14 h-14 rounded-full shadow-2xl grid place-items-center",
          "bg-ink text-gold hover:scale-105 transition-transform",
        )}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div
          className={cn(
            "fixed z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
            "bottom-40 md:bottom-24 right-4 md:right-6",
            "w-[calc(100vw-2rem)] max-w-[400px]",
            "h-[70vh] max-h-[600px]",
            "flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200",
          )}
        >
          <div className="flex-1 min-h-0 [&>div]:h-full [&>div]:rounded-none [&>div]:border-0">
            <SupportChat />
          </div>
        </div>
      )}
    </>
  );
}
