// No next/jest or environment files. Every database interaction is synthetic.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1', '^server-only$': '<rootDir>/__tests__/orders/server-only-stub.cjs' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/orders/scoped-reads.test.ts',
    '<rootDir>/__tests__/order-lines/scoped-reads.test.ts',
    '<rootDir>/__tests__/orders/location-cache-boundary.test.ts',
    '<rootDir>/__tests__/orders/date-range-cache.test.ts',
    '<rootDir>/__tests__/order-lines/location-cache-boundary.test.ts',
    '<rootDir>/__tests__/order-lines/modifiers.test.ts',
  ],
}