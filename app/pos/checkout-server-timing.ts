import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

const stages = ["pos_total", "pos_auth", "pos_references", "checkout_auth",
  "checkout_admission", "checkout_environment", "checkout_attribution",
  "checkout_lines", "checkout_records", "checkout_finalize", "checkout_complete"] as const;
type Stage = typeof stages[number];
const scopes = new AsyncLocalStorage<Map<Stage, number>>();

/** Fixed metric names and durations only; never inputs, errors, IDs or tokens. */
export async function withPosServerTiming<T>(work: () => Promise<T>) {
  const durations = new Map<Stage, number>();
  const value = await scopes.run(durations, () => timePosStage("pos_total", work));
  const serverTiming = stages.filter((stage) => durations.has(stage))
    .map((stage) => `${stage};dur=${durations.get(stage)!.toFixed(1)}`).join(", ");
  return { value, serverTiming };
}

export async function timePosStage<T>(stage: Stage, work: () => Promise<T>): Promise<T> {
  const durations = scopes.getStore();
  if (!durations) return work();
  const start = performance.now();
  try { return await work(); }
  finally {
    if (stages.includes(stage)) durations.set(stage, (durations.get(stage) || 0) + Math.max(0, performance.now() - start));
  }
}

/** Sequential checkout phases also account for early returns and failures. */
export function checkoutStageTimer() {
  const durations = scopes.getStore();
  let current: Stage | undefined;
  let start = performance.now();
  const finish = () => {
    if (durations && current) durations.set(current, (durations.get(current) || 0) + Math.max(0, performance.now() - start));
    current = undefined;
  };
  return {
    stage(stage: Stage) { finish(); current = stages.includes(stage) ? stage : undefined; start = performance.now(); },
    finish,
  };
}