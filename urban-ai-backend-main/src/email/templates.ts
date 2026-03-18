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
