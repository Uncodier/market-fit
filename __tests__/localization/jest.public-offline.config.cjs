// Run screen localization and related boundaries without loading Next config or environment files.
module.exports = {
  rootDir: require("path").resolve(__dirname, "../.."),
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/__tests__/localization/public-test-setup.cjs"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^server-only$": "<rootDir>/__tests__/catalog/server-only-mock.cjs",
  },
  transform: { "^.+\\.[jt]sx?$": ["next/dist/build/swc/jest-transformer", {}] },
  testMatch: [
    "<rootDir>/__tests__/localization/public-pages.test.tsx",
    "<rootDir>/__tests__/api/social/sync-outstand-accounts.test.ts",
    "<rootDir>/__tests__/api/social-location-boundary.test.ts",
    "<rootDir>/__tests__/config/demo-image-remote-patterns.test.ts",
    "<rootDir>/__tests__/documents/public-document-data-exposure.test.ts",
  ],
}