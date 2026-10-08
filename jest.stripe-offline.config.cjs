// No Next config, dotenv, app setup, or credentials are loaded for backend tests.
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^server-only$': '<rootDir>/node_modules/next/dist/compiled/server-only/empty.js',
  },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: ['<rootDir>/__tests__/api/*stripe*.test.ts', '<rootDir>/__tests__/api/webhooks/stripe*.test.ts', '<rootDir>/__tests__/scripts/stripe-annual-prices.test.js'],
}