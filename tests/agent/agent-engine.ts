import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { CaseTiming, ToolTiming } from './agent-verification-types';

type EngineInvocation = { args: string[]; input?: string };

// argv (and whether the prompt goes on stdin) for each named engine.
export function engineInvocation(
  engine: string,
  ctx: { prompt: string; timeoutMinutes: number },
): EngineInvocation {
  switch (path.basename(engine)) {
    case 'codex':
      return { args: ['exec', '--sandbox', 'workspace-write', '-'], input: ctx.prompt };
    case 'claude':
      return {
        args: [
          '--print',
          '--output-format',
          'stream-json',
          '--include-partial-messages',
          '--include-hook-events',
          '--verbose',
          '--permission-mode',
          'default',
        ],
        input: ctx.prompt,
      };
    default:
      console.warn(
        `Unknown agent verification engine "${engine}"; invoking it with stdin and no extra arguments.`,
      );
      return { args: [], input: ctx.prompt };
  }
}

// Coarse "where did the time go" bucket for a tool, by tool name.
function categorizeTool(name: string): string {
  if (name.startsWith('mcp__')) return 'mcp'; // shiplight MCP — browser/DB automation
  if (name === 'Bash') return 'shell';
  if (['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep', 'LS'].includes(name)) {
    return 'file';
  }
  return 'other';
}

type ProcessOutcome = { status: number | null; timedOut: boolean; timing?: Partial<CaseTiming> };

