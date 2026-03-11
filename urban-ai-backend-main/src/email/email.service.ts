import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { InjectRepository } from '@nestjs/typeorm';
import { ProcessService } from 'src/process/process.service';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';
import * as crypto from 'crypto';
import { EmailConfirmation } from 'src/entities/EmailConfirmation';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { MailerService } from 'src/mailer/mailer.service';

@Injectable()
export class EmailService {

    private transporter: nodemailer.Transporter;

    constructor(
        @InjectRepository(AnaliseEnderecoEvento)
        private readonly analysisRepo: Repository<AnaliseEnderecoEvento>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(EmailConfirmation)
        private readonly emailConfirmationRepository: Repository<EmailConfirmation>,
        private readonly notificationService: NotificationsService,
        private readonly mailerService: MailerService,
    ) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT, 10),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
    }

    async getProfileById(userId: string) {
        console.log(userId)
        const user = await this.userRepository.findOne({ where: { id: userId } });
        //if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
        console.log(user)
        return user
    }
    private sha256(str: string): string {
        return crypto.createHash('sha256').update(str).digest('hex');
    }



    async sendEmail(to: string, name: string, subject: string, quantidade: number) {
        const msg = {
            to: to,
            templateId: 'd-c9cb9b52504d449f987db33d47d94ca1',
            dynamic_template_data: {
                name: name,
                nome: name,
                subject: subject,
                quantidade: quantidade
            },
            from: process.env.EMAIL_SENDER,
            subject: 'Dengue Zero',

        }


        try {
            await sgMail.send(msg);
            console.log('Email enviado com sucesso');
            return { enviado: true };
        } catch (error) {
            console.error('Erro ao enviar email', error);
            return { enviado: false };
        }
    }

    async confirmPassword(idUsuario: string, password: string) {
        try {
            const usuario = await this.userRepository.findOne({ where: { id: idUsuario } });
            console.log(usuario, idUsuario);

            if (!usuario) {
                console.warn(`Usuário com email ${idUsuario} não encontrado.`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const isHex = /^[a-f0-9]{64}$/i.test(password);
            const pwdHash = isHex ? password : this.sha256(password);

            // garante update, não insert
            usuario.password = pwdHash;

            console.log("senha", pwdHash)
            const user = await this.userRepository.save(usuario);

            console.log(`Senha alterada para usuário ${idUsuario}`);
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
                console.error('Detalhes do erro SendGrid:', error.response.body);
            }

            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }
    async enviarCodigo(email: string) {
        try {
            // 1️⃣ Buscar o usuário
            const usuario = await this.userRepository.findOne({ where: { email: email } });
            if (!usuario) {
                console.warn(`Usuário com email ${email} não encontrado.`);
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

            // 3️⃣ Envia o email via SendGrid
            const msg = {
                to: usuario?.email,
                templateId: process.env.SENDGRID_SEND_CODE_TEMPLATE,
                dynamic_template_data: {
                    nome: nome,
                    email: usuario?.email,
                    codigo: confirmation.code,
                    subject: "Urban AI - Confirmação de Email",
                    app_name: "Urban Ai",
                    front_url: `${process.env.FRONT_BASE_URL}/confirm-email`
                },
                from: process.env.EMAIL_SENDER,
                subject: 'Confirmação de Email',
            };

            await this.mailerService.sendTemplateEmail(
                { email: usuario?.email, name: nome },
                "Confirmação de Email",
                process.env.MAILERSEND_SEND_CODE_TEMPLATE,
                msg.dynamic_template_data,
            );

            console.log(`Email de confirmação enviado para ${email}`);
            return { enviado: true };

        } catch (error) {
            console.error('Erro ao enviar email de confirmação:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro SendGrid:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }

    }

    async confirmarEmail(email: string, codigo: string) {
        try {
            // 1️⃣ Buscar o usuário
            const usuario = await this.userRepository.findOne({ where: { email: email } });
            if (!usuario) {
                console.warn(`Usuário com id ${email} não encontrado.`);
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

            console.log(`Email do usuário ${email} confirmado com sucesso.`);
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
                console.warn(`⚠️ Usuário com email ${email} não encontrado.`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';

            console.log(`👤 Usuário encontrado: ${nome} (${usuario.email})`);
            console.log("✉️  Preparando mensagem de aviso...");

            // 📩 Monta mensagem só com os dados necessários
            const msg = {
                to: usuario.email,
                templateId: process.env.SENDGRID_ANALISE_PROPRIEDADE_INICIADO,
                dynamic_template_data: {
                    nome: nome,
                    app_name: "Urban Ai",
                    front_url: `${process.env.FRONT_BASE_URL}/dashboard`,
                    subject: "Urban AI - Análise de propriedades",
                },
                subject: "Urban AI - Análise de propriedades",
                from: process.env.EMAIL_SENDER,
            };

            console.log(`🚀 Enviando email de aviso para: ${usuario.email} ...`);

            await this.mailerService.sendTemplateEmail(
                { email: usuario?.email, name: nome },
                "Forgot password",
                process.env.MAILERSEND_ANALISE_PROPRIEDADE_INICIADO,
                msg.dynamic_template_data,
            );

            console.log("✅ Email enviado com sucesso!");
            return { enviado: true };

        } catch (error) {
            console.error('❌ Erro ao enviar email:', error);
            if (error.response?.body) {
                console.error('📄 Detalhes do erro SendGrid:', error.response.body);
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
                console.warn(`⚠️ Usuário com email ${email} não encontrado.`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';

            console.log(`👤 Usuário encontrado: ${nome} (${usuario.email})`);
            console.log("✉️  Preparando mensagem de aviso...");

            // 📩 Monta mensagem só com os dados necessários
            const msg = {
                to: usuario.email,
                templateId: process.env.SENDGRID_ANALISE_PROPRIEDADE_FINALIZADO,
                dynamic_template_data: {
                    nome: nome,
                    app_name: "Urban Ai",
                    front_url: `${process.env.FRONT_BASE_URL}/painel`,
                    subject: "Urban AI - Análise completed",
                },
                subject: "Urban AI - Análise completed",
                from: process.env.EMAIL_SENDER,
            };

            console.log(`🚀 Enviando email de aviso para: ${usuario.email} ...`);

            await this.mailerService.sendTemplateEmail(
                { email: usuario?.email, name: nome },
                "Forgot password",
                process.env.MAILERSEND_ANALISE_PROPRIEDADE_FINALIZADO,
                msg.dynamic_template_data,
            );

            console.log("✅ Email enviado com sucesso!");
            return { enviado: true };

        } catch (error) {
            console.error('❌ Erro ao enviar email:', error);
            if (error.response?.body) {
                console.error('📄 Detalhes do erro SendGrid:', error.response.body);
            }
            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }

    async forgotPassword_bkp(email: string) {
        console.log(email)
        try {
            const usuario = await this.userRepository.findOne({
                where: { email: email }
            });

            if (!usuario) {
                console.warn(`Usuário com email ${email} não encontrado.`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';
            const userId = usuario.id;

            const msg = {
                to: usuario?.email,
                templateId: process.env.SENDGRID_FORGOT_PASS_TEMPLATE,
                dynamic_template_data: {
                    nome: nome,
                    email: usuario?.email,
                    userId: userId,
                    subject: "Forgot password",
                    app_name: "Urban Ai",
                    link_reset: `${process.env.RESET_PASS_URL}/${userId}`
                },
                from: process.env.EMAIL_SENDER,
                subject: 'Forgot password',
            };

            console.log(msg)

            await sgMail.send(msg);

            console.log(`Email de recuperação enviado para ${userId}`);
            return { enviado: true };

        } catch (error) {
            console.error('Erro ao processar forgotPassword:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro SendGrid:', error.response.body);
            }

            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }
    async forgotPassword(email: string) {
        console.log(email)
        try {
            const usuario = await this.userRepository.findOne({
                where: { email: email }
            });

            if (!usuario) {
                console.warn(`Usuário com email ${email} não encontrado.`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';
            const userId = usuario.id;

            const msg = {
                to: usuario?.email,
                templateId: process.env.SENDGRID_FORGOT_PASS_TEMPLATE,
                dynamic_template_data: {
                    nome: nome,
                    email: usuario?.email,
                    userId: userId,
                    subject: "Forgot password",
                    app_name: "Urban Ai",
                    link_reset: `${process.env.RESET_PASS_URL}/${userId}`
                },
                from: process.env.EMAIL_SENDER,
                subject: 'Forgot password',
            };

            await this.mailerService.sendTemplateEmail(
                { email: usuario?.email, name: nome },
                "Forgot password",
                process.env.MAILERSEND_FORGOT_PASS_TEMPLATE,
                msg.dynamic_template_data,
            );

            // await sgMail.send(msg);

            console.log(`Email de recuperação enviado para ${userId}`);
            return { enviado: true };

        } catch (error) {
            console.error('Erro ao processar forgotPassword:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro SendGrid:', error.response.body);
            }

            return { enviado: false, motivo: 'Erro interno ao enviar email' };
        }
    }


    async enviarNotification(usuarioId: string, notificationContent: CreateNotificationDto) {
        console.log(usuarioId)
        try {
            const notification = await this.notificationService.create(usuarioId, notificationContent)
            if (notification) {
                console.log("Notificação salvo com sucesso!")
            }
            const usuario = await this.userRepository.findOne({
                where: { id: usuarioId }
            });

            if (!usuario) {
                console.warn(`Usuário com id ${usuarioId} não encontrado.`);
                return { enviado: false, motivo: 'Usuário não encontrado' };
            }

            const nome = usuario.username || 'Usuário';
            const userId = usuario.id;

            if (notificationContent?.sendEmail) {
                const msg = {
                    to: usuario?.email,
                    templateId: process.env.SENDGRID_ENVIO_NOTIFICATION,
                    dynamic_template_data: {
                        nome: nome,
                        email: usuario?.email,
                        userId: userId,
                        subject: "Nova Mensagem",
                        app_name: "Urban Ai",
                        title: notificationContent?.title,
                        description: notificationContent?.description,
                        redirectTo: notificationContent?.redirectTo,
                        front_url: `${process.env.FRONT_BASE_URL}`,
                        ano_atual: `2025`
                    },
                    from: process.env.EMAIL_SENDER,
                    subject: 'Forgot password',
                };

              await this.mailerService.sendTemplateEmail(
                { email: usuario?.email, name: nome },
                msg.dynamic_template_data.subject,
                process.env.MAILERSEND_ENVIO_NOTIFICATION,
                msg.dynamic_template_data,
            );

                console.log(`Email de notificação enviado para ${userId}`);
            } else {
                console.log("Email foi marcado para não ser enviado, portanto não foi enviado.")
            }
            return { enviado: true };

        } catch (error) {
            console.error('Erro ao processar envio:', error);
            if (error.response && error.response.body) {
                console.error('Detalhes do erro SendGrid:', error.response.body);
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
                    console.log(`Usuário ${user.username}, ${user.id} possui ${eventosUnicos.size} eventos únicos analisados.`);
                    const enviado = await this.sendEmail(user?.email, user?.username, "Novos eventos", eventosUnicos.size)

                    if (enviado && enviado?.enviado) {
                        console.log(`✅ Email enviado com sucesso para o usuário ${user?.username}`);
                    } else {
                        console.log(`❌ Falha ao enviar email para o usuário ${user?.username}`);
                    }
                } else {
                    console.log(`ℹ️ Nenhum evento disponível para envio no momento para o usuário ${user?.username}.`);
                }

            }

            return relatorioUsuarios;
        } catch (error) {
            console.error('Erro ao compilar eventos únicos por usuário:', error);
            return [];
        }
    }

}
