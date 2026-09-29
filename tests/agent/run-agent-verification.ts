import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CaseTiming } from './agent-verification-types';
import type { Args, SuiteCase, CaseResult } from './agent-runner-types';
import { agentEnvironment, parseStatus, targetEnvDefaults, validateAgentEvidence } from './agent-evidence';
import { parseArgs, selectedCases, slugify, timestamp, shellQuote, commandExists } from './agent-options';
import { engineInvocation, runEngineProcess } from './agent-engine';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env'), quiet: true });
dotenv.config({ path: path.resolve('.env.local'), quiet: true });
let runAttemptSeq = 0;

function buildPrompt(params: {
  target: string;
  caseId: string;
  casePath: string;
  reportPath: string;
  caseMarkdown: string;
}): string {
  return `You are executing a Shiplight agent test.

Target environment: ${params.target}
Agent test id: ${params.caseId}
Agent test file: ${params.casePath}

Write the final verification report to this exact path:
${params.reportPath}

The report must include one final exact status line:
Status: PASS
Status: FAIL
or
Status: BLOCKED

Use Status: BLOCKED only when environment, access, credentials, fixtures, or app
startup prevent product verification from starting. Once product verification
starts, return Status: PASS or Status: FAIL.

Execute the case below exactly.

${params.caseMarkdown}
`;
}

/**
 * Prepare a hybrid case's embedded Shiplight UI project (`<case-dir>/ui`) so the
 * agent can run `npx shiplight test` against it. Self-contained here — not in the
 * CI workflow — so it works identically for local, CI, and staging runs, and so a
 * fresh checkout can run a hybrid case without manual setup. A no-op for
 * backend-only cases (no `ui/`). Idempotent: skips the dependency install when
 * `node_modules` is already present, and Playwright's browser install
 * short-circuits once the machine-global cache exists.
 *
 * A setup failure is an expected, per-case blocker — signal it with
 * `{ ok: false, reason }` so the caller records this one case BLOCKED, rather than
 * throwing (which would abort the whole run and skip sibling cases + the summary).
 */
// Bounds a hung npm/Playwright install so a stalled network can't freeze a CI job
// indefinitely (the case-level timeout only wraps the engine subprocess, not setup).
const UI_SETUP_TIMEOUT_MS = 10 * 60 * 1000;

