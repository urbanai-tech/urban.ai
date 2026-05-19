import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    this.apiBaseUrl = (process.env.BREVO_API_BASE_URL || 'https://api.brevo.com/v3').replace(/\/$/, '');
    this.senderEmail = process.env.EMAIL_SENDER || 'noreply@myurbanai.com';
    this.senderName = process.env.EMAIL_SENDER_NAME || 'Urban AI';
  }

  async sendTemplateEmail(
    to: { email: string; name?: string },
    subject: string,
    templateId: string,
    variables?: Record<string, any>,
  ) {
    const numericTemplateId = Number(templateId);
    this.logger.debug(
      `Sending template email templateId=${templateId} to=${this.maskEmail(to.email)} variables=${Object.keys(variables || {}).join(',')}`,
    );

    if (!Number.isFinite(numericTemplateId)) {
      this.logger.warn(`Invalid Brevo templateId=${templateId} to=${this.maskEmail(to.email)}`);
      return { enviado: false, status: 400, message: 'Invalid Brevo templateId' };
    }

    return this.sendBrevoEmail({
      to,
      subject,
      templateId: numericTemplateId,
      params: variables,
    });
  }

  async sendHtmlEmail(
    to: { email: string; name?: string },
    subject: string,
    html: string,
  ) {
    return this.sendBrevoEmail({ to, subject, htmlContent: html, type: 'HTML' });
  }

  async sendTextEmailCron(
    to: { email: string; name?: string },
    subject: string,
    text: string,
  ): Promise<{ enviado: boolean; status: number; message?: string }> {
    return this.sendBrevoEmail({ to, subject, textContent: text, type: 'text' });
  }

  private async sendBrevoEmail(input: {
    to: { email: string; name?: string };
    subject: string;
    htmlContent?: string;
    textContent?: string;
    templateId?: number;
    params?: Record<string, any>;
    type?: string;
  }): Promise<{ enviado: boolean; status: number; message?: string; messageId?: string }> {
    if (!this.apiKey) {
      const message = 'BREVO_API_KEY is not configured';
      this.logger.error(message);
      return { enviado: false, status: 500, message };
    }

    const payload: Record<string, any> = {
      sender: {
        email: this.senderEmail,
        name: this.senderName,
      },
      to: [
        {
          email: input.to.email,
          name: input.to.name || '',
        },
      ],
      subject: input.subject,
    };

    if (input.templateId !== undefined) {
      payload.templateId = input.templateId;
      if (input.params) payload.params = input.params;
    } else if (input.htmlContent !== undefined) {
      payload.htmlContent = input.htmlContent;
    } else {
      payload.textContent = input.textContent || '';
    }

    try {
      const response = await axios.post(`${this.apiBaseUrl}/smtp/email`, payload, {
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        timeout: 15_000,
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Brevo email sent to=${this.maskEmail(input.to.email)}`);
        return {
          enviado: true,
          status: response.status,
          messageId: response.data?.messageId,
        };
      }

      this.logger.warn(
        `Failed to send ${input.type || 'transactional'} email to=${this.maskEmail(input.to.email)} status=${response.status}`,
      );
      return { enviado: false, status: response.status };
    } catch (error: any) {
      const diagnostic = this.formatMailerError(error);
      this.logger.error(
        `Error sending ${input.type || 'transactional'} email to=${this.maskEmail(input.to.email)}: ${diagnostic}`,
      );
      return {
        enviado: false,
        status: error?.response?.status ?? error?.status ?? 500,
        message: diagnostic,
      };
    }
  }

  private formatMailerError(error: any): string {
    const statusCode = error?.statusCode ?? error?.status ?? error?.response?.statusCode ?? error?.response?.status;
    const body = error?.body ?? error?.response?.body ?? error?.response?.data;
    const bodyMessage =
      typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
        : Array.isArray(body?.errors)
          ? body.errors
              .map((item: any) => item?.message || item?.detail || item?.code)
              .filter(Boolean)
              .join('; ')
          : undefined;
    const message =
      bodyMessage ||
      (typeof error?.message === 'string' ? error.message : undefined) ||
      this.safeJson(body || error);

    const parts = [
      statusCode ? `status=${statusCode}` : undefined,
      message ? `message=${this.redactSecrets(String(message))}` : undefined,
    ].filter(Boolean);

    return parts.join(' ') || 'unknown mailer error';
  }

  private safeJson(value: any): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private redactSecrets(value: string): string {
    return value
      .replace(/(api[-_ ]?key|token|authorization|bearer)\s*[:=]\s*["']?[^"',\s]+/gi, '$1=[redacted]')
      .replace(/xkeysib-[A-Za-z0-9_-]+/g, 'xkeysib-[redacted]')
      .slice(0, 500);
  }

  private maskEmail(email?: string): string {
    if (!email || !email.includes('@')) return 'unknown';
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
}
