// Offline regression suite: no Next configuration, credentials or live endpoints.
module.exports = {
  ...require('./jest.robot-runner.config.cjs'),
  testMatch: [
    '<rootDir>/__tests__/components/robots/instance-browser-pagination.test.tsx',
    '<rootDir>/__tests__/components/ui/mobile-primary-buttons.test.tsx',
    '<rootDir>/__tests__/components/robots/instance-browser-data.test.tsx',
    '<rootDir>/__tests__/components/robots/instance-browser-model.test.ts',
    '<rootDir>/__tests__/components/robots/instance-asset-summaries.test.tsx',
    '<rootDir>/__tests__/components/robots/instance-asset-demo.test.ts',
    '<rootDir>/__tests__/app/robots/instance-creation-lifecycle.test.tsx',
  ],
}