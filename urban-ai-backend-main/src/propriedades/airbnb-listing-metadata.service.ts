import { Injectable } from '@nestjs/common';
import axios from 'axios';

export type ReverseGeocodeResult = {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    fullAddress: string;
};

const EMPTY_GEOCODE: ReverseGeocodeResult = {
    street: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    fullAddress: '',
};

/** Normalizes read-only metadata collected while importing an Airbnb listing. */
@Injectable()
export class AirbnbListingMetadataService {
    private static readonly PROPERTY_TYPE_PT: Record<string, string> = {
        'Entire home': 'Casa inteira',
        'Entire rental unit': 'Apartamento inteiro',
        'Rental unit': 'Apartamento',
        'Entire serviced apartment': 'Apartamento com serviços',
        'Serviced apartment': 'Apartamento com serviços',
        'Private room': 'Quarto privado',
        'Shared room': 'Quarto compartilhado',
        'Entire villa': 'Villa inteira',
        'Entire condo': 'Condomínio inteiro',
        'Condo': 'Condomínio',
        'Entire loft': 'Loft inteiro',
        'Loft': 'Loft',
        'Entire guest suite': 'Suíte completa',
        'Guest suite': 'Suíte',
        'Entire place': 'Espaço inteiro',
        'Entire cottage': 'Chalé inteiro',
        'Cottage': 'Chalé',
        'Entire cabin': 'Cabana inteira',
        'Cabin': 'Cabana',
        'Entire bungalow': 'Bangalô inteiro',
        'Bungalow': 'Bangalô',
        'Tiny home': 'Mini casa',
        'Treehouse': 'Casa na árvore',
        'Houseboat': 'Barco-casa',
        'Home': 'Casa',
        'Room in a hotel': 'Quarto de hotel',
        'Room in a bed and breakfast': 'Quarto em pousada',
        'Room in a boutique hotel': 'Quarto em hotel boutique',
        'Aparthotel': 'Aparthotel',
        'Apartment': 'Apartamento',
        'Studio': 'Estúdio',
        'Guesthouse': 'Casa de hóspedes',
        'Farm stay': 'Estadia na fazenda',
        'Townhouse': 'Sobrado',
        'Castle': 'Castelo',
        'Boat': 'Barco',
        'Camper/RV': 'Trailer',
        'Tent': 'Barraca',
        'Yurt': 'Yurt',
        'Apartamento': 'Apartamento',
        'Casa': 'Casa',
    };

    private static readonly STATE_ABBR: Record<string, string> = {
        'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
        'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF',
        'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA',
        'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
        'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE',
        'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
        'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR',
        'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE',
        'Tocantins': 'TO',
    };

    translatePropertyType(propertyType: string): string {
        const exact = AirbnbListingMetadataService.PROPERTY_TYPE_PT[propertyType];
        if (exact) return exact;

        const key = Object.keys(AirbnbListingMetadataService.PROPERTY_TYPE_PT)
            .find((candidate) => candidate.toLowerCase() === propertyType.toLowerCase());
        return key ? AirbnbListingMetadataService.PROPERTY_TYPE_PT[key] : propertyType;
    }

    async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=pt-BR`;
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'UrbanAI/1.0 (contact@myurbanai.com)' },
                timeout: 10000,
            });

            const address = data.address || {};
            const street = address.road || address.pedestrian || address.footway || '';
            const neighborhood = address.suburb || address.neighbourhood || address.city_district || '';
            const city = address.city || address.town || address.municipality || address.village || '';
            const stateRaw = address.state || '';
            const state = AirbnbListingMetadataService.STATE_ABBR[stateRaw] || stateRaw;
            const zipCode = address.postcode || '';
            const fullAddress = data.display_name || '';

            console.log(`📍 [geocode] ${lat},${lng} → ${street}, ${neighborhood}, ${city}-${state} ${zipCode}`);
            return { street, neighborhood, city, state, zipCode, fullAddress };
        } catch (err: any) {
            console.warn(`⚠️ [geocode] Falha no reverse geocoding: ${err.message}`);
            return { ...EMPTY_GEOCODE };
        }
    }
}
