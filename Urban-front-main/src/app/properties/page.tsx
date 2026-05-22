'use client';

import React, { useEffect, useState } from 'react';
import { Check, Clock, Edit2, ExternalLink, Plus, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../../../i18n';
import {
  getPropriedadesDropdownList,
  getPropertyPricingInputHistory,
  PricingInputHistory,
  PropertyDropdown,
  requestDeleteAddress,
  updatePropertyIdentity,
  updatePropertyPricingInputs,
} from '../service/api';
import { AddPropertyModal } from '../componentes/AddPropertyModal';
import {
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppLoadingStatus,
  AppPageShell,
  AppSectionHeader,
  useToastCompat,
} from '../componentes/ui';

type PricingDraft = { manualDailyPrice: string; averageMonthlyRevenue: string };
type IdentityDraft = { internalNickname: string; internalCode: string };

function PropertyThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [errored, setErrored] = useState(false);
  const initial = (alt?.charAt(0) || '?').toUpperCase();

  if (!src || errored) {
    return <div className="properties-thumb-fallback">{initial}</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="properties-thumb"
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
    />
  );
}

export default function MyProperties() {
  const { t } = useTranslation();
  const toast = useToastCompat();
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState<string | null>(null);
  const [editingIdentity, setEditingIdentity] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, PricingDraft>>({});
  const [identityDrafts, setIdentityDrafts] = useState<Record<string, IdentityDraft>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);
  const [pricingHistory, setPricingHistory] = useState<Record<string, PricingInputHistory[]>>({});
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const data = await getPropriedadesDropdownList();
      setProperties(data);
      setPricingDrafts(Object.fromEntries(data.map((prop) => [
        prop.id,
        {
          manualDailyPrice: prop.manualDailyPrice ? String(prop.manualDailyPrice) : '',
          averageMonthlyRevenue: prop.averageMonthlyRevenue ? String(prop.averageMonthlyRevenue) : '',
        },
      ])));
      setIdentityDrafts(Object.fromEntries(data.map((prop) => [
        prop.id,
        {
          internalNickname: prop.internalNickname ?? '',
          internalCode: prop.internalCode ?? '',
        },
      ])));
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleDeleteRequest = (id: string) => {
    setPropertyToDelete(id);
  };

  const closeDeleteDialog = () => {
    setPropertyToDelete(null);
  };

  const confirmDelete = async () => {
    if (!propertyToDelete) return;

    try {
      await requestDeleteAddress(propertyToDelete);
      toast("Imovel excluido", { type: "success" });
      setProperties((prev) => prev.filter((prop) => prop.id !== propertyToDelete));
    } catch (error) {
      toast("Erro ao excluir propriedade", { type: "error" });
      console.error('Erro ao deletar imovel:', error);
    } finally {
      closeDeleteDialog();
    }
  };

  const updateDraft = (id: string, field: keyof PricingDraft, value: string) => {
    setPricingDrafts((prev) => ({
      ...prev,
      [id]: {
        manualDailyPrice: prev[id]?.manualDailyPrice ?? '',
        averageMonthlyRevenue: prev[id]?.averageMonthlyRevenue ?? '',
        [field]: value,
      },
    }));
  };

  const updateIdentityDraft = (id: string, field: keyof IdentityDraft, value: string) => {
    setIdentityDrafts((prev) => ({
      ...prev,
      [id]: {
        internalNickname: prev[id]?.internalNickname ?? '',
        internalCode: prev[id]?.internalCode ?? '',
        [field]: value,
      },
    }));
  };

  const editIdentity = (prop: PropertyDropdown) => {
    setIdentityDrafts((prev) => ({
      ...prev,
      [prop.id]: {
        internalNickname: prop.internalNickname ?? '',
        internalCode: prop.internalCode ?? '',
      },
    }));
    setEditingIdentity(prop.id);
  };

  const cancelIdentityEdit = (prop: PropertyDropdown) => {
    setIdentityDrafts((prev) => ({
      ...prev,
      [prop.id]: {
        internalNickname: prop.internalNickname ?? '',
        internalCode: prop.internalCode ?? '',
      },
    }));
    setEditingIdentity(null);
  };

  const parseMoney = (value: string) => {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const saveIdentity = async (prop: PropertyDropdown) => {
    const draft = identityDrafts[prop.id] ?? { internalNickname: '', internalCode: '' };
    const internalNickname = draft.internalNickname.trim() || null;
    const internalCode = draft.internalCode.trim() || null;

    try {
      setSavingIdentity(prop.id);
      const updated = await updatePropertyIdentity(prop.id, {
        internalNickname,
        internalCode,
      });
      setProperties((prev) => prev.map((item) => item.id === prop.id ? { ...item, ...updated } : item));
      setEditingIdentity(null);
      toast("Identificacao do imovel salva.", { type: "success" });
    } catch (error) {
      toast("Erro ao salvar apelido/codigo do imovel.", { type: "error" });
      console.error('Erro ao salvar identificacao do imovel:', error);
    } finally {
      setSavingIdentity(null);
    }
  };

  const savePricingInputs = async (prop: PropertyDropdown) => {
    const draft = pricingDrafts[prop.id] ?? { manualDailyPrice: '', averageMonthlyRevenue: '' };
    const manualDailyPrice = parseMoney(draft.manualDailyPrice);

    if (!manualDailyPrice) {
      toast("Informe uma diaria base valida para este imovel.", { type: "warning" });
      return;
    }

    try {
      setSavingPricing(prop.id);
      const updated = await updatePropertyPricingInputs(prop.id, {
        manualDailyPrice,
        averageMonthlyRevenue: parseMoney(draft.averageMonthlyRevenue),
      });
      setProperties((prev) => prev.map((item) => item.id === prop.id ? { ...item, ...updated } : item));
      setPricingHistory((prev) => {
        const next = { ...prev };
        delete next[prop.id];
        return next;
      });
      toast("Valor salvo. As proximas sugestoes usarao essa referencia.", { type: "success" });
    } catch (error) {
      toast("Erro ao salvar preco base do imovel.", { type: "error" });
      console.error('Erro ao salvar inputs de pricing:', error);
    } finally {
      setSavingPricing(null);
    }
  };

  const loadPricingHistory = async (propId: string) => {
    if (openHistory === propId) {
      setOpenHistory(null);
      return;
    }

    setOpenHistory(propId);
    if (pricingHistory[propId]) return;

    try {
      setLoadingHistory(propId);
      const history = await getPropertyPricingInputHistory(propId, 10);
      setPricingHistory((prev) => ({ ...prev, [propId]: history }));
    } catch (error) {
      toast("Erro ao carregar historico de preco.", { type: "error" });
      console.error('Erro ao carregar historico de inputs de pricing:', error);
    } finally {
      setLoadingHistory(null);
    }
  };

  const formatMoney = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getAirbnbRoomUrl = (listingId?: string | null) => {
    const value = listingId?.trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `https://www.airbnb.com/rooms/${encodeURIComponent(value)}`;
  };

  const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const normalizeSearch = (value: unknown) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const searchNeedle = normalizeSearch(propertySearch);
  const filteredProperties = properties.filter((prop) => {
    if (!searchNeedle) return true;
    return [
      prop.internalNickname,
      prop.internalCode,
      prop.propertyName,
      prop.id_do_anuncio,
      prop.id,
      (prop as any).neighborhood,
      (prop as any).city,
      (prop as any).address,
    ].some((value) => normalizeSearch(value).includes(searchNeedle));
  });
  const processingProperties = properties.filter((prop) => !isPropertyReady(prop));
  const processingStatus = processingProperties[0]?.setupStatus;

  if (loading) {
    return (
      <AppPageShell maxWidth={1180}>
        <AppLoadingStatus
          eyebrow="IMOVEIS"
          title="Carregando seus imoveis"
          body="Estamos preparando sua lista antes de liberar busca e edicoes."
          steps={[
            { id: 'list', label: 'Buscar lista', status: 'active', detail: 'Seus imoveis' },
            { id: 'pricing', label: 'Carregar precos', status: 'pending', detail: 'Valores de referencia' },
            { id: 'ready', label: 'Liberar edicao', status: 'pending', detail: 'Busca e acoes' },
          ]}
        />
        <style jsx>{styles}</style>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={1180}>
      <AppSectionHeader
        eyebrow="IMOVEIS"
        title="Meus imoveis"
        subtitle="Organize apelidos, codigos internos e valores que ajudam a Urban AI sugerir precos melhores."
        actions={
          <AppButton
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => setIsAddOpen(true)}
          >
            Adicionar imovel
          </AppButton>
        }
      />

      {processingProperties.length > 0 && (
        <AppLoadingStatus
          compact
          eyebrow="IMOVEIS SENDO PREPARADOS"
          title={processingPropertiesTitle(processingProperties.length)}
          body={processingStatus?.publicDescription ?? "Mapa, eventos por perto e sugestoes de preco aparecem assim que cada imovel ficar pronto. Enquanto isso, voce pode ajustar apelidos e valores."}
          tone="warn"
          steps={
            processingStatus?.steps ?? [
              { id: 'registered', label: 'Imovel adicionado', status: 'complete' },
              { id: 'location', label: 'Preparar mapa', status: 'active', detail: 'Endereco e raio' },
              { id: 'events', label: 'Procurar eventos perto', status: 'pending', detail: 'Shows, feiras e jogos' },
              { id: 'recommendations', label: 'Preparar sugestoes', status: 'pending', detail: 'Precos por oportunidade' },
            ]
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <AppCard variant="default" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="properties-toolbar">
          <label className="properties-search">
            <Search size={15} />
            <input
              value={propertySearch}
              onChange={(event) => setPropertySearch(event.target.value)}
              placeholder="Filtrar por apelido, codigo, titulo ou ID Airbnb"
            />
          </label>
          <div className="properties-count">
            <span>{filteredProperties.length} de {properties.length} imoveis</span>
            {propertySearch && (
              <button
                aria-label="Limpar filtro"
                className="properties-icon-button"
                type="button"
                onClick={() => setPropertySearch('')}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="properties-list">
          {filteredProperties.map((prop) => {
            const airbnbUrl = getAirbnbRoomUrl(prop.id_do_anuncio);
            const isEditingIdentity = editingIdentity === prop.id;
            const identityDraft = identityDrafts[prop.id] ?? { internalNickname: '', internalCode: '' };
            const locationLabel = (prop as any).neighborhood || (prop as any).city || (prop as any).address || 'Imovel cadastrado';
            const secondaryLabel = prop.internalNickname ? prop.propertyName : locationLabel;
            const detailLabel = [
              prop.id_do_anuncio ? `Airbnb ${prop.id_do_anuncio}` : null,
              prop.internalNickname ? locationLabel : null,
            ].filter(Boolean).join(' - ');

            return (
              <article className="properties-row" key={prop.id}>
                <div className="properties-row-main">
                  <div className="properties-identity">
                    <PropertyThumb src={prop.image_url} alt={prop.propertyName} />
                    <div className="properties-title-block">
                      {isEditingIdentity ? (
                        <div className="properties-edit-box">
                          <div className="properties-identity-inputs">
                            <AppInput
                              placeholder="Apelido interno"
                              maxLength={80}
                              value={identityDraft.internalNickname}
                              onChange={(event) => updateIdentityDraft(prop.id, 'internalNickname', event.target.value)}
                            />
                            <AppInput
                              placeholder="Codigo"
                              maxLength={32}
                              value={identityDraft.internalCode}
                              onChange={(event) => updateIdentityDraft(prop.id, 'internalCode', event.target.value)}
                              shellStyle={{ maxWidth: 150 }}
                            />
                          </div>
                          <div className="properties-inline-actions">
                            <AppButton
                              size="sm"
                              variant="primary"
                              leftIcon={<Check size={14} />}
                              loading={savingIdentity === prop.id}
                              onClick={() => saveIdentity(prop)}
                            >
                              Salvar ID
                            </AppButton>
                            <AppButton
                              size="sm"
                              variant="ghost"
                              leftIcon={<X size={14} />}
                              onClick={() => cancelIdentityEdit(prop)}
                            >
                              Cancelar
                            </AppButton>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="properties-name-line">
                            <p>{prop.internalNickname || prop.propertyName}</p>
                            {prop.internalCode && <span>{prop.internalCode}</span>}
                            {!isPropertyReady(prop) && (
                              <span className="properties-status-pill">
                                {prop.setupStatus?.publicLabel ?? 'Preparando sugestoes'}
                              </span>
                            )}
                            <button
                              aria-label="Editar apelido e codigo do imovel"
                              className="properties-icon-button"
                              type="button"
                              onClick={() => editIdentity(prop)}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                          <p className="properties-secondary">{secondaryLabel}</p>
                          {detailLabel && <p className="properties-detail">{detailLabel}</p>}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="properties-pricing">
                    <AppInput
                      label="Diaria base"
                      leftAddon="R$"
                      placeholder="0,00"
                      inputMode="decimal"
                      value={pricingDrafts[prop.id]?.manualDailyPrice ?? ''}
                      onChange={(event) => updateDraft(prop.id, 'manualDailyPrice', event.target.value)}
                      shellStyle={{ minWidth: 150 }}
                    />
                    <AppInput
                      label="Receita media / mes"
                      leftAddon="R$"
                      placeholder="0,00"
                      inputMode="decimal"
                      value={pricingDrafts[prop.id]?.averageMonthlyRevenue ?? ''}
                      onChange={(event) => updateDraft(prop.id, 'averageMonthlyRevenue', event.target.value)}
                      shellStyle={{ minWidth: 170 }}
                    />
                    <div className="properties-actions">
                      <AppButton
                        size="sm"
                        variant="primary"
                        loading={savingPricing === prop.id}
                        onClick={() => savePricingInputs(prop)}
                      >
                        Salvar
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="ghost"
                        leftIcon={<Clock size={14} />}
                        loading={loadingHistory === prop.id}
                        onClick={() => loadPricingHistory(prop.id)}
                      >
                        Historico
                      </AppButton>
                      {airbnbUrl ? (
                        <a
                          className="properties-link-button"
                          href={airbnbUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={14} />
                          Abrir
                        </a>
                      ) : (
                        <span className="properties-link-button disabled">
                          <ExternalLink size={14} />
                          Abrir
                        </span>
                      )}
                      <button
                        aria-label={t('my_properties.delete')}
                        className="properties-delete-button"
                        type="button"
                        onClick={() => handleDeleteRequest(prop.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <details className="properties-details">
                  <summary>Dados de localizacao</summary>
                  <p>Usamos o endereco cadastrado para comparar eventos, bairro e demanda.</p>
                </details>

                {openHistory === prop.id && (
                  <div className="properties-history">
                    <p className="properties-history-title">Ultimas alteracoes de preco base</p>
                    {(pricingHistory[prop.id] ?? []).length === 0 ? (
                      <p className="properties-empty-note">Nenhuma alteracao registrada ainda.</p>
                    ) : (
                      <div className="properties-history-list">
                        {pricingHistory[prop.id].map((item) => (
                          <div className="properties-history-row" key={item.id}>
                            <span>{formatDateTime(item.createdAt)}</span>
                            <span>
                              Diaria {formatMoney(item.previousManualDailyPrice)} -&gt; {formatMoney(item.newManualDailyPrice)}
                            </span>
                            <span>
                              Mes {formatMoney(item.previousAverageMonthlyRevenue)} -&gt; {formatMoney(item.newAverageMonthlyRevenue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {properties.length > 0 && filteredProperties.length === 0 && (
          <div className="properties-empty-filter">
            <AppEmptyState
              title="Nenhum imovel encontrado"
              body="Tente outro apelido, codigo, titulo ou ID Airbnb."
              icon={<Search size={32} />}
            />
          </div>
        )}
      </AppCard>

      {propertyToDelete && (
        <div className="properties-dialog-overlay" role="dialog" aria-modal="true">
          <div className="properties-dialog">
            <h2>Excluir propriedade?</h2>
            <p>
              A Urban AI nao atualizara mais os precos desta unidade. Esta acao nao pode ser desfeita.
            </p>
            <div className="properties-dialog-actions">
              <AppButton variant="ghost" onClick={closeDeleteDialog}>
                Cancelar
              </AppButton>
              <AppButton variant="danger" onClick={confirmDelete}>
                Excluir
              </AppButton>
            </div>
          </div>
        </div>
      )}

      <AddPropertyModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={fetchProperties}
      />

      <style jsx>{styles}</style>
    </AppPageShell>
  );
}

const styles = `
  .properties-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    border-bottom: 1px solid var(--app-divider);
    background: var(--app-surface);
  }

  .properties-search {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(520px, 100%);
    height: 38px;
    padding: 0 12px;
    color: var(--app-text-muted);
    border: 1px solid var(--app-divider-strong);
    border-radius: 10px;
    background: var(--app-surface);
  }

  .properties-search input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    color: var(--app-text);
    background: transparent;
    font: inherit;
    font-size: 14px;
  }

  .properties-count {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    color: var(--app-text-muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .properties-icon-button,
  .properties-delete-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: var(--app-text-muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
  }

  .properties-icon-button:hover {
    color: var(--app-text);
    background: var(--app-surface-muted);
    border-color: var(--app-divider);
  }

  .properties-delete-button {
    color: var(--app-danger);
  }

  .properties-delete-button:hover {
    background: rgba(194, 52, 46, 0.08);
    border-color: rgba(194, 52, 46, 0.22);
  }

  .properties-list {
    display: grid;
  }

  .properties-row {
    padding: 16px 20px;
    border-bottom: 1px solid var(--app-divider);
  }

  .properties-row:last-child {
    border-bottom: 0;
  }

  .properties-row-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .properties-identity {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1 1 420px;
    gap: 14px;
  }

  .properties-thumb,
  .properties-thumb-fallback {
    width: 60px;
    height: 60px;
    flex: 0 0 auto;
    border-radius: 8px;
  }

  .properties-thumb {
    object-fit: cover;
  }

  .properties-thumb-fallback {
    display: grid;
    place-items: center;
    color: var(--app-text-muted);
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    font-size: 18px;
    font-weight: 750;
  }

  .properties-title-block {
    min-width: 0;
    flex: 1;
  }

  .properties-name-line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .properties-name-line p {
    max-width: min(460px, 100%);
    margin: 0;
    overflow: hidden;
    color: var(--app-text);
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .properties-name-line span {
    padding: 3px 8px;
    color: var(--app-text-muted);
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
  }

  .properties-name-line span.properties-status-pill {
    color: #92400E;
    background: rgba(202, 138, 4, 0.12);
    border-color: rgba(202, 138, 4, 0.24);
  }

  .properties-secondary,
  .properties-detail {
    max-width: 520px;
    margin: 4px 0 0;
    overflow: hidden;
    color: var(--app-text-muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .properties-detail {
    color: var(--app-text-subtle);
    font-size: 12px;
  }

  .properties-edit-box {
    display: grid;
    gap: 8px;
    max-width: 520px;
  }

  .properties-identity-inputs,
  .properties-inline-actions,
  .properties-actions,
  .properties-pricing {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .properties-pricing {
    justify-content: flex-end;
    flex: 0 1 auto;
  }

  .properties-link-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 32px;
    padding: 0 14px;
    color: var(--app-text-muted);
    border: 1px solid transparent;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
  }

  .properties-link-button:hover {
    color: var(--app-text);
    background: var(--app-surface-muted);
  }

  .properties-link-button.disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .properties-details {
    margin-top: 10px;
    color: var(--app-text-subtle);
  }

  .properties-details summary {
    width: fit-content;
    cursor: pointer;
    color: var(--app-text-subtle);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .properties-details p {
    margin: 6px 0 0;
    color: var(--app-text-muted);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 12px;
  }

  .properties-history {
    margin-top: 12px;
    padding: 12px;
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 10px;
  }

  .properties-history-title,
  .properties-empty-note {
    margin: 0;
    color: var(--app-text);
    font-size: 14px;
    font-weight: 650;
  }

  .properties-empty-note {
    color: var(--app-text-muted);
    font-weight: 400;
  }

  .properties-history-list {
    display: grid;
    gap: 8px;
    margin-top: 10px;
  }

  .properties-history-row {
    display: grid;
    grid-template-columns: 160px 1fr 1fr;
    gap: 12px;
    color: var(--app-text-muted);
    font-size: 13px;
  }

  .properties-empty-filter {
    padding: 32px;
  }

  .properties-dialog-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.48);
    backdrop-filter: blur(4px);
  }

  .properties-dialog {
    width: min(420px, 100%);
    padding: 24px;
    background: var(--app-surface);
    border: 1px solid var(--app-divider);
    border-radius: 14px;
    box-shadow: 0 24px 72px rgba(15, 23, 42, 0.20);
  }

  .properties-dialog h2 {
    margin: 0;
    color: var(--app-text);
    font-size: 20px;
    line-height: 1.25;
  }

  .properties-dialog p {
    margin: 12px 0 0;
    color: var(--app-text-muted);
    font-size: 14px;
    line-height: 1.55;
  }

  .properties-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 22px;
  }

  @media (max-width: 980px) {
    .properties-row-main {
      align-items: stretch;
      flex-direction: column;
    }

    .properties-pricing {
      justify-content: flex-start;
    }
  }

  @media (max-width: 720px) {
    .properties-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .properties-search {
      width: 100%;
    }

    .properties-count {
      justify-content: space-between;
    }

    .properties-identity {
      align-items: flex-start;
    }

    .properties-identity-inputs,
    .properties-pricing,
    .properties-actions {
      align-items: stretch;
      flex-direction: column;
      width: 100%;
    }

    .properties-inline-actions {
      align-items: stretch;
    }

    .properties-history-row {
      grid-template-columns: 1fr;
    }

    .properties-dialog-actions {
      flex-direction: column-reverse;
    }
  }
`;

function isPropertyReady(prop: PropertyDropdown): boolean {
  return prop.setupStatus?.state ? prop.setupStatus.state === 'ready' : prop.analisado === 'completed';
}

function processingPropertiesTitle(count: number): string {
  return count === 1
    ? "1 imovel ainda sendo preparado"
    : `${count} imoveis ainda sendo preparados`;
}