// spawnSync sets status=null (+ error ETIMEDOUT) on timeout; describe both cleanly.
function describeSpawnFailure(r: ReturnType<typeof spawnSync>): string {
  if ((r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT') {
    return `timed out after ${UI_SETUP_TIMEOUT_MS / 60_000}m`;
  }
  return `exit ${r.status}`;
}

function ensureCaseUiSetup(casePath: string): { ok: true } | { ok: false; reason: string } {
  const uiDir = path.join(path.dirname(casePath), 'ui');
  if (!fs.existsSync(path.join(uiDir, 'package.json'))) return { ok: true }; // backend-only case
  const nestedPackage = path.join(uiDir, 'node_modules/shiplightai/package.json');
  if (fs.existsSync(nestedPackage)) {
    const rootVersion = JSON.parse(fs.readFileSync('node_modules/shiplightai/package.json', 'utf8')).version;
    const nestedVersion = JSON.parse(fs.readFileSync(nestedPackage, 'utf8')).version;
    if (nestedVersion !== rootVersion) return { ok: false, reason: 'Nested Shiplight version differs from the repository runner; align the committed dependency before execution' };
  }
  const opts = { cwd: uiDir, stdio: 'inherit', timeout: UI_SETUP_TIMEOUT_MS } as const;

  if (!fs.existsSync(path.join(uiDir, 'node_modules'))) {
    console.log(`[ui-setup] installing dependencies in ${uiDir}`);
    const install = spawnSync('npm', ['ci'], opts);
    if (install.status !== 0) {
      return { ok: false, reason: `dependency install failed in ${uiDir} (${describeSpawnFailure(install)})` };
    }
  }

  console.log(`[ui-setup] ensuring Playwright chromium for ${uiDir}`);
  const browser = spawnSync('npx', ['playwright', 'install', 'chromium'], opts);
  if (browser.status !== 0) {
    return { ok: false, reason: `playwright install failed in ${uiDir} (${describeSpawnFailure(browser)})` };
  }
  return { ok: true };
}

/**
 * Per-target base URLs + provisioning defaults, injected into the agent + YAML env so
 * cases and `ui/` tests stay environment-agnostic — they read `$WEB_URL` / `$ADMIN_URL` /
 * `$E2E_PROVISIONING_URL` / `$E2E_PROVISIONING_TOKEN` instead of hardcoding localhost.
 * `process.env` overrides these, so the staging prep script's secrets
 * (`E2E_PROVISIONING_TOKEN`, `DATABASE_URL`) win over the defaults here.
 */
async function runCase(args: Args, suiteCase: SuiteCase): Promise<CaseResult> {
  // Self-contained per-case setup for hybrid cases (no-op for backend-only ones):
  // ensure the case's embedded Shiplight UI project is installed before the engine
  // runs. Once per case (not per engine attempt), so retries don't reinstall. A
  // setup failure blocks just this case, so sibling cases still run.
  const uiSetup = ensureCaseUiSetup(suiteCase.case);
  if (!uiSetup.ok) {
    console.error(`${suiteCase.id}: UI setup failed — ${uiSetup.reason}`);
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: 'BLOCKED',
      reportPath: '',
      exitCode: null,
      attempts: 0,
    };
  }

  // The test-only shell template hook stays single-engine (local only); the
  // fallback chain applies to named engines.
  const chain = args.engineCommandTemplate ? ['custom-template'] : args.engines;

  let totalAttempts = 0;
  let lastResult: CaseResult | undefined;
  for (const [index, engine] of chain.entries()) {
    const { result, attempts } = await runEngineWithRetries(args, suiteCase, engine);
    totalAttempts += attempts;
    lastResult = result;

    // Only an engine crash is recoverable by another provider. A real verdict
    // (PASS/FAIL/ABORTED/BLOCKED), a missing/garbled report, or a timeout is
    // terminal — re-running it on a different engine would not be honest.
    if (result.status !== 'ENGINE_FAILED') {
      return { ...result, engine, attempts: totalAttempts };
    }

    const nextEngine = chain[index + 1];
    if (nextEngine) {
      console.log(
        `${suiteCase.id}: ${engine} engine failed (exit ${result.exitCode}); ` +
          `falling back to ${nextEngine}`,
      );
    }
  }

  const lastEngine = chain[chain.length - 1];
  return { ...(lastResult as CaseResult), engine: lastEngine, attempts: totalAttempts };
}

// Runs one engine with the configured same-engine retry budget. Returns the
// terminal result for this engine and how many attempts it consumed.
async function runEngineWithRetries(
  args: Args,
  suiteCase: SuiteCase,
  engine: string,
): Promise<{ result: CaseResult; attempts: number }> {
  const maxAttempts = args.engineRetries + 1;
  let result = await runCaseOnce(args, suiteCase, engine);
  let attempt = 1;
  while (result.status === 'ENGINE_FAILED' && attempt < maxAttempts) {
    console.log(
      `${suiteCase.id}: ${engine} engine crashed (exit ${result.exitCode}); ` +
        `retrying attempt ${attempt + 1}/${maxAttempts}`,
    );
    result = await runCaseOnce(args, suiteCase, engine);
    attempt += 1;
  }
  return { result, attempts: attempt };
}

