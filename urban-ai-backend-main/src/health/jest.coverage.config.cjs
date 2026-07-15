const { jest: baseConfig } = require('../../package.json');

module.exports = {
  ...baseConfig,
  rootDir: '..',
  testRegex: undefined,
  testMatch: [
    '<rootDir>/health/health.service.spec.ts',
    '<rootDir>/health/health.controller.spec.ts',
    '<rootDir>/admin-job-runs/admin-job-run-tracker.spec.ts',
    '<rootDir>/admin-job-runs/scheduled-job-runner.service.spec.ts',
    '<rootDir>/cron/cron.controller.spec.ts',
  ],
  collectCoverage: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '<rootDir>/health/health.service.ts',
    '<rootDir>/health/health.controller.ts',
    '<rootDir>/admin-job-runs/admin-job-run-tracker.ts',
    '<rootDir>/admin-job-runs/scheduled-job-runner.service.ts',
    '<rootDir>/cron/cron.controller.ts',
  ],
  coverageDirectory: '<rootDir>/../coverage/health-cron',
  coverageReporters: ['text', 'json-summary'],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
