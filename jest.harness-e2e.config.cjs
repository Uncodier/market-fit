// Offline canary-runner tests: no Next config, dotenv, auth, sandbox or paid calls.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/harness-e2e/**/*.test.cjs'],
  transform: {},
};