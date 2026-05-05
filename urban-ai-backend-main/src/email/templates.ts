// src/email/templates.ts

const LOGO_URL = "https://app.myurbanai.com/urban-logo.png";
const PRIMARY_COLOR = "#0ea5e9"; // Cyan for codes
const TEXT_COLOR = "#374151"; // Dark grey
const TITLE_COLOR = "#9ca3af"; // Gray for centered titles
const LINK_COLOR = "#2563eb"; // Standard blue

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
                <p style="margin-top: 15px;">Este link expira em <b>2</b> minutos por motivos de segurança.</p>
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
            <p>Nosso motor cruza dados de mercado, eventos próximos e padrões históricos
            para ajudar você a precificar melhor seus imóveis. O resultado: mais ocupação,
            preço mais justo e menos achismo.</p>

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
        <div class="title">Você está usando ${percent}% da sua quota</div>
        <div class="content">
            <p>Olá, ${firstName}!</p>
            <p>Sua conta tem <b>${input.contratados} imóveis contratados</b> e você já
            cadastrou <b>${input.ativos}</b>. Está perto do limite.</p>

            <p>Quando passar do contratado, novos imóveis ficam bloqueados até upgrade.
            Para ampliar agora sem fricção:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${input.upgradeUrl}" class="link" style="display: inline-block; padding: 12px 28px; background: ${PRIMARY_COLOR}; color: white; border-radius: 8px; font-weight: bold;">
                    Aumentar quota
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
                    Aumentar quota agora
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
            quando quiser. Quando confiar no motor, vire <b>Automático</b> em qualquer
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
