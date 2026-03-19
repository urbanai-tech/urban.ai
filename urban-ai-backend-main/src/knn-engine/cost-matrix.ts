import { Injectable } from '@nestjs/common';
import { TravelTimeEngine } from './isochrone';

@Injectable()
export class DisplacementCostMatrix {
    constructor(private travelEngine: TravelTimeEngine) {}

    /**
     * Avalia a "Atratividade" de um imóvel em relação a um evento,
     * balanceando tempo de viagem, custo e conforto.
     */
    async calculateAttractivityScore(property: any, event: any) {
        // Cálculo base de tempo de viagem
        const travelTransit = await this.travelEngine.calculateTravelTime(property, event, 'transit');
        const travelDrive = await this.travelEngine.calculateTravelTime(property, event, 'driving');

        // Seleciona a melhor opção (mais rápida) como referência principal
        const bestTime = Math.min(travelTransit.travelTimeMinutes, travelDrive.travelTimeMinutes);
        
        // Simulação de Custo de Uber/99 (R$ 2.50 por km + base de R$ 5)
        const driveCost = 5 + (travelDrive.distanceKm * 2.5);

        // Score de Atratividade (0 a 100)
        let attractivityScore = 100;

        // Punição por tempo de viagem
        if (bestTime <= 15) {
            attractivityScore -= 0; // Excelente
        } else if (bestTime <= 30) {
            attractivityScore -= 15; // Bom
        } else if (bestTime <= 60) {
            attractivityScore -= 40; // Regular
        } else {
            attractivityScore -= 70; // Ruim/Longe
        }

        // Punição se não houver metrô perto (transit penality)
        if (property.metroDistance > 1.5) {
            attractivityScore -= 10;
        }

        // Garante que fique entre 0 e 100
        attractivityScore = Math.max(0, Math.min(100, attractivityScore));

        return {
            score: attractivityScore,
            travelTime: bestTime,
            estimatedDriveCost: parseFloat(driveCost.toFixed(2)),
            attractivityLevel: this.getAttractivityLabel(attractivityScore)
        };
    }

    getAttractivityLabel(score: number): string {
        if (score >= 80) return "Alta Atratividade";
        if (score >= 50) return "Média Atratividade";
        return "Baixa Atratividade";
    }
}
