import KNN from 'ml-knn';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PropertyClassifier {
    private knn: any;
    private labels: number[];
    private trainingData: number[][];
    private warnedUntrained = false;
    private warnedInvalidInput = false;

    constructor() {
        this.knn = null;
        this.labels = [];
        this.trainingData = [];
    }

    /**
     * Prepara os dados para o KNN.
     * Features: [latitude, longitude, proximidade_metro, qualidade_bairro]
     * Labels: 0 (Economico), 1 (Standard), 2 (Premium/Alta Atratividade)
     */
    train(properties: any[]) {
        const rows = properties
            .map(p => ({
                features: this.toFeatureVector(p),
                category: Number(p.category),
            }))
            .filter(row => row.features && Number.isFinite(row.category));

        this.trainingData = rows.map(row => row.features as number[]);
        this.labels = rows.map(row => row.category);

        const k = Math.min(3, Math.max(1, this.trainingData.length));
        if (this.trainingData.length > 0) {
            this.knn = new KNN(this.trainingData, this.labels, { k });
        } else {
            this.knn = null;
        }
    }

    /**
     * Classifica um novo imóvel ou um imóvel existente no contexto de um evento.
     */
    classify(property: any) {
        if (!this.knn) {
            this.warnOnce('untrained');
            return this.fallbackCategory();
        }

        const input = this.toFeatureVector(property);
        if (!input) {
            this.warnOnce('invalid-input');
            return this.fallbackCategory();
        }

        const prediction = this.knn.predict(input);
        const categoryId = Array.isArray(prediction) ? prediction[0] : prediction;

        return {
            categoryId,
            categoryName: this.getCategoryName(categoryId),
        };
    }

    getCategoryName(id: number) {
        const names = ["Econ\u00f4mico", "Standard", "Premium"];
        return names[id] || "Desconhecido";
    }

    private toFeatureVector(property: any): number[] | null {
        const lat = Number(property?.lat);
        const lng = Number(property?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const metroDistance = Number(property?.metroDistance);
        const amenitiesCount = Number(property?.amenitiesCount);
        return [
            lat,
            lng,
            Number.isFinite(metroDistance) ? metroDistance : 0.5,
            Number.isFinite(amenitiesCount) ? amenitiesCount : 1,
        ];
    }

    private fallbackCategory() {
        return { categoryId: 1, categoryName: "Standard" };
    }

    private warnOnce(reason: 'untrained' | 'invalid-input') {
        if (reason === 'untrained') {
            if (this.warnedUntrained) return;
            this.warnedUntrained = true;
            console.warn("Modelo KNN não treinado. Retornando categoria fallback.");
            return;
        }

        if (this.warnedInvalidInput) return;
        this.warnedInvalidInput = true;
        console.warn("Entrada KNN sem coordenadas validas. Retornando categoria fallback.");
    }
}
