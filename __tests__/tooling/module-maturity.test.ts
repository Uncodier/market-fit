/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const input = JSON.parse(fs.readFileSync(path.join(root, 'docs/MODULE_MATURITY_INPUT.json'), 'utf8'));
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/MODULE_MATURITY_EVIDENCE.json'), 'utf8'));
const guide = fs.readFileSync(path.join(root, 'docs/MODULES.md'), 'utf8');
type ModuleEvidence = {
  name: string; source: string; created: string; dbKind: string; jest: number; e2e: number;
  score: { value: number; denominator: number; components: Record<string, number | null> };
  codeQuality: { score: number | null; lines: number; errors: number; warnings: number; files: { fatal: number }[] };
  metaScore: number | null;
  jestFiles: { file: string; active: number }[]; e2eFiles: { file: string; active: number }[];
};

describe('module maturation evidence contract', () => {
  it('compares every consolidated entry exactly once without Limits paragraphs', () => {
    const names = [...guide.matchAll(/^### (.*?) —/gm)].map(match => match[1]);
    expect(evidence.modules.map((item: ModuleEvidence) => item.name)).toEqual(names);
    expect(new Set(names).size).toBe(names.length);
    expect(guide).not.toMatch(/\*\*(?:Limits|Maturity \/ pending work):/);
    expect(guide.split('\n').length).toBeLessThan(500);
  });

  it('provides real local creation sources and file-level static count attribution', () => {
    for (const entry of evidence.modules as ModuleEvidence[]) {
      expect(fs.existsSync(path.join(root, entry.source))).toBe(true);
      expect(entry.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.jest).toBe(entry.jestFiles.reduce((sum, file) => sum + file.active, 0));
      expect(entry.e2e).toBe(entry.e2eFiles.reduce((sum, file) => sum + file.active, 0));
      for (const file of [...entry.jestFiles, ...entry.e2eFiles]) {
        expect(fs.existsSync(path.join(root, file.file))).toBe(true);
      }
      expect(entry.e2eFiles.some(file => file.file.endsWith('.test.yaml'))).toBe(false);
    }
  });

  it('normalizes grades only by applicable components, excluding shared DB credit', () => {
    for (const entry of evidence.modules as ModuleEvidence[]) {
      const { components, denominator, value } = entry.score;
      const earned = Object.values(components).reduce<number>((sum, points) => sum + (points ?? 0), 0);
      expect(value).toBe(Math.round(earned / denominator * 100) / 10);
      if (entry.dbKind === 'shared' || entry.dbKind === 'none') {
        expect(components.database).toBeNull();
      }
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it('retains only aggregate read-only DB evidence and no claimed execution success', () => {
    for (const metric of Object.values(input.database) as { records: number; query: string }[]) {
      expect(metric.records).toBeGreaterThanOrEqual(0);
      expect(metric.query).toMatch(/^SELECT count\(\*\) FROM public\./);
      expect(metric.query).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\b/);
    }
    expect(evidence.definition).toContain('no execution/passing claim');
    expect(guide).toContain('Counts are NOT passing tests');
  });

  it('orders the final matrix by descending final Meta Score and derives its evidence state', () => {
    const rows = guide.split('## Module maturation matrix')[1].split('\n')
      .filter(line => line.startsWith('| ') && !line.startsWith('| Module') && !line.startsWith('| ---'));
    const values = rows.map(row => Number(row.split('|')[10].trim()));
    expect(values.length).toBe(evidence.modules.length);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    for (const row of rows) {
      const value = Number(row.split('|')[10].trim());
      const state = value >= 8 ? 'Strong evidence' : value >= 6 ? 'Established evidence' : value >= 4 ? 'Developing evidence' : 'Limited evidence';
      expect(row.split('|')[7].trim()).toBe(state);
    }
  });

  it('derives lint quality and the composite score from measured findings', () => {
    for (const entry of evidence.modules as ModuleEvidence[]) {
      const quality = entry.codeQuality;
      if (quality.score === null) { expect(entry.metaScore).toBeNull(); continue; }
      const fatal = quality.files.some(file => file.fatal > 0);
      const expected = fatal ? 0 : Math.round(Math.max(0, 10 - 100 * (2 * quality.errors + quality.warnings) / quality.lines) * 10) / 10;
      expect(quality.score).toBe(expected);
      expect(entry.metaScore).toBe(Math.round((0.7 * entry.score.value + 0.3 * quality.score) * 10) / 10);
    }
  });
});