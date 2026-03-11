// types/connect.ts

/** Dados de endereço enriquecido pela BrasilAPI */
export interface AddressData {
  logradouro: string;
  cidade: string;
  estado: string;
  bairro?: string;
}

/** Interface extendida para listagens com CEP validado */
export interface ConnectWithCep extends Connect {
  cep: string;
  endereco: AddressData;
  cepStatus: 'validado' | 'invalido' | 'nao-encontrado';
  cepData?: any; // Dados brutos da BrasilAPI
}

export interface Connect {
  pictureUrl: string;
  id_do_anuncio: string;
  titulo: string;
  id: number;
  api_id: string;
  host_name: string;
  name: string;
  latitude: number;
  longitude: number;
  price: number;
  bedrooms: number;
  last_updated: string;
}

export interface List {
  pictureUrl: any;
  id?: number;
  titulo: string;
  id_do_anuncio: string;
  ativo: boolean;
}

export interface Address {
  id: string;
  cep: string;
  numero: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  list: { id: string };
}

/** Tipo para criar endereços (sem id) */
export interface CreateAddressDto {
  cep: string;
  numero: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string | null;
  list: { id: string };
}

/** Informações de validação de CEP para comparação */
export interface CepValidation {
  propertyId: string;
  propertyCep: string;
  userCep: string;
  isValid: boolean;
  message?: string;
}
