import { act, renderHook } from "@testing-library/react";
import { usePaymentRegisterPreflight } from "@/app/pos/hooks/use-payment-register-preflight";
import { fetchActivePaymentRegister } from "@/app/pos/operation-client";

jest.mock("@/app/pos/operation-client", () => ({ fetchActivePaymentRegister: jest.fn() }));
let current = true;
let generation = 1;
jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: () => ({ generation, remoteGeneration: generation }),
  isPosPermissionCurrent: (lease: { generation: number }) => current && lease.generation === generation,
}));

const register = { data: { id: "shift", location_id: "store" } } as Awaited<ReturnType<typeof fetchActivePaymentRegister>>;
const props = { siteId: "site", userId: "cashier", locationId: "store", cart: "cart-1", enabled: true };
const usePreflight = (input: typeof props) => usePaymentRegisterPreflight(
  input.siteId, input.userId, input.locationId, input.cart, input.enabled,
);

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  current = true;
  generation = 1;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  jest.mocked(fetchActivePaymentRegister).mockResolvedValue(register);
});
afterEach(() => jest.restoreAllMocks());

it("starts while the dialog is open and consumes the same in-flight read once", async () => {
  let finish!: (value: typeof register) => void;
  jest.mocked(fetchActivePaymentRegister).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(usePreflight, { initialProps: props });
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(1);
  const prepared = result.current.take();
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(1);
  finish(register);
  await expect(prepared).resolves.toEqual(register);
  await expect(result.current.take()).resolves.toEqual(register);
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it.each(["siteId", "userId", "locationId", "cart"] as const)("discards a read after changing %s", async (field) => {
  jest.mocked(fetchActivePaymentRegister).mockReturnValueOnce(new Promise(() => {}));
  const { result, rerender } = renderHook(usePreflight, { initialProps: props });
  rerender({ ...props, [field]: "other" });
  await expect(result.current.take()).resolves.toEqual(register);
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it("refreshes old hints instead of extending their lifetime on rerender", async () => {
  const clock = jest.spyOn(performance, "now").mockReturnValue(0);
  const { result, rerender } = renderHook(usePreflight, { initialProps: props });
  clock.mockReturnValue(16_000);
  rerender({ ...props });
  await result.current.take();
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it("drops hints when the dialog closes or register setup opens", async () => {
  const { result, rerender } = renderHook(usePreflight, { initialProps: props });
  rerender({ ...props, enabled: false });
  rerender(props);
  await result.current.take();
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it("does not start reads offline or accept hints after permission loss", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  const { result } = renderHook(usePreflight, { initialProps: props });
  expect(fetchActivePaymentRegister).not.toHaveBeenCalled();
  current = false;
  await expect(result.current.take()).resolves.toHaveProperty("error");
  expect(fetchActivePaymentRegister).not.toHaveBeenCalled();
});

it("does not reuse reads across a permission generation change", async () => {
  const { result, rerender } = renderHook(usePreflight, { initialProps: props });
  generation = 2;
  rerender(props);
  await result.current.take();
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it("retries an in-flight speculative failure within the first submission", async () => {
  jest.mocked(fetchActivePaymentRegister).mockRejectedValueOnce(new Error("Network unavailable"));
  const { result } = renderHook(usePreflight, { initialProps: props });
  await act(async () => { await expect(result.current.take()).resolves.toEqual(register); });
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it.each([
  { error: "Temporary network failure" },
  { error: "Open a register", code: "register_required" as const },
])("discards settled speculative errors before the first submission: %j", async (failure) => {
  jest.mocked(fetchActivePaymentRegister).mockResolvedValueOnce(failure);
  const { result } = renderHook(usePreflight, { initialProps: props });
  await act(async () => {});
  await expect(result.current.take()).resolves.toEqual(register);
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it("returns the fresh failure without looping or replaying mutations", async () => {
  jest.mocked(fetchActivePaymentRegister).mockResolvedValue({ error: "Still unavailable" });
  const { result } = renderHook(usePreflight, { initialProps: props });
  await expect(result.current.take()).resolves.toEqual({ error: "Still unavailable" });
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(2);
});

it("does not retry after permission loss while a speculative read fails", async () => {
  let finish!: (value: { error: string }) => void;
  jest.mocked(fetchActivePaymentRegister).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(usePreflight, { initialProps: props });
  const taken = result.current.take();
  current = false;
  finish({ error: "Network failure" });
  await expect(taken).resolves.toEqual({ error: expect.stringContaining("access changed") });
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(1);
});

it("falls back to a fresh read when shared revision storage is unavailable", async () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  const { result } = renderHook(usePreflight, { initialProps: props });
  expect(fetchActivePaymentRegister).not.toHaveBeenCalled();
  await expect(result.current.take()).resolves.toEqual(register);
  expect(fetchActivePaymentRegister).toHaveBeenCalledTimes(1);
});