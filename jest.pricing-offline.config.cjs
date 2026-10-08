// Deliberately bypass next/jest: no Next config or environment files are loaded.
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: ['<rootDir>/__tests__/components/billing/*pricing*.test.ts?(x)', '<rootDir>/__tests__/components/billing/billing-form-interval.test.tsx', '<rootDir>/__tests__/components/billing/billing-page-read.test.tsx', '<rootDir>/__tests__/components/billing/downgrade-accounts.test.ts', '<rootDir>/__tests__/context/site-refresh-billing.test.ts', '<rootDir>/__tests__/context/site-billing-hydration.test.ts', '<rootDir>/__tests__/api/sites-read.test.ts', '<rootDir>/__tests__/components/billing-initialization.test.tsx', '<rootDir>/__tests__/context/read-site-billing.test.ts'],
}