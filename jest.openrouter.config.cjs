// Offline BYOK web contracts: do not load Next configuration or local credentials.
module.exports = {
  ...require('./jest.robot-runner.config.cjs'),
  setupFilesAfterEnv: ['<rootDir>/__tests__/integrations/openrouter.setup.ts'],
  testMatch: ['<rootDir>/__tests__/integrations/openrouter-*.test.ts', '<rootDir>/__tests__/integrations/openrouter-*.test.tsx'],
}