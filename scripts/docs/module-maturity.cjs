#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('typescript');
const { ESLint } = require('eslint');
const root = path.resolve(__dirname, '../..');
const guide = path.join(root, 'docs/MODULES.md');
const evidencePath = path.join(root, 'docs/MODULE_MATURITY_EVIDENCE.json');
const configPath = path.join(root, 'docs/MODULE_MATURITY_INPUT.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

// Counts declarations, not assertions, generated YAML steps or successful runs.
// Parameterized declarations count once; runtime expansion is deliberately excluded.
function declarations(file) {
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const cases = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(tree);
      const named = /^(?:it|test)(?:\.(?:skip|only|todo|concurrent|failing|each|serial))*$/.test(expression);
      const each = /^(?:it|test)(?:\.[a-z]+)*\.each\(/.test(expression);
      if ((named || each) && node.arguments.length &&
          (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
        cases.push({ title: node.arguments[0].text, text: node.getText(tree),
          disabled: /\.(skip|todo)\b/.test(expression) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { source, cases };
}

function created(file) {
  const dates = cp.execFileSync('git', ['log', '--all', '--diff-filter=A', '--format=%cs', '--', file],
    { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  return dates[0] || null;
}

function score(module, date, jest, e2e) {
  const age = date ? Math.max(0, (Date.parse(config.asOf) - Date.parse(date)) / 86400000) : null;
  const history = age === null ? null : age >= 180 ? 2 : age >= 90 ? 1.5 : age >= 30 ? 1 : 0.5;
  const unit = jest >= 20 ? 3 : jest >= 5 ? 2 : jest > 0 ? 1 : 0;
  const browser = e2e >= 5 ? 3 : e2e >= 2 ? 2 : e2e > 0 ? 1 : 0;
  // Shared source counts cannot demonstrate use of the consuming screen.
  const count = module.dbKind === 'own' || module.dbKind === 'filtered'
    ? config.database[module.dbKey]?.records : null;
  const persistence = count === null || count === undefined ? null : count >= 100 ? 2 : count >= 10 ? 1.5 : count > 0 ? 1 : 0;
  const weights = [history, unit, browser, persistence];
  const denominator = weights.reduce((sum, item, i) => sum + (item === null ? 0 : [2, 3, 3, 2][i]), 0);
  const value = Math.round(weights.reduce((sum, item) => sum + (item || 0), 0) / denominator * 100) / 10;
  return { value, denominator, components: { history, jest: unit, e2e: browser, database: persistence },
    state: value >= 8 ? 'Strong evidence' : value >= 6 ? 'Established evidence' : value >= 4 ? 'Developing evidence' : 'Limited evidence' };
}

async function qualityEvidence() {
  const eslint = new ESLint({ cwd: root });
  const sources = [...new Set(config.modules.map(item => item.source))];
  const evidence = {};
  for (const source of sources) {
    const absolute = path.join(root, source);
    const files = fs.statSync(absolute).isDirectory() ? walk(absolute).filter(file => /\.[jt]sx?$/.test(file)) : [absolute];
    const eligible = [];
    for (const file of files) if (!await eslint.isPathIgnored(file)) eligible.push(file);
    if (!eligible.length) { evidence[source] = { score: null, files: [] }; continue; }
    const results = await eslint.lintFiles(eligible);
    const filesEvidence = results.map(result => ({
      file: path.relative(root, result.filePath),
      lines: fs.readFileSync(result.filePath, 'utf8').split('\n').length,
      errors: result.errorCount, warnings: result.warningCount, fatal: result.fatalErrorCount,
      rules: [...new Set(result.messages.map(message => message.ruleId || 'parse-error'))].sort(),
    }));
    const errors = filesEvidence.reduce((sum, file) => sum + file.errors, 0);
    const warnings = filesEvidence.reduce((sum, file) => sum + file.warnings, 0);
    const lines = filesEvidence.reduce((sum, file) => sum + file.lines, 0);
    const fatal = filesEvidence.some(file => file.fatal > 0);
    const score = fatal ? 0 : Math.round(Math.max(0, 10 - 100 * (2 * errors + warnings) / lines) * 10) / 10;
    evidence[source] = { score, lines, errors, warnings, files: filesEvidence };
  }
  return evidence;
}

async function generate() {
  const quality = await qualityEvidence();
  const jestFiles = walk(path.join(root, '__tests__')).filter(file => /\.test\.[jt]sx?$/.test(file));
  const browserFiles = walk(path.join(root, 'tests')).filter(file => /\.spec\.ts$/.test(file) &&
    !file.includes('/agent/') && !/(?:example|arch)\.yaml\.spec\.ts$/.test(file));
  const units = jestFiles.map(file => ({ file: path.relative(root, file), ...declarations(file) }));
  const browsers = browserFiles.map(file => ({ file: path.relative(root, file), ...declarations(file) }));
  const modules = config.modules.map(module => {
    const tokens = module.testTokens || [];
    const matchedUnits = units.filter(item => tokens.some(token => item.file.includes(token)) ||
      (module.imports || []).some(prefix => item.source.includes(prefix)));
    const matchedBrowsers = browsers.flatMap(item => {
      const cases = item.cases.filter(test => (module.e2eTokens || []).some(token => item.file.includes(token)) ||
        (module.routes || []).some(route => new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[/"\x27`?\\s]|$)').test(test.text)));
      return cases.length ? [{ file: item.file, cases: cases.length, active: cases.filter(test => !test.disabled).length }] : [];
    });
    const jest = matchedUnits.reduce((sum, item) => sum + item.cases.filter(test => !test.disabled).length, 0);
    const e2e = matchedBrowsers.reduce((sum, item) => sum + item.active, 0);
    const date = created(module.source);
    const database = config.database[module.dbKey] || null;
    const maturity = score(module, date, jest, e2e);
    const codeQuality = quality[module.source];
    const metaScore = codeQuality.score === null ? null : Math.round((0.7 * maturity.value + 0.3 * codeQuality.score) * 10) / 10;
    return { name: module.name, source: module.source, created: date, dbKind: module.dbKind,
      dbKey: module.dbKey, implementation: module.implementation, database, jest, e2e, score: maturity, codeQuality, metaScore,
      jestFiles: matchedUnits.map(item => ({ file: item.file, declarations: item.cases.length,
        active: item.cases.filter(test => !test.disabled).length })), e2eFiles: matchedBrowsers };
  });
  return { asOf: config.asOf, databaseObservedAt: config.databaseObservedAt,
    gitHead: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    definition: 'Static active test declarations; parameterized declarations count once; no execution/passing claim.',
    qualityDefinition: 'ESLint on selected source path only; not full module/security/type/runtime quality.', modules };
}

function matrix(evidence) {
  const intro = [
    '## Module maturation matrix', '',
    `Snapshot: **${evidence.asOf}**. Global Makinari DB counts observed **${evidence.databaseObservedAt}**, using read-only exact COUNT(*) queries; no customer fields were retrieved.`,
    'Creation = earliest addition of the selected source path in available Git history, not product launch or first DB use. Renames/replacements may make this date younger than the original feature.',
    'Jest / E2E = active authored test declarations statically associated by reviewed filename/import or literal route; skipped/todo excluded, parameterized declarations counted once. YAML/generated pairs count only the generated spec. Counts are NOT passing tests or feature coverage percentages.',
    'Association is module-level: shared suite declarations may exercise dependencies or multiple modules. Counts overlap across rows and must not be summed. Demo/mocked/source-contract tests are included in Jest; E2E declarations may include API/RLS journeys, not only UI journeys. See exact file attribution in the evidence JSON.',
    'DB: `own` = primary entity; `filtered` = explicit subset; `shared` = another module/shared configuration source; `none` = no own store identified. Shared counts do not establish screen usage. Deleted/archived/test rows are not distinguished; record volume is not proof of correctness.',
    '**Rubric (evidence index, not functionality/completeness):** history /2: <30 days 0.5, 30–89 1, 90–179 1.5, ≥180 2; Jest /3: 0→0, 1–4→1, 5–19→2, ≥20→3; E2E /3: 0→0, 1→1, 2–4→2, ≥5→3; own/filtered DB /2: 0→0, 1–9→1, 10–99→1.5, ≥100→2.',
    'Score /10 = earned points ÷ applicable maximum ×10. Shared/no-own/unknown DB and unknown history are N/A, excluded—not zero. States: ≥8 Strong, ≥6 Established, ≥4 Developing, <4 Limited evidence. Age/volume favor established modules; this is a heuristic, not a release gate.',
    'Current source state describes the implemented surface, not end-to-end completion; no module-wide pass rate/deployed SHA was established. **Code Quality /10:** ESLint on the selected creation source file (or subtree for directory sources), not all dependencies: max(0, 10 − 100 × (2×errors + warnings)/source lines), rounded to one decimal; fatal parse errors →0, excluded/no source →N/A. This lint-density proxy is not security, architecture, type correctness or functional quality. Exact files/rules/counts are in the evidence JSON.',
    '**Final result — Meta Score /10:** 70% maturation + 30% Code Quality; N/A when quality is unavailable. Rows sort by final Meta Score, highest first; ties use maturation then module name, and N/A remains last. Final evidence state uses the same ≥8/≥6/≥4 thresholds on Meta Score. Generate ascending with `node scripts/docs/module-maturity.cjs --sort=asc`; validate that order with `--check --sort=asc`.',
    'Reproduce locally: `node scripts/docs/module-maturity.cjs --check`. [Inputs and exact DB sources](MODULE_MATURITY_INPUT.json) · [File-level attribution and component scores](MODULE_MATURITY_EVIDENCE.json). Refresh DB inputs explicitly before generating a new snapshot.', '',
    '| Module | Current source state | Created (Git) | Jest | E2E | DB source / exact rows | Final evidence state | Maturation /10 | Code Quality /10 | Final Meta Score /10 |',
    '| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: |',
  ];
  const direction = process.argv.includes('--sort=asc') ? 1 : -1;
  const sorted = [...evidence.modules].sort((a, b) => {
    if (a.metaScore === null && b.metaScore !== null) return 1;
    if (b.metaScore === null && a.metaScore !== null) return -1;
    return direction * ((a.metaScore ?? 0) - (b.metaScore ?? 0)) ||
      direction * (a.score.value - b.score.value) || a.name.localeCompare(b.name, 'en');
  });
  for (const item of sorted) {
    const db = item.database ? `${item.dbKind}: ${item.database.label} / ${item.database.records.toLocaleString('en-US')}` : 'none: N/A';
    const finalState = item.metaScore === null ? 'Not assessed' : item.metaScore >= 8 ? 'Strong evidence' : item.metaScore >= 6 ? 'Established evidence' : item.metaScore >= 4 ? 'Developing evidence' : 'Limited evidence';
    intro.push(`| ${item.name} | ${item.implementation} | ${item.created || 'Unknown'} | ${item.jest} | ${item.e2e} | ${db} | ${finalState} | ${item.score.value.toFixed(1)} | ${item.codeQuality.score?.toFixed(1) ?? 'N/A'} | ${item.metaScore?.toFixed(1) ?? 'N/A'} |`);
  }
  return intro.join('\n') + '\n';
}

async function main() {
const sortArgument = process.argv.find(argument => argument.startsWith('--sort='));
if (sortArgument && !['--sort=asc', '--sort=desc'].includes(sortArgument)) throw new Error('Sort must be asc or desc');
const evidence = await generate();
const output = matrix(evidence);
if (process.argv.includes('--check')) {
  const stored = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  if (JSON.stringify(stored) !== JSON.stringify(evidence) || !fs.readFileSync(guide, 'utf8').endsWith(output)) {
    console.error('Module maturity snapshot is stale. Review inputs and regenerate.'); process.exit(1);
  }
  console.log(`Validated ${evidence.modules.length} module rows and exact test/file attribution.`);
} else {
  const previous = fs.readFileSync(guide, 'utf8').split('## Module maturation matrix')[0].trimEnd();
  fs.writeFileSync(guide, previous + '\n\n' + output);
  fs.writeFileSync(evidencePath, '{\n' + Object.entries(evidence).map(([key, value]) =>
    key === 'modules' ? `"modules": [\n${value.map(item => JSON.stringify(item)).join(',\n')}\n]` : `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n') + '\n}\n');
  console.log(`Generated ${evidence.modules.length} module rows.`);
}
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });