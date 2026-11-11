// Offline: do not load Next project config, environment files, or global fetch mocks.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/chat/snooze-offline.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  testMatch: [
    '<rootDir>/__tests__/chat/automation-snooze*.test.*',
    '<rootDir>/__tests__/leads/lead-payment-menus.test.tsx',
    '<rootDir>/__tests__/components/settings/ActivitiesSection.test.tsx',
    '<rootDir>/__tests__/components/settings/activity-*.test.*',
    '<rootDir>/__tests__/components/settings/use-activity-hydration.test.tsx',
    '<rootDir>/__tests__/components/settings/outreach-persistence.test.ts',
    '<rootDir>/__tests__/components/settings/daily-standup-persistence.test.ts',
    '<rootDir>/__tests__/components/settings/icp-lead-generation-persistence.test.ts',
    '<rootDir>/__tests__/components/settings/save-settings-write-dedup.test.ts',
    '<rootDir>/__tests__/chat/resolve-team-member-sender.test.ts',
    '<rootDir>/__tests__/services/conversation-list-items.test.ts',
    '<rootDir>/__tests__/services/conversation-list-query.test.ts',
    '<rootDir>/__tests__/hooks/use-conversation-realtime.test.tsx',
  ],
}