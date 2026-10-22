// Use the Next transformer without next/jest's config and environment loading.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: ['<rootDir>/__tests__/control-center/data-hook.test.ts'],
}