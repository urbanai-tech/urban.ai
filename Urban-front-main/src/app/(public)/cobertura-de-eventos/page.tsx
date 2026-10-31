import type { Metadata } from "next";
import { CalendarCheck, ClipboardCheck, ScanSearch, UserCheck, type LucideIcon } from "lucide-react";
import { JsonLd, buildSeoMetadata, webPageJsonLd } from "../../lib/seo";
import { FinalCommercialCta, SectionHeading } from "../../componentes/PublicMarketing";
import CoverageStats from "./CoverageStats";
import { parsePublicCoverage, type PublicCoverage } from "./coverage-domain";
import styles from "./page.module.css";

const TITLE = "Cobertura de eventos de São Paulo | My Urban AI";
const DESCRIPTION =
  "Quantos dos grandes eventos de São Paulo o My Urban já acompanhava no último mês? Medimos o recall contra uma lista de referência auditada e publicamos só o que dá para provar.";

export const metadata: Metadata = buildSeoMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/cobertura-de-eventos",
});

// Mesmo resumo do endpoint público; cache curto porque a medição é diária.
const REVALIDATE_SECONDS = 1800;
const FETCH_TIMEOUT_MS = 4000;

async function getCoverage(): Promise<PublicCoverage | null> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!base) return null;
  try {
    const response = await fetch(`${base}/public/event-coverage`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return parsePublicCoverage(await response.json());
  } catch {
    return null;
  }
}

function Step({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article>
      <Icon aria-hidden size={26} />
      <h3 className={styles.stepTitle}>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

export default async function CoberturaDeEventosPage() {
  const coverage = await getCoverage();

  return (
    <main className="urban-manifesto urban-public-page">
      <JsonLd
        id="cobertura-de-eventos-jsonld"
        data={webPageJsonLd({ path: "/cobertura-de-eventos", name: TITLE, description: DESCRIPTION })}
      />

      <section className="public-page-hero">
        <div className="public-container">
          <p className="public-kicker">Transparência</p>
          <h1>Quanto da agenda de São Paulo o radar <em>realmente enxerga.</em></h1>
          <p className="public-page-hero__lead">
            Recomendação de preço só é boa se o evento certo entra no cálculo. Por isso medimos, todo dia, quantos dos grandes eventos da
            cidade o My Urban já tinha no radar, e mostramos aqui o resultado, inclusive quando ainda não há número para mostrar.
          </p>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <CoverageStats initial={coverage} />
        </div>
      </section>

      <section className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading
            eyebrow="Como medimos"
            title={<>Uma lista de referência que <em>não depende só de nós.</em></>}
            description="O recall é a fração dos eventos da lista de referência que já estavam no radar. A lista é montada e conferida antes de entrar na conta."
          />
          <div className="public-process">
            <Step
              icon={ScanSearch}
              title="Coleta em fontes independentes"
              body="Todo dia, buscamos a agenda dos principais venues e calendários de São Paulo (estádios, arenas, centros de convenção e casas de show) para os próximos 90 dias."
            />
            <Step
              icon={ClipboardCheck}
              title="Consenso entre validadores"
              body="Um evento só entra na lista quando pelo menos duas fontes independentes concordam em nome, data e local, e uma delas é externa ao nosso banco. Divergência não entra na conta."
            />
            <Step
              icon={UserCheck}
              title="Revisão humana nos conflitos"
              body="Quando as fontes divergem, uma pessoa da operação decide. Nada é aprovado automaticamente com dúvida."
            />
            <Step
              icon={CalendarCheck}
              title="Casamento diário com o radar"
              body="Comparamos cada evento da lista com o que o radar tem, tolerando um dia de diferença e variações de nome, e gravamos o resultado do dia."
            />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-split">
          <SectionHeading
            eyebrow="O que esse número é (e não é)"
            title={<>Recall dos <em>grandes eventos,</em> não promessa de 100%.</>}
            description="Mostramos o recall dos eventos de grande porte que já aconteceram nos últimos 30 dias. Eventos pequenos, de bairro ou sem divulgação pública ficam fora da lista de referência; não os contamos para parecer maiores."
          />
          <blockquote className="public-quote">
            Só publicamos o percentual depois de 4 semanas seguidas de medição. Antes disso, dizemos que ainda estamos medindo.
          </blockquote>
        </div>
      </section>

      <section className="public-section public-section--soft">
        <div className="public-container">
          <p className={styles.privacyNote}>
            A página mostra apenas agregados (percentual, quantidade de eventos acompanhados e de venues cobertos). Não há dados pessoais
            nem a lista de eventos. Atualizada diariamente; a data da última medição aparece acima.
          </p>
        </div>
      </section>

      <FinalCommercialCta
        eyebrow="Eventos no seu preço"
        title="Veja quais eventos mexem no preço do seu imóvel."
        body="Crie sua conta, cadastre o primeiro imóvel e acompanhe, no painel, os eventos que importam para o seu bairro."
      />
    </main>
  );
}
