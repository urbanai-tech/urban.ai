/**
 * Módulo de Classificação KNN (K-Nearest Neighbors)
 * Agrupa imóveis por "vizinhança de conveniência" e características.
 */

const KNN = require('ml-knn');

class PropertyClassifier {
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
    train(properties) {
        this.trainingData = properties.map(p => [
            p.lat,
            p.lng,
            p.metroDistance,
            p.amenitiesCount
        ]);

        this.labels = properties.map(p => p.category);
        const k = Math.min(3, this.trainingData.length);
        this.knn = new KNN(this.trainingData, this.labels, { k });
    }

    /**
     * Classifica um novo imóvel ou um imóvel existente no contexto de um evento.
     */
    classify(property) {
        if (!this.knn) throw new Error("Modelo KNN não treinado.");

        const input = [
            property.lat,
            property.lng,
            property.metroDistance,
            property.amenitiesCount
        ];

        const prediction = this.knn.predict(input);

        return {
            categoryId: prediction,
            categoryName: this.getCategoryName(prediction)
        };
    }

    getCategoryName(id) {
        const names = ["Econômico", "Standard", "Premium"];
        return names[id] || "Desconhecido";
    }
}

module.exports = PropertyClassifier;
