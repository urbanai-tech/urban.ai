/**
 * Gerador do dicionário de dados (docs/DICIONARIO-DE-DADOS.md).
 *
 * Fonte da verdade: metadados do TypeORM (DataSource.buildMetadatas(), SEM conectar
 * ao banco) + comentários TSDoc/`//` das entidades (lidos com a API do TypeScript).
 *
 * Uso (a partir de urban-ai-backend-main/):
 *   npm run docs:data-dictionary                 # reescreve o bloco gerado do .md
 *   npm run docs:data-dictionary -- --check      # sai com código 1 se o .md estiver desatualizado
 *   npm run docs:data-dictionary -- --compare-db # compara com um MySQL real (DB_* ou DATABASE_URL)
 *
 * Só o trecho entre os marcadores BEGIN/END GENERATED é sobrescrito; o cabeçalho
 * escrito à mão fica intacto. O gerador também falha (nos dois modos) se uma tabela
 * não pertencer a nenhum domínio ou se uma coluna da lista de PII deixar de existir,
 * para que o dicionário não apodreça silenciosamente.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { DataSource } from 'typeorm';
import type { EntityMetadata } from 'typeorm/metadata/EntityMetadata';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';

export const BEGIN_MARKER = '<!-- BEGIN GENERATED: data-dictionary (não edite à mão; rode npm run docs:data-dictionary) -->';
export const END_MARKER = '<!-- END GENERATED: data-dictionary -->';

const BACKEND_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(BACKEND_ROOT, 'src');
export const DOC_PATH = path.resolve(BACKEND_ROOT, '..', 'docs', 'DICIONARIO-DE-DADOS.md');

/** Mesmos globs de src/data-source.ts. */
const ENTITY_GLOBS = [path.join(SRC_ROOT, '**', '*.entity{.ts,.js}'), path.join(SRC_ROOT, 'entities', '*{.ts,.js}')];

// ---------------------------------------------------------------------------
// Domínios: toda tabela precisa estar aqui (o gerador falha se aparecer uma nova).
// ---------------------------------------------------------------------------
export const DOMAINS: Array<{ id: string; title: string; tables: string[] }> = [
  { id: 'auth', title: 'Usuários e autenticação', tables: ['user', 'refresh_tokens', 'password_reset_tokens', 'email_confirmations'] },
  { id: 'billing', title: 'Assinatura e Stripe', tables: ['plans', 'payment'] },
  {
    id: 'properties',
    title: 'Imóveis, anúncios e Stays',
    tables: [
      'list',
      'addresses',
      'stays_accounts',
      'stays_listings',
      'pricing_input_history',
      'portfolio_property_settings',
      'portfolio_action_runs',
      'portfolio_action_items',
      'portfolio_daily_price_overrides',
      'airbnb_pricing_attempt_logs',
    ],
  },
  {
    id: 'events',
    title: 'Eventos, ingestão e deduplicação',
    tables: ['events', 'event_sources', 'event_dedup_candidates', 'event_historical_multiplier', 'coverage_regions', 'external_listing', 'market_listing_observation', 'market_ingest_log', 'process_status', 'event_reference', 'event_reference_votes', 'event_coverage_snapshots', 'event_reference_fetch_cache'],
  },
  {
    id: 'pricing',
    title: 'Precificação e análises',
    tables: [
      'analise_preco',
      'analise_endereco_evento',
      'pricing_rule_configs',
      'pricing_decision_snapshots',
      'price_updates',
      'price_snapshots',
      'occupancy_history',
      'event_intelligence_snapshots',
      'event_property_impacts',
      'event_proximity_features',
      'ask_urban_messages',
    ],
  },
  {
    id: 'notifications',
    title: 'Notificações e comunicação',
    tables: ['notifications', 'push_subscriptions', 'push_deliveries', 'event_alert_dispatches', 'communication_events', 'user_communication_preferences', 'pricing_recommendation_digests'],
  },
  {
    id: 'owners',
    title: 'Proprietários e relatório mensal',
    tables: ['property_owners', 'property_owner_properties', 'owner_reports', 'owner_report_links'],
  },
  { id: 'admin', title: 'Administração e auditoria', tables: ['admin_audit_logs', 'admin_job_runs', 'platform_costs'] },
  { id: 'acquisition', title: 'Aquisição (waitlist e contato)', tables: ['waitlist', 'contact_submissions'] },
];

