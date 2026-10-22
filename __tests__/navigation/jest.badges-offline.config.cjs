// Deliberately skip next/jest: it loads next.config and .env files.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: ['<rootDir>/__tests__/navigation/badge-*.test.tsx'],
}