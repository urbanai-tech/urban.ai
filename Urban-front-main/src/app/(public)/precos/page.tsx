import { ArrowRight, Check } from "lucide-react";
import NextLink from "next/link";
import { Metadata } from "next";

/**
 * /precos — pricing pública (visão resumida).
 *
 * NÃO é o checkout — checkout vive no app autenticado em /plans
 * (app.myurbanai.com/plans). Aqui é vitrine pública pra trazer o usuário
 * pra criar conta. Mostra os 3 planos × 4 ciclos de cobrança em formato
 * legível, com FAQ específico de pricing.
 */
export const metadata: Metadata = {
  title: "Preços · Urban AI",
  description:
    "Cobrança por imóvel, 4 ciclos com desconto progressivo. Sem fidelidade, cancele quando quiser. Veja todos os planos.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.myurbanai.com";
const SIGNUP_URL = `${APP_URL.replace(/\/$/, "")}/create`;

const STARTER_TIERS = [
  { cycle: "Mensal", price: "R$ 149", per: "/imóvel/mês", note: "—" },
  { cycle: "Trimestral", price: "R$ 129", per: "/imóvel/mês", note: "13% off" },
  { cycle: "Semestral", price: "R$ 109", per: "/imóvel/mês", note: "27% off" },
  { cycle: "Anual", price: "R$ 97", per: "/imóvel/mês", note: "35% off" },
];

const PROFISSIONAL_TIERS = [
  { cycle: "Mensal", price: "R$ 99", per: "/imóvel/mês", note: "—" },
  { cycle: "Trimestral", price: "R$ 85", per: "/imóvel/mês", note: "14% off" },
  { cycle: "Semestral", price: "R$ 72", per: "/imóvel/mês", note: "27% off" },
  { cycle: "Anual", price: "R$ 67", per: "/imóvel/mês", note: "32% off" },
];

export default function PrecosPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white px-6 pt-20 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Preços simples, sem surpresa
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Você paga <strong>por imóvel</strong> e escolhe o ciclo que faz
            mais sentido. Quanto mais imóveis e mais longo o ciclo, menor o
            preço por unidade.
          </p>
        </div>
      </section>

      {/* Plano Starter */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <PlanBlock
            name="Starter"
            tagline="Para anfitriões com 1 a 3 imóveis"
            description="Comece a usar o motor de eventos da Urban AI sem complicação. Recomendações chegam por e-mail e painel — você aplica manualmente no Airbnb."
            tiers={STARTER_TIERS}
            features={[
              "Análises ilimitadas em imóveis cadastrados",
              "Recomendações por evento próximo",
              "Painel de imóvel + cálculo de uplift",
              "E-mail de oportunidade quando evento mexe na demanda",
              "Histórico completo de recomendações",
              "Suporte por e-mail",
            ]}
          />
        </div>
      </section>

      {/* Plano Profissional */}
      <section className="px-6 py-12 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <PlanBlock
            name="Profissional"
            tagline="Para anfitriões com 4 a 19 imóveis"
            description="Desbloqueia o modo Automático via integração Stays — a Urban AI aplica o preço sem você precisar abrir nada. Para quem leva como negócio."
            tiers={PROFISSIONAL_TIERS}
            features={[
              "Tudo do Starter +",
              "Integração Stays (push automático de preço)",
              "Modo Automático com tetos de variação configuráveis",
              "Webhooks e API para integrações próprias",
              "Suporte prioritário (resposta em até 4h úteis)",
              "Relatório mensal consolidado",
            ]}
            highlight
          />
        </div>
      </section>

      {/* Plano Escala */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              <div className="md:col-span-2">
                <h3 className="text-2xl md:text-3xl font-bold mb-2">Escala</h3>
                <p className="text-slate-300 mb-4">
                  Para redes, gestoras com 20+ imóveis ou operações
                  multi-conta. Onboarding dedicado, SLA personalizado e
                  relatórios executivos.
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    Tudo do Profissional +
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    Multi-conta com gestor consolidado
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    Onboarding dedicado e treinamento da equipe
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    SLA contratual + suporte WhatsApp dedicado
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    Relatórios executivos personalizados
                  </li>
                </ul>
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Investimento
                </p>
                <p className="text-2xl font-bold mb-4">Sob consulta</p>
                <a
                  href="https://wa.me/seunumerodevendas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold py-3 px-6 rounded-full"
                >
                  Falar com consultor <ArrowRight size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ pricing */}
      <section className="px-6 py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-10">
            Perguntas sobre cobrança
          </h2>

          <div className="space-y-3">
            <FAQ
              q="Como funciona a 'cobrança por imóvel'?"
              a="Você escolhe um plano (Starter ou Profissional) e o ciclo de pagamento. Multiplicamos preço × imóveis × ciclo. Exemplo: Profissional anual com 5 imóveis = R$ 67 × 5 × 12 = R$ 4.020 cobrados de uma vez, com 32% de desconto vs. mensal."
            />
            <FAQ
              q="O que acontece se eu adicionar mais imóveis no meio do ciclo?"
              a="Você atualiza a quantidade no painel — a cobrança proporcional é feita automaticamente para o restante do ciclo. Sem trocar de plano nem reiniciar a assinatura."
            />
            <FAQ
              q="E se eu remover imóveis?"
              a="Você mantém a quota até o fim do ciclo (não há crédito retroativo). No próximo ciclo, a cobrança ajusta para o número atual."
            />
            <FAQ
              q="Posso pagar mensal e mudar pra anual depois?"
              a="Sim. Pode trocar de ciclo a qualquer momento. O valor já pago vira crédito proporcional no novo ciclo."
            />
            <FAQ
              q="Posso cancelar?"
              a="Sim, sem fidelidade. Cancela direto pelo painel. Você mantém acesso até o fim do ciclo já pago. Não fazemos reembolso proporcional para ciclo já iniciado, exceto quando exigido por lei."
            />
            <FAQ
              q="Tem teste gratuito?"
              a="No pré-lançamento estamos abrindo trials individuais conforme convite — entre na lista de espera para receber. No go-live oficial, planejamos 7 a 14 dias gratuitos sem cartão."
            />
            <FAQ
              q="Vocês aceitam Pix, boleto?"
              a="Sim. O processamento de pagamento é via Stripe — aceita cartão de crédito, débito, Pix e boleto bancário (com 2 dias úteis de processamento)."
            />
            <FAQ
              q="Tem nota fiscal?"
              a="Sim, emitida automaticamente após cada cobrança. Você baixa pelo painel."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#070B14] text-white px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para começar?
          </h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            No pré-lançamento, o acesso é por convite. Entre na lista de
            espera e libere antes da abertura geral.
          </p>
          <a
            href={SIGNUP_URL}
            className="bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold py-4 px-10 rounded-full inline-flex gap-2 items-center transition-all duration-300"
          >
            Entrar na lista <ArrowRight size={20} />
          </a>
        </div>
      </section>
    </div>
  );
}

