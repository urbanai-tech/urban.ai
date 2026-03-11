
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AirbnbService } from 'src/airbnb/airbnb.service';
import { EmailService } from 'src/email/email.service';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { MailerService } from 'src/mailer/mailer.service';
import { SendEmailDto } from 'src/mailer/tdo/sendEmail.tdo';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';
import { getDiariaForCron } from 'src/util';
import { Raw, Repository } from 'typeorm';

@Injectable()
export class CronService {
    constructor(@InjectRepository(AnalisePreco)
    private readonly analisePrecoRepository: Repository<AnalisePreco>,
        private readonly airbnbService: AirbnbService,
        private readonly emailService: EmailService,
        private readonly mailerSender: MailerService) { }
    async buscarAnalisesAceitas(): Promise<any> {
        // Pega o dia de hoje sem hora (só AAAA-MM-DD)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataHoje = hoje.toISOString().split('T')[0];

        console.log(`\n🔎 Buscando análises aceitas a partir de ${dataHoje}...\n`);

        const aceites = await this.analisePrecoRepository.find({
            where: {
                aceito: true,
                evento: {
                    dataInicio: Raw(
                        (alias) => `DATE(${alias}) >= :dataHoje`,
                        { dataHoje }
                    )
                }
            },
            relations: ['endereco', 'evento', 'usuarioProprietario'],
        });

        console.log(`✅ ${aceites.length} análises aceitas encontradas.\n`);

        for (const element of aceites) {
            console.log(`🏠 Propriedade de: ${element.usuarioProprietario.email}`);
            console.log(`   📊 Diferença percentual: ${element.diferencaPercentual}%`);
            console.log(`   📝 Recomendação: ${element.recomendacao}`);
            console.log(`   💵 Seu preço atual: R$${element.seuPrecoAtual}`);
            console.log(`   🎯 Preço sugerido: R$${element.precoSugerido}`);
            console.log(`   🌐 Airbnb ID: ${element.endereco.list.id_do_anuncio}\n`);

            console.log(`🔎 Buscando dados no Airbnb para o anúncio ${element.endereco.list.id_do_anuncio}...`);
            const dadosProperty = await this.airbnbService.getFirstAvailablePrice(element.endereco.list.id_do_anuncio);
            console.log(`📦 Dados retornados do Airbnb:`, dadosProperty);

            const diaria = getDiariaForCron(dadosProperty);
            console.log(`💰 Diária atual no Airbnb: R$${diaria}`);
            console.log(`📈 Preço sugerido: R$${element.precoSugerido}`);
            console.log(`📊 Diferença percentual: ${element.diferencaPercentual}%\n`);

            if (element.diferencaPercentual > 0) {
                if (element.precoSugerido > diaria) {
                    console.log(`📢 Enviando notificação -> Oportunidade de AUMENTAR o preço!`);
                    const tdo: CreateNotificationDto = {
                        title: `Uma oportunidade para aumentar suas vendas!`,
                        description: `Olá! Nossa análise indica que você poderia aumentar o preço do seu imóvel para R$${element.precoSugerido}, o que representa uma diferença de ${element.diferencaPercentual}% em relação ao seu preço atual de R$${diaria}. Aproveite essa oportunidade para maximizar seus ganhos!`,
                        redirectTo: '/painel',
                        sendEmail: true,
                    };
                    console.log(`📧 Enviando email para: ${element.usuarioProprietario.email}`);
                    const { enviado } = await this.emailService.enviarNotification(element?.usuarioProprietario.id, tdo);
                    console.log(enviado ? `✅ Email enviado com sucesso!` : `❌ Falha ao enviar email.`);
                }
            } else if (element.diferencaPercentual < 0) {
                if (element.precoSugerido < diaria) {
                    console.log(`📢 Enviando notificação -> Oportunidade de DIMINUIR o preço!`);
                    const tdo: CreateNotificationDto = {
                        title: `Uma oportunidade para aumentar suas vendas!`,
                        description: `Olá! Nossa análise indica que você poderia diminuir o preço do seu imóvel para R$${element.precoSugerido}, o que representa uma diferença de ${element.diferencaPercentual}% em relação ao seu preço atual de R$${diaria}. Ajustar o preço pode aumentar suas chances de alugar mais rapidamente!`,
                        redirectTo: '/painel',
                        sendEmail: true,
                    };
                    console.log(`📧 Enviando email para: ${element.usuarioProprietario.email}`);
                    const { enviado } = await this.emailService.enviarNotification(element?.usuarioProprietario.id, tdo);
                    console.log(enviado ? `✅ Email enviado com sucesso!` : `❌ Falha ao enviar email.`);
                }
            } else {
                console.log(`ℹ️ Nenhuma notificação necessária para este imóvel.`);
            }

            console.log(`⏳ Aguardando 2 segundos antes do próximo...\n`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log("🏁 Processo finalizado com sucesso!\n");
        return { iniciado: true };
    }

    async enviarNotificacaoCron(subject: string, content: string) {
        const resultado = await this.mailerSender.sendTextEmailCron(
            { email: 'lucas@luminalab.ai', name: 'Dev feedback' },
            subject,
            content
        );

        if (resultado.enviado) {
            console.log(`📩 Email confirmado como enviado! (status ${resultado.status})`);
        } else {
            console.log(`⚠️ Email NÃO enviado (status ${resultado.status}): ${resultado.message}`);
        }


    }

    async buscarAnalisesAceitasTeste(): Promise<any> {
        // Data de hoje (sem hora)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataHoje = hoje.toISOString().split('T')[0];

        console.log(`🔎 Buscando análises aceitas a partir de ${dataHoje}...`);

        const aceites = await this.analisePrecoRepository.find({
            where: {
                aceito: true,
                evento: {
                    dataInicio: Raw(
                        (alias) => `DATE(${alias}) >= :dataHoje`,
                        { dataHoje }
                    )
                }
            },
            relations: ['endereco', 'evento', 'usuarioProprietario'],
        });

        console.log(`✅ ${aceites.length} análises aceitas encontradas.`);

        for (const element of aceites) {
            console.log(`\n📌 Analisando propriedade do usuário: ${element.usuarioProprietario.email}`);
            console.log(`- Diferença percentual: ${element.diferencaPercentual}`);
            console.log(`- Recomendação: ${element.recomendacao}`);
            console.log(`- Preço atual: ${element.seuPrecoAtual}`);
            console.log(`- Preço sugerido: ${element.precoSugerido}`);
            console.log(`- ID do anúncio Airbnb: ${element.endereco.list.id_do_anuncio}`);

            const dadosProperty = await this.airbnbService.getFirstAvailablePrice(element.endereco.list.id_do_anuncio);
            const diaria = getDiariaForCron(dadosProperty);

            console.log(`💰 Diária atual no Airbnb: ${diaria}`);

            if (element.diferencaPercentual > 0 && element.precoSugerido > diaria) {
                console.log(`📢 Simulação: Enviar notificação -> "Você está perdendo dinheiro! Considere aumentar o preço para R$${element.precoSugerido}."`);
            } else if (element.diferencaPercentual < 0 && element.precoSugerido < diaria) {
                console.log(`📢 Simulação: Enviar notificação -> "Você está perdendo oportunidades! Considere diminuir o preço para R$${element.precoSugerido}."`);
            } else {
                console.log("ℹ️ Nenhuma notificação necessária.");
            }

            // Delay de 2s antes de processar o próximo
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log("\n🏁 Processo finalizado.");
        return { iniciado: true };
    }


}
