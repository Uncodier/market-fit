// Offline UI contracts: no Next config, environment files or remote providers.
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: ['<rootDir>/__tests__/app/robots/requirement-runner-banner.test.tsx'],
}