// Spawns a named engine, piping the prompt on stdin when the invocation uses it,
// and enforcing the case timeout with a SIGKILL. For claude (the only engine
// that emits a machine-readable stream-json trace) it also tees stdout to a
// `.stream.jsonl` sidecar and times each tool call by stamping line arrivals,
// producing the per-step timing breakdown.
export function runEngineProcess(
  engine: string,
  invocation: EngineInvocation,
  ctx: { timeoutMs: number; env: NodeJS.ProcessEnv; reportPath: string },
): Promise<ProcessOutcome> {
  const profile = path.basename(engine) === 'claude';
  const streamPath: string | undefined = undefined;
  // Buffered (async) write stream rather than a synchronous writeSync per line:
  // claude runs with --include-partial-messages, so the trace is a high-rate
  // flood of token-delta lines, and a blocking syscall on each one would sit on
  // the readline hot path and inflate the very wallMs the profiler measures.
  const streamFile = streamPath ? fs.createWriteStream(streamPath) : undefined;
  // A trace-write error must never crash the run, but surface it so a full disk
  // or bad path doesn't yield a silently-missing .stream.jsonl.
  streamFile?.on('error', (err) =>
    console.warn(`agent verification: failed writing ${streamPath}: ${err.message}`),
  );

  // Tool spans keyed by tool_use id, aggregated per tool name. Result-event
  // fields (whole-case wall/api time) come from claude's final summary line.
  const toolStarts = new Map<string, { name: string; startedAt: number }>();
  const toolAgg = new Map<string, ToolTiming>();
  const resultEvent: Pick<CaseTiming, 'reportedWallMs' | 'apiMs' | 'numTurns' | 'costUsd'> = {};

  const onLine = (line: string) => {
    // Parse timing in memory only. Raw tool output can contain credentials/PII.
    const now = Date.now();
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      return; // non-JSON progress line; nothing to time
    }
    if (!event || typeof event !== 'object') return;
    const record = event as { type?: unknown; message?: { content?: unknown } };
    const content = Array.isArray(record.message?.content) ? record.message?.content : [];
    if (record.type === 'assistant') {
      for (const block of content as Array<Record<string, unknown>>) {
        if (block?.type === 'tool_use' && typeof block.id === 'string') {
          toolStarts.set(block.id, { name: String(block.name ?? 'unknown'), startedAt: now });
        }
      }
    } else if (record.type === 'user') {
      for (const block of content as Array<Record<string, unknown>>) {
        if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
          const start = toolStarts.get(block.tool_use_id);
          if (!start) continue;
          toolStarts.delete(block.tool_use_id);
          const agg = toolAgg.get(start.name) ?? {
            name: start.name,
            category: categorizeTool(start.name),
            count: 0,
            totalMs: 0,
          };
          agg.count += 1;
          agg.totalMs += Math.max(0, now - start.startedAt);
          toolAgg.set(start.name, agg);
        }
      }
    } else if (record.type === 'result') {
      const r = event as Record<string, unknown>;
      if (typeof r.duration_ms === 'number') resultEvent.reportedWallMs = r.duration_ms;
      if (typeof r.duration_api_ms === 'number') resultEvent.apiMs = r.duration_api_ms;
      if (typeof r.num_turns === 'number') resultEvent.numTurns = r.num_turns;
      if (typeof r.total_cost_usd === 'number') resultEvent.costUsd = r.total_cost_usd;
    }
  };

  return new Promise<ProcessOutcome>((resolve) => {
    const child = spawn(engine, invocation.args, {
      stdio: [invocation.input === undefined ? 'ignore' : 'pipe', profile ? 'pipe' : 'ignore', 'ignore'],
      env: ctx.env,
      detached: process.platform !== 'win32',
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // Kill shell/browser descendants too; a timed-out case must not keep mutating.
      if (process.platform !== 'win32' && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      } else child.kill('SIGKILL');
    }, ctx.timeoutMs);

    if (invocation.input !== undefined && child.stdin) {
      child.stdin.on('error', () => {}); // swallow EPIPE if the engine exits early
      child.stdin.write(invocation.input);
      child.stdin.end();
    }

    let rl: readline.Interface | undefined;
    if (profile && child.stdout) {
      rl = readline.createInterface({ input: child.stdout });
      rl.on('line', onLine);
    }

    // Resolve only once both the process has exited and the stream has fully
    // drained, so a trailing tool_result/result line is not lost to a race.
    let exitStatus: number | null = null;
    let processClosed = false;
    let streamClosed = !rl;
    let settled = false;
    const maybeFinish = () => {
      if (settled || !processClosed || !streamClosed) return;
      settled = true;
      clearTimeout(timer);
      const outcome: ProcessOutcome = { status: exitStatus, timedOut };
      if (profile) {
        // Note: a SIGKILL'd (timed-out) run can leave an in-flight tool_use with
        // no matching tool_result; that span stays in toolStarts unmatched, so
        // toolTotalMs undercounts for timed-out cases. Acceptable — the profile
        // is a guide for perf work, and timed-out runs are flagged TIMED_OUT.
        const tools = [...toolAgg.values()].sort((a, b) => b.totalMs - a.totalMs);
        const toolTotalMs = tools.reduce((sum, t) => sum + t.totalMs, 0);
        const byCategoryMs: Record<string, number> = {};
        for (const t of tools) byCategoryMs[t.category] = (byCategoryMs[t.category] ?? 0) + t.totalMs;
        if (resultEvent.apiMs !== undefined) byCategoryMs.llm = resultEvent.apiMs;
        outcome.timing = { ...resultEvent, tools, toolTotalMs, byCategoryMs, streamPath };
      }
      // Flush the buffered trace before resolving so the sidecar is complete by
      // the time the caller reads it.
      if (streamFile) {
        streamFile.end(() => resolve(outcome));
      } else {
        resolve(outcome);
      }
    };

    rl?.on('close', () => {
      streamClosed = true;
      maybeFinish();
    });
    child.on('error', () => {
      // Spawn failure: no exit code, nothing more to drain.
      exitStatus = null;
      processClosed = true;
      streamClosed = true;
      maybeFinish();
    });
    child.on('close', (code) => {
      exitStatus = code;
      processClosed = true;
      maybeFinish();
    });
  });
}

