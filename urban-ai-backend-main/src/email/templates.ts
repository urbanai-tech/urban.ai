// src/email/templates.ts

const LOGO_URL = "https://app.myurbanai.com/urban-logo.png";
const PRIMARY_COLOR = "#0ea5e9"; // Cyan for codes
const TEXT_COLOR = "#374151"; // Dark grey
const TITLE_COLOR = "#9ca3af"; // Gray for centered titles
const LINK_COLOR = "#2563eb"; // Standard blue

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const baseLayout = (content: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; color: ${TEXT_COLOR}; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .logo-container { text-align: center; margin-bottom: 50px; }
        .logo { height: 40px; }
        .title { text-align: center; color: ${TITLE_COLOR}; font-size: 24px; font-weight: bold; margin-bottom: 40px; }
        .content { font-size: 16px; line-height: 1.6; color: ${TEXT_COLOR}; }
        .footer { margin-top: 60px; font-size: 12px; color: #9ca3af; text-align: center; }
        .code-box { text-align: center; font-size: 36px; font-weight: bold; color: ${PRIMARY_COLOR}; margin: 40px 0; }
        a.link { color: ${LINK_COLOR}; text-decoration: none; word-break: break-all; }
        a.link:hover { text-decoration: underline; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 30px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <img src="${LOGO_URL}" alt="Urban AI Logo" class="logo" />
        </div>
        ${content}
        <div class="footer">
            © ${new Date().getFullYear()} Urban AI • E-mail automático — não responda.
        </div>
    </div>
</body>
</html>
`;

export class EmailTemplates {
  static getEventNotificationTemplate(nome: string, title: string, quantidade: number): string {
    const safeName = escapeHtml(nome || "Usuario");
    const safeTitle = escapeHtml(title || "Novos eventos");
    const safeQuantidade = Math.max(0, Number.isFinite(quantidade) ? quantidade : 0);
    const plural = safeQuantidade === 1 ? "evento relevante" : "eventos relevantes";

    const content = `
        <div class="title">${safeTitle}</div>
        <div class="content">
            <p>Ola, <b>${safeName}</b>.</p>
            <p>Encontramos <b>${safeQuantidade}</b> ${plural} para acompanhar na sua operacao Urban AI.</p>
            <p>Acesse a plataforma para revisar as analises e oportunidades associadas aos seus imoveis.</p>
        </div>
    `;
    return baseLayout(content);
  }

  static getWeeklyEventReportTemplate(input: {
    nome: string;
    windowDays: number;
    dashboardUrl: string;
    properties: {
      title: string;
      totalEvents: number;
      events: {
        name: string;
        dateLabel: string;
        location: string;
        relevance: number | null;
        currentPrice: number | null;
        suggestedPrice: number | null;
        liftPercent: number | null;
        recommendation: string | null;
      }[];
    }[];
  }): string {
    const safeName = escapeHtml(input.nome || "Usuario");
    const firstName = safeName.split(" ")[0];
    const windowDays = Math.max(1, Number(input.windowDays) || 30);
    const totalEvents = input.properties.reduce((sum, property) => sum + property.totalEvents, 0);
    const propertyBlocks = input.properties
      .map((property) => {
        const safeTitle = escapeHtml(property.title || "Imovel");
        const eventRows = property.events
          .map((event) => {
            const safeEvent = escapeHtml(event.name || "Evento");
            const safeDate = escapeHtml(event.dateLabel || "");
            const safeLocation = escapeHtml(event.location || "");
            const relevance = event.relevance !== null ? `${Math.round(event.relevance)}/100` : "sem score";
            const priceParts = [
              event.currentPrice !== null ? `atual ${EmailTemplates.formatMoney(event.currentPrice)}` : null,
              event.suggestedPrice !== null ? `sugerido ${EmailTemplates.formatMoney(event.suggestedPrice)}` : null,
              event.liftPercent !== null ? `${event.liftPercent > 0 ? "+" : ""}${event.liftPercent}%` : null,
            ].filter(Boolean);
            const safeRecommendation = event.recommendation ? escapeHtml(event.recommendation) : null;

            return `
              <li style="margin: 0 0 14px 0;">
                <b>${safeEvent}</b><br />
                <span style="color:#6b7280;">${safeDate}${safeLocation ? ` &middot; ${safeLocation}` : ""} &middot; relevancia ${relevance}</span>
                ${priceParts.length ? `<br /><span>${priceParts.join(" &middot; ")}</span>` : ""}
                ${safeRecommendation ? `<br /><span style="color:#6b7280;">${safeRecommendation}</span>` : ""}
              </li>
            `;
          })
          .join("");

        return `
          <div style="border-top:1px solid #e5e7eb; padding-top:22px; margin-top:22px;">
            <p style="margin:0 0 8px 0; font-weight:bold;">${safeTitle}</p>
            <p style="margin:0 0 12px 0; color:#6b7280;">${property.totalEvents} ${property.totalEvents === 1 ? "evento relevante" : "eventos relevantes"} nos proximos ${windowDays} dias.</p>
            <ol style="padding-left:20px; margin:0;">${eventRows}</ol>
          </div>
        `;
      })
      .join("");

    const content = `
        <div class="title">Radar semanal de eventos</div>
        <div class="content">
            <p>Ola, <b>${firstName}</b>.</p>
            <p>Encontramos <b>${totalEvents}</b> ${totalEvents === 1 ? "evento relevante" : "eventos relevantes"} para os seus imoveis nos proximos <b>${windowDays} dias</b>.</p>
            <p>Este e um resumo do que a Urban AI esta monitorando por voce. As sugestoes completas ficam no painel.</p>
            ${propertyBlocks}
            <div style="text-align:center; margin:32px 0 8px;">
              <a href="${escapeHtml(input.dashboardUrl)}" class="link" style="display:inline-block; padding:12px 28px; background:${PRIMARY_COLOR}; color:white; border-radius:8px; font-weight:bold;">
                Ver recomendacoes no painel
              </a>
            </div>
        </div>
    `;
    return baseLayout(content);
  }

  private static formatMoney(value: number): string {
    if (!Number.isFinite(value)) return "R$0";
    return `R$${Math.round(value).toLocaleString("pt-BR")}`;
  }

  
  static getConfirmEmailTemplate(nome: string, code: string, frontUrl: string): string {
    const content = `
        <div class="title">Código de verificação</div>
        <div class="content">
            <p>Olá!</p>
            <p>Use o código abaixo para verificar seu e-mail no <b>Urban AI</b>:</p>
            
            <div class="code-box">${code}</div>
            
            <p style="text-align: center; font-size: 14px;">Este código expira em 3 minutos.</p>
        </div>
    `;
    return baseLayout(content);
  }

  static getForgotPasswordTemplate(nome: string, resetLink: string): string {
    const content = `
        <div class="title">Redefinir sua senha</div>
        <div class="content">
            <p>Olá, <b>${nome}!</b></p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no <b>Urban AI</b>.<br/>
            Se você fez essa solicitação, clique no link abaixo para criar uma nova senha.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <p>Para redefinir sua senha, clique no link abaixo:</p>
                <a href="${resetLink}" class="link">${resetLink}</a>
                <p style="margin-top: 15px;">Este link expira em <b>30</b> minutos por motivos de segurança.</p>
            </div>
            
            <hr />
            
            <p>Se o link acima não funcionar, copie e cole esta URL no seu navegador:</p>
            <p><a href="${resetLink}" class="link" style="font-size: 14px;">${resetLink}</a></p>
            
            <p style="margin-top: 30px;">Não reconhece esta solicitação? Ignore este e-mail e sua senha permanecerá a mesma.</p>
        </div>
    `;
    return baseLayout(content);
  }

  static getAnalysisStartedTemplate(nome: string, dashboardUrl: string): string {
    let firstName = nome.split(" ")[0];
    const content = `
        <div class="title">Sua propriedade está em análise</div>
        <div class="content">
            <p>Olá ${firstName},</p>
            <p>A sua propriedade cadastrada no <b>Urban AI</b> está sendo processada.</p>
            <p>Em breve você receberá um e-mail com sugestões de preço personalizadas.</p>
            <br/>
            <p>Você pode acompanhar o status acessando:</p>
            <p><a href="${dashboardUrl}" class="link">${dashboardUrl}</a></p>
        </div>
    `;
    return baseLayout(content);
  }

  static getAnalysisFinishedTemplate(nome: string, dashboardUrl: string): string {
    let firstName = nome.split(" ")[0];
    const content = `
        <div class="title">Análise concluída!</div>
        <div class="content">
            <p>Olá ${firstName},</p>
            <p>A análise da sua propriedade no <b>Urban AI</b> foi concluída com sucesso!</p>
            <p>Agora você já pode acessar os resultados e conferir as <b>recomendações de preço personalizadas</b> para o seu imóvel.</p>
            <br/>
            <p>Acesse aqui os resultados:</p>
            <p><a href="${dashboardUrl}" class="link">${dashboardUrl}</a></p>
        </div>
    `;
    return baseLayout(content);
  }

  // ================== F6.5 / lifecycle ==================

  /**
   * E-mail de boas-vindas após signup confirmado.
   * Não menciona plano ainda — esse e-mail é antes do checkout.
   */
  static getWelcomeTemplate(nome: string, dashboardUrl: string): string {
    const firstName = nome.split(' ')[0];
    const content = `
        <div class="title">Bem-vindo(a), ${firstName}!</div>
        <div class="content">
            <p>Que bom ter você na <b>Urban AI</b>.</p>
            <p>A Urban AI cruza dados de mercado, eventos próximos e padrões históricos
            para ajudar você a escolher preços melhores para seus imóveis. O resultado:
            decisões mais claras, menos achismo e mais controle sobre a diária.</p>

            <p><b>Próximos passos:</b></p>
            <ol style="line-height: 1.8;">
                <li>Cadastre seu primeiro imóvel</li>
                <li>Receba a primeira análise em poucos minutos</li>
                <li>Compare com os preços que você cobra hoje</li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Acessar painel
                </a>
            </div>

            <p style="font-size: 14px;">Qualquer dúvida, é só responder este e-mail.</p>
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * Recibo de assinatura ativada (após webhook checkout.session.completed).
   * Mostra plano, ciclo, quantity (imóveis), próxima cobrança.
   */
  static getSubscriptionActiveTemplate(input: {
    nome: string;
    planName: string;
    billingCycle: 'monthly' | 'quarterly' | 'semestral' | 'annual';
    listingsContratados: number;
    totalAmountCents: number;
    nextBillingDate: string; // ISO ou YYYY-MM-DD
    invoiceUrl?: string;
    dashboardUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const cycleLabel: Record<string, string> = {
      monthly: 'mensal',
      quarterly: 'trimestral',
      semestral: 'semestral',
      annual: 'anual',
    };
    const total = `R$ ${(input.totalAmountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const content = `
        <div class="title">Assinatura ativada ✓</div>
        <div class="content">
            <p>Olá, ${firstName}!</p>
            <p>Sua assinatura no <b>Urban AI</b> foi ativada com sucesso. Resumo:</p>

            <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 15px;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Plano</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${input.planName}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Ciclo</td><td style="padding: 8px 0; text-align: right;">${cycleLabel[input.billingCycle] ?? input.billingCycle}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Imóveis contratados</td><td style="padding: 8px 0; text-align: right;">${input.listingsContratados}</td></tr>
                <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 12px 0; color: #6b7280;">Valor total cobrado</td><td style="padding: 12px 0; text-align: right; font-weight: bold; color: ${PRIMARY_COLOR};">${total}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Próxima cobrança</td><td style="padding: 8px 0; text-align: right;">${input.nextBillingDate}</td></tr>
            </table>

            ${input.invoiceUrl ? `<p style="text-align: center;"><a href="${input.invoiceUrl}" class="link">Ver recibo Stripe</a></p>` : ''}

            <hr />

            <p><b>Próximos passos:</b></p>
            <ul style="line-height: 1.8;">
                <li>Cadastre seus ${input.listingsContratados} ${input.listingsContratados === 1 ? 'imóvel' : 'imóveis'}</li>
                <li>Conecte sua conta Stays para envio automático de preços</li>
                <li>Acompanhe as primeiras recomendações no painel</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.dashboardUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Ir para o painel
                </a>
            </div>
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * Cancelamento confirmado — informa que acesso continua até o fim do ciclo.
   */
  static getSubscriptionCancelledTemplate(input: {
    nome: string;
    accessEndsAt: string;
    reactivateUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const content = `
        <div class="title">Cancelamento confirmado</div>
        <div class="content">
            <p>Olá, ${firstName}.</p>
            <p>Confirmamos o cancelamento da sua assinatura. <b>Você continua com acesso
            completo até ${input.accessEndsAt}</b>; depois disso a conta vira read-only.</p>

            <p>Caso queira voltar antes da virada, é um clique:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.reactivateUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Reativar assinatura
                </a>
            </div>

            <hr />

            <p style="font-size: 14px;">Se cancelou por algum motivo específico, escreva pra
            gente — feedback de quem sai é o que mais nos ajuda a melhorar.</p>
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * Falha de pagamento (webhook invoice.payment_failed).
   * Stripe re-tenta automaticamente; nós só comunicamos e damos link.
   */
  static getPaymentFailedTemplate(input: {
    nome: string;
    amountCents: number;
    nextRetryDate: string;
    updatePaymentUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const total = `R$ ${(input.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const content = `
        <div class="title" style="color: #b45309;">Pagamento não foi processado</div>
        <div class="content">
            <p>Olá, ${firstName}.</p>
            <p>Tentamos processar a cobrança de <b>${total}</b> da sua assinatura no
            Urban AI mas o cartão recusou.</p>

            <p>Vamos tentar novamente em <b>${input.nextRetryDate}</b>. Para evitar
            qualquer interrupção, é melhor atualizar o método de pagamento agora:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.updatePaymentUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: #b45309; color: white; border-radius: 8px; font-weight: bold;">
                    Atualizar cartão
                </a>
            </div>

            <p style="font-size: 14px;">Causas comuns: cartão expirado, limite insuficiente
            ou bloqueio antifraude do banco.</p>
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * Alerta 80% da quota — antecipação de upsell.
   */
  static getQuotaWarningTemplate(input: {
    nome: string;
    contratados: number;
    ativos: number;
    upgradeUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const percent = Math.round((input.ativos / input.contratados) * 100);
    const content = `
        <div class="title">Você está usando ${percent}% do limite do seu plano</div>
        <div class="content">
            <p>Olá, ${firstName}!</p>
            <p>Sua conta tem <b>${input.contratados} imóveis contratados</b> e você já
            cadastrou <b>${input.ativos}</b>. Está perto do limite.</p>

            <p>Quando passar do contratado, novos imóveis ficam bloqueados até upgrade.
            Para ampliar agora sem fricção:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.upgradeUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Ajustar meu plano
                </a>
            </div>

            <p style="font-size: 14px;">Lembrete: a Urban AI cobra <b>por imóvel</b>, então
            você só paga pelo que de fato usa.</p>
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * Quota excedida — bloqueio de novo cadastro (gerado pelo guard
   * `LISTINGS_QUOTA_EXCEEDED` no backend).
   */
  static getQuotaExceededTemplate(input: {
    nome: string;
    contratados: number;
    tentando: number;
    upgradeUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const content = `
        <div class="title" style="color: #b91c1c;">Limite de imóveis atingido</div>
        <div class="content">
            <p>Olá, ${firstName}.</p>
            <p>Você tentou cadastrar <b>${input.tentando}</b> imóvel${input.tentando > 1 ? 'is' : ''} mas
            seu plano cobre apenas <b>${input.contratados}</b>.</p>

            <p>Para destravar, basta aumentar a quantidade de imóveis no seu plano:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.upgradeUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: #b91c1c; color: white; border-radius: 8px; font-weight: bold;">
                    Ajustar meu plano agora
                </a>
            </div>

            <p style="font-size: 14px;">A cobrança é proporcional ao restante do ciclo —
            sem trocar de plano nem reiniciar a assinatura.</p>
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * Confirmação de conexão Stays (após primeiro sync OK).
   */
  static getStaysConnectedTemplate(input: {
    nome: string;
    listingsImported: number;
    settingsUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const content = `
        <div class="title">Stays conectada ✓</div>
        <div class="content">
            <p>Olá, ${firstName}!</p>
            <p>Sua conta Stays foi conectada com sucesso e nós já importamos
            <b>${input.listingsImported}</b> ${input.listingsImported === 1 ? 'imóvel' : 'imóveis'}.</p>

            <p>Por padrão o modo é <b>Recomendação</b> — você recebe sugestões e aplica
            quando quiser. Quando estiver confortável, vire <b>Automático</b> em qualquer
            imóvel individualmente.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.settingsUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Configurar modo automático
                </a>
            </div>
        </div>
    `;
    return baseLayout(content);
  }

  // ================== Onboarding drip D1/D3/D7 (gap H9 do roadmap) ==================

  /**
   * D+1 — primeiro dia após signup. Lembra que o motor está coletando
   * eventos e dá link pra cadastrar o primeiro imovel se nao houver nenhum.
   */
  static getOnboardingDay1Template(input: {
    nome: string;
    propertiesCount: number;
    dashboardUrl: string;
    propertiesUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const hasNoProperty = input.propertiesCount === 0;
    const content = `
        <div class="title">Bem-vindo, ${firstName}!</div>
        <div class="content">
            <p>Você está dentro da Urban AI. Nas próximas 24h vamos começar a:</p>
            <ul style="line-height: 1.8;">
                <li>Mapear eventos relevantes a até <b>8km</b> dos seus imóveis</li>
                <li>Cruzar com calendário do Airbnb / Stays</li>
                <li>Gerar a primeira recomendação de preço</li>
            </ul>
            ${
              hasNoProperty
                ? `
            <hr />
            <p><b>Você ainda não cadastrou imóveis.</b> As sugestões começam depois do primeiro cadastro:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.propertiesUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Cadastrar primeiro imóvel
                </a>
            </div>
            `
                : `
            <p>Seus <b>${input.propertiesCount} ${input.propertiesCount === 1 ? 'imóvel está' : 'imóveis estão'}</b> sendo processados. Confira no painel:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.dashboardUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Ver painel
                </a>
            </div>
            `
            }
            <p style="font-size: 14px;">Dúvidas? É só responder este e-mail.</p>
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * D+3 — três dias após signup. Mostra primeiras recomendações se houver,
   * ou explica por que ainda nao apareceram (eventos baixos / sem cobertura).
   */
  static getOnboardingDay3Template(input: {
    nome: string;
    recommendationsCount: number;
    dashboardUrl: string;
    staysUrl: string;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const hasRecs = input.recommendationsCount > 0;
    const content = `
        <div class="title">${hasRecs ? 'Suas primeiras recomendações' : 'Atualização sobre suas recomendações'}</div>
        <div class="content">
            <p>Olá, ${firstName}.</p>
            ${
              hasRecs
                ? `
            <p>Geramos <b>${input.recommendationsCount}</b> ${input.recommendationsCount === 1 ? 'recomendação' : 'recomendações'} de preço pros seus imóveis. Cada uma vem com:</p>
            <ul style="line-height: 1.8;">
                <li>Motivo da sugestão (qual evento, qual janela)</li>
                <li>Preço atual vs. preço sugerido</li>
                <li>Variação % esperada</li>
                <li>Botão pra aceitar e (se Stays conectado) aplicar</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.dashboardUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Ver recomendações
                </a>
            </div>

            <p><b>Dica:</b> conecte sua conta Stays pra aplicar sugestões automaticamente. Custa 30 segundos.</p>
            <p style="text-align: center;">
                <a href="${input.staysUrl}" class="link">Conectar Stays →</a>
            </p>
            `
                : `
            <p>Ainda não geramos recomendações pros seus imóveis. Os motivos mais comuns:</p>
            <ul style="line-height: 1.8;">
                <li>Sem eventos relevantes no raio dos seus imóveis nos próximos 30 dias</li>
                <li>Coordenadas pendentes (o geocoder está processando)</li>
                <li>Sem preço base configurado (fazemos comparativo só se você informar a diária atual)</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.dashboardUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Ver detalhes
                </a>
            </div>

            <p style="font-size: 14px;">Avise a gente se quiser que olhemos manualmente — responde este e-mail.</p>
            `
            }
        </div>
    `;
    return baseLayout(content);
  }

  /**
   * D+7 — uma semana após signup. Foco em conversão pra plano pago se
   * ainda está em trial / waitlist convertido sem assinatura.
   */
  static getOnboardingDay7Template(input: {
    nome: string;
    hasActiveSubscription: boolean;
    plansUrl: string;
    dashboardUrl: string;
    suggestedAppliedCount: number;
  }): string {
    const firstName = input.nome.split(' ')[0];
    const content = `
        <div class="title">Uma semana com a Urban AI</div>
        <div class="content">
            <p>Olá, ${firstName}!</p>
            <p>Faz uma semana que você entrou. Hora de transformar as sugestões em rotina.</p>

            ${
              input.suggestedAppliedCount > 0
                ? `
            <p><b>Até agora você aplicou ${input.suggestedAppliedCount} ${input.suggestedAppliedCount === 1 ? 'sugestão' : 'sugestões'}.</b> Continue assim: cada resposta ajuda a Urban AI a entender melhor seus imóveis.</p>
            `
                : `
            <p>Você ainda não aplicou nenhuma sugestão. Aceite ou recuse cada recomendação: em 1 clique você nos diz se vamos na direção certa.</p>
            `
            }

            ${
              input.hasActiveSubscription
                ? `
            <hr />
            <p><b>Próximos passos pra extrair o máximo:</b></p>
            <ol style="line-height: 1.8;">
                <li>Conecte Stays se ainda não conectou — aplica preço automaticamente</li>
                <li>Registre receita real das diárias aplicadas (vai no card da sugestão)</li>
                <li>Confira o painel "Ganhos" para ver o dinheiro atribuído às sugestões aplicadas</li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.dashboardUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Ir pro painel
                </a>
            </div>
            `
                : `
            <hr />
            <p><b>Pronto pra ativar tudo?</b></p>
            <p>Seu trial inicial te deu acesso ao painel e às primeiras recomendações.
            Pra continuar recebendo recomendações diárias, conectar Stays e ativar o modo automático,
            escolha um plano. Cobramos por imóvel — sem fidelidade, cancela quando quiser.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.plansUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Ver planos
                </a>
            </div>
            `
            }

            <p style="font-size: 14px;">Qualquer dúvida, responde este e-mail. Lemos tudo.</p>
        </div>
    `;
    return baseLayout(content);
  }

  static getPricingRecommendationDigestTemplate(input: {
    nome: string;
    dashboardUrl: string;
    items: Array<{
      propertyTitle: string;
      title: string;
      description: string;
      redirectTo: string;
      reasons?: string[];
    }>;
  }): string {
    const firstName = EmailTemplates.escapeHtml((input.nome || 'Usuario').split(' ')[0]);
    const total = input.items.length;
    const cards = input.items.map((item, index) => {
      const reasons = item.reasons?.length
        ? item.reasons
        : [
            'Eventos futuros e demanda local perto do imovel.',
            'Comparacao com a diaria atual e limites de seguranca configurados.',
            'Sinal de oportunidade para revisar preco antes da data ficar em cima.',
          ];
      return `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin:0 0 16px;background:#ffffff;">
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Recomendacao ${index + 1}</p>
          <h3 style="margin:0;color:#111827;font-size:18px;">${EmailTemplates.escapeHtml(item.propertyTitle)}</h3>
          <p style="margin:10px 0 14px;color:#374151;line-height:1.55;">${EmailTemplates.escapeHtml(item.description)}</p>
          <p style="margin:0 0 8px;color:#111827;font-weight:700;">Por que vale olhar:</p>
          <ul style="margin:0 0 16px;padding-left:18px;color:#4b5563;line-height:1.6;">
            ${reasons.map((reason) => `<li>${EmailTemplates.escapeHtml(reason)}</li>`).join('')}
          </ul>
          <a href="${EmailTemplates.escapeHtml(EmailTemplates.absoluteUrl(input.dashboardUrl, item.redirectTo))}" class="link" style="display:inline-block;padding:10px 18px;background:${PRIMARY_COLOR};color:#fff;border-radius:8px;font-weight:bold;">Revisar recomendacao</a>
        </div>
      `;
    }).join('');

    const content = `
      <div class="title">${total === 1 ? '1 sugestao de preco pronta' : `${total} sugestoes de preco prontas`}</div>
      <div class="content">
        <p>Ola, ${firstName}.</p>
        <p>Em vez de mandar um e-mail por imovel, agrupamos as novas recomendacoes em um resumo unico. Assim voce ve o contexto, prioriza o que importa e revisa tudo em um so lugar.</p>
        ${cards}
        <div style="text-align:center;margin:28px 0;">
          <a href="${EmailTemplates.escapeHtml(input.dashboardUrl)}" class="link" style="display:inline-block;padding:12px 28px;background:${PRIMARY_COLOR};color:white;border-radius:8px;font-weight:bold;">
            Abrir painel completo
          </a>
        </div>
        <p style="font-size:13px;color:#6b7280;">Dica: se voce conectar a Stays, a Urban AI consegue transformar recomendacoes aprovadas em alteracoes operacionais com guardrails e rollback.</p>
      </div>
    `;
    return baseLayout(content);
  }

  private static escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static absoluteUrl(baseUrl: string, value?: string): string {
    if (!value) return baseUrl;
    if (/^https?:\/\//i.test(value)) return value;
    try {
      const base = new URL(baseUrl);
      return new URL(value, `${base.origin}/`).href;
    } catch {
      return baseUrl;
    }
  }

  // ================== legacy ==================

  static getSystemNotificationTemplate(nome: string, title: string, description: string, url: string): string {
    const content = `
        <h2 style="font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 20px;">${title}</h2>
        <div class="content">
            <p>Olá, <b>${nome}!</b></p>
            
            <!-- Descrição (que pode conter parágrafos, então evitamos envolver num único <p>) -->
            <div style="margin-bottom: 20px;">
                ${description.replace(/\n/g, '<br/>')}
            </div>

            ${url ? `<p><a href="${url}" class="link">${url}</a></p>` : ''}
        </div>
    `;
    // For System notification, we don't use the centered grey title layout, 
    // to match the "Eventos próximos à sua propriedade" screenshot, 
    // we use a bold black left-aligned title directly inside the content block.
    return baseLayout(content);
  }
}
