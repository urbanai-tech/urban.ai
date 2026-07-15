import { DocumentBuilder } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

export const API_CONTRACT_VERSION = '1.0.0';

export const API_COMPATIBILITY = {
  strategy: 'stable-unprefixed',
  currentContract: API_CONTRACT_VERSION,
  urlPrefix: null,
  compatibility: 'backward-compatible-with-current-urls',
  deprecationPolicy: 'docs/runbooks/api-compatibility.md',
} as const;

export function buildOpenApiConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('API Urban AI')
    .setDescription(
      [
        'API RESTful da plataforma Urban AI.',
        'As URLs atuais são estáveis e não recebem prefixo global de versão.',
        'A versão abaixo identifica o contrato OpenAPI; regras de compatibilidade e depreciação estão em docs/runbooks/api-compatibility.md.',
      ].join(' '),
    )
    .setVersion(API_CONTRACT_VERSION)
    .addBearerAuth()
    .addExtension('x-urban-ai-api-compatibility', API_COMPATIBILITY)
    .build();
}
