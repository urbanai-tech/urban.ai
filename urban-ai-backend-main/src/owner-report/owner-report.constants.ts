/**
 * Declaração do anfitrião ao cadastrar um proprietário (ADR 0027).
 *
 * ATENÇÃO: este texto e o aviso exibido ao proprietário PRECISAM de revisão do advogado
 * antes de o envio por e-mail ser ligado em produção (item do lote do dono no ADR 0027).
 * Qualquer mudança de redação exige nova `OWNER_CONSENT_VERSION` — a versão aceita fica
 * gravada junto com data e IP em `property_owners`.
 */
export const OWNER_CONSENT_VERSION = 'owner-share-2026-10-v1';

export const OWNER_CONSENT_TEXT =
  'Declaro que tenho base legal para compartilhar com este proprietário os dados de desempenho dos imóveis vinculados ' +
  '(diária média, ocupação, receita registrada, eventos e recomendações), por exemplo contrato de administração ou autorização do proprietário. ' +
  'Estou ciente de que o My Urban enviará o relatório mensal ao e-mail informado em meu nome, com link de descadastro, ' +
  'e de que posso revogar links e desativar o envio a qualquer momento.';

/** Aviso exibido no rodapé da página pública e do e-mail do proprietário (também sob revisão jurídica). */
export const OWNER_NOTICE_TEXT =
  'Você recebe este relatório porque o responsável pela administração dos seus imóveis informou o seu e-mail ao My Urban. ' +
  'O My Urban é um operador desse compartilhamento e não usa estes dados para outra finalidade. ' +
  'Para deixar de receber, use o link de descadastro.';

export const OWNER_REPORT_RETENTION_MONTHS_DEFAULT = 12;
export const OWNER_REPORT_LINK_PURGE_GRACE_DAYS = 30;
