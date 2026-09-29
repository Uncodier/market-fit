/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}

describe('retired cron status debugging surface', () => {
  it.each([
    'app/api/cron-status/route.ts',
    'app/api/cron-status/route.js',
    'app/components/agents/activities-view.tsx',
  ])('does not restore %s', file => {
    expect(fs.existsSync(path.join(root, file))).toBe(false);
  });

  it('has no application consumers or parallel cron_status storage access', () => {
    const references = ['app', 'lib'].flatMap(directory => sourceFiles(path.join(root, directory)))
      .filter(file => /\/api\/cron-status\b|\bcron_status\b|\bActivitiesView\b|agents\/activities-view\b/.test(fs.readFileSync(file, 'utf8')))
      .map(file => path.relative(root, file));

    // Execution debugging belongs to Temporal metadata, not this retired API/table.
    expect(references).toEqual([]);
  });
});