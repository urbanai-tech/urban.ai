import KNN from 'ml-knn';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PropertyClassifier {
    private knn: any;
    private labels: number[];
    private trainingData: number[][];

    constructor() {
        this.knn = null;
        this.labels = [];
        this.trainingData = [];
    }

    /**
     * Prepara os dados para o KNN.
     * Features: [latitude, longitude, proximidade_metro, qualidade_bairro]
     * Labels: 0 (Econômico), 1 (Standard), 2 (Premium/Alta Atratividade)
     */
    train(properties: any[]) {
        this.trainingData = properties.map(p => [
            p.lat,
            p.lng,
            p.metroDistance || 0.5,
            p.amenitiesCount || 1
        ]);

        this.labels = properties.map(p => p.category);
        const k = Math.min(3, Math.max(1, this.trainingData.length));
        if (this.trainingData.length > 0) {
            this.knn = new KNN(this.trainingData, this.labels, { k });
        }
    }

    /**
     * Classifica um novo imóvel ou um imóvel existente no contexto de um evento.
     */
    classify(property: any) {
        if (!this.knn) {
            console.warn("Modelo KNN não treinado. Retornando categoria fallback.");
            return { categoryId: 1, categoryName: "Standard" }; // Fallback
        }

        const input = [
            property.lat,
            property.lng,
            property.metroDistance || 0.5,
            property.amenitiesCount || 1
        ];

        const prediction = this.knn.predict(input);

        return {
            categoryId: prediction,
            categoryName: this.getCategoryName(prediction)
        };
    }

    getCategoryName(id: number) {
        const names = ["Econômico", "Standard", "Premium"];
        return names[id] || "Desconhecido";
    }
}
