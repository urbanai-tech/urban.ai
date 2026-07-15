const { jest: baseConfig } = require('./package.json');

module.exports = {
  ...baseConfig,
  rootDir: 'src',
  collectCoverageFrom: [
    'knn-engine/backtesting.ts',
    'payments/stripe-price-id.resolver.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
