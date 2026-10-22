/** @jest-environment node */

import { PostgrestClient } from "@supabase/postgrest-js";
import { createDemoMockClient } from "@/lib/demo-data/mock-client";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { readThroughJsonCache } from "@/lib/redis/json-cache";

jest.mock("server-only", () => ({}));
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
jest.mock("@/lib/redis/control-plane", () => ({ hashRedisKeyPart: jest.fn(async () => "hash") }));
jest.mock("@/lib/redis/json-cache", () => ({ readThroughJsonCache: jest.fn() }));

const SITE = "site-one";
const order = { id: "order-one", sale_id: "sale-one", seller_user_id: "seller-one", status: "pending" };
const sale = { id: "sale-one", amount: 10, amount_due: 10, status: "pending" };
let calls: Array<{ table: string; signal: AbortSignal }>;
let hangingTable: string | null;
let members: unknown[];
let ignoreAbort: boolean;
let finishIgnored: () => void;
let computeSettled: boolean;
let consoleError: jest.SpyInstance;

async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

beforeEach(() => {
  jest.useFakeTimers();
  calls = [];
  hangingTable = null;
  members = [{ user_id: "seller-one", name: "Cashier" }];
  ignoreAbort = false;
  computeSettled = false;
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const sdk = new PostgrestClient("https://pos-db.example.invalid/rest/v1", {
    fetch: async (input, init) => {
      const table = new URL(String(input)).pathname.split("/").pop()!;
      const signal = init!.signal as AbortSignal;
      calls.push({ table, signal });
      if (table === hangingTable) {
        return new Promise<Response>((resolve, reject) => {
          finishIgnored = () => resolve(Response.json(table === "sale_orders" ? [order] : []));
          if (!ignoreAbort) {
            const abort = () => reject(new DOMException("Cancelled test request", "AbortError"));
            if (signal.aborted) abort();
            else signal.addEventListener("abort", abort, { once: true });
          }
        });
      }
      const data = table === "sale_orders" ? [order] : table === "sales" ? [sale] : table === "site_members" ? members : [];
      return Response.json(data);
    },
  });
  jest.mocked(requirePosSiteAccess).mockResolvedValue({
    supabase: sdk, role: "owner", user: { id: "cashier" },
  } as unknown as Awaited<ReturnType<typeof requirePosSiteAccess>>);
  jest.mocked(readThroughJsonCache).mockImplementation(async ({ compute }) => {
    try { return { status: "computed", value: await compute() }; }
    finally { computeSettled = true; }
  });
});

afterEach(() => {
  consoleError.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it("uses the installed SDK to forward one cancellable signal to all query stages and clears the deadline on success", async () => {
  members = [];
  const result = await listPosOpenOrders(SITE);
  expect(result.error).toBeUndefined();
  expect(calls.map(({ table }) => table)).toEqual(["sale_orders", "site_members", "sales", "profiles"]);
  expect(new Set(calls.map(({ signal }) => signal)).size).toBe(1);
  expect(calls[0].signal.aborted).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(["demo-habituall", "demo-saas-en-123", "demo-ecom-es-456"])("preserves the existing isolated %s fixture without requiring an SDK cancellation method", async (siteId) => {
  jest.mocked(requirePosSiteAccess).mockResolvedValue({
    supabase: createDemoMockClient(siteId), role: "owner", user: { id: "fixture-owner" },
  } as unknown as Awaited<ReturnType<typeof requirePosSiteAccess>>);
  const result = await listPosOpenOrders(siteId);
  expect(result.error).toBeUndefined();
  expect(Array.isArray(result.data)).toBe(true);
  expect(calls).toEqual([]);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(["sale_orders", "sales", "site_members", "profiles"])("cancels a hanging %s fetch at the server deadline without SDK retries", async (table) => {
  hangingTable = table;
  if (table === "profiles") members = [];
  const result = listPosOpenOrders(SITE);
  await flush();
  expect(calls.some((call) => call.table === table)).toBe(true);
  await jest.advanceTimersByTimeAsync(7_999);
  expect(computeSettled).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  expect(await result).toEqual({ data: [], error: "Open orders query timed out" });
  expect(calls.every(({ signal }) => signal.aborted)).toBe(true);
  expect(calls.filter((call) => call.table === table)).toHaveLength(1);
  if (table === "site_members") expect(calls.some((call) => call.table === "profiles")).toBe(false);
  expect(computeSettled).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it("keeps the cache computation pending if an underlying fetch ignores cancellation", async () => {
  hangingTable = "sales";
  ignoreAbort = true;
  let returned = false;
  const result = listPosOpenOrders(SITE).then((value) => { returned = true; return value; });
  await flush();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(calls.find(({ table }) => table === "sales")?.signal.aborted).toBe(true);
  expect(computeSettled).toBe(false);
  expect(returned).toBe(false);
  finishIgnored();
  expect(await result).toEqual({ data: [], error: "Open orders query timed out" });
  expect(computeSettled).toBe(true);
});

it("does not release the computation after one fan-out rejects while the other is still hanging", async () => {
  const hanging = new Promise<{ data: []; error: null }>((resolve) => {
    finishIgnored = () => resolve({ data: [], error: null });
  });
  const fake = {
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
        abortSignal: () => table === "sale_orders" ? Promise.resolve({ data: [order] })
          : table === "sales" ? Promise.reject(new Error("Sales unavailable")) : hanging,
      };
      return query;
    },
  };
  jest.mocked(requirePosSiteAccess).mockResolvedValue({
    supabase: fake, role: "owner", user: { id: "cashier" },
  } as unknown as Awaited<ReturnType<typeof requirePosSiteAccess>>);
  const result = listPosOpenOrders(SITE);
  await flush();
  expect(computeSettled).toBe(false);
  await jest.advanceTimersByTimeAsync(8_000);
  expect(computeSettled).toBe(false);
  finishIgnored();
  expect(await result).toEqual({ data: [], error: "Open orders query timed out" });
});