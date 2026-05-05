import {
  ArrowRight,
  Brain,
  CalendarClock,
  Check,
  Layers,
  Link2,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import NextLink from "next/link";
import { Metadata } from "next";

/**
 * Landing institucional principal (myurbanai.com/).
 *
 * Servida pelo middleware via rewrite "/" → "/landing" quando o host é
 * myurbanai.com. Em app.myurbanai.com não é acessível (middleware redireciona
 * /landing para o apex).
 *
 * Diferente da `/lancamento` que é uma campanha específica de pré-lançamento,
 * esta é a porta de entrada permanente do site público — explica o produto,
 * mostra o problema/solução, planos e CTA para waitlist.
 */
export const metadata: Metadata = {
  title: "Urban AI · Precificação dinâmica para anfitriões Airbnb",
  description:
    "Plataforma de IA que precifica seu Airbnb cruzando eventos da cidade, demanda local e padrões históricos. +30% receita potencial, sem vigiar a agenda manualmente.",
  openGraph: {
    title: "Urban AI · Precificação dinâmica para anfitriões Airbnb",
    description:
      "IA + eventos da cidade que blindam seu calendário. Cobrança por imóvel, sem fidelidade.",
    type: "website",
  },
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.myurbanai.com";
const WAITLIST_URL = `${APP_URL.replace(/\/$/, "")}/create`;

export default function LandingPage() {
  return (
    <>
      {/* ============== HERO ============== */}
      <section className="relative bg-gradient-to-b from-[#070B14] to-[#0A0F1D] text-slate-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-32 md:pt-32 md:pb-40 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-900/30 text-blue-300 font-semibold mb-8 border border-blue-800/50 text-xs">
            <Zap size={14} /> Pré-lançamento aberto
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight max-w-4xl mx-auto">
            Cada noite vazia ou subprecificada custa{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
              R$ 200 a R$ 800
            </span>{" "}
            que você nunca vai recuperar.
          </h1>

          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">
            A Urban AI cruza eventos da cidade, demanda local e seu histórico
            para sugerir o preço certo todo dia — automaticamente, sem você
            precisar olhar a agenda da cidade.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-12">
            <a
              href={WAITLIST_URL}
              className="bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold text-base md:text-lg py-4 px-8 rounded-full inline-flex gap-2 items-center transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:-translate-y-0.5"
            >
              Garantir meu acesso <ArrowRight size={20} />
            </a>
            <NextLink
              href="/precos"
              className="text-slate-300 hover:text-white font-semibold py-4 px-6 inline-flex items-center gap-1 transition-colors"
            >
              Ver planos →
            </NextLink>
          </div>

          <p className="text-xs text-slate-500">
            Cobrança por imóvel · Cancele quando quiser · Setup em minutos
          </p>
        </div>

        {/* Glow gradients de fundo */}
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* ============== PROBLEMA ============== */}
      <section className="bg-[#0A0F1D] text-slate-50 py-20 px-6 border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center">
            O preço errado tem 3 sintomas. Algum é familiar?
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-14">
            Anfitriões experientes perdem 20–40% de receita silenciosamente. A
            culpa quase nunca é do imóvel.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProblemCard
              icon={<CalendarClock size={28} />}
              title="Lota cedo demais"
              description="Os finais de semana de feriado esgotaram em janeiro? Você precificou antes dos eventos serem anunciados — alguém pagaria 60% a mais."
              accent="text-red-400"
            />
            <ProblemCard
              icon={<TrendingUp size={28} />}
              title="Preço estático em mercado dinâmico"
              description="A média do bairro varia 3–4x por mês conforme show, congresso, feriado. Você não consegue acompanhar manualmente — e nem deveria."
              accent="text-amber-400"
            />
            <ProblemCard
              icon={<Layers size={28} />}
              title="Concorrência invisível"
              description="Imóvel novo na sua rua, mais barato e melhor avaliado, ofusca o seu nas buscas. Você só descobre quando o calendário já está vazio."
              accent="text-blue-400"
            />
          </div>
        </div>
      </section>

      {/* ============== SOLUÇÃO — Como funciona ============== */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center text-slate-900">
            A IA olha pra cidade inteira por você.
          </h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-16">
            Em 4 passos, você ganha o que faltava: contexto + tempo + decisão
            quantificada.
          </p>

          <div className="space-y-12">
            <StepRow
              step="1"
              icon={<Link2 size={24} />}
              title="Conecta seu Airbnb (ou Stays)"
              description="Setup leva 3 minutos. Importamos seus imóveis automaticamente — você não precisa cadastrar nada manual."
            />
            <StepRow
              step="2"
              icon={<Brain size={24} />}
              title="Mapeamos eventos no raio do imóvel"
              description="Shows, congressos, feriados, partidas, festivais, formaturas. Calculamos travel time real (não só distância em km) para entender quem é vizinho de fato do evento."
            />
            <StepRow
              step="3"
              icon={<TrendingUp size={24} />}
              title="Cruzamos com dados de mercado e seu histórico"
              description="Modelo proprietário aprende com cada análise: comps na sua faixa, sazonalidade do bairro, quanto seu imóvel especificamente respondeu a aumentos passados."
            />
            <StepRow
              step="4"
              icon={<Zap size={24} />}
              title="Recomenda — ou aplica direto via Stays"
              description="Modo Recomendação: você decide. Modo Automático: a IA aplica respeitando os tetos que você define (ex.: nunca subir mais que 25% num dia). Você dorme tranquilo."
            />
          </div>
        </div>
      </section>

      {/* ============== DIFERENCIAIS ============== */}
      <section className="bg-slate-50 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center text-slate-900">
            Por que a Urban AI é diferente
          </h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-14">
            Não é mais uma extensão do Airbnb que olha só preço. É um motor de
            revenue management feito pra Brasil.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DiffCard
              icon={<Brain className="text-blue-600" size={28} />}
              title="Dataset proprietário, não scraping"
              description="A cada análise gerada, alimentamos nosso próprio histórico de preços, ocupação e eventos. Em meses, isso vira um motor que ninguém consegue reproduzir copiando produto."
            />
            <DiffCard
              icon={<Layers className="text-emerald-600" size={28} />}
              title="Modelo escala com você"
              description="Começamos com regras inteligentes, evoluímos para XGBoost quando temos dados, depois para um modelo neural híbrido. Você só vê o preço melhorando — sem migração de plataforma."
            />
            <DiffCard
              icon={<ShieldCheck className="text-orange-600" size={28} />}
              title="Integração Stays Preferred+"
              description="Somos parceiros do canal Preferred+ da Stays — pushar preço pro Airbnb é nativo, não scraping nem hack. Mesma confiabilidade da própria Stays."
            />
            <DiffCard
              icon={<TrendingUp className="text-purple-600" size={28} />}
              title="Foco no Brasil"
              description="Eventos brasileiros (Sympla, Eventbrite, prefeituras), feriados regionais, peculiaridades de Carnaval, Réveillon, eleições, festivais. Concorrentes globais ignoram tudo isso."
            />
          </div>
        </div>
      </section>

      {/* ============== PRICING SUMMARY ============== */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center text-slate-900">
            Você só paga pelo que de fato usa
          </h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-14">
            Cobrança <strong>por imóvel</strong>, não por plano flat. Quanto
            mais você usa, menor o preço por unidade — e nada cobrado por
            funcionalidade que você não precisa.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <PricingTeaser
              name="Starter"
              priceFrom="R$ 97"
              suffix="/imóvel/mês"
              tagline="Para 1 a 3 imóveis"
              features={[
                "Análises ilimitadas",
                "Recomendações por evento",
                "Painel completo",
                "E-mail de oportunidade",
              ]}
            />
            <PricingTeaser
              name="Profissional"
              priceFrom="R$ 67"
              suffix="/imóvel/mês"
              tagline="A partir de 4 imóveis"
              highlight
              features={[
                "Tudo do Starter",
                "Integração Stays (auto)",
                "API/webhooks",
                "Suporte prioritário",
              ]}
            />
            <PricingTeaser
              name="Escala"
              priceFrom="Sob consulta"
              suffix=""
              tagline="20+ imóveis ou rede"
              features={[
                "Onboarding dedicado",
                "SLA personalizado",
                "Relatórios executivos",
                "Multi-conta",
              ]}
            />
          </div>

          <div className="text-center">
            <NextLink
              href="/precos"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
            >
              Ver tabela completa com 4 ciclos de pagamento <ArrowRight size={18} />
            </NextLink>
          </div>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section className="bg-slate-50 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12 text-center text-slate-900">
            Dúvidas comuns
          </h2>

          <div className="space-y-3">
            <FAQItem
              q="Vocês precificam pra todo o Brasil?"
              a="Hoje cobrimos São Paulo capital com profundidade total. Outras capitais entram conforme nosso pipeline de eventos amadurecer (RJ, Belo Horizonte, Curitiba e Porto Alegre são os próximos). Se você tem imóvel fora dessa lista, entre na lista de espera — avisamos quando abrirmos."
            />
            <FAQItem
              q="Preciso integrar com Stays para usar?"
              a="Não. No modo Recomendação você recebe sugestões e aplica manualmente no Airbnb (ou onde quer que anuncie). A integração com Stays é só para quem quer modo Automático — onde a Urban AI aplica o preço sem você precisar abrir nada."
            />
            <FAQItem
              q="Como vocês garantem que o preço não vai ficar errado?"
              a="No modo Automático você define tetos de variação (ex.: nunca subir mais que 25% ou descer mais que 20% num único dia). Toda mudança é logada — você vê histórico completo de cada decisão da IA. Se algo parecer estranho, basta pausar com um clique."
            />
            <FAQItem
              q="Os meus dados ficam seguros?"
              a="Sim. Não vendemos dados, nunca. Senhas armazenadas como bcrypt, tráfego TLS 1.3, banco criptografado em repouso, backup off-site diário. Conformidade LGPD com DPO designado e processo de exclusão de conta documentado."
            />
            <FAQItem
              q="Posso cancelar quando quiser?"
              a="Sim. O cancelamento é direto pelo painel — sem ligação, sem fidelidade. Você mantém acesso até o final do ciclo já pago e depois a conta vira read-only (você não perde histórico)."
            />
            <FAQItem
              q="O que vocês NÃO fazem?"
              a="Não somos OTA, corretora nem hospedagem — não vendemos diárias nem captamos hóspedes para você. Só ajudamos a precificar melhor os anúncios que você já tem. Promessa simples, escopo focado."
            />
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="bg-gradient-to-b from-[#0A0F1D] to-[#070B14] text-slate-50 py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Garanta seu lugar antes da abertura geral
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
            Estamos abrindo acesso por convite, na ordem da lista de espera.
            Quem entra agora também ganha posições subindo na fila a cada
            indicação.
          </p>

          <a
            href={WAITLIST_URL}
            className="bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold text-base md:text-lg py-4 px-10 rounded-full inline-flex gap-2 items-center transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:-translate-y-0.5"
          >
            Entrar na lista de espera <ArrowRight size={20} />
          </a>

          <p className="mt-6 text-xs text-slate-500">
            Sem compromisso · 100% gratuito · Você só vê preço no convite final
          </p>
        </div>
      </section>
    </>
  );
}

// =================== Subcomponents ===================

function ProblemCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="bg-[#070B14] border border-slate-800 p-6 rounded-2xl flex flex-col gap-3">
      <div className={`bg-slate-800/50 p-3 rounded-xl w-fit ${accent}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepRow({
  step,
  icon,
  title,
  description,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
      <div className="flex-shrink-0 flex items-center gap-3">
        <div className="text-3xl font-extrabold text-blue-600 w-10">{step}</div>
        <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">{icon}</div>
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function DiffCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-3">
      <div>{icon}</div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function PricingTeaser({
  name,
  priceFrom,
  suffix,
  tagline,
  features,
  highlight = false,
}: {
  name: string;
  priceFrom: string;
  suffix: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative bg-white rounded-2xl p-8 ${
        highlight
          ? "border-2 border-orange-400 shadow-lg shadow-orange-200/50"
          : "border border-slate-200"
      }`}
    >
      {highlight && (
        <span className="absolute top-0 right-6 -translate-y-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          Mais escolhido
        </span>
      )}
      <h3 className="text-xl font-bold text-slate-900 mb-1">{name}</h3>
      <p className="text-slate-500 text-sm mb-4">{tagline}</p>
      <div className="mb-6">
        <span className="text-3xl font-extrabold text-slate-900">{priceFrom}</span>
        {suffix && <span className="text-sm text-slate-500 ml-1">{suffix}</span>}
      </div>
      <ul className="space-y-2 text-sm text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-white border border-slate-200 rounded-xl overflow-hidden">
      <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between gap-3 font-semibold text-slate-900 hover:bg-slate-50 transition-colors">
        <span>{q}</span>
        <span className="text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">
          +
        </span>
      </summary>
      <div className="px-6 pb-5 text-slate-600 leading-relaxed text-sm">{a}</div>
    </details>
  );
}
