import { Instagram, MapPin, Phone, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Logo } from "../Logo";
import { INSTAGRAM_URL, WHATSAPP_NUMBER_FORMATTED, whatsappLink } from "@/lib/contact";

export function SiteFooter() {
  return (
    <footer className="bg-ink px-6 pb-12 pt-4 text-white/55">
      <div className="mx-auto grid max-w-7xl gap-10 border-t border-white/10 pt-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center">
            <Logo className="h-7 sm:h-8" />
          </div>
          <p className="mt-4 max-w-xs text-sm">
            Criamos ideias. Materializamos possibilidades.
          </p>
          <Link
            to="/impressao-3d-goiania"
            className="mt-4 inline-flex items-center gap-1 text-sm text-white/55 transition-colors hover:text-white"
          >
            Impressão 3D em Goiânia <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-white/60">Localização</h2>
          <p className="mt-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" /> Goiânia, GO — Brasil
          </p>
        </div>
        <div className="text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-white/60">Contato</h2>
          <a
            href={whatsappLink("Olá, 3D Create!")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 transition-colors hover:text-white"
          >
            <Phone className="h-4 w-4 shrink-0" /> WhatsApp {WHATSAPP_NUMBER_FORMATTED}
          </a>
        </div>
        <div className="text-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-white/60">Social</h2>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 transition-colors hover:text-white"
          >
            <Instagram className="h-4 w-4 shrink-0" /> @3d.create_
          </a>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-7xl text-xs text-white/25">
        © {new Date().getFullYear()} 3D Create · Goiânia, GO
      </p>
    </footer>
  );
}