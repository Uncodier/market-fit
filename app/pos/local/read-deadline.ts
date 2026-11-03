/** Bounds read-only UI hydration. Late data is discarded, never applied. */
export async function readPosLocalWithDeadline<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Local POS read timed out")), 8_000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}