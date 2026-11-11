// Offline: do not load Next project config, environment files, or global fetch mocks.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/chat/automation-snooze*.test.*',
    '<rootDir>/__tests__/chat/resolve-team-member-sender.test.ts',
    '<rootDir>/__tests__/services/conversation-list-items.test.ts',
    '<rootDir>/__tests__/services/conversation-list-query.test.ts',
    '<rootDir>/__tests__/hooks/use-conversation-realtime.test.tsx',
  ],
}