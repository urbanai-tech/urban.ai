'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppButton, AppLoadingStatus, DialogSurface, useToastCompat, type AppLoadingStep } from './ui';
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
import styles from "./AddPropertyModal.module.css";
import { brl } from "../lib/format";

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

const QUOTA_UPSELL_PATH = '/plans?upsell=quota';

const isQuotaExceededError = (error: unknown) =>
  (error as any)?.response?.data?.code === 'LISTINGS_QUOTA_EXCEEDED';

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
  const router = useRouter();
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
      if (isQuotaExceededError(error)) {
        // Limite do plano: leva ao upsell em vez de tratar como erro genérico.
        toast(quotaErrorMessage(error, "Você atingiu o limite de imóveis do seu plano."), { type: "warning" });
        setTimeout(() => router.push(QUOTA_UPSELL_PATH), 1800);
      } else {
        toast(quotaErrorMessage(error, "Não conseguimos registrar as propriedades agora. Tente novamente em alguns instantes."), { type: "error" });
      }
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
      toast("Informe uma diária base válida para todos os imóveis. Sem esse valor, o My Urban não inicia a análise.", { type: "warning" });
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
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <DialogSurface
        onClose={handleClose}
        aria-labelledby="add-property-title"
        className={styles.addPropertyDialog}
      >
        <header
          className={styles.dialogHeader}
        >
          <h2 id="add-property-title" className={styles.dialogTitle}>
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

        <div className={styles.dialogBody}>
          {fetchedProperties.length === 0 ? (
            <div className={styles.stepStack}>
              <p className={styles.introText}>
                Para adicionar imóveis a sua conta, cole abaixo o <strong>link do Airbnb</strong> do seu imóvel
                ou o <strong>link do seu perfil de anfitrião</strong> para importar automaticamente todos os imóveis.
              </p>

              <input
                aria-label="Link do imóvel ou do perfil no Airbnb"
                placeholder="Exemplo: https://www.airbnb.com/rooms/12345678"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className={styles.textInput}
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
            <div className={styles.stepStack}>
              <AppLoadingStatus
                compact
                eyebrow={loadingStatus.eyebrow}
                title={loadingStatus.title}
                body={loadingStatus.body}
                steps={loadingStatus.steps}
                tone={loadingStatus.tone}
              />

              <div
                className={styles.pendingPriceNotice}
                style={{ borderColor: "#FDBA74", background: "#FFF7ED" }}
              >
                <p className={styles.pendingPriceTitle}>Informe a diária base</p>
                <p className={styles.pendingPriceText}>
                  O Airbnb não retornou uma diária confirmada para estes imóveis, ou retornou apenas uma fonte provisória. Informe a diária atual para concluir o cadastro e iniciar a análise.
                </p>
              </div>

              {pendingPricingProperties.map((property) => (
                <div
                  key={property.addressId}
                  className={styles.pendingPropertyRow}
                >
                  {property.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={property.pictureUrl}
                      alt="Capa"
                      className={styles.pendingPropertyThumb}
                    />
                  ) : (
                    <div className={styles.pendingPropertyPlaceholder} style={{ background: "#F3F4F6" }} />
                  )}
                  <div className={styles.propertyInfo}>
                    <p className={styles.propertyName}>
                      {property.propertyName}
                    </p>
                    {property.airbnbId && (
                      <p className={styles.propertyAirbnbId}>
                        {property.airbnbId}
                      </p>
                    )}
                    <p className={styles.pendingFallbackMessage} style={{ color: "#9A3412" }}>
                      {property.fallbackMessage}
                      {property.provisionalDailyPrice
                        ? ` Valor encontrado: ${brl(property.provisionalDailyPrice)} (${property.sourceLabel ?? "fonte não informada"}).`
                        : ` Fonte: ${property.sourceLabel ?? "fonte não informada"}.`}
                    </p>
                  </div>
                  <input
                    aria-label={`Diária base de ${property.propertyName}`}
                    placeholder="R$ 350"
                    inputMode="decimal"
                    value={manualPriceDrafts[property.addressId] ?? ''}
                    onChange={(event) =>
                      setManualPriceDrafts((prev) => ({ ...prev, [property.addressId]: event.target.value }))
                    }
                    disabled={isLoading}
                    className={`${styles.textInput} ${styles.pendingPriceInput}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.stepStack}>
              <p className={styles.resultsSummary}>
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
                className={styles.propertyListScroll}
              >
                <div className={styles.propertyList}>
                  {fetchedProperties.map((prop) => {
                    const selected = selectedProperties[prop.id_do_anuncio] || false;
                    return (
                      <div
                        key={prop.id_do_anuncio}
                        onClick={() => handleToggleProperty(prop.id_do_anuncio, !selected)}
                        className={
                          selected
                            ? `${styles.propertyOption} ${styles.propertyOptionSelected}`
                            : styles.propertyOption
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          aria-label={`Monitorar ${prop.titulo || `anúncio ${prop.id_do_anuncio}`}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => handleToggleProperty(prop.id_do_anuncio, event.target.checked)}
                          className={styles.propertyCheckbox}
                        />

                        {prop.pictureUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={prop.pictureUrl}
                            alt="Capa"
                            className={styles.propertyThumb}
                          />
                        ) : (
                          <div
                            className={styles.propertyThumbPlaceholder}
                            style={{ background: "#F3F4F6", color: "#9CA3AF" }}
                          >
                            Sem foto
                          </div>
                        )}

                        <div className={styles.propertyInfo}>
                          <p className={styles.propertyTitle}>
                            {prop.titulo || `Anúncio #${prop.id_do_anuncio}`}
                          </p>
                          <p className={styles.propertyMeta}>
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
          className={styles.dialogFooter}
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
      </DialogSurface>
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
      body: "Marque os que você quer acompanhar no My Urban.",
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

const iconButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid var(--theme-app-legacy-ink-12)",
  borderRadius: 8,
  background: "var(--theme-app-legacy-white)",
  color: "var(--theme-app-legacy-ink)",
  cursor: "pointer",
};

const ratingStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 999,
  background: "var(--theme-app-legacy-success-10)",
  color: "var(--theme-app-legacy-success)",
  fontSize: "var(--text-xs)",
  fontWeight: 750,
};
