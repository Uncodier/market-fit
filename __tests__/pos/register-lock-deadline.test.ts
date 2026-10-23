import { withRegisterPaymentLock } from "@/app/pos/register/queue-guard";

jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it("bounds queued lock admission and never runs a late expired callback", async () => {
  let late!: () => Promise<unknown>;
  let signal!: AbortSignal;
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: (_name: string, options: LockOptions, operation: () => Promise<unknown>) => {
      late = operation;
      signal = options.signal!;
      return new Promise(() => {});
    },
  } });
  const operation = jest.fn();
  const waiting = withRegisterPaymentLock("site", operation).catch((error: unknown) => error);
  await jest.advanceTimersByTimeAsync(8_000);
  expect(await waiting).toEqual(new Error("The register is busy. No new payment was submitted. Try again shortly."));
  expect(signal.aborted).toBe(true);
  await expect(late()).rejects.toThrow("expired");
  expect(operation).not.toHaveBeenCalled();
});

it("does not time out or release an acquired lock around a write that may commit", async () => {
  let release!: (value: string) => void;
  let signal!: AbortSignal;
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: (_name: string, options: LockOptions, operation: () => Promise<unknown>) => {
      signal = options.signal!;
      return operation();
    },
  } });
  let settled = false;
  const active = withRegisterPaymentLock("site", () => new Promise<string>((resolve) => { release = resolve; }))
    .then((value) => { settled = true; return value; });
  await jest.advanceTimersByTimeAsync(60_000);
  expect(settled).toBe(false);
  expect(signal.aborted).toBe(false);
  release("confirmed");
  expect(await active).toBe("confirmed");
});