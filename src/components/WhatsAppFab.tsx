import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { whatsappLink, WHATSAPP_NUMBER_FORMATTED } from "@/lib/contact";

export function WhatsAppFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <div
        className={`max-w-[260px] rounded-2xl bg-white px-4 py-3 text-sm text-ink shadow-xl transition-all duration-500 ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2 rounded-full p-1 text-ink/50 transition-colors hover:text-ink"
          aria-label="Fechar balão"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="pr-5 font-medium">Fale com a 3D Create</p>
        <p className="mt-1 text-ink/70">
          Toque para conversar pelo WhatsApp.
        </p>
        <a
          href={whatsappLink("Olá! Vim pelo site da 3D Create e quero um orçamento.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#128C7E] transition-colors hover:text-[#075E54]"
        >
          <MessageCircle className="h-4 w-4" /> {WHATSAPP_NUMBER_FORMATTED}
        </a>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Falar no WhatsApp"
        className="brand-gradient relative grid h-14 w-14 place-items-center rounded-full text-primary-foreground shadow-[0_10px_40px_-8px_oklch(0.56_0.26_305/0.8)] transition-transform duration-500 hover:scale-110"
      >
        <span className="brand-gradient absolute inset-0 -z-10 animate-ping rounded-full opacity-40 [animation-duration:2.8s]" />
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
