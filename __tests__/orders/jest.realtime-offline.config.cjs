// Deliberately bypass next/jest and project config: no environment files loaded.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { pretendToBeVisual: true },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/orders/use-orders-realtime.test.tsx',
    '<rootDir>/__tests__/orders/use-order-detail-data.test.tsx',
    '<rootDir>/__tests__/shipments/use-shipments-realtime.test.tsx',
  ],
}