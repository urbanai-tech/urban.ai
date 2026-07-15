// IMPORTANT: instrument.ts MUST be imported first for Sentry to work properly
import "./instrument";

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { requestIdMiddleware } from './common/request-id.middleware';
import { buildOpenApiConfig } from './openapi/openapi.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Helmet — HSTS, X-Frame-Options, X-Content-Type-Options, etc.
  // CSP aplicado manualmente porque o backend serve principalmente JSON;
  // a CSP do front é responsabilidade do Next.js.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          // Permite Stripe (checkout + webhooks), Sentry e Google (Maps/OAuth)
          scriptSrc: ["'self'", 'https://js.stripe.com', 'https://*.sentry.io'],
          connectSrc: [
            "'self'",
            'https://api.stripe.com',
            'https://*.sentry.io',
            'https://maps.googleapis.com',
          ],
          frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS — whitelist explícita. Nunca fallback para "*".
  // CORS_ALLOWED_ORIGINS (lista separada por vírgula) tem prioridade;
  // FRONT_BASE_URL sozinha serve como conveniência retrocompatível.
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONT_BASE_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    // Fail-closed: sem whitelist configurada, bloqueia toda origem em vez de abrir "*".
    console.warn(
      '[CORS] Nenhuma origem configurada (CORS_ALLOWED_ORIGINS/FRONT_BASE_URL). Requisições cross-origin serão bloqueadas.',
    );
  }

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Urban-Push-Secret'],
  });

  // cookie-parser — necessário para os cookies httpOnly de auth
  // (urbanai_access_token, urbanai_refresh_token).
  app.use(cookieParser());

  // OBS-2 — correlationId por request (x-request-id + tag no Sentry).
  app.use(requestIdMiddleware);

  // ⚠️ Desabilita o body-parser padrão na rota do Stripe Webhook
  app.use(
    '/payments/webhook',
    bodyParser.raw({ type: '*/*' }) // corpo bruto necessário para verificação da assinatura
  );

  // ✅ body-parser padrão para o restante das rotas
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  const shouldEnableSwagger =
    process.env.ENABLE_SWAGGER === 'true' || appEnv !== 'production';

  if (shouldEnableSwagger) {
    // Swagger config
    const config = buildOpenApiConfig();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

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
