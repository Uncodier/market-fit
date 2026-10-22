// Offline: do not load Next project config or environment files.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/chat/message-reads.test.tsx',
    '<rootDir>/__tests__/services/get-conversation-comment-messages.test.ts',
  ],
}