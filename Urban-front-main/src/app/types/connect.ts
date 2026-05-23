// types/connect.ts

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
  cep: string | null;
  numero: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  list: { id: string };
}
