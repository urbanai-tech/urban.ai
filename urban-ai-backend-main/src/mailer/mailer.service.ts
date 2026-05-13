import { Injectable, Logger } from '@nestjs/common';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly mailerSend: MailerSend;
  private readonly sentFrom: Sender;

  constructor() {
    this.mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    const senderEmail = process.env.EMAIL_SENDER || 'noreply@notify.myurbanai.com';
    this.sentFrom = new Sender(senderEmail, 'Urban AI');
  }

  async sendTemplateEmail(
    to: { email: string; name?: string },
    subject: string,
    templateId: string,
    variables?: Record<string, any>,
  ) {
    const recipients = [new Recipient(to.email, to.name || '')];

    this.logger.debug(
      `Sending template email templateId=${templateId} to=${this.maskEmail(to.email)} variables=${Object.keys(variables || {}).join(',')}`,
    );

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

  async sendHtmlEmail(
    to: { email: string; name?: string },
    subject: string,
    html: string,
  ) {
    const recipients = [new Recipient(to.email, to.name || '')];

    const emailParams = new EmailParams()
      .setFrom(this.sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(html);

    try {
      const response = await this.mailerSend.email.send(emailParams);
      if (response?.statusCode === 202) {
        return { enviado: true, status: response.statusCode };
      }
      this.logger.warn(
        `Failed to send HTML email to=${this.maskEmail(to.email)} status=${response?.statusCode ?? 500}`,
      );
      return { enviado: false, status: response?.statusCode ?? 500 };
    } catch (error: any) {
      this.logger.error(
        `Error sending HTML email to=${this.maskEmail(to.email)}`,
        error?.message || String(error),
      );
      return { enviado: false, status: 500, message: error.message };
    }
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

      if (response?.statusCode === 202) {
        this.logger.log(`Email sent to=${this.maskEmail(to.email)}`);
        return { enviado: true, status: response.statusCode };
      }

      this.logger.warn(
        `Failed to send text email to=${this.maskEmail(to.email)} status=${response?.statusCode ?? 500}`,
      );
      return { enviado: false, status: response?.statusCode ?? 500, message: 'Erro inesperado' };
    } catch (error: any) {
      this.logger.error(
        `Error sending text email to=${this.maskEmail(to.email)}`,
        error?.message || String(error),
      );
      return { enviado: false, status: 500, message: error.message };
    }
  }

  private maskEmail(email?: string): string {
    if (!email || !email.includes('@')) return 'unknown';
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
}
