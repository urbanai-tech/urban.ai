import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  // ⚠️ Desabilita o body-parser padrão na rota do Stripe Webhook
  app.use(
    '/payments/webhook',
    bodyParser.raw({ type: '*/*' }) // corpo bruto necessário para verificação da assinatura
  );

  // ✅ body-parser padrão para o restante das rotas
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Swagger config
  const config = new DocumentBuilder()
    .setTitle('API Urban AI')
    .setDescription(`
      A API RESTful da plataforma Urban AI — um sistema inteligente que identifica eventos em diferentes regiões e se integra ao Airbnb para sugerir ajustes dinâmicos de preços em hospedagens.

      Essa plataforma permite que anfitriões verifiquem automaticamente se há eventos programados em suas localidades e, com base nisso, otimizem seus anúncios para aumentar a lucratividade.
    `)
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  console.log("🔁 Tentando escutar na porta", 10000);

  const timeout = setTimeout(() => {
    console.error("❌ app.listen travou, possível problema no banco ou outro provider.");
    process.exit(1);
  }, 5000);

  await app.listen(10000);
  clearTimeout(timeout);
  console.log('✅ App ouvindo porta', 10000);
}
bootstrap();
