import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-ink text-white/80 mt-20">
      <div className="max-w-[1400px] mx-auto px-5 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <div className="font-display text-2xl font-bold text-gold tracking-wider mb-3">DERDALAX</div>
          <p className="text-sm text-white/60 leading-relaxed">
            Moda com história. Peças únicas e coleções selecionadas, entregues em todo o Moçambique.
          </p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Loja</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/produtos" className="hover:text-gold">Produtos</Link></li>
            <li><Link to="/categorias" className="hover:text-gold">Categorias</Link></li>
            <li><Link to="/carrinho" className="hover:text-gold">Carrinho</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Suporte</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/suporte" className="hover:text-gold">Ajuda & FAQ</Link></li>
            <li><Link to="/politica-privacidade" className="hover:text-gold">Política de Privacidade</Link></li>
            <li><a href="https://wa.me/258840000000" className="hover:text-gold inline-flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Siga-nos</h4>
          <div className="flex gap-4">
            <a href="#" aria-label="Instagram" className="hover:text-gold"><Instagram className="w-5 h-5" /></a>
            <a href="#" aria-label="Facebook" className="hover:text-gold"><Facebook className="w-5 h-5" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-5 py-5 text-xs text-white/50 flex justify-between">
          <span>© {new Date().getFullYear()} DERDALAX. Todos os direitos reservados.</span>
          <span>Maputo · Moçambique</span>
        </div>
      </div>
    </footer>
  );
}
