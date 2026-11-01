/** Lazy fixture RPC with the same cancellation entry point as PostgREST. */
export class AbortableDemoRpc<T> implements PromiseLike<T> {
  constructor(private readonly run: (signal?: AbortSignal) => Promise<T>, private readonly signal?: AbortSignal) {}

  abortSignal(signal: AbortSignal): AbortableDemoRpc<T> {
    return new AbortableDemoRpc(this.run, signal);
  }

  private async execute(): Promise<T> {
    if (this.signal?.aborted) throw new DOMException("Demo RPC aborted", "AbortError");
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(new DOMException("Demo RPC aborted", "AbortError"));
      this.signal?.addEventListener("abort", onAbort, { once: true });
    });
    try {
      return await Promise.race([this.run(this.signal), aborted]);
    } finally {
      if (onAbort) this.signal?.removeEventListener("abort", onAbort);
    }
  }

  then: Promise<T>["then"] = (fulfilled, rejected) => this.execute().then(fulfilled, rejected);
  catch: Promise<T>["catch"] = (rejected) => this.execute().catch(rejected);
  finally: Promise<T>["finally"] = (callback) => this.execute().finally(callback);
}