// ---------------------------------------------------------------------------
// Colunas sensíveis / PII (curado; validado contra o schema a cada execução).
// "a confirmar" = não verificado no código.
// ---------------------------------------------------------------------------
export interface PiiEntry {
  table: string;
  column: string; // nome da coluna no banco
  kind: string;
  protection: string;
}
export const PII_COLUMNS: PiiEntry[] = [
  { table: 'user', column: 'email', kind: 'e-mail', protection: 'Texto puro no banco (índice único). Mascarado (`maskEmail`) no log de auditoria admin e no log de comunicações; incluído na exportação LGPD do titular. Criptografia em repouso: a confirmar (nível do provedor de banco).' },
  { table: 'user', column: 'password', kind: 'hash de senha', protection: 'Esquema v2 (`pw:v2:` + bcrypt 12 rounds da senha, calculado só no servidor; senha limitada a 72 bytes UTF-8 ao definir; ADR 0025). Hashes legados (bcrypt do SHA-256 que o front antigo enviava) são migrados para v2 no login com a senha em claro. `select: false` + `@Exclude()`; nunca na exportação LGPD.' },
  { table: 'user', column: 'username', kind: 'nome', protection: 'Texto puro. Incluído na exportação LGPD (campos exatos em `account-data.service.ts`). Proteção adicional: a confirmar.' },
  { table: 'user', column: 'phone', kind: 'telefone', protection: 'Texto puro, opcional. Proteção adicional: a confirmar.' },
  { table: 'user', column: 'company', kind: 'nome de empresa', protection: 'Texto puro, opcional. Proteção adicional: a confirmar.' },
  { table: 'refresh_tokens', column: 'tokenHash', kind: 'token de sessão (hash)', protection: 'Só o SHA-256 do refresh token é persistido; o valor bruto vai ao cliente em cookie httpOnly. Revogável (`revokedAt`).' },
  { table: 'refresh_tokens', column: 'ip', kind: 'IP', protection: 'Texto puro. Política de retenção: a confirmar.' },
  { table: 'refresh_tokens', column: 'userAgent', kind: 'user-agent', protection: 'Texto puro. Política de retenção: a confirmar.' },
  { table: 'password_reset_tokens', column: 'tokenHash', kind: 'token de redefinição (hash)', protection: 'Só o SHA-256 do token é persistido; expira (`expiresAt`) e é de uso único (`usedAt`).' },
  { table: 'password_reset_tokens', column: 'ip', kind: 'IP', protection: 'Texto puro. Política de retenção: a confirmar.' },
  { table: 'password_reset_tokens', column: 'userAgent', kind: 'user-agent', protection: 'Texto puro. Política de retenção: a confirmar.' },
  { table: 'email_confirmations', column: 'code', kind: 'código de confirmação (hash)', protection: 'Hash versionado vinculado ao usuário (`hashConfirmationCode`); texto puro apenas em registros legados. Tentativas limitadas (`attemptCount`, `lockedUntil`).' },
  { table: 'stays_accounts', column: 'accessToken', kind: 'token de API de terceiro (Stays)', protection: 'Criptografado em repouso com AES-256-GCM (transformer `staysTokenTransformer`, prefixo `enc:v1:`); chave em `STAYS_TOKEN_ENCRYPTION_KEY`, obrigatória em production/staging. Fora da exportação LGPD.' },
  { table: 'stays_accounts', column: 'clientId', kind: 'identificador de credencial (Stays)', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'stays_accounts', column: 'consentIp', kind: 'IP (prova de consentimento)', protection: 'Texto puro, truncado a 64 caracteres no serviço. Retenção: a confirmar.' },
  { table: 'stays_accounts', column: 'consentUserAgent', kind: 'user-agent (prova de consentimento)', protection: 'Texto puro. Retenção: a confirmar.' },
  { table: 'payment', column: 'customerId', kind: 'ID de cliente Stripe', protection: 'Identificador opaco (cus_...), texto puro; sem dados de cartão no banco (cartões ficam no Stripe). Fora da exportação LGPD.' },
  { table: 'payment', column: 'subscriptionId', kind: 'ID de assinatura Stripe', protection: 'Identificador opaco (sub_...), texto puro. Fora da exportação LGPD.' },
  { table: 'push_subscriptions', column: 'endpoint', kind: 'endpoint Web Push', protection: 'Texto puro (necessário para enviar o push); há `endpointHash` SHA-256 para busca/deduplicação.' },
  { table: 'push_subscriptions', column: 'p256dh', kind: 'chave pública Web Push', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'push_subscriptions', column: 'auth', kind: 'segredo de autenticação Web Push', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'push_subscriptions', column: 'deviceSecretHash', kind: 'segredo do dispositivo (hash)', protection: 'Só o SHA-256 do segredo é persistido.' },
  { table: 'push_subscriptions', column: 'userAgent', kind: 'user-agent', protection: 'Texto puro. Retenção: a confirmar.' },
  { table: 'communication_events', column: 'recipient_email', kind: 'e-mail do destinatário', protection: 'Texto puro no banco; a API admin devolve mascarado (`maskEmail`). `failure_reason` passa por redação de e-mails/tokens na leitura.' },
  { table: 'communication_events', column: 'recipient_device_id', kind: 'ID de dispositivo', protection: 'Texto puro no banco; mascarado (`maskToken`) na API admin.' },
  { table: 'pricing_recommendation_digests', column: 'recipient_email', kind: 'e-mail do destinatário', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'pricing_recommendation_digests', column: 'recipient_name', kind: 'nome do destinatário', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'waitlist', column: 'email', kind: 'e-mail', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'waitlist', column: 'name', kind: 'nome', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'waitlist', column: 'phone', kind: 'telefone', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'waitlist', column: 'inviteToken', kind: 'token de convite', protection: 'Texto puro no banco (diferente de refresh/reset, que usam hash); expira (`inviteTokenExpiresAt`) e é limpo ao ser usado. Hash em repouso: a confirmar.' },
  { table: 'waitlist', column: 'signupIp', kind: 'IP', protection: 'Texto puro. Retenção: a confirmar.' },
  { table: 'waitlist', column: 'userAgent', kind: 'user-agent', protection: 'Texto puro. Retenção: a confirmar.' },
  { table: 'contact_submissions', column: 'name', kind: 'nome', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'contact_submissions', column: 'email', kind: 'e-mail', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'contact_submissions', column: 'message', kind: 'texto livre (pode conter dados pessoais)', protection: 'Texto puro. Proteção adicional: a confirmar.' },
  { table: 'contact_submissions', column: 'ipAddress', kind: 'IP', protection: 'Texto puro, truncado a 80 caracteres no serviço. Retenção: a confirmar.' },
  { table: 'contact_submissions', column: 'userAgent', kind: 'user-agent', protection: 'Texto puro. Retenção: a confirmar.' },
  { table: 'price_updates', column: 'ip', kind: 'IP', protection: 'Texto puro (trilha de quem aplicou preço). Retenção: a confirmar.' },
  { table: 'price_updates', column: 'userAgent', kind: 'user-agent', protection: 'Texto puro. Retenção: a confirmar.' },
  { table: 'addresses', column: 'cep', kind: 'endereço do imóvel do anfitrião', protection: 'Texto puro; acesso restrito ao dono do imóvel (escopo por `user_id`). Incluído na exportação LGPD.' },
  { table: 'addresses', column: 'logradouro', kind: 'endereço do imóvel do anfitrião', protection: 'Texto puro; escopo por `user_id`. Incluído na exportação LGPD.' },
  { table: 'addresses', column: 'numero', kind: 'endereço do imóvel do anfitrião', protection: 'Texto puro; escopo por `user_id`.' },
  { table: 'addresses', column: 'latitude', kind: 'geolocalização do imóvel', protection: 'Texto puro; escopo por `user_id`.' },
  { table: 'addresses', column: 'longitude', kind: 'geolocalização do imóvel', protection: 'Texto puro; escopo por `user_id`.' },
  { table: 'property_owners', column: 'name', kind: 'nome de terceiro (proprietário do imóvel)', protection: 'Texto puro, escopo por `user_id` do anfitrião (CASCADE). Retenção: some com a conta do anfitrião ou quando ele remove o proprietário (ADR 0027).' },
  { table: 'property_owners', column: 'email', kind: 'e-mail de terceiro (proprietário do imóvel)', protection: 'Texto puro, em minúsculas, único por anfitrião. Só recebe o relatório mensal, com descadastro. Mesma retenção do nome (ADR 0027).' },
  { table: 'property_owners', column: 'consent_ip', kind: 'IP (declaração de base legal do anfitrião)', protection: 'Texto puro (`req.ip`), truncado a 64 caracteres. Prova de consentimento: fica enquanto o proprietário existir (ADR 0027).' },
  { table: 'property_owners', column: 'unsubscribe_ref', kind: 'referência opaca do descadastro', protection: 'Aleatório de 128 bits, inútil sem a assinatura HMAC do servidor. Trocada quando o e-mail muda.' },
  { table: 'owner_reports', column: 'payload_json', kind: 'desempenho financeiro dos imóveis (receita registrada, diária, ocupação) e nome do proprietário', protection: 'JSON sem IDs internos, escopo por proprietário. Retenção: OWNER_REPORT_RETENTION_MONTHS (padrão 12) após o fim do mês (ADR 0027).' },
  { table: 'owner_report_links', column: 'token_hash', kind: 'credencial de leitura (hash)', protection: 'SHA-256 da parte aleatória do token; o token nunca é gravado. Expira (padrão 30 dias), revogável; apagado 30 dias depois de vencer/revogar (ADR 0027).' },
  { table: 'ask_urban_messages', column: 'content', kind: 'texto livre do chat com a IA (pode conter dados pessoais)', protection: 'Texto puro, escopo por `user_id`. Retenção: a confirmar.' },
  { table: 'admin_audit_logs', column: 'before', kind: 'estado anterior (JSON)', protection: 'Passa por `redactForAudit` antes de gravar: segredos viram `[REDACTED]`, e-mails são mascarados, textos livres são omitidos.' },
  { table: 'admin_audit_logs', column: 'after', kind: 'estado posterior (JSON)', protection: 'Idem `before` (`redactForAudit`).' },
  { table: 'admin_audit_logs', column: 'metadata', kind: 'metadados da requisição (JSON)', protection: 'Idem `before` (`redactForAudit`).' },
];

