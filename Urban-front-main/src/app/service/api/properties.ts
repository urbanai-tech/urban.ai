import { api } from "./client";
import { Connect, CreateAddressDto, List, Address } from "../../types/connect";

export async function getUserManagedListings(
  userId: string,
): Promise<Connect[]> {
  try {
    const { data } = await api.get<Connect[]>(
      `/connect/user-managed-listings/${userId}`,
    );
    return data;
  } catch (error) {
    console.error("Erro ao buscar listings do usuário:", error);
    throw error;
  }
}

/** Busca listagens do usuário com CEP validado pela BrasilAPI */
export type PropertyDropdown = {
  id: string;
  propertyName: string;
  userId: string;
  analisado	: string;
  image_url: string;
  latitude: number;
  longitude: number;
  id_do_anuncio?: string;
  internalNickname?: string | null;
  internalCode?: string | null;
  manualDailyPrice?: number | null;
  averageMonthlyRevenue?: number | null;
  dailyPrice?: number | null;
  pricingInputSource?: string | null;
  pricingInputsUpdatedAt: string | null;
  cep?: string | null;
  numero?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  addressLine?: string | null;
  locationLabel?: string | null;
  setupStatus?: PropertySetupStatus;
  nome: string;
};

function propertyIdentityValue(value?: string | null): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function pushUniquePropertyPart(parts: string[], value?: string | null) {
  const normalized = propertyIdentityValue(value);
  if (!normalized) return;
  const alreadyIncluded = parts.some(
    (part) => part.localeCompare(normalized, "pt-BR", { sensitivity: "accent" }) === 0,
  );
  if (!alreadyIncluded) parts.push(normalized);
}

export function formatPropertyIdentityLabel(property?: Partial<PropertyDropdown> | null): string {
  if (!property) return "Imóvel";
  const parts: string[] = [];
  pushUniquePropertyPart(parts, property.internalNickname);
  pushUniquePropertyPart(parts, property.internalCode);
  pushUniquePropertyPart(parts, property.propertyName);
  pushUniquePropertyPart(parts, property.nome);
  return parts.length > 0 ? parts.join(" - ") : property.id || "Imóvel";
}

export function formatPropertyPrimaryLabel(property?: Partial<PropertyDropdown> | null): string {
  if (!property) return "Imóvel";
  const parts: string[] = [];
  pushUniquePropertyPart(parts, property.internalNickname);
  pushUniquePropertyPart(parts, property.internalCode);
  if (parts.length === 0) {
    pushUniquePropertyPart(parts, property.propertyName);
    pushUniquePropertyPart(parts, property.nome);
  }
  return parts.length > 0 ? parts.join(" - ") : property.id || "Imóvel";
}

export function formatPropertySecondaryLabel(property?: Partial<PropertyDropdown> | null): string | null {
  if (!property) return null;
  const primary = formatPropertyPrimaryLabel(property);
  const rawName = propertyIdentityValue(property.propertyName) || propertyIdentityValue(property.nome);
  if (rawName && rawName.localeCompare(primary, "pt-BR", { sensitivity: "accent" }) !== 0) {
    return rawName;
  }
  return property.locationLabel || property.addressLine || null;
}

export function formatPropertySearchLabel(property?: Partial<PropertyDropdown> | null): string {
  if (!property) return "";
  return [
    formatPropertyIdentityLabel(property),
    property.id_do_anuncio ? `Airbnb ${property.id_do_anuncio}` : null,
    property.locationLabel,
    property.addressLine,
    property.id,
  ]
    .filter(Boolean)
    .join(" ");
}

export type PropertyDetail = {
  id: string;
  cep?: string | null;
  numero?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ativo?: boolean;
  created_at: string;
  updated_at: string;
  analisado?: string;
  list?: {
    id: string;
    titulo: string;
    id_do_anuncio?: string | null;
    internalNickname?: string | null;
    internalCode?: string | null;
    pictureUrl?: string | null;
    priceText?: string | null;
    raw?: number | null;
    currency?: string | null;
    dailyPrice?: number | null;
    manualDailyPrice?: number | null;
    averageMonthlyRevenue?: number | null;
    pricingInputSource?: string | null;
    pricingInputsUpdatedAt: string | null;
    hospedes?: number | null;
    quartos?: number | null;
    camas?: number | null;
    banheiros?: number | null;
    rating?: number | null;
    propertyType?: string | null;
    amenitiesCount?: number | null;
    neighborhood?: string | null;
    reviewCount?: number | null;
    lastScrapedAt: string | null;
  } | null;
};

