'use client';

import React, { useState } from 'react';
import { AppButton, AppLoadingStatus, useToastCompat, type AppLoadingStep } from './ui';
import {
  getUserManagedListings,
  getPropriedadesDropdownList,
  registerProperties,
  resolveAirbnbUrl,
  getPropertyQuickInfo,
  createMultipleAddresses,
  registerProcess,
  getFriendlyApiErrorMessage,
  updatePropertyPricingInputs,
} from '../service/api';
import { describeBasePriceReadiness } from '../lib/pricingInputs';

export interface Property {
  id: number;
  titulo: string;
  id_do_anuncio: string;
  ativo: boolean;
  pictureUrl?: string;
  propertyType?: string;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  guests?: number;
  rating?: number;
  isNewListing?: boolean;
  reviewCount?: number;
  neighborhood?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  fullAddress?: string;
  amenitiesCount?: number;
  amenities?: string[];
}

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

type PropertyLoadStage =
  | 'idle'
  | 'checking-existing'
  | 'resolving-link'
  | 'fetching-profile'
  | 'fetching-listing'
  | 'ready'
  | 'registering'
  | 'creating-addresses'
  | 'checking-airbnb-availability'
  | 'finding-available-dates'
  | 'calculating-daily-rate'
  | 'manual-price-required'
  | 'saving-prices'
  | 'starting-analysis'
  | 'refreshing';

type PendingPricingProperty = {
  addressId: string;
  listId: string;
  propertyName: string;
  pictureUrl?: string | null;
  airbnbId?: string | null;
  sourceLabel?: string;
  fallbackMessage?: string;
  provisionalDailyPrice?: number | null;
};

const quotaErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as any)?.response?.data;
  if (data?.code === 'LISTINGS_QUOTA_EXCEEDED') {
    return getFriendlyApiErrorMessage(error, fallback);
  }
  return getFriendlyApiErrorMessage(error, fallback);
};

const propertyCountLabel = (count: number) =>
  count === 1 ? "1 imóvel" : `${count} imóveis`;

const foundPropertiesLabel = (count: number) =>
  count === 1 ? "1 imóvel encontrado" : `${count} imóveis encontrados`;