/** Tabelas cujas colunas de endereço/geo são dados públicos ou de mercado (não PII de titular). */
const NON_PII_DOMAINS = new Set(['events']);
const PII_HEURISTIC = /e-?mail|phone|telefone|cpf|cnpj|document|token|password|senha|secret|hash|(^|_)ip($|_)|ip_?address|signupip|consentip|user_?agent|logradouro|cep$|endpoint|p256dh|^auth$|(^|_)(name|nome)$/i;

// ---------------------------------------------------------------------------
// Comentários das entidades (API do TypeScript)
// ---------------------------------------------------------------------------
interface SourceDocs {
  file: string;
  classDoc: string;
  props: Record<string, string>;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'migrations' || e.name === 'node_modules') continue;
      walk(p, acc);
    } else if (/\.ts$/.test(e.name) && !/\.(spec|d)\.ts$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function cleanComment(raw: string): string {
  return raw
    .replace(/^\/\*+/, '')
    .replace(/\*+\/$/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\/\/+\s?/, '').replace(/^\s*\*+\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function commentsAround(text: string, node: ts.Node): { leading: string; trailing: string } {
  const lead = (ts.getLeadingCommentRanges(text, node.getFullStart()) || []).map((r) => cleanComment(text.slice(r.pos, r.end)));
  const trail = (ts.getTrailingCommentRanges(text, node.getEnd()) || []).map((r) => cleanComment(text.slice(r.pos, r.end)));
  return { leading: lead.filter(Boolean).join(' '), trailing: trail.filter(Boolean).join(' ') };
}

function collectSourceDocs(): Map<string, SourceDocs> {
  const out = new Map<string, SourceDocs>();
  for (const file of walk(SRC_ROOT)) {
    const text = fs.readFileSync(file, 'utf8');
    if (!/@Entity\s*\(/.test(text)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2021, true);
    sf.forEachChild((node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const props: Record<string, string> = {};
      for (const m of node.members) {
        if (!ts.isPropertyDeclaration(m) || !m.name) continue;
        const c = commentsAround(text, m);
        const doc = [c.leading, c.trailing].filter(Boolean).join(' ');
        if (doc) props[m.name.getText(sf)] = doc;
      }
      out.set(node.name.text, {
        file: path.relative(BACKEND_ROOT, file).replace(/\\/g, '/'),
        classDoc: commentsAround(text, node).leading,
        props,
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Metadados TypeORM
// ---------------------------------------------------------------------------
async function loadMetadata(): Promise<{ ds: DataSource; tables: EntityMetadata[] }> {
  // `database` é exigido só pela validação de metadados; nenhuma conexão é aberta.
  const ds = new DataSource({ type: 'mysql', database: 'dictionary', entities: ENTITY_GLOBS } as any);
  await (ds as any).buildMetadatas();
  const tables = [...ds.entityMetadatas].filter((m) => m.tableType !== 'view').sort((a, b) => a.tableName.localeCompare(b.tableName));
  return { ds, tables };
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[\\|]/g, '\\$&').replace(/\r?\n/g, ' ');
}

/** Lê o doc atual sem checar existência antes (evita corrida entre checar e ler). */
function readDocIfPresent(): string {
  try {
    return fs.readFileSync(DOC_PATH, 'utf8').replace(/\r\n/g, '\n');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

function renderDefault(col: ColumnMetadata): string {
  let d: unknown = col.default;
  if (d === undefined) return '';
  if (typeof d === 'function') {
    try {
      d = (d as () => unknown)();
    } catch {
      return '(função)';
    }
  }
  if (d === null) return 'NULL';
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'object') return JSON.stringify(d);
  return String(d);
}

function renderType(ds: DataSource, col: ColumnMetadata): string {
  const driver = ds.driver as any;
  const base: string = driver.normalizeType(col);
  if (Array.isArray(col.enum) && col.enum.length) return `${base}(${col.enum.map((v) => `'${v}'`).join(',')})`;
  if (col.precision != null && col.scale != null) return `${base}(${col.precision},${col.scale})`;
  if (col.precision != null && /^(decimal|numeric|float|double)$/.test(base)) return `${base}(${col.precision})`;
  const len = col.length || (typeof driver.getColumnLength === 'function' ? driver.getColumnLength(col) : '');
  if (len && /^(varchar|char|varbinary|binary)$/.test(base)) return `${base}(${len})`;
  if (len && /^(int|tinyint|smallint|bigint)$/.test(base) && col.length) return `${base}(${len})`;
  return base;
}

export interface DictColumn { name: string; property: string; type: string; baseType: string; nullable: boolean }
export interface DictTable { table: string; columns: DictColumn[] }

function keysOf(meta: EntityMetadata, col: ColumnMetadata): string {
  const k: string[] = [];
  if (col.isPrimary) k.push('PK');
  if (col.generationStrategy) k.push(col.generationStrategy === 'uuid' ? 'uuid auto' : col.generationStrategy === 'increment' ? 'auto-inc' : col.generationStrategy);
  const uniq = [...meta.uniques.map((u) => u.columns), ...meta.indices.filter((i) => i.isUnique).map((i) => i.columns)];
  if (uniq.some((cols) => cols.length === 1 && cols[0] === col)) k.push('UNIQUE');
  else if (uniq.some((cols) => cols.includes(col))) k.push('UNIQUE (composto)');
  if (meta.indices.some((i) => !i.isUnique && i.columns.includes(col))) k.push('IDX');
  if (meta.foreignKeys.some((f) => f.columns.includes(col))) k.push('FK');
  return k.join(', ');
}

export async function buildDictionary(): Promise<{ markdown: string; tables: DictTable[]; problems: string[] }> {
  const { ds, tables } = await loadMetadata();
  const docs = collectSourceDocs();
  const problems: string[] = [];
  const domainOf = new Map<string, string>();
  for (const d of DOMAINS) for (const t of d.tables) domainOf.set(t, d.id);

  const names = new Set(tables.map((t) => t.tableName));
  for (const t of tables) if (!domainOf.has(t.tableName)) problems.push(`Tabela "${t.tableName}" não pertence a nenhum domínio (atualize DOMAINS em scripts/generate-data-dictionary.ts).`);
  for (const d of DOMAINS) for (const t of d.tables) if (!names.has(t)) problems.push(`Domínio "${d.id}" cita a tabela "${t}", que não existe mais nas entidades.`);

  const colsByTable = new Map(tables.map((t) => [t.tableName, new Set(t.columns.map((c) => c.databaseName))]));
  for (const p of PII_COLUMNS) {
    if (!colsByTable.get(p.table)?.has(p.column)) problems.push(`PII_COLUMNS cita ${p.table}.${p.column}, que não existe mais.`);
  }

  const out: string[] = [];
  const dictTables: DictTable[] = [];
  const total = tables.length;
  const totalCols = tables.reduce((n, t) => n + t.columns.length, 0);
  out.push(`## Resumo`, '', `- Tabelas (entidades TypeORM): **${total}**`, `- Colunas: **${totalCols}**`, `- Chaves estrangeiras: **${tables.reduce((n, t) => n + t.foreignKeys.length, 0)}**`,`- Tabela de controle de migrations (\`migrations\`) não é entidade e não consta aqui.`, '');

  out.push('## Tabelas por domínio', '', '| Domínio | Tabelas |', '| --- | --- |');
  for (const d of DOMAINS) out.push(`| ${esc(d.title)} | ${d.tables.map((t) => `\`${t}\``).join(', ')} |`);
  out.push('');

  // PII curada + candidatas
  out.push('## Colunas sensíveis (PII e segredos) — inventário gerado', '');
  out.push('Lista curada em `PII_COLUMNS` (scripts/generate-data-dictionary.ts); o gerador falha se uma coluna listada deixar de existir. "a confirmar" = não verificado no código.', '');
  out.push('| Tabela | Coluna | Tipo de dado | Proteção |', '| --- | --- | --- | --- |');
  for (const p of [...PII_COLUMNS].sort((a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column))) {
    out.push(`| \`${p.table}\` | \`${p.column}\` | ${esc(p.kind)} | ${esc(p.protection)} |`);
  }
  out.push('');
  const curated = new Set(PII_COLUMNS.map((p) => `${p.table}.${p.column}`));
  const candidates: string[] = [];
  for (const t of tables) {
    if (NON_PII_DOMAINS.has(domainOf.get(t.tableName) || '')) continue;
    for (const c of t.columns) {
      if (PII_HEURISTIC.test(c.databaseName) && !curated.has(`${t.tableName}.${c.databaseName}`)) candidates.push(`\`${t.tableName}.${c.databaseName}\``);
    }
  }
  out.push('**Candidatas por nome ainda não classificadas** (heurística; revisar e mover para `PII_COLUMNS` ou aceitar como não sensíveis):', '');
  out.push(candidates.length ? candidates.join(', ') : '_nenhuma_', '');

  out.push('## Tabelas', '');
  for (const t of tables) {
    const cls = (t.target as any).name as string;
    const src = docs.get(cls);
    const domain = DOMAINS.find((d) => d.id === domainOf.get(t.tableName));
    out.push(`### \`${t.tableName}\``, '');
    out.push(`- Entidade: \`${cls}\`${src ? ` (\`${src.file}\`)` : ''}`);
    out.push(`- Domínio: ${domain ? domain.title : '—'}`);
    if (src?.classDoc) out.push(`- Descrição: ${esc(src.classDoc)}`);
    out.push('');
    out.push('| Coluna | Propriedade | Tipo | Nulo | Padrão | Chaves | Observação |', '| --- | --- | --- | --- | --- | --- | --- |');
    const dcols: DictColumn[] = [];
    for (const c of t.columns) {
      const type = renderType(ds, c);
      dcols.push({ name: c.databaseName, property: c.propertyName, type, baseType: String((ds.driver as any).normalizeType(c)), nullable: c.isNullable });
      const obs = [c.comment, src?.props[c.propertyName]].filter(Boolean).join(' — ');
      out.push(`| \`${c.databaseName}\` | \`${c.propertyName}\` | ${esc(type)} | ${c.isNullable ? 'sim' : 'não'} | ${esc(renderDefault(c))} | ${keysOf(t, c)} | ${esc(obs)} |`);
    }
    dictTables.push({ table: t.tableName, columns: dcols });
    out.push('');

    const fks = [...t.foreignKeys].sort((a, b) => a.columnNames.join().localeCompare(b.columnNames.join()));
    if (t.relations.length || fks.length) {
      out.push('Relações:', '', '| Tipo | Propriedade | Alvo | Coluna(s) FK | onDelete | onUpdate |', '| --- | --- | --- | --- | --- | --- |');
      for (const r of t.relations) {
        const fk = fks.find((f) => r.joinColumns.some((j) => f.columnNames.includes(j.databaseName)));
        const fkCols = r.joinColumns.length ? r.joinColumns.map((j) => j.databaseName).join(', ') : r.isOneToMany || (r.isOneToOne && !r.isOwning) ? '(lado inverso)' : '';
        const target = r.inverseEntityMetadata?.tableName ?? '?';
        out.push(`| ${r.relationType} | \`${r.propertyName}\` | \`${target}\` | ${esc(fkCols)} | ${fk?.onDelete ?? (r.isOwning ? 'NO ACTION' : '')} | ${fk?.onUpdate ?? (r.isOwning ? 'NO ACTION' : '')} |`);
      }
      out.push('');
    }
    const idx = [...t.indices].sort((a, b) => a.name.localeCompare(b.name));
    const uq = [...t.uniques].sort((a, b) => a.name.localeCompare(b.name));
    if (idx.length || uq.length) {
      out.push('Índices e unicidades:', '');
      for (const i of idx) out.push(`- \`${i.name}\`${i.isUnique ? ' (UNIQUE)' : ''}: ${i.columns.map((c) => `\`${c.databaseName}\``).join(', ')}`);
      for (const u of uq) out.push(`- \`${u.name}\` (UNIQUE): ${u.columns.map((c) => `\`${c.databaseName}\``).join(', ')}`);
      out.push('');
    }
  }
  return { markdown: out.join('\n').replace(/\r\n/g, '\n').trimEnd() + '\n', tables: dictTables, problems };
}

// ---------------------------------------------------------------------------
// Arquivo .md: cabeçalho manual + bloco gerado
// ---------------------------------------------------------------------------
export function spliceGenerated(existing: string, generated: string): string {
  const block = `${BEGIN_MARKER}\n\n${generated}\n${END_MARKER}`;
  const b = existing.indexOf(BEGIN_MARKER);
  const e = existing.indexOf(END_MARKER);
  if (b === -1 || e === -1 || e < b) return `${existing.trimEnd()}\n\n${block}\n`;
  return existing.slice(0, b) + block + existing.slice(e + END_MARKER.length);
}

async function compareDb(dict: DictTable[]): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mysql = require('mysql2/promise');
  const conn = process.env.DATABASE_URL
    ? await mysql.createConnection(process.env.DATABASE_URL)
    : await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_urban',
      });
  try {
    const [[{ db }]] = await conn.query('SELECT DATABASE() AS db');
    const [rows] = await conn.query(
      'SELECT TABLE_NAME t, COLUMN_NAME c, DATA_TYPE d, COLUMN_TYPE ct, IS_NULLABLE n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION',
      [db],
    );
    const real = new Map<string, Map<string, { d: string; ct: string; n: boolean }>>();
    for (const r of rows as any[]) {
      if (r.t === 'migrations') continue;
      if (!real.has(r.t)) real.set(r.t, new Map());
      real.get(r.t)!.set(r.c, { d: String(r.d).toLowerCase(), ct: String(r.ct), n: r.n === 'YES' });
    }
    const issues: string[] = [];
    const typeNotes: string[] = [];
    const dictNames = new Set(dict.map((t) => t.table));
    for (const t of real.keys()) if (!dictNames.has(t)) issues.push(`tabela só no banco/migrations: ${t}`);
    for (const t of dict) {
      const cols = real.get(t.table);
      if (!cols) { issues.push(`tabela só nas entidades: ${t.table}`); continue; }
      const dictCols = new Set(t.columns.map((c) => c.name));
      for (const c of cols.keys()) if (!dictCols.has(c)) issues.push(`coluna só no banco: ${t.table}.${c}`);
      for (const c of t.columns) {
        const r = cols.get(c.name);
        if (!r) { issues.push(`coluna só na entidade: ${t.table}.${c.name}`); continue; }
        if (r.n !== c.nullable) issues.push(`nulidade difere: ${t.table}.${c.name} (entidade=${c.nullable ? 'NULL' : 'NOT NULL'}, banco=${r.n ? 'NULL' : 'NOT NULL'})`);
        const norm = (s: string) => (s === 'integer' ? 'int' : s === 'bool' || s === 'boolean' ? 'tinyint' : s === 'numeric' ? 'decimal' : s);
        if (norm(c.baseType.toLowerCase()) !== norm(r.d)) typeNotes.push(`tipo difere: ${t.table}.${c.name} (entidade=${c.type}, banco=${r.ct})`);
      }
    }
    const nTables = real.size;
    const nCols = [...real.values()].reduce((n, m) => n + m.size, 0);
    console.log(`Banco: ${nTables} tabelas, ${nCols} colunas | Dicionário: ${dict.length} tabelas, ${dict.reduce((n, t) => n + t.columns.length, 0)} colunas`);
    issues.forEach((i) => console.log(`DIVERGÊNCIA ${i}`));
    typeNotes.forEach((i) => console.log(`TIPO ${i}`));
    console.log(`Divergências estruturais: ${issues.length} | divergências de tipo base: ${typeNotes.length}`);
    return issues.length === 0 ? 0 : 1; // diferenças de tipo base são informativas (migration vs entidade), não falham
  } finally {
    await conn.end();
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const { markdown, tables, problems } = await buildDictionary();
  if (problems.length) {
    problems.forEach((p) => console.error(`ERRO: ${p}`));
    return 1;
  }
  if (args.includes('--compare-db')) return compareDb(tables);

  const existing = readDocIfPresent();
  const next = spliceGenerated(existing, markdown);
  if (args.includes('--check')) {
    if (existing !== next) {
      console.error('docs/DICIONARIO-DE-DADOS.md está desatualizado em relação às entidades. Rode: npm run docs:data-dictionary (em urban-ai-backend-main) e faça commit.');
      return 1;
    }
    console.log(`Dicionário de dados em dia (${tables.length} tabelas).`);
    return 0;
  }
  fs.mkdirSync(path.dirname(DOC_PATH), { recursive: true });
  fs.writeFileSync(DOC_PATH, next, 'utf8');
  console.log(`Dicionário gerado: ${tables.length} tabelas, ${tables.reduce((n, t) => n + t.columns.length, 0)} colunas -> ${path.relative(process.cwd(), DOC_PATH)}`);
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
