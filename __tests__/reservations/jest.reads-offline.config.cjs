// Do not use next/jest here: it loads Next configuration and environment files.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1', '\\.(css)$': 'next/dist/build/jest/object-proxy' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: ['<rootDir>/__tests__/reservations/*read*.test.[jt]s?(x)'],
}