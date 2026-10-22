// No next/jest, environment files, application setup, or network access.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'node',
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: ['<rootDir>/__tests__/security/operational-planning-postgres.test.ts'],
}