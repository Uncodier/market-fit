import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Args, SuiteCase } from './agent-runner-types';

const allowedTargets = new Set(['local', 'staging', 'production']);
const manifestPath = 'tests/agent/agent-test-suites.json';

function usage(): never {
  console.error(`Usage:
  npm run agent:verify -- --target <local|staging> --suite <suite-name> [--engine codex]
  npm run agent:verify -- --target <local|staging> --case <case.md> [--engine codex]

Options:
  --engine <codex|claude|command>             Agent CLI to execute, or a comma-separated
                                              fallback chain (e.g. claude,codex) tried
                                              left-to-right on engine crash. Default: codex
  --case-id <id>                              Required when a workflow runs one manifest case
  --required <true|false>                     Required flag for a single manifest case
  --timeout-minutes <minutes>                 Timeout for a single manifest case
  --engine-command-template <shell command>   Test hook; receives AGENT_VERIFICATION_* env vars
  --report-dir <dir>                          Default: agent-test-reports
  --engine-retries <n>                        Must be 0 for mutating cases (default)
  --dry-run                                   Print the selected cases without invoking an agent`);
  process.exit(2);
}

function parseBoolean(value: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  console.error(`Expected true or false, got: ${value}`);
  usage();
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`Expected a positive number, got: ${value}`);
    usage();
  }
  return parsed;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.error(`Expected a non-negative integer, got: ${value}`);
    usage();
  }
  return parsed;
}

// A single engine or a comma-separated fallback chain (claude,codex).
// Trims, drops empties, and dedupes while preserving order.
function parseEngines(value: string): string[] {
  const engines: string[] = [];
  for (const part of value.split(',')) {
    const engine = part.trim();
    if (engine && !engines.includes(engine)) engines.push(engine);
  }
  if (engines.length === 0) {
    console.error(`--engine requires at least one engine, got: ${value}`);
    usage();
  }
  return engines;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    target: process.env.AGENT_VERIFICATION_TARGET,
    caseId: process.env.AGENT_VERIFICATION_CASE_ID,
    caseRequired: process.env.AGENT_VERIFICATION_CASE_REQUIRED
      ? parseBoolean(process.env.AGENT_VERIFICATION_CASE_REQUIRED)
      : undefined,
    caseTimeoutMinutes: process.env.AGENT_VERIFICATION_TIMEOUT_MINUTES
      ? parsePositiveNumber(process.env.AGENT_VERIFICATION_TIMEOUT_MINUTES)
      : undefined,
    engines: parseEngines(process.env.AGENT_VERIFICATION_ENGINE ?? 'codex'),
    reportDir: process.env.AGENT_VERIFICATION_REPORT_DIR ?? 'agent-test-reports',
    dryRun: false,
    engineRetries: process.env.AGENT_VERIFICATION_ENGINE_RETRIES
      ? parseNonNegativeInteger(process.env.AGENT_VERIFICATION_ENGINE_RETRIES)
      : 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) usage();
      index += 1;
      return value;
    };

    switch (arg) {
      case '--target':
        args.target = next();
        break;
      case '--suite':
        args.suite = next();
        break;
      case '--case':
        args.casePath = next();
        break;
      case '--case-id':
        args.caseId = next();
        break;
      case '--required':
        args.caseRequired = parseBoolean(next());
        break;
      case '--timeout-minutes':
        args.caseTimeoutMinutes = parsePositiveNumber(next());
        break;
      case '--engine':
        args.engines = parseEngines(next());
        break;
      case '--engine-command-template':
        args.engineCommandTemplate = next();
        break;
      case '--report-dir':
        args.reportDir = next();
        break;
      case '--engine-retries':
        args.engineRetries = parseNonNegativeInteger(next());
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
      case '-h':
        usage();
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        usage();
    }
  }

  if (!args.target || !allowedTargets.has(args.target)) {
    console.error('Agent verification requires --target local, staging, or production.');
    usage();
  }
  if (!args.suite && !args.casePath) {
    console.error('Agent verification requires --suite or --case.');
    usage();
  }
  if (args.suite && args.casePath) {
    console.error('Use either --suite or --case, not both.');
    usage();
  }
  if (
    !args.casePath &&
    (args.caseId || args.caseRequired !== undefined || args.caseTimeoutMinutes)
  ) {
    console.error('--case-id, --required, and --timeout-minutes require --case.');
    usage();
  }
  if (args.engineCommandTemplate && args.target !== 'local') {
    console.error('--engine-command-template is only allowed with --target local.');
    usage();
  }

  return args;
}

function readSuites(): Record<string, SuiteCase[]> {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${manifestPath} must contain an object of suite names to cases.`);
  }

  const suites: Record<string, SuiteCase[]> = {};
  for (const [suiteName, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) {
      throw new Error(`Suite ${suiteName} must be an array.`);
    }
    suites[suiteName] = value.map((item, index) => normalizeSuiteCase(suiteName, item, index));
  }
  return suites;
}

function normalizeSuiteCase(suiteName: string, item: unknown, index: number): SuiteCase {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Suite ${suiteName} case ${index} must be an object.`);
  }
  const record = item as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) {
    throw new Error(`Suite ${suiteName} case ${index} is missing id.`);
  }
  const id = slugify(record.id);
  if (!id) {
    throw new Error(`Suite ${suiteName} case ${index} has an invalid id.`);
  }
  if (typeof record.case !== 'string' || record.case.length === 0) {
    throw new Error(`Suite ${suiteName} case ${id} is missing case path.`);
  }
  return {
    id,
    case: record.case,
    required: typeof record.required === 'boolean' ? record.required : true,
    timeout_minutes:
      typeof record.timeout_minutes === 'number' && record.timeout_minutes > 0
        ? record.timeout_minutes
        : 30,
  };
}

export function selectedCases(args: Args): SuiteCase[] {
  if (args.casePath) {
    return [
      {
        id: slugify(args.caseId ?? path.basename(args.casePath, path.extname(args.casePath))),
        case: args.casePath,
        required: args.caseRequired ?? true,
        timeout_minutes: args.caseTimeoutMinutes ?? 30,
      },
    ];
  }

  const suites = readSuites();
  const suite = suites[args.suite ?? ''];
  if (!suite) {
    throw new Error(`Unknown agent verification suite: ${args.suite}`);
  }
  return suite;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function commandExists(command: string): boolean {
  const result = spawnSync('bash', ['-c', `command -v ${shellQuote(command)}`], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

