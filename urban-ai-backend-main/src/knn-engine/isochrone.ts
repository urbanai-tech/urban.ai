import * as turf from '@turf/turf';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TravelTimeEngine {
    constructor() {}

    /**
     * Simula o cálculo de tempo de viagem usando Turf.js como heurística.
     * Em produção, integra-se via API (GraphHopper, OSRM, Google Maps).
     */
    async calculateTravelTime(origin: any, destination: any, mode: string = 'transit'): Promise<any> {
        const from = turf.point([origin.lng, origin.lat]);
        const to = turf.point([destination.lng, destination.lat]);

        // Distância em km
        const distanceKm = turf.distance(from, to, { units: 'kilometers' });

        // Velocidade média simulada em São Paulo (km/h)
        const speeds: Record<string, number> = {
            driving: 15,
            transit: 20, // Metrô/CBTU é mais rápido em média
            walking: 5,
            bicycling: 12
        };

        const speed = speeds[mode] || speeds.transit;
        let timeHours = distanceKm / speed;

        // Penalidades de trânsito simulado (horário de pico etc poderiam entrar aqui)
        if (mode === 'driving' && distanceKm > 5) {
            timeHours *= 1.5; // Engarrafamento SP
        }

        const timeMinutes = Math.round(timeHours * 60);

        return {
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            travelTimeMinutes: timeMinutes,
            mode: mode
        };
    }

    /**
     * Gera um polígono (isócrona circular) representando a área de alcance em X minutos.
     */
    async generateIsochrone(center: any, maxTimeMinutes: number, mode: string = 'transit'): Promise<any> {
        const speeds: Record<string, number> = { driving: 15, transit: 20, walking: 5, bicycling: 12 };
        const speed = speeds[mode] || speeds.transit;

        // Raio máximo atingível (km)
        const maxDistanceKm = (maxTimeMinutes / 60) * speed;

        const centerPoint = turf.point([center.lng, center.lat]);
        const options = { steps: 32, units: 'kilometers' as turf.Units };
        const isochronePolygon = turf.circle(centerPoint, maxDistanceKm, options);

        return {
            timeLimit: maxTimeMinutes,
            polygon: isochronePolygon
        };
    }
}
