// Run only isolated web regressions. Unlike next/jest({ dir }), this does not load .env files or Next config.
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1', '^.*\\.svg$': '<rootDir>/__tests__/catalog/svg-mock.cjs',
    '^server-only$': '<rootDir>/__tests__/catalog/server-only-mock.cjs',
  },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/api/connectors-proxy.test.ts',
    '<rootDir>/__tests__/app/connectors/{access,callback,catalog-reads,connect-account,detail,local-account-recovery,provider-direct-settings,provider-mode,support-publication,tool-access-mode,tool-picker}.test.tsx',
  ],
}