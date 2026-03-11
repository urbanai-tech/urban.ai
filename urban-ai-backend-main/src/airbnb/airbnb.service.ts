import { forwardRef, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { PropriedadeService } from 'src/propriedades/propriedade.service';
import { FirstAvailablePriceResult } from './types';

@Injectable()
export class AirbnbService {
    constructor(@Inject(forwardRef(() => PropriedadeService))
    private readonly propriedadeService: PropriedadeService,) { }
    private readonly apiHost = 'airbnb19.p.rapidapi.com';
    private readonly apiKey = 'e8b495920cmsh21fec04b593ce3ep17cb68jsnce9b835f0eef';

  async getAvailability(propertyId: string) {
    const url = `https://${this.apiHost}/api/v1/checkAvailability`;
    const params = { propertyId };
    const headers = {
        'x-rapidapi-host': this.apiHost,
        'x-rapidapi-key': this.apiKey,
    };

    // Função para esperar X milissegundos
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        // Aguarda 1 segundo antes de fazer a requisição
        await sleep(5000);

        const { data } = await axios.get(url, { params, headers });
        return data;
    } catch (error: any) {
        console.error('Erro ao consultar disponibilidade Airbnb:', error.response?.data || error.message);
        throw new InternalServerErrorException({
            status: false,
            message: 'Erro ao consultar disponibilidade no Airbnb',
            details: error.response?.data || error.message,
        });
    }
}


    async getCheckoutPrice(propertyId: string, checkIn: string, checkOut: string) {
        const url = `https://${this.apiHost}/api/v1/getPropertyCheckoutPrice`;
        const params = {
            propertyId,
            currency: 'BRL',
            checkIn,
            checkOut,
        };

        const headers = {
            'x-rapidapi-host': this.apiHost,
            'x-rapidapi-key': this.apiKey,
        };

        try {
            const { data } = await axios.get(url, { params, headers });
            return data;
        } catch (error) {
            console.error('Erro ao consultar preço Airbnb:', error.response?.data || error.message);
            throw new InternalServerErrorException({
                status: false,
                message: 'Erro ao consultar preço no Airbnb',
                details: error.response?.data || error.message,
            });
        }
    }

   async getFirstAvailablePrice(propertyId: string): Promise<FirstAvailablePriceResult> {
    const availability = await this.getAvailability(propertyId);
    const propertyDetails = await this.propriedadeService.getPropertyDetails(propertyId);

    if (!availability?.data?.length) {
        throw new InternalServerErrorException({
            status: false,
            message: 'Não foi encontrada nenhuma disponibilidade para este imóvel',
        });
    }

    let checkIn: string | null = null;
    let checkOut: string | null = null;

    for (const month of availability.data) {
        for (let i = 0; i < month.days.length; i++) {
            const day = month.days[i];

            if (day.available && day.available_for_checkin) {
                checkIn = day.date;
                const minNights = day.min_nights ?? 1;
                const maxNights = day.max_nights ?? 365;

                // procurar checkout dentro do range válido
                for (let j = i + minNights; j <= Math.min(i + maxNights, month.days.length - 1); j++) {
                    const nextDay = month.days[j];
                    if (nextDay.available_for_checkout) {
                        checkOut = nextDay.date;
                        break;
                    }
                }
            }

            if (checkIn && checkOut) break;
        }
        if (checkIn && checkOut) break;
    }

    if (!checkIn || !checkOut) {
        throw new InternalServerErrorException({
            status: false,
            message: 'Nenhuma data válida para check-in e check-out encontrada',
        });
    }

    const price = await this.getCheckoutPrice(propertyId, checkIn, checkOut);
    return { price, propertyDetails };
}

    getFirstAvailablePriceMock_bkp(propertyId: string): Promise<AirbnbResponse> {
        return new Promise((resolve) => {
            const delay = Math.random() * 1000 + 1000;

            setTimeout(() => {
                const dadosAirbnb: AirbnbResponse = {
                    price: {
                        data: {
                            accommodationCost: 350,
                        },
                    },
                    propertyDetails: {
                        bedrooms: 3,
                        bathrooms: 2,
                    },
                };

                resolve(dadosAirbnb);
            }, delay);
        });
    }

}
