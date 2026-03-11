import { Injectable } from '@nestjs/common';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

@Injectable()
export class MailerService {
  private readonly mailerSend: MailerSend;
  private readonly sentFrom: Sender;

  constructor() {
    this.mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    this.sentFrom = new Sender('noreply@myurbanai.com', 'Urban AI');
  }

  async sendTemplateEmail(
    to: { email: string; name?: string },
    subject: string,
    templateId: string,
    variables?: Record<string, any>, // aqui você passa variáveis dinâmicas pro template
  ) {
    const recipients = [new Recipient(to.email, to.name || '')];

    console.log(variables)
    const emailParams = new EmailParams()
      .setFrom(this.sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setTemplateId(templateId);

      

    if (variables) {
      emailParams.setPersonalization([
        {
          email: to.email,
          data: variables,
        },
      ]);
    }

    return this.mailerSend.email.send(emailParams);
  }

  async sendTextEmailCron(
  to: { email: string; name?: string },
  subject: string,
  text: string,
): Promise<{ enviado: boolean; status: number; message?: string }> {
  const recipients = [new Recipient(to.email, to.name || '')];

  const emailParams = new EmailParams()
    .setFrom(this.sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setText(text);

  try {
    const response = await this.mailerSend.email.send(emailParams);

    // Aqui usamos apenas statusCode
    if (response?.statusCode === 202) {
      console.log(`✅ Email enviado para ${to.email}`);
      return { enviado: true, status: response.statusCode };
    }

    console.error(`❌ Falha ao enviar email para ${to.email}`, response);
    return { enviado: false, status: response?.statusCode ?? 500, message: 'Erro inesperado' };

  } catch (error: any) {
    console.error(`❌ Erro ao enviar email para ${to.email}:`, error.message || error);
    return { enviado: false, status: 500, message: error.message };
  }
}

}
