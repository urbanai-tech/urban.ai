// IMPORTANT: instrument.ts MUST be imported first for Sentry to work properly
import "./instrument";

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — permite o frontend acessar o backend
  app.enableCors({
    origin: process.env.FRONT_BASE_URL || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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

  const port = parseInt(process.env.PORT, 10) || 8080;
  console.log(`🔁 Tentando escutar na porta ${port}`);

  const timeout = setTimeout(() => {
    console.error("❌ app.listen travou, possível problema no banco ou outro provider.");
    process.exit(1);
  }, 15000);

  await app.listen(port);
  clearTimeout(timeout);
  console.log(`✅ App ouvindo porta ${port}`);
}
bootstrap();
