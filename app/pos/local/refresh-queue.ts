/** Coalesce notifications without losing an invalidation received during a read. */
export function createPosRefreshQueue(refresh: () => Promise<void>) {
  let active = true;
  let running = false;
  let pending = false;
  const request = () => {
    if (!active) return;
    pending = true;
    if (running) return;
    running = true;
    queueMicrotask(async () => {
      try {
        while (active && pending) {
          pending = false;
          await refresh();
        }
      } finally {
        running = false;
      }
    });
  };
  return { request, stop: () => { active = false; pending = false; } };
}