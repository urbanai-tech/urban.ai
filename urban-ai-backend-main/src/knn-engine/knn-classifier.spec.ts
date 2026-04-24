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

      expect(result.categoryName).toBe('Econômico');
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
  });

  describe('getCategoryName', () => {
    it('maps ids 0, 1, 2 to human-readable labels', () => {
      const classifier = new PropertyClassifier();

      expect(classifier.getCategoryName(0)).toBe('Econômico');
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
