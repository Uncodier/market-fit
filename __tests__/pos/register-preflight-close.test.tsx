import { act, renderHook } from "@testing-library/react";
import { usePaymentRegisterPreflight } from "@/app/pos/hooks/use-payment-register-preflight";
import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { withRegisterCloseLock } from "@/app/pos/register/queue-guard";
import { readRegisterPreflightRevision } from "@/app/pos/register/preflight-revision";
import { fetchActivePaymentRegister } from "@/app/pos/operation-client";
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox";
import { PaymentRegisterRequiredError } from "@/app/pos/register/payment-register-required";
import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/operation-client", () => ({ fetchActivePaymentRegister: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ siteId: "site", userId: "actor", generation: 1, remoteGeneration: 1 }),
  getPosPermissionLease: () => ({ siteId: "site", userId: "actor", generation: 1, remoteGeneration: 1 }),
  isPosPermissionCurrent: () => true,
}));

const register = { data: { id: "shift", location_id: "store" } } as Awaited<ReturnType<typeof fetchActivePaymentRegister>>;
const payload: CheckoutOutboxPayload = { siteId: "site", userId: "actor", source: "pos", fulfillment: "none",
  clientMutationId: "payment", originLocationId: "store", lines: [], payments: [{ method: "cash", amount: 10 }] };
let rows: PosOutboxRow[];

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  rows = [];
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  // Two simulated tabs share the same browser lock and synchronous storage.
  let tail: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: (_name: string, _options: LockOptions, operation: () => Promise<unknown>) => {
      const next = tail.then(operation);
      tail = next.catch(() => {});
      return next;
    },
  } });
  jest.mocked(fetchActivePaymentRegister).mockResolvedValue(register);
  jest.mocked(listOutbox).mockImplementation(async () => rows);
  jest.mocked(enqueueCheckout).mockImplementation(async (siteId, data) => {
    const row = { id: "row", siteId, clientMutationId: data.clientMutationId, kind: "checkout", status: "pending",
      payload: { kind: "checkout", data }, attempts: 0, createdAt: "", updatedAt: "" } satisfies PosOutboxRow;
    rows.push(row);
    return row;
  });
});
afterEach(() => jest.restoreAllMocks());

const usePreflight = () => usePaymentRegisterPreflight("site", "actor", "store", "cart", true);
const submit = (readRegister: ReturnType<typeof usePreflight>["take"]) =>
  enqueueRegisteredCheckout("site", payload, undefined, undefined, { waitForConfirmation: false, readRegister });

it("rejects a closed shift before enqueue after another tab finishes closing", async () => {
  const { result } = renderHook(usePreflight);
  await act(async () => {});
  await withRegisterCloseLock("site", async () => {
    jest.mocked(fetchActivePaymentRegister).mockResolvedValue({ error: "Open a register", code: "register_required" });
  });
  await expect(submit(result.current.take)).rejects.toBeInstanceOf(PaymentRegisterRequiredError);
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
  expect(enqueueCheckout).not.toHaveBeenCalled();
});

it("does not revive an old read that resolves after closing and reopening", async () => {
  let finish!: (value: typeof register) => void;
  jest.mocked(fetchActivePaymentRegister).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(usePreflight);
  await withRegisterCloseLock("site", async () => {});
  jest.mocked(fetchActivePaymentRegister).mockResolvedValue({ data: { ...register.data!, id: "new-shift" } });
  finish(register);
  await expect(submit(result.current.take)).resolves.toMatchObject({
    payload: { data: { registerSessionId: "new-shift" } },
  });
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it("waits behind closing and never starts a hint while the close is in flight", async () => {
  let release!: () => void;
  const closing = withRegisterCloseLock("site", () => new Promise<void>((resolve) => { release = resolve; }));
  await act(async () => {});
  expect(readRegisterPreflightRevision("site")).toBeNull();
  const { result } = renderHook(usePreflight);
  const payment = submit(result.current.take).catch((error: unknown) => error);
  await act(async () => {});
  expect(fetchActivePaymentRegister).not.toHaveBeenCalled();
  expect(enqueueCheckout).not.toHaveBeenCalled();
  jest.mocked(fetchActivePaymentRegister).mockResolvedValue({ error: "Open a register", code: "register_required" });
  release();
  await closing;
  expect(await payment).toBeInstanceOf(PaymentRegisterRequiredError);
  expect(enqueueCheckout).not.toHaveBeenCalled();
});

it("preserves the opposite ordering: an accepted payment fences closing", async () => {
  const { result } = renderHook(usePreflight);
  await submit(result.current.take);
  const close = jest.fn();
  await expect(withRegisterCloseLock("site", close)).rejects.toThrow("unsynchronized payments");
  expect(close).not.toHaveBeenCalled();
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(1);
});

it("invalidates hints even when close has an ambiguous failure", async () => {
  const before = readRegisterPreflightRevision("site");
  await expect(withRegisterCloseLock("site", async () => { throw new Error("Connection lost"); })).rejects.toThrow("Connection lost");
  expect(readRegisterPreflightRevision("site")).not.toBe(before);
});

it("does not close if cross-tab invalidation cannot be persisted", async () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  const close = jest.fn();
  await expect(withRegisterCloseLock("site", close)).rejects.toThrow("Storage unavailable");
  expect(close).not.toHaveBeenCalled();
});

it("preserves a successful close and disables reuse if finishing invalidation fails", async () => {
  const original = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (value.startsWith("ready:")) throw new Error("Storage unavailable");
    original.call(this, key, value);
  });
  await expect(withRegisterCloseLock("site", async () => "closed")).resolves.toBe("closed");
  expect(readRegisterPreflightRevision("site")).toBeNull();
});

it("preserves the original close failure when final invalidation also fails", async () => {
  const original = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (value.startsWith("ready:")) throw new Error("Storage unavailable");
    original.call(this, key, value);
  });
  await expect(withRegisterCloseLock("site", async () => { throw new Error("Close unconfirmed"); }))
    .rejects.toThrow("Close unconfirmed");
  expect(readRegisterPreflightRevision("site")).toBeNull();
});