async function runCaseOnce(args: Args, suiteCase: SuiteCase, engine: string): Promise<CaseResult> {
  if (!fs.existsSync(suiteCase.case)) {
    throw new Error(`Agent test does not exist: ${suiteCase.case}`);
  }

  fs.mkdirSync(args.reportDir, { recursive: true });
  runAttemptSeq += 1;
  const reportPath = path.join(
    args.reportDir,
    `${suiteCase.id}-${args.target}-${timestamp()}-${String(runAttemptSeq).padStart(3, '0')}.md`,
  );
  const absoluteReportPath = path.resolve(reportPath);
  const evidencePath = absoluteReportPath.replace(/\.md$/, '.evidence.json');
  const runId = path.basename(absoluteReportPath, '.md');
  const promptPath = path.join(
    os.tmpdir(),
    `${suiteCase.id}-${process.pid}-${Date.now()}.prompt.md`,
  );
  const caseMarkdown = fs.readFileSync(suiteCase.case, 'utf8');
  const prompt = buildPrompt({
    target: args.target ?? '',
    caseId: suiteCase.id,
    casePath: suiteCase.case,
    reportPath: absoluteReportPath,
    caseMarkdown,
  }) + `\nWrite structured JSON evidence to ${evidencePath}.\nRun ID: ${runId}. Site ID: ${process.env.TEST_SITE_ID}.\nUse the schema in tests/agent/agent-evidence.ts. Never reuse evidence from another attempt.\nOnly one exact Status line is permitted, as the final line. A PASS requires persisted channel observations and verified cleanup.\n`;
  fs.writeFileSync(promptPath, prompt);

  const timeoutMs = suiteCase.timeout_minutes * 60 * 1000;
  const env = {
    ...agentEnvironment(process.env),
    ...targetEnvDefaults(args.target ?? ''),
    AGENT_VERIFICATION_TARGET: args.target ?? '',
    AGENT_VERIFICATION_CASE_ID: suiteCase.id,
    AGENT_VERIFICATION_CASE_PATH: path.resolve(suiteCase.case),
    AGENT_VERIFICATION_REPORT_PATH: absoluteReportPath,
    AGENT_VERIFICATION_PROMPT_PATH: promptPath,
    AGENT_VERIFICATION_EVIDENCE_PATH: evidencePath,
    AGENT_VERIFICATION_RUN_ID: runId,
    TEST_PROJECT_ROOT: process.cwd(),
  };

  const engineLabel = args.engineCommandTemplate ? 'custom-template' : path.basename(engine);
  const startedAt = Date.now();
  let exitStatus: number | null;
  let timedOut: boolean;
  let processTiming: Partial<CaseTiming> | undefined;
  try {
    if (args.engineCommandTemplate) {
      // Test-only escape hatch for contract tests and local harness experiments.
      // Release workflows should use named engines, not shell templates.
      const result = spawnSync(
        args.engineCommandTemplate
          .replaceAll('{{prompt_file}}', shellQuote(promptPath))
          .replaceAll('{{report_path}}', shellQuote(absoluteReportPath))
          .replaceAll('{{case_path}}', shellQuote(path.resolve(suiteCase.case))),
        {
          shell: true,
          stdio: 'inherit',
          timeout: timeoutMs,
          env,
        },
      );
      exitStatus = result.status;
      timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
    } else {
      const outcome = await runEngineProcess(
        engine,
        engineInvocation(engine, { prompt, timeoutMinutes: suiteCase.timeout_minutes }),
        { timeoutMs, env, reportPath },
      );
      exitStatus = outcome.status;
      timedOut = outcome.timedOut;
      processTiming = outcome.timing;
    }
  } finally {
    fs.rmSync(promptPath, { force: true });
  }

  // Wall-clock is engine-agnostic; the richer breakdown (tools/llm) rides along
  // only when the engine emitted a stream-json trace we could parse (claude).
  const timing: CaseTiming = { engine: engineLabel, wallMs: Date.now() - startedAt, ...processTiming };

  if (exitStatus !== 0) {
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: timedOut ? 'TIMED_OUT' : 'ENGINE_FAILED',
      reportPath,
      exitCode: exitStatus,
      attempts: 1,
      timing,
    };
  }

  if (!fs.existsSync(reportPath)) {
    return {
      id: suiteCase.id,
      casePath: suiteCase.case,
      required: suiteCase.required,
      status: 'MISSING_REPORT',
      reportPath,
      exitCode: exitStatus,
      attempts: 1,
      timing,
    };
  }

  let status = parseStatus(fs.readFileSync(reportPath, 'utf8'));
  if (status === 'PASS') {
    try {
      validateAgentEvidence(JSON.parse(fs.readFileSync(evidencePath, 'utf8')), {
        runId, target: args.target!, siteId: process.env.TEST_SITE_ID!, startedAt,
      });
    } catch {
      status = 'FAIL';
      console.error(`${suiteCase.id}: missing, stale or invalid structured evidence; refusing PASS`);
    }
  }
  return {
    id: suiteCase.id,
    casePath: suiteCase.case,
    required: suiteCase.required,
    status: status ?? 'MISSING_STATUS',
    reportPath,
    exitCode: exitStatus,
    attempts: 1,
    timing,
  };
}

