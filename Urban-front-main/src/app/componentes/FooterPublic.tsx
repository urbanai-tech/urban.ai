import NextLink from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PUBLIC_SIGNUP_URL } from "./PublicMarketing";

const groups = [
  {
    title: "Produto",
    links: [
      ["Como funciona", "/#como-funciona"],
      ["Preços", "/precos"],
      ["Integração Stays", "/integracao-stays-precificacao-automatica"],
      ["Criar conta", PUBLIC_SIGNUP_URL],
    ],
  },
  {
    title: "Conteúdo",
    links: [
      ["Precificação dinâmica", "/precificacao-dinamica-airbnb"],
      ["Preços em dias de eventos", "/como-precificar-airbnb-em-dias-de-eventos"],
      ["Urban AI vs. planilha", "/urban-ai-vs-planilha-de-precificacao"],
      ["Segurança e LGPD", "/seguranca-lgpd-ia-precificacao"],
    ],
  },
  {
    title: "Empresa",
    links: [
      ["Sobre", "/sobre"],
      ["Contato", "/contato"],
      ["Privacidade", "/privacidade"],
      ["Termos de uso", "/termos"],
    ],
  },
];

export default function FooterPublic() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="public-footer__lead">
          <div>
            <p className="public-kicker">Precificação com contexto urbano</p>
            <h2>Veja a cidade antes que ela apareça no calendário.</h2>
          </div>
          <a href={PUBLIC_SIGNUP_URL}>Criar minha conta <ArrowUpRight aria-hidden size={20} /></a>
        </div>

        <div className="public-footer__grid">
          <div className="public-footer__brand">
            <NextLink href="/" className="public-wordmark" aria-label="Urban AI — página inicial">
              <span>URBAN</span><i>AI</i>
            </NextLink>
            <p>Inteligência de preço para anfitriões e gestoras de aluguel por temporada.</p>
            <a href="mailto:contato@myurbanai.com">contato@myurbanai.com</a>
          </div>
          {groups.map((group) => (
            <div className="public-footer__column" key={group.title}>
              <p>{group.title}</p>
              {group.links.map(([label, href]) => href.startsWith("http") ? (
                <a key={href} href={href}>{label}</a>
              ) : (
                <NextLink key={href} href={href}>{label}</NextLink>
              ))}
            </div>
          ))}
        </div>

        <div className="public-footer__bottom">
          <span>© {new Date().getFullYear()} Urban AI. Todos os direitos reservados.</span>
          <span>Feito em São Paulo.</span>
        </div>
      </div>
    </footer>
  );
}
