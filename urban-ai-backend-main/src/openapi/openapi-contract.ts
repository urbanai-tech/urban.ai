import type { OpenAPIObject } from '@nestjs/swagger';

export const CRITICAL_API_OPERATIONS = [
  ['get', '/health/live'],
  ['get', '/health'],
  ['post', '/auth/login'],
  ['post', '/auth/refresh'],
  ['get', '/auth/me'],
  ['get', '/propriedades/user'],
  ['get', '/propriedades/{id}'],
  ['post', '/payments/create-checkout-session'],
  ['get', '/payments/me'],
  ['get', '/plans'],
  ['get', '/host/events/radar'],
  ['post', '/host/events/{eventId}/simulate-pricing'],
] as const;

type JsonObject = Record<string, unknown>;

export function projectCriticalOpenApiContract(document: OpenAPIObject): JsonObject {
  const operations: JsonObject = {};

  for (const [method, route] of CRITICAL_API_OPERATIONS) {
    const pathItem = document.paths[route] as JsonObject | undefined;
    const operation = pathItem?.[method] as JsonObject | undefined;
    if (!operation) throw new Error(`Critical OpenAPI operation is missing: ${method.toUpperCase()} ${route}`);
    operations[`${method.toUpperCase()} ${route}`] = structuralValue(operation);
  }

  const referencedSchemas = collectReferencedSchemas(operations, document);

  return sortObject({
    contractVersion: document.info.version,
    compatibility: (document as unknown as JsonObject)['x-urban-ai-api-compatibility'],
    operations,
    schemas: referencedSchemas,
  });
}

function collectReferencedSchemas(seed: unknown, document: OpenAPIObject): JsonObject {
  const available = (document.components?.schemas || {}) as JsonObject;
  const queue = [...schemaReferences(seed)];
  const visited = new Set<string>();
  const result: JsonObject = {};

  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (visited.has(name)) continue;
    visited.add(name);
    const schema = available[name];
    if (!schema) throw new Error(`Critical OpenAPI schema reference is missing: ${name}`);
    const normalized = structuralValue(schema);
    result[name] = normalized;
    for (const nested of schemaReferences(normalized)) {
      if (!visited.has(nested)) queue.push(nested);
    }
  }

  return sortObject(result);
}

function schemaReferences(value: unknown): Set<string> {
  const result = new Set<string>();
  visit(value, (key, candidate) => {
    if (key !== '$ref' || typeof candidate !== 'string') return;
    const match = candidate.match(/^#\/components\/schemas\/(.+)$/);
    if (match) result.add(match[1]);
  });
  return result;
}

function structuralValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralValue);
  if (!value || typeof value !== 'object') return value;

  const ignored = new Set(['description', 'summary', 'example', 'examples', 'externalDocs']);
  const result: JsonObject = {};
  for (const [key, candidate] of Object.entries(value as JsonObject)) {
    if (ignored.has(key)) continue;
    result[key] = structuralValue(candidate);
  }
  return sortObject(result);
}

function sortObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, candidate]) => [key, candidate]),
  );
}

function visit(value: unknown, visitor: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, visitor);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, candidate] of Object.entries(value as JsonObject)) {
    visitor(key, candidate);
    visit(candidate, visitor);
  }
}
