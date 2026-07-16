import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { EmailConfirmation } from 'src/entities/EmailConfirmation';
import { PasswordResetToken } from 'src/entities/password-reset-token.entity';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { MailerService } from 'src/mailer/mailer.service';
import { EmailTemplates } from './templates';
import * as crypto from 'crypto';
import { PushNotificationService } from 'src/push/push-notification.service';
import {
    ClaimedPricingDigest,
    PricingDigestItem,
    PricingRecommendationDigestService,
} from './pricing-recommendation-digest.service';
import { CommunicationPreferencesService } from 'src/communication-preferences/communication-preferences.service';

const EMAIL_CONFIRMATION_PURPOSE = 'email_confirmation';
const CONFIRMATION_HASH_PREFIX = 'hmac:v1:';
const PUBLIC_EMAIL_SUCCESS = Object.freeze({ enviado: true });
const PUBLIC_CONFIRMATION_FAILURE = Object.freeze({
    ok: false,
    motivo: 'Código inválido ou expirado',
});

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly pricingDigestDelayMs = Math.max(5000, Number(process.env.PRICING_DIGEST_EMAIL_DELAY_MS || 120000));
    private readonly pricingDigestTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        @InjectRepository(AnaliseEnderecoEvento)
        private readonly analysisRepo: Repository<AnaliseEnderecoEvento>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(EmailConfirmation)
        private readonly emailConfirmationRepository: Repository<EmailConfirmation>,
        @InjectRepository(PasswordResetToken)
        private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
        private readonly notificationService: NotificationsService,
        private readonly mailerService: MailerService,
        private readonly pushNotificationService: PushNotificationService,
        private readonly pricingDigestService: PricingRecommendationDigestService,
        private readonly communicationPreferences: CommunicationPreferencesService,
    ) {}

    async getProfileById(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        return user;
    }
    private async bcryptHash(passwordOrSha256: string): Promise<string> {
        // O input pode ser texto-puro OU pré-hash SHA-256 vindo do frontend legado.
        // Em ambos os casos, o valor entrada é tratado como "senha" e vira bcrypt.
        return bcrypt.hash(passwordOrSha256, 12);
    }

    private hashResetToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private confirmationSecret(): string {
        const secret = process.env.EMAIL_CONFIRMATION_CODE_SECRET || process.env.JWT_SECRET;
        if (secret) return secret;
        if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
            throw new Error('EMAIL_CONFIRMATION_CODE_SECRET is required in production');
        }
        return 'urban-ai-local-email-confirmation-secret';
    }

    private hashConfirmationCode(userId: string, code: string): string {
        const digest = crypto
            .createHmac('sha256', this.confirmationSecret())
            .update(`${EMAIL_CONFIRMATION_PURPOSE}|${userId}|${code}`)
            .digest('hex');
        return `${CONFIRMATION_HASH_PREFIX}${digest}`;
    }

    private matchesConfirmationCode(userId: string, code: string, stored: string): boolean {
        const expected = stored.startsWith(CONFIRMATION_HASH_PREFIX) ? this.hashConfirmationCode(userId, code) : code;
        const expectedBuffer = Buffer.from(expected, 'utf8');
        const storedBuffer = Buffer.from(stored, 'utf8');
        return expectedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(expectedBuffer, storedBuffer);
    }

    private generateConfirmationCode(): string {
        return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    }

    private confirmationMaxAttempts(): number {
        const configured = Number(process.env.EMAIL_CONFIRMATION_MAX_ATTEMPTS || 5);
        return Number.isFinite(configured) ? Math.min(Math.max(Math.trunc(configured), 3), 10) : 5;
    }

    private confirmationLockoutMs(): number {
        const configured = Number(process.env.EMAIL_CONFIRMATION_LOCKOUT_MINUTES || 15);
        const minutes = Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 24 * 60) : 15;
        return minutes * 60 * 1000;
    }

    private async padPublicResponse(startedAt: number): Promise<void> {
        const configuredFloor = Number(process.env.EMAIL_PUBLIC_RESPONSE_MIN_MS || 250);
        const configuredJitter = Number(process.env.EMAIL_PUBLIC_RESPONSE_JITTER_MS || 50);
        const floor = Number.isFinite(configuredFloor) ? Math.min(Math.max(configuredFloor, 0), 2_000) : 250;
        const jitterMax = Number.isFinite(configuredJitter)
            ? Math.min(Math.max(Math.trunc(configuredJitter), 0), 500)
            : 50;
        const target = floor + (jitterMax > 0 ? crypto.randomInt(0, jitterMax + 1) : 0);
        const remaining = target - (Date.now() - startedAt);
        if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
        }
    }

    private buildResetLink(token: string): string {
        const base =
            process.env.RESET_PASS_URL || `${process.env.FRONT_BASE_URL || 'https://app.myurbanai.com'}/reset-password`;
        return `${base.replace(/\/$/, '')}/${encodeURIComponent(token)}`;
    }

    private maskEmail(email?: string): string {
        if (!email || !email.includes('@')) return 'unknown';
        const [local, domain] = email.split('@');
        return `${local.slice(0, 2)}***@${domain}`;
    }

    private async sendHtmlEmailOrThrow(to: { email: string; name?: string }, subject: string, htmlContent: string) {
        const result = await this.mailerService.sendHtmlEmail(to, subject, htmlContent);
        if (!result?.enviado) {
            throw new Error(
                result?.message || `Transactional email rejected with status=${result?.status ?? 'unknown'}`,
            );
        }
        return result;
    }

    async sendEmail(to: string, name: string, subject: string, quantidade: number) {
        try {
            if (!to) {
                return {
                    enviado: false,
                    status: 400,
                    motivo: 'E-mail de destino ausente',
                };
            }

            const title = subject || 'Novos eventos';
            const htmlContent = EmailTemplates.getEventNotificationTemplate(
                name || 'Usuário',
                title,
                Number(quantidade) || 0,
            );

            const result = await this.sendHtmlEmailOrThrow(
                { email: to, name: name || undefined },
                `${title} - Urban AI`,
                htmlContent,
            );
            return { enviado: true, status: result.status };
        } catch (error) {
            this.logger.error(`Erro ao enviar e-mail transacional: ${error instanceof Error ? error.message : error}`);
            return { enviado: false, motivo: 'Erro interno ao enviar e-mail' };
        }
    }

    async confirmPassword(token: string, password: string) {
        try {
            if (!token || !password) {
                return { enviado: false, motivo: 'Token e senha são obrigatórios' };
            }

            const resetToken = await this.passwordResetTokenRepository.findOne({
                where: { tokenHash: this.hashResetToken(token) },
                relations: ['user'],
            });

            if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
                return { enviado: false, motivo: 'Token inválido ou expirado' };
            }

            // Reset de senha sempre grava bcrypt(12), seja o input texto-puro
            // ou pré-hash SHA-256 do frontend legado.
            const usuario = resetToken.user;
            usuario.password = await this.bcryptHash(password);
            resetToken.usedAt = new Date();

            await this.passwordResetTokenRepository.save(resetToken);
            const user = await this.userRepository.save(usuario);

            return { enviado: true, user: { ...user, password: null } };
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao alterar senha' };
        }
    }

    async verificarUserEmail(userId: string, to: string) {
        try {
            const usuario = await this.userRepository.findOne({
                where: { id: userId, email: to },
            });

            //console.log(usuario)
            const ativo = usuario?.ativo;
            return { ativo: Boolean(ativo) };
        } catch (error) {
            console.error('Erro ao processar forgotPassword:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro do provedor de e-mail:', error.response.body);
            }

            return { enviado: false, motivo: 'Erro interno ao enviar e-mail' };
        }
    }
    async enviarCodigo(email: string) {
        const startedAt = Date.now();
        try {
            const usuario = await this.userRepository.findOne({
                where: { email: email },
            });
            if (!usuario) {
                // Mantém trabalho criptográfico e tempo público equivalentes sem revelar cadastro.
                this.hashConfirmationCode('unknown-user', '000000');
                await this.padPublicResponse(startedAt);
                return PUBLIC_EMAIL_SUCCESS;
            }

            const now = new Date();
            let confirmation = await this.emailConfirmationRepository.findOne({
                where: {
                    user: { id: usuario.id },
                    purpose: EMAIL_CONFIRMATION_PURPOSE,
                    confirmed: false,
                },
                order: { createdAt: 'DESC' },
            });

            if (confirmation?.lockedUntil && confirmation.lockedUntil > now) {
                this.hashConfirmationCode(usuario.id, '000000');
                await this.padPublicResponse(startedAt);
                return PUBLIC_EMAIL_SUCCESS;
            }

            const expiresAt = new Date(now.getTime() + 3 * 60 * 1000);
            const codigo = this.generateConfirmationCode();
            const codeHash = this.hashConfirmationCode(usuario.id, codigo);

            if (confirmation) {
                confirmation.code = codeHash;
                confirmation.purpose = EMAIL_CONFIRMATION_PURPOSE;
                confirmation.expiresAt = expiresAt;
                confirmation.attemptCount = 0;
                confirmation.lockedUntil = null;
                confirmation = await this.emailConfirmationRepository.save(confirmation);
            } else {
                confirmation = this.emailConfirmationRepository.create({
                    user: usuario,
                    code: codeHash,
                    purpose: EMAIL_CONFIRMATION_PURPOSE,
                    expiresAt: expiresAt,
                    attemptCount: 0,
                    lockedUntil: null,
                });
                confirmation = await this.emailConfirmationRepository.save(confirmation);
            }

            const nome = usuario.username || 'Usuário';

            const htmlContent = EmailTemplates.getConfirmEmailTemplate(
                nome,
                codigo,
                `${process.env.FRONT_BASE_URL}/confirm-email`,
            );

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                'Confirmação de E-mail',
                htmlContent,
            );

            this.logger.log(`E-mail de confirmação enviado para ${this.maskEmail(email)}`);
            await this.padPublicResponse(startedAt);
            return PUBLIC_EMAIL_SUCCESS;
        } catch (error) {
            this.logger.warn(
                `Falha interna no envio de confirmação para ${this.maskEmail(email)}: ${(error as Error)?.message ?? String(error)}`,
            );
            await this.padPublicResponse(startedAt);
            return PUBLIC_EMAIL_SUCCESS;
        }
    }

    async confirmarEmail(email: string, codigo: string) {
        const startedAt = Date.now();
        try {
            const usuario = await this.userRepository.findOne({
                where: { email: email },
            });
            if (!usuario) {
                const fakeHash = this.hashConfirmationCode('unknown-user', '000000');
                this.matchesConfirmationCode('unknown-user', codigo, fakeHash);
                await this.padPublicResponse(startedAt);
                return PUBLIC_CONFIRMATION_FAILURE;
            }

            const now = new Date();
            const confirmation = await this.emailConfirmationRepository.findOne({
                where: {
                    user: { id: usuario.id },
                    purpose: EMAIL_CONFIRMATION_PURPOSE,
                    confirmed: false,
                },
                order: { createdAt: 'DESC' },
            });

            if (!confirmation) {
                this.hashConfirmationCode(usuario.id, codigo);
                await this.padPublicResponse(startedAt);
                return PUBLIC_CONFIRMATION_FAILURE;
            }

            if (confirmation.lockedUntil && confirmation.lockedUntil > now) {
                this.hashConfirmationCode(usuario.id, codigo);
                await this.padPublicResponse(startedAt);
                return PUBLIC_CONFIRMATION_FAILURE;
            }

            if (confirmation.expiresAt <= now) {
                await this.padPublicResponse(startedAt);
                return PUBLIC_CONFIRMATION_FAILURE;
            }

            if (confirmation.lockedUntil && confirmation.lockedUntil <= now) {
                confirmation.attemptCount = 0;
                confirmation.lockedUntil = null;
            }

            if (!this.matchesConfirmationCode(usuario.id, codigo, confirmation.code)) {
                confirmation.attemptCount = (confirmation.attemptCount ?? 0) + 1;
                if (confirmation.attemptCount >= this.confirmationMaxAttempts()) {
                    confirmation.lockedUntil = new Date(now.getTime() + this.confirmationLockoutMs());
                }
                await this.emailConfirmationRepository.save(confirmation);
                await this.padPublicResponse(startedAt);
                return PUBLIC_CONFIRMATION_FAILURE;
            }

            confirmation.confirmed = true;
            confirmation.attemptCount = 0;
            confirmation.lockedUntil = null;
            await this.emailConfirmationRepository.save(confirmation);

            usuario.ativo = true;
            await this.userRepository.save(usuario);

            this.logger.log(`E-mail confirmado com sucesso para ${this.maskEmail(email)}`);
            await this.padPublicResponse(startedAt);
            return { ok: true };
        } catch (error) {
            this.logger.warn(
                `Falha interna na confirmação para ${this.maskEmail(email)}: ${(error as Error)?.message ?? String(error)}`,
            );
            await this.padPublicResponse(startedAt);
            return PUBLIC_CONFIRMATION_FAILURE;
        }
    }

    async enviarEmailAvisandoQueOsDadosEstaoSendoProcessados(email: string) {
        try {
            console.log('📨 Iniciando processo de envio de e-mail...');

            // 🔎 Buscar usuário
            const usuario = await this.userRepository.findOne({ where: { email } });
            if (!usuario) {
                this.logger.warn(`Usuário não encontrado para aviso de processamento: ${this.maskEmail(email)}`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';

            this.logger.debug(`Usuário encontrado para aviso de processamento: user=${usuario.id}`);
            console.log('✉️  Preparando mensagem de aviso...');

            const htmlContent = EmailTemplates.getAnalysisStartedTemplate(
                nome,
                `${process.env.FRONT_BASE_URL}/dashboard`,
            );

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                'Urban AI - Análise de propriedades',
                htmlContent,
            );

            console.log('✅ Email enviado com sucesso!');
            return { enviado: true };
        } catch (error) {
            console.error('❌ Erro ao enviar e-mail:', error);
            if (error.response?.body) {
                console.error('📄 Detalhes do erro do provedor de e-mail:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao enviar e-mail' };
        }
    }
    async enviarEmailAvisandoQueOsDadosForamProcessados(email: string) {
        try {
            console.log('📨 Iniciando processo de envio de e-mail...');

            // 🔎 Buscar usuário
            const usuario = await this.userRepository.findOne({ where: { email } });
            if (!usuario) {
                this.logger.warn(
                    `Usuário não encontrado para aviso de processamento finalizado: ${this.maskEmail(email)}`,
                );
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';

            this.logger.debug(`Usuário encontrado para aviso de processamento finalizado: user=${usuario.id}`);
            console.log('✉️  Preparando mensagem de aviso...');

            const htmlContent = EmailTemplates.getAnalysisFinishedTemplate(
                nome,
                `${process.env.FRONT_BASE_URL}/painel`,
            );

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                'Urban AI - Análise concluída',
                htmlContent,
            );

            console.log('✅ Email enviado com sucesso!');
            return { enviado: true };
        } catch (error) {
            console.error('❌ Erro ao enviar e-mail:', error);
            if (error.response?.body) {
                console.error('📄 Detalhes do erro do provedor de e-mail:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao enviar e-mail' };
        }
    }

    async forgotPassword(email: string) {
        const startedAt = Date.now();
        try {
            const usuario = await this.userRepository.findOne({
                where: { email: email },
            });

            if (!usuario) {
                this.hashResetToken(crypto.randomBytes(32).toString('base64url'));
                await this.padPublicResponse(startedAt);
                return PUBLIC_EMAIL_SUCCESS;
            }

            const nome = usuario.username || 'Usuário';
            const token = crypto.randomBytes(32).toString('base64url');
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

            await this.passwordResetTokenRepository
                .createQueryBuilder()
                .update(PasswordResetToken)
                .set({ usedAt: new Date() })
                .where('user_id = :userId', { userId: usuario.id })
                .andWhere('usedAt IS NULL')
                .execute();

            await this.passwordResetTokenRepository.save(
                this.passwordResetTokenRepository.create({
                    user: usuario,
                    tokenHash: this.hashResetToken(token),
                    expiresAt,
                    usedAt: null,
                }),
            );

            const htmlContent = EmailTemplates.getForgotPasswordTemplate(nome, this.buildResetLink(token));

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                'Recuperação de Senha - Urban AI',
                htmlContent,
            );

            // await sgMail.send(msg);

            console.log(`E-mail de recuperação enviado para usuário ${usuario.id}`);
            await this.padPublicResponse(startedAt);
            return PUBLIC_EMAIL_SUCCESS;
        } catch (error) {
            this.logger.warn(
                `Falha interna no reset para ${this.maskEmail(email)}: ${(error as Error)?.message ?? String(error)}`,
            );
            await this.padPublicResponse(startedAt);
            return PUBLIC_EMAIL_SUCCESS;
        }
    }

    async enviarNotification(usuarioId: string, notificationContent: CreateNotificationDto) {
        try {
            const usuario = await this.userRepository.findOne({
                where: { id: usuarioId },
            });

            if (!usuario) {
                this.logger.warn(`Usuário não encontrado para notificação: user=${usuarioId}`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';
            const userId = usuario.id;

            const notification = await this.notificationService.create(usuarioId, notificationContent);
            if (notification) {
                this.logger.debug(`Notificação salva para user=${usuarioId}`);
            }

            if (this.shouldBatchPricingRecommendation(notificationContent)) {
                await this.queuePricingRecommendationDigest(usuario, notificationContent, notification?.id);
                return { enviado: true, batched: true };
            }

            if (notificationContent?.sendEmail) {
                const htmlContent = EmailTemplates.getSystemNotificationTemplate(
                    nome,
                    notificationContent.title || 'Nova Mensagem',
                    notificationContent.description || '',
                    notificationContent.redirectTo || process.env.FRONT_BASE_URL || '',
                );

                await this.sendHtmlEmailOrThrow(
                    { email: usuario.email, name: nome },
                    notificationContent.title || 'Nova Mensagem',
                    htmlContent,
                );

                this.logger.log(`E-mail de notificação enviado para user=${userId}`);
            } else {
                console.log('Email foi marcado para não ser enviado, portanto não foi enviado.');
            }
            const shouldSendPush = notificationContent?.sendPush ?? notificationContent?.sendEmail ?? false;
            if (shouldSendPush) {
                const pushResult = await this.pushNotificationService.sendToUser(userId, {
                    title: notificationContent.title || 'Urban AI',
                    body: notificationContent.description || '',
                    url: notificationContent.redirectTo || '/notificacao',
                    tag: notificationContent.pushTag || `notification-${notification?.id ?? Date.now()}`,
                    data: {
                        type: notificationContent.pushType || 'system_notification',
                        notificationId: notification?.id,
                    },
                });
                this.logger.debug(`Push PWA para user=${userId}: ${JSON.stringify(pushResult)}`);
            }
            return { enviado: true };
        } catch (error) {
            console.error('Erro ao processar envio:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro do provedor de e-mail:', error.response.body);
            }

            return {
                enviado: false,
                motivo: 'Erro interno ao enviar e-mail ou notificação',
            };
        }
    }

    private shouldBatchPricingRecommendation(notificationContent: CreateNotificationDto): boolean {
        const type = notificationContent?.pushType?.trim();
        const title = (notificationContent?.title || '').toLowerCase();
        return (
            type === 'pricing_recommendation' ||
            type === 'pricing_recommendation_digest' ||
            title.includes('sugestões de preço') ||
            title.includes('sugestão de preço') ||
            title.includes('sugestões de preço') ||
            title.includes('sugestão de preço') ||
            title.includes('sugestões disponíveis') ||
            title.includes('sugestoes disponiveis')
        );
    }

    private async queuePricingRecommendationDigest(
        user: User,
        notificationContent: CreateNotificationDto,
        notificationId?: string,
    ): Promise<void> {
        const userId = user.id;
        const preferences = await this.communicationPreferences.getForUser(userId);
        const wantsEmail = Boolean(notificationContent.sendEmail && preferences.emailPricing);
        const wantsPush = Boolean(
            (notificationContent.sendPush ?? notificationContent.sendEmail) && preferences.pushPricing,
        );
        if (!wantsEmail && !wantsPush) return;
        await this.pricingDigestService.appendPendingDigest({
            user,
            item: this.toPricingDigestItem(notificationContent, notificationId),
            wantsEmail,
            wantsPush,
            delayMs: this.pricingDigestDelayMs,
        });

        if (!this.pricingDigestTimers.has(userId)) {
            const timer = setTimeout(() => {
                this.pricingDigestTimers.delete(userId);
                this.flushPricingRecommendationDigest(userId).catch((error) => {
                    this.logger.warn(
                        `pricing digest failed user=${userId}: ${(error as Error)?.message ?? String(error)}`,
                    );
                });
            }, this.pricingDigestDelayMs);
            timer.unref?.();
            this.pricingDigestTimers.set(userId, timer);
        }
    }

    private async flushPricingRecommendationDigest(userId: string): Promise<void> {
        const digest = await this.pricingDigestService.claimDueDigest(userId);
        if (!digest) return;
        await this.sendClaimedPricingRecommendationDigest(digest);
    }

    @Interval(30000)
    private async flushDuePricingRecommendationDigests(): Promise<void> {
        if (process.env.PRICING_DIGEST_SWEEP_ENABLED === 'false') return;

        const limit = Math.max(1, Math.min(Number(process.env.PRICING_DIGEST_SWEEP_LIMIT || 10), 50));
        for (let index = 0; index < limit; index += 1) {
            const digest = await this.pricingDigestService.claimDueDigest();
            if (!digest) return;
            await this.sendClaimedPricingRecommendationDigest(digest);
        }
    }

    private async sendClaimedPricingRecommendationDigest(digest: ClaimedPricingDigest): Promise<void> {
        const items = digest.items;
        if (!items.length) return;

        const preferences = await this.communicationPreferences.getForUser(digest.userId);
        const wantsEmail = Boolean(digest.wantsEmail && preferences.emailPricing);
        const wantsPush = Boolean(digest.wantsPush && preferences.pushPricing);
        if (!wantsEmail && !wantsPush) {
            await this.pricingDigestService.markSkipped(digest.id, 'pricing_digest_opted_out_before_flush');
            return;
        }

        const dashboardUrl = `${(process.env.FRONT_BASE_URL || 'https://app.myurbanai.com').replace(/\/$/, '')}/dashboard?source=pricing_digest_email`;
        const subject =
            items.length === 1
                ? '1 recomendação de preço para revisar - Urban AI'
                : `${items.length} recomendações de preço para revisar - Urban AI`;

        try {
            if (wantsEmail) {
                const html = EmailTemplates.getPricingRecommendationDigestTemplate({
                    nome: digest.name,
                    dashboardUrl,
                    items,
                });
                await this.sendHtmlEmailOrThrow({ email: digest.email, name: digest.name }, subject, html);
            }

            if (wantsPush) {
                await this.pushNotificationService.sendToUser(digest.userId, {
                    title:
                        items.length === 1
                            ? 'Recomendação de preço para revisar'
                            : 'Recomendações de preço para revisar',
                    body:
                        items.length === 1
                            ? 'A Urban AI preparou uma recomendação nova para revisar.'
                            : `A Urban AI preparou ${items.length} recomendações para revisar em um só lugar.`,
                    url: '/dashboard?source=pwa_push_pricing_digest',
                    tag: `pricing-digest-${new Date().toISOString().slice(0, 10)}`,
                    data: {
                        type: 'pricing_recommendation_digest',
                        count: items.length,
                        digestId: digest.id,
                    },
                });
            }

            await this.pricingDigestService.markSent(digest.id);
        } catch (error) {
            await this.pricingDigestService.markFailed(digest.id, error);
            throw error;
        }
    }

    private toPricingDigestItem(
        notificationContent: CreateNotificationDto,
        notificationId?: string,
    ): PricingDigestItem {
        const metadata = notificationContent.metadata || {};
        const reasons = Array.isArray(metadata.reasons)
            ? metadata.reasons.filter((item) => typeof item === 'string').slice(0, 4)
            : [];
        const propertyTitle =
            this.metadataString(metadata.propertyTitle) ||
            this.metadataString(metadata.listingTitle) ||
            this.metadataString(metadata.propertyName) ||
            this.extractPropertyTitle(notificationContent.description) ||
            'Imóvel';
        return {
            notificationId,
            title: notificationContent.title || 'Sugestão de preço',
            description: notificationContent.description || 'Nova recomendação disponível para revisão.',
            redirectTo: notificationContent.redirectTo || '/dashboard',
            propertyTitle,
            propertyNickname:
                this.metadataString(metadata.propertyNickname) || this.metadataString(metadata.internalNickname),
            propertyCode: this.metadataString(metadata.propertyCode) || this.metadataString(metadata.internalCode),
            propertyAddress: this.metadataString(metadata.propertyAddress) || this.metadataString(metadata.address),
            currentPrice: this.metadataNumber(metadata.currentPrice ?? metadata.seuPrecoAtual),
            suggestedPrice: this.metadataNumber(metadata.suggestedPrice ?? metadata.precoSugerido),
            liftPercent: this.metadataNumber(metadata.liftPercent ?? metadata.diferencaPercentual),
            reasons,
            createdAt: new Date().toISOString(),
        };
    }

    private extractPropertyTitle(description?: string): string | null {
        if (!description) return null;
        const lower = description.toLocaleLowerCase('pt-BR');
        const markers = ['imóvel ', 'imovel '];
        const marker = markers
            .map((value) => ({ value, index: lower.indexOf(value) }))
            .filter(({ index }) => index >= 0)
            .sort((left, right) => left.index - right.index)[0];
        if (!marker) return null;
        const remainder = description.slice(marker.index + marker.value.length);
        const sentenceEnd = remainder.indexOf('.');
        const title = (sentenceEnd >= 0 ? remainder.slice(0, sentenceEnd) : remainder).trim();
        return title.slice(0, 120) || null;
    }

    private metadataString(value: unknown): string | undefined {
        const text = String(value ?? '').trim();
        return text.length ? text.slice(0, 240) : undefined;
    }

    private metadataNumber(value: unknown): number | null {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : null;
    }

    async compilarEventosUnicosUsuarios() {
        try {
            const users = await this.userRepository.find({
                where: { distanceKm: Not(IsNull()) },
            });

            const relatorioUsuarios: {
                usuarioId: string;
                username: string;
                email: string;
                eventosUnicos: number;
                emailDisparado: boolean;
            }[] = [];

            for (const user of users) {
                const analises = await this.analysisRepo.find({
                    where: {
                        usuarioProprietario: { id: user.id },
                        enviado: false,
                    },
                    relations: ['evento'], // para garantir acesso ao evento.id
                });
                const eventosUnicos = new Set(analises.map((a) => a.evento?.id));

                relatorioUsuarios.push({
                    usuarioId: user.id,
                    username: user.username || '',
                    email: user.email || '',
                    eventosUnicos: eventosUnicos.size,
                    emailDisparado: false,
                });

                if (eventosUnicos.size > 0) {
                    this.logger.debug(
                        `Usuário ${user.id} possui ${eventosUnicos.size} eventos únicos analisados; e-mail legado suprimido.`,
                    );
                } else {
                    this.logger.debug(`Nenhum evento disponível para user=${user.id}`);
                }
            }

            return relatorioUsuarios;
        } catch (error) {
            console.error('Erro ao compilar eventos únicos por usuário:', error);
            return [];
        }
    }
}
