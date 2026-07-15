const { jest: baseConfig } = require('../../package.json');

module.exports = {
  ...baseConfig,
  rootDir: '..',
  testRegex: undefined,
  testMatch: [
    '<rootDir>/stays/stays.service.spec.ts',
    '<rootDir>/stays/stays-connector.spec.ts',
    '<rootDir>/stays/stays-auto-apply.service.spec.ts',
  ],
  collectCoverage: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '<rootDir>/stays/stays.service.ts',
    '<rootDir>/stays/stays-connector.ts',
    '<rootDir>/stays/stays-auto-apply.service.ts',
  ],
  coverageDirectory: '<rootDir>/../coverage/stays',
  coverageReporters: ['text', 'json-summary'],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
