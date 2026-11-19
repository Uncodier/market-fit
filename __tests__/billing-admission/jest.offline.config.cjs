// Do not load next.config or .env files. All service boundaries are mocked.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/billing-admission/*.test.[jt]s?(x)',
    '<rootDir>/__tests__/context/site-billing-hydration.test.ts',
    '<rootDir>/__tests__/context/read-site-billing.test.ts',
  ],
}