// Barrel de compatibilidade — reexporta a API modularizada por dominio.
// Todo import existente `from '.../service/api'` continua resolvendo identico.
// Implementacao real vive em ./api/*.
export * from "./api/client";
export * from "./api/properties";
export * from "./api/billing";
export * from "./api/auth";
export * from "./api/notifications";
export * from "./api/events";
export * from "./api/pricing";
export * from "./api/admin";
export * from "./api/portfolio";
export * from "./api/ask";
