import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProcessService } from 'src/process/process.service';
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

@Injectable()
export class EmailService {

    private readonly logger = new Logger(EmailService.name);

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
    ) { }

    async getProfileById(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        return user
    }
    private async bcryptHash(passwordOrSha256: string): Promise<string> {
        // O input pode ser texto-puro OU pré-hash SHA-256 vindo do frontend legado.
        // Em ambos os casos, o valor entrada é tratado como "senha" e vira bcrypt.
        return bcrypt.hash(passwordOrSha256, 12);
    }

    private hashResetToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private buildResetLink(token: string): string {
        const base =
            process.env.RESET_PASS_URL ||
            `${process.env.FRONT_BASE_URL || 'https://app.myurbanai.com'}/reset-password`;
        return `${base.replace(/\/$/, '')}/${encodeURIComponent(token)}`;
    }

    private maskEmail(email?: string): string {
        if (!email || !email.includes('@')) return 'unknown';
        const [local, domain] = email.split('@');
        return `${local.slice(0, 2)}***@${domain}`;
    }

    private async sendHtmlEmailOrThrow(
        to: { email: string; name?: string },
        subject: string,
        htmlContent: string,
    ) {
        const result = await this.mailerService.sendHtmlEmail(to, subject, htmlContent);
        if (!result?.enviado) {
            throw new Error(result?.message || `Transactional email rejected with status=${result?.status ?? 'unknown'}`);
        }
        return result;
    }



    async sendEmail(to: string, name: string, subject: string, quantidade: number) {
        try {
            if (!to) {
                return { enviado: false, status: 400, motivo: 'E-mail de destino ausente' };
            }

            const title = subject || 'Novos eventos';
            const htmlContent = EmailTemplates.getEventNotificationTemplate(
                name || 'Usuario',
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
            this.logger.error(`Erro ao enviar email transacional: ${error instanceof Error ? error.message : error}`);
            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }

    async confirmPassword(token: string, password: string) {
        try {
            const resetToken = await this.passwordResetTokenRepository.findOne({
                where: { tokenHash: this.hashResetToken(token) },
                relations: ['user'],
            });

            if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
                return { enviado: false, motivo: 'Token invalido ou expirado' };
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


    async verificarUserEmail(to: string) {
        try {
            const usuario = await this.userRepository.findOne({
                where: { email: to }
            });

            //console.log(usuario)
            const ativo = usuario?.ativo;
            return { ativo };

        } catch (error) {
            console.error('Erro ao processar forgotPassword:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro do provedor de email:', error.response.body);
            }

            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }
    async enviarCodigo(email: string) {
        try {
            // 1️⃣ Buscar o usuário
            const usuario = await this.userRepository.findOne({ where: { email: email } });
            if (!usuario) {
                this.logger.warn(`Usuario nao encontrado para envio de codigo: ${this.maskEmail(email)}`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const now = new Date();

            // 2️⃣ Verificar se já existe um código válido
            let confirmation = await this.emailConfirmationRepository.findOne({
                where: { user: { id: usuario.id }, confirmed: false },
                order: { createdAt: "DESC" },
            });

            const expiresAt = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutos à frente
            const codigo = Math.floor(100000 + Math.random() * 900000).toString(); // código de 6 dígitos

            if (confirmation && confirmation.expiresAt > now) {
                // Já existe código válido, reutiliza
            } else if (confirmation) {
                // Atualiza código existente
                confirmation.code = codigo;
                confirmation.expiresAt = expiresAt;
                confirmation = await this.emailConfirmationRepository.save(confirmation);
            } else {
                // Cria novo código
                confirmation = this.emailConfirmationRepository.create({
                    user: usuario,
                    code: codigo,
                    expiresAt: expiresAt,
                });
                confirmation = await this.emailConfirmationRepository.save(confirmation);
            }

            const nome = usuario.username || 'Usuário';

            const htmlContent = EmailTemplates.getConfirmEmailTemplate(
                nome, 
                confirmation.code, 
                `${process.env.FRONT_BASE_URL}/confirm-email`
            );

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                "Confirmação de E-mail",
                htmlContent
            );

            this.logger.log(`Email de confirmacao enviado para ${this.maskEmail(email)}`);
            return { enviado: true };

        } catch (error) {
            console.error('Erro ao enviar email de confirmação:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro do provedor de email:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }

    }

    async confirmarEmail(email: string, codigo: string) {
        try {
            // 1️⃣ Buscar o usuário
            const usuario = await this.userRepository.findOne({ where: { email: email } });
            if (!usuario) {
                this.logger.warn(`Usuario nao encontrado para confirmar email: ${this.maskEmail(email)}`);
                return { ok: false, motivo: 'Usuário não encontrado' };
            }

            const now = new Date();

            // 2️⃣ Buscar o código mais recente não confirmado
            const confirmation = await this.emailConfirmationRepository.findOne({
                where: { user: { id: usuario.id }, confirmed: false },
                order: { createdAt: "DESC" },
            });

            const newUserState = await this.userRepository.findOne({
                where: { id: usuario.id, ativo: false },
                order: { createdAt: "DESC" },
            });



            if (!confirmation) {
                return { ok: false, motivo: 'Código não encontrado' };
            }

            // 3️⃣ Verificar validade e correspondência
            if (confirmation.expiresAt < now) {
                return { ok: false, motivo: 'Código expirado' };
            }

            if (confirmation.code !== codigo) {
                return { ok: false, motivo: 'Código inválido' };
            }

            // 4️⃣ Marcar como confirmado
            confirmation.confirmed = true;
            await this.emailConfirmationRepository.save(confirmation);

            newUserState.ativo = true;
            await this.userRepository.save(newUserState);

            this.logger.log(`Email confirmado com sucesso para ${this.maskEmail(email)}`);
            return { ok: true };

        } catch (error) {
            console.error('Erro ao confirmar email:', error);
            return { ok: false, motivo: 'Erro interno ao confirmar email' };
        }
    }

    async enviarEmailAvisandoQueOsDadosEstaoSendoProcessados(email: string) {
        try {
            console.log("📨 Iniciando processo de envio de email...");

            // 🔎 Buscar usuário
            const usuario = await this.userRepository.findOne({ where: { email } });
            if (!usuario) {
                this.logger.warn(`Usuario nao encontrado para aviso de processamento: ${this.maskEmail(email)}`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';

            this.logger.debug(`Usuario encontrado para aviso de processamento: user=${usuario.id}`);
            console.log("✉️  Preparando mensagem de aviso...");

            const htmlContent = EmailTemplates.getAnalysisStartedTemplate(
                nome,
                `${process.env.FRONT_BASE_URL}/dashboard`
            );

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                "Urban AI - Análise de propriedades",
                htmlContent
            );

            console.log("✅ Email enviado com sucesso!");
            return { enviado: true };

        } catch (error) {
            console.error('❌ Erro ao enviar email:', error);
            if (error.response?.body) {
                console.error('📄 Detalhes do erro do provedor de email:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }
    async enviarEmailAvisandoQueOsDadosForamProcessados(email: string) {
        try {
            console.log("📨 Iniciando processo de envio de email...");

            // 🔎 Buscar usuário
            const usuario = await this.userRepository.findOne({ where: { email } });
            if (!usuario) {
                this.logger.warn(`Usuario nao encontrado para aviso de processamento finalizado: ${this.maskEmail(email)}`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';

            this.logger.debug(`Usuario encontrado para aviso de processamento finalizado: user=${usuario.id}`);
            console.log("✉️  Preparando mensagem de aviso...");

            const htmlContent = EmailTemplates.getAnalysisFinishedTemplate(
                nome,
                `${process.env.FRONT_BASE_URL}/painel`
            );

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                "Urban AI - Análise completed",
                htmlContent
            );

            console.log("✅ Email enviado com sucesso!");
            return { enviado: true };

        } catch (error) {
            console.error('❌ Erro ao enviar email:', error);
            if (error.response?.body) {
                console.error('📄 Detalhes do erro do provedor de email:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }

    async forgotPassword(email: string) {
        try {
            const usuario = await this.userRepository.findOne({
                where: { email: email }
            });

            if (!usuario) {
                return { enviado: true };
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
                })
            );

            const htmlContent = EmailTemplates.getForgotPasswordTemplate(
                nome,
                this.buildResetLink(token)
            );

            await this.sendHtmlEmailOrThrow(
                { email: usuario?.email, name: nome },
                "Recuperação de Senha - Urban AI",
                htmlContent
            );

            // await sgMail.send(msg);

            console.log(`Email de recuperação enviado para usuario ${usuario.id}`);
            return { enviado: true };

        } catch (error) {
            console.error('Erro ao processar forgotPassword:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro do provedor de email:', error.response.body);
            }

            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }


    async enviarNotification(usuarioId: string, notificationContent: CreateNotificationDto) {
        try {
            const notification = await this.notificationService.create(usuarioId, notificationContent)
            if (notification) {
                this.logger.debug(`Notificacao salva para user=${usuarioId}`);
            }
            const usuario = await this.userRepository.findOne({
                where: { id: usuarioId }
            });

            if (!usuario) {
                this.logger.warn(`Usuario nao encontrado para notificacao: user=${usuarioId}`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';
            const userId = usuario.id;

            if (notificationContent?.sendEmail) {
                const htmlContent = EmailTemplates.getSystemNotificationTemplate(
                  nome,
                  notificationContent.title || 'Nova Mensagem',
                  notificationContent.description || '',
                  notificationContent.redirectTo || process.env.FRONT_BASE_URL || ''
                );

                await this.sendHtmlEmailOrThrow(
                  { email: usuario.email, name: nome },
                  notificationContent.title || 'Nova Mensagem',
                  htmlContent
                );

                this.logger.log(`Email de notificacao enviado para user=${userId}`);
            } else {
                console.log("Email foi marcado para não ser enviado, portanto não foi enviado.")
            }
            return { enviado: true };

        } catch (error) {
            console.error('Erro ao processar envio:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro do provedor de email:', error.response.body);
            }

            return { enviado: false, motivo: 'Erro interno ao enviar email ou notificação' };
        }
    }



    async compilarEventosUnicosUsuarios() {
        try {
            const users = await this.userRepository.find({
                where: { distanceKm: Not(IsNull()) }
            });

            const relatorioUsuarios: {
                usuarioId: string;
                username: string;
                email: string;
                eventosUnicos: number;
            }[] = [];

            for (const user of users) {
                const analises = await this.analysisRepo.find({
                    where: {
                        usuarioProprietario: { id: user.id },
                        enviado: false,
                    },
                    relations: ['evento'], // para garantir acesso ao evento.id
                });
                const eventosUnicos = new Set(
                    analises.map(a => a.evento?.id)
                );

                relatorioUsuarios.push({
                    usuarioId: user.id,
                    username: user.username || '',
                    email: user.email || '',
                    eventosUnicos: eventosUnicos.size
                });

                if (eventosUnicos.size > 0) {
                    this.logger.debug(`Usuario ${user.id} possui ${eventosUnicos.size} eventos unicos analisados.`);
                    const enviado = await this.sendEmail(user?.email, user?.username, "Novos eventos", eventosUnicos.size)

                    if (enviado && enviado?.enviado) {
                        this.logger.log(`Email de eventos enviado para user=${user.id}`);
                    } else {
                        this.logger.warn(`Falha ao enviar email de eventos para user=${user.id}`);
                    }
                } else {
                    this.logger.debug(`Nenhum evento disponivel para envio para user=${user.id}`);
                }

            }

            return relatorioUsuarios;
        } catch (error) {
            console.error('Erro ao compilar eventos únicos por usuário:', error);
            return [];
        }
    }

}