// =================== Subcomponents ===================

function PlanBlock({
  name,
  tagline,
  description,
  tiers,
  features,
  highlight = false,
}: {
  name: string;
  tagline: string;
  description: string;
  tiers: { cycle: string; price: string; per: string; note: string }[];
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-8 md:p-10 ${
        highlight ? "border-2 border-orange-400 shadow-xl" : "border border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-baseline gap-3 md:gap-4 mb-1">
        <h2 className="text-3xl font-bold text-slate-900">{name}</h2>
        {highlight && (
          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full self-start md:self-baseline">
            Mais escolhido
          </span>
        )}
      </div>
      <p className="text-slate-500 mb-3">{tagline}</p>
      <p className="text-slate-700 mb-8 max-w-2xl">{description}</p>

      {/* Grid de ciclos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {tiers.map((t) => (
          <div
            key={t.cycle}
            className="border border-slate-200 rounded-xl p-4 bg-slate-50/50"
          >
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              {t.cycle}
            </p>
            <p className="text-xl font-bold text-slate-900">{t.price}</p>
            <p className="text-xs text-slate-500 mb-1">{t.per}</p>
            {t.note !== "—" && (
              <p className="text-xs font-bold text-emerald-600">{t.note}</p>
            )}
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm text-slate-700">
            <Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-white border border-slate-200 rounded-xl overflow-hidden">
      <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between gap-3 font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
        <span>{q}</span>
        <span className="text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">
          +
        </span>
      </summary>
      <div className="px-6 pb-5 text-slate-600 leading-relaxed text-sm">{a}</div>
    </details>
  );
}