export type PropertySetupStatus = {
  state: 'preparing' | 'ready' | 'error';
  currentStep: 'map' | 'events' | 'suggestions' | 'ready' | 'attention';
  publicLabel: string;
  publicDescription: string;
  steps: Array<{
    id: 'saved' | 'map' | 'events' | 'suggestions';
    label: string;
    status: 'complete' | 'active' | 'pending' | 'error';
  }>;
};

export type PricingInputHistory = {
  id: string;
  previousManualDailyPrice: number | null;
  newManualDailyPrice: number | null;
  previousAverageMonthlyRevenue: number | null;
  newAverageMonthlyRevenue: number | null;
  source: string;
  changedByUserId: string | null;
  createdAt: string;
};

export type PropertyOccupancyStatus = 'booked' | 'available' | 'blocked' | 'unknown';

export type PropertyOccupancyRecord = {
  id: string;
  date: string;
  status: PropertyOccupancyStatus;
  revenue: number | null;
  listedPrice: number | null;
  currency: string;
  origin: string;
  nightsBooked: number | null;
  trainingReady: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PropertyOccupancyPayload = {
  date: string;
  status: PropertyOccupancyStatus;
  revenue?: number | null;
  listedPrice?: number | null;
  nightsBooked?: number | null;
};

export type PropertyIdentityUpdate = {
  addressId: string;
  listId: string;
  internalNickname: string | null;
  internalCode: string | null;
};

export async function getPropriedadesDropdownList(): Promise<PropertyDropdown[]> {
  try {
    const { data } = await api.get<any[]>("/propriedades/dropdown/list");
    return data;
  } catch (error) {
    console.error("Erro ao buscar propriedades dropdown list:", error);
    throw error;
  }
}

export async function updatePropertyIdentity(
  addressId: string,
  payload: { internalNickname?: string | null; internalCode?: string | null },
): Promise<PropertyIdentityUpdate> {
  const { data } = await api.patch(`/propriedades/${addressId}/identity`, payload);
  return data;
}

export async function updatePropertyPricingInputs(
  addressId: string,
  payload: { manualDailyPrice?: number | null; averageMonthlyRevenue?: number | null },
): Promise<PropertyDropdown> {
  const { data } = await api.patch(`/propriedades/${addressId}/pricing-inputs`, payload);
  return data;
}

export async function getPropertyPricingInputHistory(
  addressId: string,
  limit = 10,
): Promise<PricingInputHistory[]> {
  const { data } = await api.get<PricingInputHistory[]>(
    `/propriedades/${addressId}/pricing-inputs/history`,
    { params: { limit } },
  );
  return data;
}

export async function getPropertyOccupancyHistory(
  addressId: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<PropertyOccupancyRecord[]> {
  const { data } = await api.get<PropertyOccupancyRecord[]>(
    `/propriedades/${addressId}/occupancy`,
    { params },
  );
  return data;
}

export async function upsertPropertyOccupancy(
  addressId: string,
  payload: PropertyOccupancyPayload,
): Promise<PropertyOccupancyRecord> {
  const { data } = await api.post<PropertyOccupancyRecord>(
    `/propriedades/${addressId}/occupancy`,
    payload,
  );
  return data;
}

export async function registerProperties(properties: List[]): Promise<List[]> {
  try {
    const { data } = await api.post<List[]>("/connect/register", properties);
    return data;
  } catch (error) {
    console.error("Erro ao registrar propriedades:", error);
    throw error;
  }
}

export const getUserProperties = async (page = 1, limit = 10) => {
  const response = await api.get(`/propriedades/user/`, {
    params: { page, limit },
  });
  return response.data;
};

export const getPropertyById = async (propertyId: string): Promise<PropertyDetail> => {
  const response = await api.get<PropertyDetail>(`/propriedades/${propertyId}`, {
    headers: { accept: 'application/json' },
  });
  return response.data;
};

export async function getAddressByCep(cep: string): Promise<{
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  service: string;
}> {
  try {
    const cleanCep = cep.replace(/\D/g, "");
    const { data } = await api.get(`/connect/cep/${cleanCep}`);
    return data;
  } catch (error) {
    console.error("Erro ao consultar CEP:", error);
    throw error;
  }
}

/** Cria múltiplos endereços (endpoint correto conforme guia) */
export async function createMultipleAddresses(
  addresses: CreateAddressDto[],
): Promise<Address[]> {
  try {
    const { data } = await api.post<Address[]>(
      "/connect/addresses",
      addresses
    );
    return data;
  } catch (error) {
    console.error("Erro ao criar endereços:", error);
    throw error;
  }
}

interface ProcessResponse {
  status: string;
}

export async function registerProcess(list:any[]
) {

  const body = {
    listIds: list
  }
  try {
    const { data } = await api.post<ProcessResponse>(
      "/processos",
      body
    );
    return data;
  } catch (error) {
    console.error("Erro ao registrar processo:", error);
    throw error;
  }
}
export const resolveAirbnbUrl = async (
  url: string
): Promise<{ finalUrl: string }> => {
  try {
    const { data } = await api.get('/connect/resolve', {
      params: { url },
    });
    return data; // { finalUrl: string }
  } catch (error) {
    console.error('Erro ao resolver URL do Airbnb:', error);
    throw error;
  }
};

export const getPropertyData = async (propertyId: string | undefined): Promise<{
  quantidadePropriedadesAtivas: number;
  lucroProjetadoGeradoPeloUrban: number;
  receitaProjetada: {
    receitaProjetada: number;
    diferencaPercentual: number;
  };
  quantidadeEventos: number;
}> => {
  try {
    const { data } = await api.get(`/dados`, {
      params: { propertyId },
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados da propriedade:', error);
    throw error;
  }
};


export type GetHostInfoResponse = {
  hostId: string | null;
  hostName: string | null;
};

export const getHostId = async (propertyId: string) => {
  try {
    const { data } = await api.get<{ result: GetHostInfoResponse }>(`/propriedades/hostId`, {
      params: { propertyId },
    });

    return data; // Retorna o hostId encontrado
  } catch (error) {
    console.error("Erro ao buscar hostId:", error);
    throw error; // Propaga o erro para ser tratado em outro lugar
  }
};

export type PropertyQuickInfo = {
  propertyId: string;
  title: string;
  pictureUrl: string;
  hostId: string | null;
  hostName: string | null;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  guests: number;
  rating: number;
  isNewListing: boolean;
  reviewCount: number;
  propertyType: string;
  neighborhood: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
  latitude: number | null;
  longitude: number | null;
  amenitiesCount: number;
  amenities: string[];
};

/** Busca info rápida de um imóvel individual (título, imagem, hostId) */
export const getPropertyQuickInfo = async (propertyId: string): Promise<PropertyQuickInfo> => {
  try {
    const { data } = await api.get<PropertyQuickInfo>(`/propriedades/quick-info`, {
      params: { propertyId },
    });
    return data;
  } catch (error) {
    console.error("Erro ao buscar info rápida do imóvel:", error);
    throw error;
  }
};

// ============================
//  USERS / ADDRESSES (CHECK)
// ============================

export type HasAddressResult = {
  hasAddress: boolean;
  count: number;
};

/** GET /users/me/has-address?onlyActive=true|false
 *  Retorna { hasAddress: boolean, count: number } */
export async function getHasAddress(
  onlyActive: boolean = true
): Promise<HasAddressResult> {
  const { data } = await api.get<HasAddressResult>('/users/me/has-address', {
    params: { onlyActive },
  });
  return data;
}

/** Açucar: retorna apenas o boolean */
export async function hasAnyAddress(
  onlyActive: boolean = true
): Promise<boolean> {
  const res = await getHasAddress(onlyActive);
  return res.hasAddress;
}

export const requestDeleteAddress = async (addressId: string) => {
  try {
    const { data } = await api.delete(`/propriedades/address/${addressId}`);
    return data;
  } catch (error) {
    console.error('Erro ao deletar endereço:', error);
    throw error;
  }
};
