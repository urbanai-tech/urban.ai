const { jest: baseConfig } = require('../../package.json');

module.exports = {
  ...baseConfig,
  rootDir: '..',
  testMatch: ['<rootDir>/auth/auth.service.spec.ts', '<rootDir>/auth/password-hashing.spec.ts'],
  testRegex: undefined,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          ...require('../../tsconfig.spec.json').compilerOptions,
          inlineSourceMap: true,
          inlineSources: true,
        },
      },
    ],
  },
  collectCoverage: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '<rootDir>/auth/auth.service.ts',
    '<rootDir>/auth/password-hashing.ts',
  ],
  coverageDirectory: '<rootDir>/../coverage/auth',
  coverageReporters: ['text', 'json', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
