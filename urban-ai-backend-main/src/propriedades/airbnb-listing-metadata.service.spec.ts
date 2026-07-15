import axios from 'axios';
import { AirbnbListingMetadataService } from './airbnb-listing-metadata.service';

jest.mock('axios');

describe('AirbnbListingMetadataService', () => {
    const service = new AirbnbListingMetadataService();
    const axiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

    afterEach(() => {
        jest.restoreAllMocks();
        axiosGet.mockReset();
    });

    it('normalizes exact and case-insensitive property types without changing unknown values', () => {
        expect(service.translatePropertyType('Entire rental unit')).toBe('Apartamento inteiro');
        expect(service.translatePropertyType('studio')).toBe('Estúdio');
        expect(service.translatePropertyType('Ryokan')).toBe('Ryokan');
    });

    it('projects Nominatim data and converts a Brazilian state to its abbreviation', async () => {
        jest.spyOn(console, 'log').mockImplementation();
        axiosGet.mockResolvedValue({
            data: {
                address: {
                    road: 'Rua Harmonia',
                    suburb: 'Vila Madalena',
                    city: 'São Paulo',
                    state: 'São Paulo',
                    postcode: '05435-000',
                },
                display_name: 'Rua Harmonia, Vila Madalena, São Paulo',
            },
        } as any);

        await expect(service.reverseGeocode(-23.556, -46.69)).resolves.toEqual({
            street: 'Rua Harmonia',
            neighborhood: 'Vila Madalena',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '05435-000',
            fullAddress: 'Rua Harmonia, Vila Madalena, São Paulo',
        });
        expect(axiosGet).toHaveBeenCalledWith(
            expect.stringContaining('lat=-23.556&lon=-46.69'),
            {
                headers: { 'User-Agent': 'UrbanAI/1.0 (contact@myurbanai.com)' },
                timeout: 10000,
            },
        );
    });

    it('keeps the importer resilient when reverse geocoding fails', async () => {
        jest.spyOn(console, 'warn').mockImplementation();
        axiosGet.mockRejectedValue(new Error('timeout'));

        await expect(service.reverseGeocode(-23.556, -46.69)).resolves.toEqual({
            street: '',
            neighborhood: '',
            city: '',
            state: '',
            zipCode: '',
            fullAddress: '',
        });
    });
});
