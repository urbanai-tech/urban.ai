import { Injectable } from '@nestjs/common';
import { TravelTimeEngine } from './isochrone';
import { PropertyClassifier } from './knn-classifier';
import { DisplacementCostMatrix } from './cost-matrix';

@Injectable()
export class UrbanAIPricingEngine {
    private travelEngine: TravelTimeEngine;
    private classifier: PropertyClassifier;
    private costMatrix: DisplacementCostMatrix;

    constructor() {
        this.travelEngine = new TravelTimeEngine();
        this.classifier = new PropertyClassifier();
        this.costMatrix = new DisplacementCostMatrix(this.travelEngine);
    }

    /**
     * Inicializa o motor com dados históricos/atuais de imóveis.
     */
    initialize(properties: any[]) {
        this.classifier.train(properties);
    }

    /**
     * Lógica Principal: Sugere um preço para um imóvel em um dia de evento.
     */
    async suggestPrice(property: any, event: any, basePrice: number) {
        // 1. Classificação KNN (Perfil do Imóvel)
        const classification = this.classifier.classify(property);
        
        // 2. Análise de Atratividade (Geospatial Intelligence)
        const attractivity = await this.costMatrix.calculateAttractivityScore(property, event);

        // 3. Cálculo do Multiplicador de Preço
        let multiplier = 1.0;

        // Boost por categoria (KNN)
        if (classification.categoryId === 2) multiplier += 0.2; // Premium
        if (classification.categoryId === 1) multiplier += 0.1; // Standard

        // Boost por Atratividade ao Evento
        if (attractivity.score > 80) {
            multiplier += 0.5; // Alta atratividade
        } else if (attractivity.score > 50) {
            multiplier += 0.2;
        }

        // Boost adicional se o tempo de viagem for muito curto (Isócrona < 15min)
        if (attractivity.travelTime <= 15) {
            multiplier += 0.3;
        }

        const suggestedPrice = basePrice * multiplier;

        return {
            propertyId: property.id,
            eventName: event.name,
            basePrice: basePrice,
            suggestedPrice: parseFloat(suggestedPrice.toFixed(2)),
            increasePercentage: Math.round((multiplier - 1) * 100),
            details: {
                classification: classification.categoryName,
                attractivity: attractivity.attractivityLevel,
                travelTimeMinutes: attractivity.travelTime,
                reasoning: `Imóvel classificado como '${classification.categoryName}'. ` +
                           `Acesso ao evento '${event.name}' em ${attractivity.travelTime} min (${attractivity.attractivityLevel}).`
            }
        };
    }
}
