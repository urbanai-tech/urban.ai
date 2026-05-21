'use client';

import React, { useState } from 'react';
import { AppButton, useToastCompat } from './ui';
import {
  getUserManagedListings,
  getPropriedadesDropdownList,
  registerProperties,
  resolveAirbnbUrl,
  getPropertyQuickInfo,
  createMultipleAddresses,
  registerProcess,
} from '../service/api';

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
  onSuccess: () => void;
}

const quotaErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as any)?.response?.data;
  if (data?.code === 'LISTINGS_QUOTA_EXCEEDED') {
    return data.message || 'Sua quota de imoveis foi atingida. Aumente sua assinatura para continuar.';
  }
  return fallback;
};

export function AddPropertyModal({ isOpen, onClose, onSuccess }: AddPropertyModalProps) {
  const toast = useToastCompat();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedProperties, setFetchedProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, boolean>>({});

  const resetState = () => {
    setInputValue('');
    setFetchedProperties([]);
    setSelectedProperties({});
    setIsLoading(false);
  };

  const handleClose = () => {
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
      toast("Por favor, insira o link de um imovel ou do perfil Airbnb.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    setFetchedProperties([]);

    try {
      const existingProps = await getPropriedadesDropdownList();
      const existingIds = existingProps.map((p) => p.id_do_anuncio).filter(Boolean);

      let finalUrl = inputValue.trim();
      if (finalUrl.includes('airbnb.com/h/') || finalUrl.includes('abnb.me')) {
        try {
          const resolved = await resolveAirbnbUrl(finalUrl);
          finalUrl = resolved.finalUrl;
        } catch {}
      }

      const userId = extractAirbnbUserId(finalUrl);
      if (userId) {
        const listings = await getUserManagedListings(userId);

        if (!listings || listings.length === 0) {
          toast("Nao encontramos imoveis neste perfil.", { type: "warning" });
          setIsLoading(false);
          return;
        }

        const filteredListings = listings.filter((item: any) => !existingIds.includes(item.id_do_anuncio));

        if (filteredListings.length === 0) {
          toast("Todos os imoveis deste perfil ja estao cadastrados em sua conta.", { type: "info" });
          setIsLoading(false);
          return;
        }

        const mapped: Property[] = filteredListings.map((item: any) => ({
          id: item.id || 0,
          titulo: item.titulo ?? item.name ?? 'Sem titulo',
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
        setIsLoading(false);
        return;
      }

      let propertyId = extractAirbnbPropertyId(finalUrl);
      const editorId = extractAirbnbListingId(finalUrl);
      if (editorId) {
        propertyId = editorId;
      }

      if (!propertyId) {
        toast("Nao foi possivel identificar o ID do imovel no link fornecido.", { type: "error" });
        setIsLoading(false);
        return;
      }

      if (existingIds.includes(propertyId)) {
        toast("Este imovel ja esta cadastrado em sua conta.", { type: "info" });
        setIsLoading(false);
        return;
      }

      const info = await getPropertyQuickInfo(propertyId);
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
    } catch (error) {
      console.error(error);
      toast("Ocorreu um erro ao buscar o(s) imovel(is).", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleProperty = (id: string, checked: boolean) => {
    setSelectedProperties((prev) => ({ ...prev, [id]: checked }));
  };

  const handleSaveProperties = async () => {
    const selectedList = fetchedProperties.filter((p) => selectedProperties[p.id_do_anuncio]);
    if (selectedList.length === 0) {
      toast("Selecione pelo menos um imovel para adicionar.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    try {
      const payload = selectedList.map((p) => ({ ...p, ativo: true }));
      const registered = await registerProperties(payload as any);
      const registeredProperties = Array.isArray((registered as any)?.data)
        ? (registered as any).data
        : (registered as any);

      const addressesToRegister = registeredProperties.map((prop: any) => ({
        cep: '00000-000',
        numero: 'S/N',
        logradouro: 'A definir',
        bairro: 'A definir',
        cidade: 'A definir',
        estado: null,
        list: { id: prop.id_do_anuncio },
      }));

      await createMultipleAddresses(addressesToRegister);

      const processListIds = registeredProperties
        .map((prop: any) => prop?.id)
        .filter(Boolean)
        .map((id: string) => ({ id }));

      if (processListIds.length > 0) {
        await registerProcess(processListIds);
      }

      toast(`${selectedList.length} propriedade(s) registrada(s) com sucesso!`, { type: "success" });
      onSuccess();
      handleClose();
    } catch (error) {
      console.error(error);
      toast(quotaErrorMessage(error, "Erro ao registrar as propriedades."), { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

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
            Adicionar imovel
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
                Para adicionar propriedades a sua conta, cole abaixo o <strong>link do Airbnb</strong> do seu imovel
                ou o <strong>link do seu perfil de anfitriao</strong> para importar automaticamente todos os imoveis.
              </p>

              <input
                placeholder="Exemplo: https://www.airbnb.com/rooms/12345678"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                style={inputStyle}
              />

              <AppButton
                type="button"
                size="lg"
                fullWidth
                onClick={handleFetchProperties}
                loading={isLoading}
              >
                Buscar propriedades
              </AppButton>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontWeight: 650 }}>
                Encontramos {fetchedProperties.length} imovel(is) elegivel(is). Selecione os que deseja monitorar e atualizar:
              </p>

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
                            {prop.titulo || `Anuncio #${prop.id_do_anuncio}`}
                          </p>
                          <p style={{ margin: "4px 0 0", color: "rgba(14,17,22,0.62)", fontSize: 13, lineHeight: 1.45 }}>
                            {prop.propertyType || 'Inteiro'} - {prop.guests} hospedes
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
            disabled={isLoading}
          >
            Cancelar
          </AppButton>

          {fetchedProperties.length > 0 && (
            <AppButton
              type="button"
              onClick={handleSaveProperties}
              loading={isLoading}
              disabled={!Object.values(selectedProperties).some(Boolean)}
            >
              Adicionar selecionados
            </AppButton>
          )}
        </footer>
      </section>
    </div>
  );
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
