// Focused offline cache regressions: no Next config or environment files loaded.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/lib/json-cache*.test.ts',
    '<rootDir>/__tests__/lib/analytics-response-cache.test.ts',
  ],
}