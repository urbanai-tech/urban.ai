import KNN from 'ml-knn';
import { Injectable } from '@nestjs/common';
import {
    extractRawFeatures,
    fitKnnScaler,
    KnnScaler,
    resolveKnnK,
    transformKnnFeatures,
} from './knn-features';

export interface KnnClassification {
    categoryId: number;
    categoryName: string;
}

/** Modelo serializável — scaler + pontos normalizados + rótulos + K. */
export interface SerializedKnnModel {
    version: 'knn-model-v2';
    k: number;
    scaler: KnnScaler;
    points: number[][];
    labels: number[];
    trainedAt: string;
}

const CATEGORY_NAMES = ["Econômico", "Standard", "Premium"];

/**
 * Classificador de perfil do imóvel (Econômico / Standard / Premium).
 *
 * Mantém DOIS modelos treinados com o mesmo conjunto:
 *  - **v2** (`classify`): features projetadas para km + z-score ajustado no
 *    treino (ver `knn-features.ts`), K configurável (`PRICING_KNN_K`, default 5)
 *    e voto ponderado por distância (desempate determinístico). Usa o rótulo
 *    `derivedCategory` (ADR relativo ao bairro, ver `knn-labels.ts`) quando
 *    presente; senão `category`.
 *  - **legado** (`classifyLegacy`): exatamente o comportamento antigo
 *    (features cruas, K=3, ml-knn, rótulo `category`). Existe só para que o
 *    motor v1 continue produzindo os mesmos números enquanto
 *    `PRICING_ENGINE_V2` não está ligado — remover quando o v1 for aposentado.
 */
@Injectable()
export class PropertyClassifier {
    private knn: any;
    private labels: number[];
    private trainingData: number[][];
    private model: SerializedKnnModel | null = null;
    private warnedUntrained = false;
    private warnedInvalidInput = false;

    constructor() {
        this.knn = null;
        this.labels = [];
        this.trainingData = [];
    }

    /**
     * Treina os dois modelos.
     * Features: [lat, lng, metroDistance, amenitiesCount]
     * Labels: 0 (Econômico), 1 (Standard), 2 (Premium)
     */
    train(properties: any[]) {
        this.trainLegacy(properties);
        this.trainV2(properties);
    }

    /** Classificação v2 (normalizada). */
    classify(property: any): KnnClassification {
        if (!this.model) {
            this.warnOnce('untrained');
            return this.fallbackCategory();
        }
        const raw = extractRawFeatures(property);
        if (!raw) {
            this.warnOnce('invalid-input');
            return this.fallbackCategory();
        }
        const query = transformKnnFeatures(raw, this.model.scaler);
        const categoryId = this.weightedVote(query, this.model);
        return { categoryId, categoryName: this.getCategoryName(categoryId) };
    }

    /** Classificação legada (features cruas, K=3) — usada só pelo motor v1. */
    classifyLegacy(property: any): KnnClassification {
        if (!this.knn) {
            this.warnOnce('untrained');
            return this.fallbackCategory();
        }

        const input = this.toLegacyFeatureVector(property);
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
        return CATEGORY_NAMES[id] || "Desconhecido";
    }

    /** Exporta o modelo v2 (com o scaler do treino) para persistência/auditoria. */
    exportModel(): SerializedKnnModel | null {
        return this.model ? JSON.parse(JSON.stringify(this.model)) : null;
    }

    /** Carrega um modelo v2 previamente exportado (não altera o legado). */
    importModel(model: SerializedKnnModel) {
        if (!model || model.version !== 'knn-model-v2' || !Array.isArray(model.points)) {
            throw new Error('Modelo KNN inválido ou de versão desconhecida');
        }
        if (model.points.length !== model.labels.length || model.points.length === 0) {
            throw new Error('Modelo KNN inconsistente (pontos x rótulos)');
        }
        this.model = JSON.parse(JSON.stringify(model));
    }

    private trainV2(properties: any[]) {
        const rows = properties
            .map((p) => {
                const derived = Number(p?.derivedCategory);
                const label = Number.isFinite(derived) ? derived : Number(p?.category);
                return { raw: extractRawFeatures(p), label };
            })
            .filter((r) => r.raw && Number.isInteger(r.label) && r.label >= 0 && r.label <= 2);

        if (rows.length === 0) {
            this.model = null;
            return;
        }
        const scaler = fitKnnScaler(rows.map((r) => r.raw!));
        this.model = {
            version: 'knn-model-v2',
            k: resolveKnnK(rows.length),
            scaler,
            points: rows.map((r) => transformKnnFeatures(r.raw!, scaler)),
            labels: rows.map((r) => r.label),
            trainedAt: new Date().toISOString(),
        };
    }

    /**
     * Voto ponderado por 1/(d + eps) entre os K vizinhos mais próximos.
     * Empate (raríssimo com pesos contínuos) → menor categoria (conservador:
     * não "promove" o imóvel a Premium por empate).
     */
    private weightedVote(query: number[], model: SerializedKnnModel): number {
        const dists = model.points.map((p, i) => {
            let s = 0;
            for (let d = 0; d < p.length; d++) s += (p[d] - query[d]) ** 2;
            return { d: Math.sqrt(s), label: model.labels[i], i };
        });
        dists.sort((a, b) => a.d - b.d || a.i - b.i);
        const k = Math.min(model.k, dists.length);
        const votes = [0, 0, 0];
        for (let j = 0; j < k; j++) {
            votes[dists[j].label] += 1 / (dists[j].d + 1e-6);
        }
        let best = 0;
        for (let c = 1; c < votes.length; c++) {
            if (votes[c] > votes[best]) best = c;
        }
        return best;
    }

    private trainLegacy(properties: any[]) {
        const rows = properties
            .map(p => ({
                features: this.toLegacyFeatureVector(p),
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

    private toLegacyFeatureVector(property: any): number[] | null {
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

    private fallbackCategory(): KnnClassification {
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
