import { PropertyClassifier } from './knn-classifier';

describe('PropertyClassifier', () => {
  describe('when the model is untrained', () => {
    it('returns the Standard fallback instead of crashing', () => {
      const classifier = new PropertyClassifier();

      const result = classifier.classify({
        lat: -23.55,
        lng: -46.63,
        metroDistance: 0.3,
        amenitiesCount: 4,
      });

      expect(result).toEqual({ categoryId: 1, categoryName: 'Standard' });
    });
  });

  describe('after training with labeled properties', () => {
    const trainingSet = [
      { lat: -23.60, lng: -46.70, metroDistance: 2.0, amenitiesCount: 1, category: 0 },
      { lat: -23.59, lng: -46.71, metroDistance: 1.8, amenitiesCount: 1, category: 0 },
      { lat: -23.55, lng: -46.63, metroDistance: 0.4, amenitiesCount: 3, category: 1 },
      { lat: -23.56, lng: -46.64, metroDistance: 0.5, amenitiesCount: 3, category: 1 },
      { lat: -23.57, lng: -46.67, metroDistance: 0.2, amenitiesCount: 8, category: 2 },
      { lat: -23.58, lng: -46.68, metroDistance: 0.3, amenitiesCount: 9, category: 2 },
    ];

    it('classifies a point near the Economico cluster as Economico', () => {
      const classifier = new PropertyClassifier();
      classifier.train(trainingSet);

      const result = classifier.classify({
        lat: -23.60,
        lng: -46.70,
        metroDistance: 2.0,
        amenitiesCount: 1,
      });

      expect(result.categoryName).toBe('Econ\u00f4mico');
      expect(result.categoryId).toBe(0);
    });

    it('classifies a point near the Premium cluster as Premium', () => {
      const classifier = new PropertyClassifier();
      classifier.train(trainingSet);

      const result = classifier.classify({
        lat: -23.57,
        lng: -46.67,
        metroDistance: 0.2,
        amenitiesCount: 9,
      });

      expect(result.categoryName).toBe('Premium');
      expect(result.categoryId).toBe(2);
    });

    it('ignores invalid training rows and still classifies with valid data', () => {
      const classifier = new PropertyClassifier();
      classifier.train([
        { lat: undefined, lng: undefined, metroDistance: 0.2, amenitiesCount: 9, category: 2 },
        ...trainingSet,
      ]);

      const result = classifier.classify({
        lat: -23.57,
        lng: -46.67,
        metroDistance: 0.2,
        amenitiesCount: 9,
      });

      expect(result.categoryName).toBe('Premium');
      expect(result.categoryId).toBe(2);
    });

    it('falls back instead of throwing when the target property has no coordinates', () => {
      const classifier = new PropertyClassifier();
      classifier.train(trainingSet);

      expect(() =>
        classifier.classify({
          lat: undefined,
          lng: undefined,
          metroDistance: 0.2,
          amenitiesCount: 9,
        }),
      ).not.toThrow();

      expect(
        classifier.classify({
          lat: undefined,
          lng: undefined,
          metroDistance: 0.2,
          amenitiesCount: 9,
        }),
      ).toEqual({ categoryId: 1, categoryName: 'Standard' });
    });

    it('falls back when every training row is invalid', () => {
      const classifier = new PropertyClassifier();
      classifier.train([
        { lat: undefined, lng: undefined, metroDistance: 0.2, amenitiesCount: 9, category: 2 },
      ]);

      const result = classifier.classify({
        lat: -23.57,
        lng: -46.67,
        metroDistance: 0.2,
        amenitiesCount: 9,
      });

      expect(result).toEqual({ categoryId: 1, categoryName: 'Standard' });
    });
  });

  describe('getCategoryName', () => {
    it('maps ids 0, 1, 2 to human-readable labels', () => {
      const classifier = new PropertyClassifier();

      expect(classifier.getCategoryName(0)).toBe('Econ\u00f4mico');
      expect(classifier.getCategoryName(1)).toBe('Standard');
      expect(classifier.getCategoryName(2)).toBe('Premium');
    });

    it('returns "Desconhecido" for out-of-range ids', () => {
      const classifier = new PropertyClassifier();

      expect(classifier.getCategoryName(99)).toBe('Desconhecido');
      expect(classifier.getCategoryName(-1)).toBe('Desconhecido');
    });
  });
});

describe('PropertyClassifier — modelo v2 serializável', () => {
  const rows = [
    { lat: -23.60, lng: -46.70, metroDistance: 2.0, amenitiesCount: 1, category: 1, derivedCategory: 0 },
    { lat: -23.59, lng: -46.71, metroDistance: 1.8, amenitiesCount: 1, category: 1, derivedCategory: 0 },
    { lat: -23.57, lng: -46.67, metroDistance: 0.2, amenitiesCount: 8, category: 1, derivedCategory: 2 },
    { lat: -23.58, lng: -46.68, metroDistance: 0.3, amenitiesCount: 9, category: 1, derivedCategory: 2 },
  ];

  it('v2 usa derivedCategory; legado continua usando category', () => {
    const classifier = new PropertyClassifier();
    classifier.train(rows);
    const q = { lat: -23.575, lng: -46.675, metroDistance: 0.25, amenitiesCount: 9 };
    expect(classifier.classify(q).categoryId).toBe(2);
    expect(classifier.classifyLegacy(q).categoryId).toBe(1);
  });

  it('exporta scaler + pontos e reimporta com a mesma predição', () => {
    const a = new PropertyClassifier();
    a.train(rows);
    const model = a.exportModel()!;
    expect(model.version).toBe('knn-model-v2');
    expect(model.scaler.mean).toHaveLength(4);
    expect(model.k).toBe(4); // min(K default 5, n=4)

    const b = new PropertyClassifier();
    b.importModel(JSON.parse(JSON.stringify(model)));
    const q = { lat: -23.595, lng: -46.705, metroDistance: 1.9, amenitiesCount: 1 };
    expect(b.classify(q)).toEqual(a.classify(q));
    expect(() => b.importModel({ ...model, version: 'x' } as any)).toThrow();
  });
});
