import NextLink from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CircleGauge,
  MapPinned,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.myurbanai.com";
export const PUBLIC_SIGNUP_URL = `${PUBLIC_APP_URL.replace(/\/$/, "")}/create`;

export function PublicButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "text";
  className?: string;
}) {
  const classes = `public-button public-button--${variant} ${className}`.trim();
  const content = (
    <>
      <span>{children}</span>
      <ArrowRight aria-hidden size={18} strokeWidth={1.8} />
    </>
  );

  return href.startsWith("http") || href.startsWith("mailto:") ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <NextLink href={href} className={classes}>
      {content}
    </NextLink>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={`public-section-heading public-section-heading--${align}`}>
      <p className="public-kicker">{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function ProductPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`product-preview ${compact ? "product-preview--compact" : ""}`}
      aria-label={compact ? "Prévia compacta do painel de recomendação da Urban AI" : "Prévia principal do painel de recomendação da Urban AI"}
    >
      <div className="product-preview__chrome">
        <div className="product-preview__brand">
          <span className="product-preview__mark">U</span>
          <span>URBAN AI</span>
        </div>
        <span className="product-preview__status"><i /> Monitoramento ativo</span>
      </div>

      <div className="product-preview__body">
        <div className="product-preview__summary">
          <div>
            <span className="product-preview__label">Imóvel selecionado</span>
            <strong>Studio · Vila Madalena</strong>
          </div>
          <span className="product-preview__control" aria-hidden="true">Próximos 30 dias</span>
        </div>

        <div className="product-preview__grid">
          <article className="product-preview__recommendation">
            <div className="product-preview__event">
              <CalendarDays aria-hidden size={18} />
              <div>
                <span>Oportunidade detectada</span>
                <strong>Festival no Allianz Parque</strong>
              </div>
            </div>
            <div className="product-preview__price-row">
              <div><span>Preço atual</span><strong>R$ 298</strong></div>
              <ArrowRight aria-hidden size={20} />
              <div><span>Recomendado</span><strong className="is-accent">R$ 357</strong></div>
            </div>
            <div className="product-preview__reason">
              <Sparkles aria-hidden size={17} />
              <p><strong>Por que este valor?</strong> Evento de grande porte, antecedência de 21 dias e deslocamento estimado de 14 minutos.</p>
            </div>
            <div className="product-preview__actions">
              <span>Você mantém a decisão final</span>
              <span className="product-preview__apply" aria-hidden="true">Aplicar recomendação</span>
            </div>
          </article>

          <aside className="product-preview__signals">
            <span className="product-preview__label">Sinais analisados</span>
            <Signal icon={CalendarDays} label="Eventos" value="3 relevantes" />
            <Signal icon={MapPinned} label="Proximidade" value="14 min" />
            <Signal icon={CircleGauge} label="Demanda" value="Em alta" />
            <Signal icon={SlidersHorizontal} label="Limite" value="Dentro da regra" />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Signal({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="product-preview__signal">
      <Icon aria-hidden size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export const productPillars = [
  {
    icon: CalendarDays,
    title: "Agenda urbana em contexto",
    body: "Eventos, feriados e sazonalidade deixam de ser uma lista solta e entram na leitura de cada data.",
  },
  {
    icon: MapPinned,
    title: "Leitura por localização",
    body: "A análise considera a relação entre o imóvel, o bairro e o deslocamento até os pontos de demanda.",
  },
  {
    icon: Sparkles,
    title: "Recomendação explicável",
    body: "Cada sugestão mostra os sinais usados para você decidir com contexto, não no escuro.",
  },
  {
    icon: SlidersHorizontal,
    title: "Controle operacional",
    body: "Aplique manualmente ou defina limites para automação. A estratégia continua sendo sua.",
  },
];

export function PillarGrid({ items = productPillars }: { items?: typeof productPillars }) {
  return (
    <div className="public-feature-grid">
      {items.map(({ icon: Icon, title, body }, index) => (
        <article className="public-feature" key={title}>
          <div className="public-feature__top">
            <Icon aria-hidden size={21} />
            <span>{String(index + 1).padStart(2, "0")}</span>
          </div>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </div>
  );
}

export function TrustBar() {
  return (
    <div className="public-trust-bar" aria-label="Princípios do produto">
      <TrustItem icon={ShieldCheck} text="Controle humano" />
      <TrustItem icon={Sparkles} text="Recomendações explicadas" />
      <TrustItem icon={SlidersHorizontal} text="Automação opcional" />
      <TrustItem icon={Building2} text="Feito para anfitriões e gestoras" />
    </div>
  );
}

function TrustItem({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <span><Icon aria-hidden size={17} /> {text}</span>;
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="public-check-list">
      {items.map((item) => <li key={item}><Check aria-hidden size={17} /> <span>{item}</span></li>)}
    </ul>
  );
}

export function FinalCommercialCta({
  eyebrow = "Comece agora",
  title = "Sua próxima decisão de preço pode ter mais contexto.",
  body = "Crie sua conta, cadastre seu primeiro imóvel e acompanhe recomendações no painel da Urban AI.",
}: {
  eyebrow?: string;
  title?: ReactNode;
  body?: ReactNode;
}) {
  return (
    <section className="public-final-cta">
      <div className="public-container public-final-cta__inner">
        <div>
          <p className="public-kicker">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <div className="public-final-cta__actions">
          <PublicButton href={PUBLIC_SIGNUP_URL}>Criar minha conta</PublicButton>
          <PublicButton href="/contato" variant="secondary">Falar com a Urban</PublicButton>
        </div>
      </div>
    </section>
  );
}