function writeSummary(args: Args, results: CaseResult[]) {
  fs.mkdirSync(args.reportDir, { recursive: true });
  const suiteOrCase = args.suite ?? slugify(path.basename(args.casePath ?? 'case', '.md'));
  const summaryPath = path.join(
    args.reportDir,
    `agent-verification-summary-${suiteOrCase}-${args.target}-${timestamp()}.json`,
  );
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        target: args.target,
        suite: args.suite,
        case: args.casePath,
        engine: args.engineCommandTemplate ? 'custom-template' : args.engines.join(','),
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote summary: ${summaryPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = selectedCases(args);

  console.log(
    `Agent verification target=${args.target} suite=${args.suite ?? '<single-case>'} cases=${cases.length}`,
  );
  for (const suiteCase of cases) {
    console.log(`- ${suiteCase.id}: ${suiteCase.case}`);
  }

  if (cases.length === 0) throw new Error('Agent suite has no required cases; empty execution is not success');
  if (args.dryRun) {
    return;
  }
  // Validate before installs, engine execution, authentication or fixture mutations.
  targetEnvDefaults(args.target ?? '');
  if (args.engineCommandTemplate) throw new Error('Shell-template execution is disabled for mutating verification');
  if (args.engineRetries !== 0 || args.engines.length !== 1) {
    throw new Error('Agent mutation runs cannot auto-retry or fall back after ambiguous execution');
  }

  if (!args.engineCommandTemplate) {
    // Drop chain engines whose CLI is not installed so a missing fallback does
    // not abort the run; only hard-fail if nothing in the chain is available.
    const present = args.engines.filter((engine) => commandExists(engine));
    for (const engine of args.engines.filter((engine) => !present.includes(engine))) {
      console.warn(`Agent verification engine not found on PATH, skipping: ${engine}`);
    }
    if (present.length === 0) {
      throw new Error(`No agent verification engine found on PATH: ${args.engines.join(', ')}`);
    }
    args.engines = present;
  }

  // Cases run sequentially (CI fans out one case per matrix job); each engine
  // subprocess is awaited so the stream-json timing capture completes in order.
  const results: CaseResult[] = [];
  for (const suiteCase of cases) {
    results.push(await runCase(args, suiteCase));
  }
  writeSummary(args, results);

  let failed = false;
  for (const result of results) {
    const attemptNote = result.attempts > 1 ? ` after ${result.attempts} attempts` : '';
    const engineNote = result.engine && result.engine !== 'custom-template' ? ` via ${result.engine}` : '';
    console.log(`${result.id}: ${result.status}${attemptNote}${engineNote} (${result.reportPath})`);
    if (result.required && result.status !== 'PASS') {
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
