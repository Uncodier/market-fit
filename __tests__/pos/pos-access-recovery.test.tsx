import { act, renderHook } from "@testing-library/react";
import { usePosLocationAccess } from "@/app/pos/hooks/use-pos-location-access";
import { createClient } from "@/lib/supabase/client";
import { clearPosPrivateData } from "@/app/pos/local/db";
import { suspendPosPermission } from "@/app/pos/local/location-permission-state";

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({
  clearPosPrivateData: jest.fn(), preparePosStorage: jest.fn(),
  hasPosCachedSnapshot: jest.fn(async () => true), lockPosDb: jest.fn(), unlockPosDb: jest.fn(),
}));

const auth = jest.fn();
const rpc = jest.fn();
const success = (name: string) => ({ data: name === "current_user_site_role" ? "collaborator" : false, error: null });
async function settle() { await act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); }); }

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  suspendPosPermission();
  localStorage.clear();
  localStorage.setItem("pos-location-scope-v1", JSON.stringify(["actor-a", "site-a", "collaborator"]));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  auth.mockResolvedValue({ data: { user: { id: "actor-a" } }, error: null });
  rpc.mockImplementation((name: string) => ({ abortSignal: () => Promise.resolve(success(name)) }));
  jest.mocked(createClient).mockReturnValue({
    auth: { getUser: auth, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }) }, rpc,
  } as never);
});
afterEach(() => jest.useRealTimers());

it("aborts timed-out RPC transport and allows manual verification without clearing stored work", async () => {
  const updated = jest.fn();
  window.addEventListener("pos-access-updated", updated);
  const signals: AbortSignal[] = [];
  rpc.mockImplementation(() => ({ abortSignal: (signal: AbortSignal) => {
    signals.push(signal);
    return new Promise(resolve => signal.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError" } }), { once: true }));
  } }));
  const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
  await settle();
  act(() => jest.advanceTimersByTime(8_000));
  await settle();
  expect(signals).toHaveLength(3);
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(result.current.lease?.offline).toBe(true);
  const generation = result.current.lease?.generation;
  rpc.mockImplementation((name: string) => ({ abortSignal: () => Promise.resolve(success(name)) }));
  act(() => window.dispatchEvent(new Event("pos-access-recheck")));
  await settle();
  expect(result.current.status).toBe("allowed");
  expect(result.current.lease?.offline).not.toBe(true);
  expect(result.current.lease?.generation).toBe(generation);
  expect(clearPosPrivateData).not.toHaveBeenCalled();
  expect(localStorage.getItem("pos-location-scope-v1")).toContain("site-a");
  expect(updated).toHaveBeenCalledTimes(2);
  window.removeEventListener("pos-access-updated", updated);
});

it("does not turn an online authentication transport error into an offline-device error", async () => {
  auth.mockResolvedValue({ data: { user: null }, error: { message: "Failed to fetch" } });
  localStorage.removeItem("pos-location-scope-v1");
  const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
  await settle();
  expect(result.current).toMatchObject({ status: "unavailable", reason: "session" });
  expect(clearPosPrivateData).not.toHaveBeenCalled();
});

it("aborts pending DB checks on disconnect so reconnection can verify and resume", async () => {
  const signals: AbortSignal[] = [];
  rpc.mockImplementation(() => ({ abortSignal: (signal: AbortSignal) => {
    signals.push(signal);
    return new Promise(resolve => signal.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError" } }), { once: true }));
  } }));
  const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
  await settle();
  act(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
  });
  await settle();
  expect(signals).toHaveLength(3);
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(result.current.lease?.offline).toBe(true);
  rpc.mockImplementation((name: string) => ({ abortSignal: () => Promise.resolve(success(name)) }));
  act(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
  });
  await settle();
  expect(result.current.status).toBe("allowed");
  expect(result.current.lease?.offline).not.toBe(true);
  expect(clearPosPrivateData).not.toHaveBeenCalled();
});

it("does not turn an online database transport error into an offline-device error", async () => {
  rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data: null, error: { message: "Failed to fetch" } }) }));
  localStorage.removeItem("pos-location-scope-v1");
  const { result } = renderHook(() => usePosLocationAccess("site-a", "actor-a"));
  await settle();
  expect(result.current).toMatchObject({ status: "unavailable", reason: "permission" });
  expect(clearPosPrivateData).not.toHaveBeenCalled();
});