export function AddPropertyModal({ isOpen, onClose, onSuccess }: AddPropertyModalProps) {
  const toast = useToastCompat();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadStage, setLoadStage] = useState<PropertyLoadStage>('idle');
  const [fetchedProperties, setFetchedProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, boolean>>({});
  const [pendingPricingProperties, setPendingPricingProperties] = useState<PendingPricingProperty[]>([]);
  const [manualPriceDrafts, setManualPriceDrafts] = useState<Record<string, string>>({});
  const [pendingProcessListIds, setPendingProcessListIds] = useState<Array<{ id: string }>>([]);

  const resetState = () => {
    setInputValue('');
    setFetchedProperties([]);
    setSelectedProperties({});
    setPendingPricingProperties([]);
    setManualPriceDrafts({});
    setPendingProcessListIds([]);
    setIsLoading(false);
    setLoadStage('idle');
  };

  const handleClose = () => {
    if (pendingPricingProperties.length > 0) {
      toast("Informe a diária base para concluir o cadastro antes de fechar.", { type: "warning" });
      return;
    }
    resetState();
    onClose();
  };

  const extractAirbnbPropertyId = (link: string): string | null => {
    if (!link || !link.includes('airbnb')) return null;
    const patterns = [/\/rooms\/(\d+)/, /rooms\/([a-zA-Z0-9]+)/];
    for (const pattern of patterns) {
      const match = link.split('?')[0].match(pattern);
      if (match && match[1]) return match[1].split('/')[0];
    }
    return null;
  };

  const extractAirbnbUserId = (link: string): string | null => {
    if (!link || !link.includes('airbnb')) return null;
    const regex = /\/users\/(?:show|profile)\/(\d+)/;
    const match = link.match(regex);
    return match && match[1] ? match[1] : null;
  };

  const extractAirbnbListingId = (url: string): string | null => {
    try {
      const regex = /editor\/(\d+)\/details/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const handleFetchProperties = async () => {
    if (!inputValue.trim()) {
      toast("Por favor, insira o link de um imóvel ou do perfil Airbnb.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    setLoadStage('checking-existing');
    setFetchedProperties([]);

    try {
      const existingProps = await getPropriedadesDropdownList();
      const existingIds = existingProps.map((p) => p.id_do_anuncio).filter(Boolean);

      let finalUrl = inputValue.trim();
      if (finalUrl.includes('airbnb.') || finalUrl.includes('abnb.me')) {
        try {
          setLoadStage('resolving-link');
          const resolved = await resolveAirbnbUrl(finalUrl);
          finalUrl = resolved.finalUrl;
        } catch {}
      }

      const userId = extractAirbnbUserId(finalUrl);
      if (userId) {
        setLoadStage('fetching-profile');
        const listings = await getUserManagedListings(userId);

        if (!listings || listings.length === 0) {
          toast("Não encontramos imóveis neste perfil.", { type: "warning" });
          setLoadStage('idle');
          setIsLoading(false);
          return;
        }

        const filteredListings = listings.filter((item: any) => !existingIds.includes(item.id_do_anuncio));

        if (filteredListings.length === 0) {
          toast("Todos os imóveis deste perfil já estão cadastrados em sua conta.", { type: "info" });
          setLoadStage('idle');
          setIsLoading(false);
          return;
        }

        const mapped: Property[] = filteredListings.map((item: any) => ({
          id: item.id || 0,
          titulo: item.titulo ?? item.name ?? 'Sem título',
          id_do_anuncio: item.id_do_anuncio ?? '',
          ativo: true,
          pictureUrl: item.pictureUrl,
          bedrooms: item.bedrooms || 0,
          beds: item.beds || 0,
          bathrooms: item.bathrooms || 0,
          guests: item.personCapacity || item.guests || 0,
          rating: item.rating || 0,
          propertyType: item.propertyType || '',
          city: item.city || '',
        }));

        setFetchedProperties(mapped);
        const autoSelect: Record<string, boolean> = {};
        mapped.forEach((p) => {
          autoSelect[p.id_do_anuncio] = true;
        });
        setSelectedProperties(autoSelect);
        setLoadStage('ready');
        setIsLoading(false);
        return;
      }

      let propertyId = extractAirbnbPropertyId(finalUrl);
      const editorId = extractAirbnbListingId(finalUrl);
      if (editorId) {
        propertyId = editorId;
      }

      if (!propertyId) {
        toast("Não foi possível identificar o ID do imóvel no link fornecido.", { type: "error" });
        setLoadStage('idle');
        setIsLoading(false);
        return;
      }

      if (existingIds.includes(propertyId)) {
        toast("Este imóvel já está cadastrado em sua conta.", { type: "info" });
        setLoadStage('idle');
        setIsLoading(false);
        return;
      }

      setLoadStage('fetching-listing');
      const info = await getPropertyQuickInfo(propertyId);
      if (info.hostId) {
        try {
          setLoadStage('fetching-profile');
          const listings = await getUserManagedListings(info.hostId);
          const filteredListings = (listings ?? []).filter((item: any) => !existingIds.includes(item.id_do_anuncio));

          if (filteredListings.length > 0) {
            const mapped: Property[] = filteredListings.map((item: any) => ({
              id: item.id || 0,
              titulo: item.titulo ?? item.name ?? 'Sem título',
              id_do_anuncio: item.id_do_anuncio ?? '',
              ativo: true,
              pictureUrl: item.pictureUrl,
              bedrooms: item.bedrooms || 0,
              beds: item.beds || 0,
              bathrooms: item.bathrooms || 0,
              guests: item.personCapacity || item.guests || 0,
              rating: item.rating || 0,
              propertyType: item.propertyType || '',
              city: item.city || '',
            }));

            setFetchedProperties(mapped);
            const autoSelect: Record<string, boolean> = {};
            mapped.forEach((p) => {
              autoSelect[p.id_do_anuncio] = true;
            });
            setSelectedProperties(autoSelect);
            setLoadStage('ready');
            return;
          }
        } catch (hostError) {
          console.warn('Não foi possível importar o perfil pelo link do anúncio; usando imóvel individual.', hostError);
        }
      }

      const newProp: Property = {
        id: 0,
        titulo: info.title,
        id_do_anuncio: propertyId,
        ativo: true,
        pictureUrl: info.pictureUrl,
        bedrooms: info.bedrooms || 0,
        beds: info.beds || 0,
        bathrooms: info.bathrooms || 0,
        guests: info.guests || 0,
        rating: info.rating || 0,
        propertyType: info.propertyType || '',
      };

      setFetchedProperties([newProp]);
      setSelectedProperties({ [newProp.id_do_anuncio]: true });
      setLoadStage('ready');
    } catch (error) {
      console.error(error);
      setLoadStage('idle');
      toast(getFriendlyApiErrorMessage(error, "Não conseguimos buscar os imóveis agora. Tente novamente em alguns instantes."), { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleProperty = (id: string, checked: boolean) => {
    setSelectedProperties((prev) => ({ ...prev, [id]: checked }));
  };

  const parseMoneyInput = (value: string): number | null => {
    const normalized = value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
  };

  const runWithTimedStages = async <T,>(
    schedule: Array<{ stage: PropertyLoadStage; delayMs: number }>,
    action: () => Promise<T>,
  ): Promise<T> => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    for (const item of schedule) {
      if (item.delayMs <= 0) {
        setLoadStage(item.stage);
      } else {
        timers.push(setTimeout(() => setLoadStage(item.stage), item.delayMs));
      }
    }

    try {
      return await action();
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  const collectPendingPricingProperties = (createdAddresses: any[]): PendingPricingProperty[] =>
    (createdAddresses ?? [])
      .reduce<PendingPricingProperty[]>((pending, address) => {
        const list = address?.list ?? {};
        const readiness = describeBasePriceReadiness(list);
        if (readiness.ready) return pending;

        const item: PendingPricingProperty = {
          addressId: address.id,
          listId: address.list?.id,
          propertyName: address.list?.titulo || `Imóvel ${String(address.id).slice(0, 4)}`,
          pictureUrl: address.list?.pictureUrl ?? null,
          airbnbId: address.list?.id_do_anuncio ?? null,
          sourceLabel: readiness.sourceLabel,
          fallbackMessage: readiness.message,
          provisionalDailyPrice: readiness.dailyPrice,
        };

        if (item.addressId && item.listId) pending.push(item);
        return pending;
      }, []);

  const handleSaveProperties = async () => {
    const selectedList = fetchedProperties.filter((p) => selectedProperties[p.id_do_anuncio]);
    if (selectedList.length === 0) {
      toast("Selecione pelo menos um imóvel para adicionar.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    try {
      const payload = selectedList.map((p) => ({ ...p, ativo: true }));
      setLoadStage('registering');
      const registered = await registerProperties(payload as any);
      const registeredProperties = Array.isArray((registered as any)?.data)
        ? (registered as any).data
        : (registered as any);

      const addressesToRegister = registeredProperties.map((prop: any) => ({
        cep: null,
        numero: null,
        logradouro: null,
        bairro: null,
        cidade: null,
        estado: null,
        list: { id: prop.id_do_anuncio },
      }));

      const createdAddresses = await runWithTimedStages(
        [
          { stage: 'creating-addresses', delayMs: 0 },
          { stage: 'checking-airbnb-availability', delayMs: 900 },
          { stage: 'finding-available-dates', delayMs: 2200 },
          { stage: 'calculating-daily-rate', delayMs: 3600 },
        ],
        () => createMultipleAddresses(addressesToRegister),
      );

      const processListIds = registeredProperties
        .map((prop: any) => prop?.id)
        .filter(Boolean)
        .map((id: string) => ({ id }));

      const pendingPricing = collectPendingPricingProperties(createdAddresses as any[]);
      if (pendingPricing.length > 0) {
        setPendingPricingProperties(pendingPricing);
        setPendingProcessListIds(processListIds);
        setManualPriceDrafts(
          pendingPricing.reduce((acc, property) => ({ ...acc, [property.addressId]: '' }), {}),
        );
        setLoadStage('manual-price-required');
        toast("Não encontramos uma diária confiável no Airbnb. Informe a diária base para concluir.", { type: "info" });
        return;
      }

      if (processListIds.length > 0) {
        setLoadStage('starting-analysis');
        await registerProcess(processListIds);
      }

      setLoadStage('refreshing');
      toast(
        selectedList.length === 1
          ? "Imóvel registrado com sucesso!"
          : `${selectedList.length} imóveis registrados com sucesso!`,
        { type: "success" },
      );
      await Promise.resolve(onSuccess());
      handleClose();
    } catch (error) {
      console.error(error);
      setLoadStage('ready');
      toast(quotaErrorMessage(error, "Não conseguimos registrar as propriedades agora. Tente novamente em alguns instantes."), { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveManualPrices = async () => {
    const parsedByAddress = pendingPricingProperties.map((property) => ({
      property,
      manualDailyPrice: parseMoneyInput(manualPriceDrafts[property.addressId] ?? ''),
    }));

    const invalid = parsedByAddress.find((item) => !item.manualDailyPrice);
    if (invalid) {
      toast("Informe uma diária base válida para todos os imóveis. Sem esse valor, a Urban AI não inicia a análise.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    try {
      setLoadStage('saving-prices');
      for (const item of parsedByAddress) {
        await updatePropertyPricingInputs(item.property.addressId, {
          manualDailyPrice: item.manualDailyPrice,
          averageMonthlyRevenue: null,
        });
      }

      if (pendingProcessListIds.length > 0) {
        setLoadStage('starting-analysis');
        await registerProcess(pendingProcessListIds);
      }

      setLoadStage('refreshing');
      toast("Preços base salvos. Imóveis registrados com sucesso!", { type: "success" });
      await Promise.resolve(onSuccess());
      resetState();
      onClose();
    } catch (error) {
      console.error(error);
      setLoadStage('manual-price-required');
      toast("Não conseguimos salvar os preços base agora. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadingStatus = getPropertyLoadingStatus(loadStage, fetchedProperties.length);
  const showLoadingStatus = isLoading || loadStage !== 'idle';

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(8,10,15,0.56)",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-property-title"
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          background: "#fff",
          color: "#0E1116",
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "20px 24px",
            borderBottom: "1px solid rgba(14,17,22,0.10)",
          }}
        >
          <h2 id="add-property-title" style={{ margin: 0, fontSize: 20 }}>
            Adicionar imóvel
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={handleClose}
            style={iconButtonStyle}
          >
            x
          </button>
        </header>

        <div style={{ padding: 24, overflowY: "auto" }}>
          {fetchedProperties.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, color: "rgba(14,17,22,0.68)", lineHeight: 1.6 }}>
                Para adicionar imóveis a sua conta, cole abaixo o <strong>link do Airbnb</strong> do seu imóvel
                ou o <strong>link do seu perfil de anfitrião</strong> para importar automaticamente todos os imóveis.
              </p>

              <input
                placeholder="Exemplo: https://www.airbnb.com/rooms/12345678"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                style={inputStyle}
              />

              {showLoadingStatus && (
                <AppLoadingStatus
                  compact
                  eyebrow={loadingStatus.eyebrow}
                  title={loadingStatus.title}
                  body={loadingStatus.body}
                  steps={loadingStatus.steps}
                  tone={loadingStatus.tone}
                />
              )}

              <AppButton
                type="button"
                size="lg"
                fullWidth
                onClick={handleFetchProperties}
                loading={isLoading}
                loadingLabel={loadingStatus.buttonLabel}
              >
                Buscar imóveis
              </AppButton>
            </div>
          ) : pendingPricingProperties.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <AppLoadingStatus
                compact
                eyebrow={loadingStatus.eyebrow}
                title={loadingStatus.title}
                body={loadingStatus.body}
                steps={loadingStatus.steps}
                tone={loadingStatus.tone}
              />

              <div
                style={{
                  padding: 14,
                  border: "1px solid #FDBA74",
                  borderRadius: 8,
                  background: "#FFF7ED",
                  color: "#0E1116",
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>Informe a diária base</p>
                <p style={{ margin: "6px 0 0", color: "rgba(14,17,22,0.68)", lineHeight: 1.5 }}>
                  O Airbnb não retornou uma diária confirmada para estes imóveis, ou retornou apenas uma fonte provisória. Informe a diária atual para concluir o cadastro e iniciar a análise.
                </p>
              </div>

              {pendingPricingProperties.map((property) => (
                <div
                  key={property.addressId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 12,
                    border: "1px solid rgba(14,17,22,0.12)",
                    borderRadius: 8,
                  }}
                >
                  {property.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={property.pictureUrl}
                      alt="Capa"
                      style={{ width: 64, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 64, height: 52, borderRadius: 8, background: "#F3F4F6", flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {property.propertyName}
                    </p>
                    {property.airbnbId && (
                      <p style={{ margin: "4px 0 0", color: "rgba(14,17,22,0.58)", fontSize: 12 }}>
                        {property.airbnbId}
                      </p>
                    )}
                    <p style={{ margin: "4px 0 0", color: "#9A3412", fontSize: 12, lineHeight: 1.35 }}>
                      {property.fallbackMessage}
                      {property.provisionalDailyPrice
                        ? ` Valor encontrado: R$ ${property.provisionalDailyPrice.toFixed(2)} (${property.sourceLabel ?? "fonte não informada"}).`
                        : ` Fonte: ${property.sourceLabel ?? "fonte não informada"}.`}
                    </p>
                  </div>
                  <input
                    placeholder="R$ 350"
                    inputMode="decimal"
                    value={manualPriceDrafts[property.addressId] ?? ''}
                    onChange={(event) =>
                      setManualPriceDrafts((prev) => ({ ...prev, [property.addressId]: event.target.value }))
                    }
                    disabled={isLoading}
                    style={{ ...inputStyle, width: 140, flexShrink: 0 }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontWeight: 650 }}>
                Encontramos {propertyCountLabel(fetchedProperties.length)} para acompanhar. Selecione os que deseja monitorar e atualizar:
              </p>

              {showLoadingStatus && (
                <AppLoadingStatus
                  compact
                  eyebrow={loadingStatus.eyebrow}
                  title={loadingStatus.title}
                  body={loadingStatus.body}
                  steps={loadingStatus.steps}
                  tone={loadingStatus.tone}
                />
              )}

              <div
                style={{
                  maxHeight: 400,
                  overflowY: "auto",
                  padding: 8,
                  border: "1px solid rgba(14,17,22,0.12)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {fetchedProperties.map((prop) => {
                    const selected = selectedProperties[prop.id_do_anuncio] || false;
                    return (
                      <div
                        key={prop.id_do_anuncio}
                        onClick={() => handleToggleProperty(prop.id_do_anuncio, !selected)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: 12,
                          border: `1px solid ${selected ? "rgba(232,80,10,0.35)" : "rgba(14,17,22,0.12)"}`,
                          borderRadius: 10,
                          background: selected ? "rgba(232,80,10,0.08)" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          readOnly
                          style={{ width: 18, height: 18, accentColor: "#E8500A", pointerEvents: "none" }}
                        />

                        {prop.pictureUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={prop.pictureUrl}
                            alt="Capa"
                            style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 70,
                              height: 70,
                              display: "grid",
                              placeItems: "center",
                              borderRadius: 8,
                              background: "#F3F4F6",
                              color: "#9CA3AF",
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            Sem foto
                          </div>
                        )}

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, color: "#0E1116", fontSize: 15, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {prop.titulo || `Anúncio #${prop.id_do_anuncio}`}
                          </p>
                          <p style={{ margin: "4px 0 0", color: "rgba(14,17,22,0.62)", fontSize: 13, lineHeight: 1.45 }}>
                            {prop.propertyType || 'Inteiro'} - {prop.guests} hóspedes
                            {prop.bedrooms ? ` - ${prop.bedrooms} quartos` : ''}
                            {prop.beds ? ` - ${prop.beds} leitos` : ''}
                            {prop.bathrooms ? ` - ${prop.bathrooms} banheiros` : ''}
                          </p>
                        </div>

                        {prop.rating !== undefined && prop.rating > 0 && (
                          <span style={ratingStyle}>* {prop.rating}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            padding: "16px 24px",
            borderTop: "1px solid rgba(14,17,22,0.10)",
          }}
        >
          <AppButton
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading || pendingPricingProperties.length > 0}
          >
            Cancelar
          </AppButton>

          {fetchedProperties.length > 0 && (
            <AppButton
              type="button"
              onClick={pendingPricingProperties.length > 0 ? handleSaveManualPrices : handleSaveProperties}
              loading={isLoading}
              loadingLabel={loadingStatus.buttonLabel}
              disabled={
                pendingPricingProperties.length > 0
                  ? pendingPricingProperties.some((property) => !parseMoneyInput(manualPriceDrafts[property.addressId] ?? ''))
                  : !Object.values(selectedProperties).some(Boolean)
              }
            >
              {pendingPricingProperties.length > 0 ? "Salvar diária e concluir" : "Adicionar selecionados"}
            </AppButton>
          )}
        </footer>
      </section>
    </div>
  );
}

function getPropertyLoadingStatus(stage: PropertyLoadStage, foundCount: number): {
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  tone: "accent" | "warn" | "neutral" | "error";
  steps: AppLoadingStep[];
} {
  const activeIndexByStage: Record<PropertyLoadStage, number> = {
    idle: -1,
    'checking-existing': 0,
    'resolving-link': 0,
    'fetching-profile': 1,
    'fetching-listing': 1,
    ready: 2,
    registering: 3,
    'creating-addresses': 4,
    'checking-airbnb-availability': 5,
    'finding-available-dates': 6,
    'calculating-daily-rate': 7,
    'manual-price-required': 8,
    'saving-prices': 9,
    'starting-analysis': 10,
    refreshing: 11,
  };

  const copy: Record<PropertyLoadStage, { title: string; body: string; buttonLabel: string }> = {
    idle: {
      title: "Pronto para buscar",
      body: "Cole um link do Airbnb ou perfil de anfitrião para iniciar.",
      buttonLabel: "Carregando…",
    },
    'checking-existing': {
      title: "Vendo se esse imóvel já está na sua conta",
      body: "Assim a lista não fica com o mesmo anúncio duas vezes.",
      buttonLabel: "Conferindo…",
    },
    'resolving-link': {
      title: "Abrindo o link informado",
      body: "Alguns links precisam ser convertidos antes da busca.",
      buttonLabel: "Abrindo link…",
    },
    'fetching-profile': {
      title: "Procurando seus imóveis",
      body: "Vamos mostrar os anúncios encontrados para você escolher.",
      buttonLabel: "Procurando…",
    },
    'fetching-listing': {
      title: "Procurando dados do imóvel",
      body: "Estamos buscando foto, título e informações básicas.",
      buttonLabel: "Procurando imóvel…",
    },
    ready: {
      title: foundPropertiesLabel(foundCount),
      body: "Marque os que você quer acompanhar na Urban AI.",
      buttonLabel: "Preparando…",
    },
    registering: {
      title: "Salvando imóveis na sua conta",
      body: "Eles vão aparecer na sua lista de imóveis em instantes.",
      buttonLabel: "Salvando…",
    },
    'creating-addresses': {
      title: "Preparando dados do imóvel",
      body: "Estamos salvando localização e dados básicos antes de consultar a diária.",
      buttonLabel: "Preparando mapa…",
    },
    'checking-airbnb-availability': {
      title: "Buscando disponibilidade no Airbnb",
      body: "Estamos verificando se o calendário público oferece noites abertas para cotar.",
      buttonLabel: "Buscando disponibilidade…",
    },
    'finding-available-dates': {
      title: "Encontrando datas para cotar",
      body: "Testamos janelas futuras de 2 a 3 noites para evitar usar uma data bloqueada.",
      buttonLabel: "Encontrando datas…",
    },
    'calculating-daily-rate': {
      title: "Calculando diária base",
      body: "Quando o Airbnb retorna um total, dividimos pelo número de noites e validamos a origem.",
      buttonLabel: "Calculando diária…",
    },
    'manual-price-required': {
      title: "Precisamos da diária base",
      body: "Não encontramos uma diária confiável no Airbnb. O cadastro continua assim que você informar o valor atual.",
      buttonLabel: "Aguardando diária…",
    },
    'saving-prices': {
      title: "Salvando diária informada",
      body: "Vamos usar esse valor como base para iniciar a análise de eventos e oportunidades.",
      buttonLabel: "Salvando diária…",
    },
    'starting-analysis': {
      title: "Preparando sugestões de preço",
      body: "Estamos iniciando a busca por eventos próximos e oportunidades de preço.",
      buttonLabel: "Preparando sugestões…",
    },
    refreshing: {
      title: "Atualizando a lista",
      body: "Estamos mostrando os novos imóveis na tela.",
      buttonLabel: "Atualizando…",
    },
  };

  const activeIndex = activeIndexByStage[stage];
  const stepDefs: Array<{ id: string; label: string; detail: string }> = [
    { id: "validate", label: "Conferir link", detail: "Evita cadastro duplicado" },
    { id: "fetch", label: "Buscar no Airbnb", detail: "Foto e informações básicas" },
    { id: "select", label: "Escolher imóveis", detail: "Você confirma quais entram" },
    { id: "register", label: "Salvar na conta", detail: "Adiciona na sua lista" },
    { id: "location", label: "Preparar mapa", detail: "Localização do imóvel" },
    { id: "availability", label: "Ver disponibilidade", detail: "Calendário público do Airbnb" },
    { id: "dates", label: "Encontrar datas", detail: "Janelas futuras disponíveis" },
    { id: "daily", label: "Calcular diária", detail: "Total dividido por noites" },
    { id: "fallback", label: "Fallback manual", detail: "Só quando falta fonte confiável" },
    { id: "save-price", label: "Salvar diária", detail: "Valor manual confirmado" },
    { id: "analysis", label: "Buscar oportunidades", detail: "Eventos e sugestões" },
    { id: "refresh", label: "Mostrar na tela", detail: "Lista atualizada" },
  ];

  return {
    eyebrow: "O QUE ESTÁ ACONTECENDO",
    title: copy[stage].title,
    body: copy[stage].body,
    buttonLabel: copy[stage].buttonLabel,
    tone: stage === "manual-price-required" ? "warn" : stage === "ready" ? "neutral" : "accent",
    steps: stepDefs.map((step, index) => ({
      ...step,
      status:
        activeIndex < 0
          ? "pending"
          : index < activeIndex
            ? "complete"
            : index === activeIndex
              ? "active"
              : "pending",
    })),
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  border: "1px solid rgba(14,17,22,0.12)",
  borderRadius: 10,
  color: "#0E1116",
  fontSize: 15,
  outline: "none",
};

const iconButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid rgba(14,17,22,0.12)",
  borderRadius: 8,
  background: "#fff",
  color: "#0E1116",
  cursor: "pointer",
};

const ratingStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(22,160,107,0.10)",
  color: "#16A06B",
  fontSize: 12,
  fontWeight: 750,
};
