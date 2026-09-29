import type { CaseTiming } from './agent-verification-types';

export type AgentStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'ABORTED';

export type SuiteCase = {
  id: string;
  case: string;
  required: boolean;
  timeout_minutes: number;
};

export type Args = {
  target?: string;
  suite?: string;
  casePath?: string;
  caseId?: string;
  caseRequired?: boolean;
  caseTimeoutMinutes?: number;
  engines: string[];
  engineCommandTemplate?: string;
  reportDir: string;
  dryRun: boolean;
  engineRetries: number;
};

// Timing-profile shapes (ToolTiming, CaseTiming) live in ./agent-verification-types
// so the runner and aggregator share one definition.

export type CaseResult = {
  id: string;
  casePath: string;
  required: boolean;
  status: AgentStatus | 'MISSING_REPORT' | 'MISSING_STATUS' | 'ENGINE_FAILED' | 'TIMED_OUT';
  reportPath: string;
  exitCode: number | null;
  attempts: number;
  // Engine that produced the terminal result (after any cross-engine fallback).
  engine?: string;
  timing?: CaseTiming;
};

