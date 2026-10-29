import { v4 as uuidv4, validate as isUuid } from "uuid";
import { enqueueCheckout, enqueueCheckIn, listOutbox, updateOutboxRow } from "@/app/pos/local/outbox";
import { getPosDb } from "@/app/pos/local/db";
import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types";
import { checkoutInput, siteId, userId } from "./operation-fixtures";

jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ siteId, userId }),
  isPosPermissionCurrent: () => true,
}));

let rows: PosOutboxRow[];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const add = jest.fn(async (row: PosOutboxRow) => { rows.push(clone(row)); });
const db = {
  outbox: {
    add,
    where: (key: "clientMutationId" | "siteId") => ({ equals: (value: string) => ({
      first: async () => rows.find((row) => row[key] === value),
      toArray: async () => clone(rows.filter((row) => row[key] === value)),
    }) }),
    update: async (id: string, patch: Partial<PosOutboxRow>) => {
      Object.assign(rows.find((row) => row.id === id)!, patch);
    },
  },
};
function data(row: PosOutboxRow): CheckoutOutboxPayload {
  if (row.payload.kind !== "checkout") throw new Error("Expected checkout");
  return row.payload.data;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  rows = [];
  jest.mocked(getPosDb).mockReturnValue(db as never);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it("persists device and creation metadata in the initial write without mutating input", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-23T10:00:00.000Z"));
  const input = Object.freeze({ ...checkoutInput });
  add.mockImplementationOnce(async (row) => {
    expect(localStorage.getItem("pos-device-id")).toBe(data(row).posOperationIdentity?.deviceId);
    expect(data(row).posOperationIdentity).toEqual({
      version: 1, deviceId: expect.any(String), createdAt: row.createdAt,
    });
    rows.push(clone(row));
  });
  const row = await enqueueCheckout(siteId, input);
  expect(isUuid(data(row).posOperationIdentity!.deviceId)).toBe(true);
  expect(data(row).posOperationIdentity!.createdAt).toBe("2026-10-23T10:00:00.000Z");
  expect(input).not.toHaveProperty("posOperationIdentity");
  expect(rows[0]).toEqual(row);
});

it("retains identity through reload and retry and reuses the device for a distinct operation", async () => {
  const original = await enqueueCheckout(siteId, checkoutInput);
  const identity = clone(data(original).posOperationIdentity);
  await updateOutboxRow(original.id, { status: "failed", attempts: 1 });
  const saved = JSON.stringify(rows);
  await jest.isolateModulesAsync(async () => {
    const reloadedDb = await import("@/app/pos/local/db");
    jest.mocked(reloadedDb.getPosDb).mockReturnValue(db as never);
    const reloaded = await import("@/app/pos/local/outbox");
    const retry = await reloaded.enqueueCheckout(siteId, checkoutInput);
    expect(data(retry).posOperationIdentity).toEqual(identity);
    expect(JSON.stringify(rows)).toBe(saved);
    const next = await reloaded.enqueueCheckout(siteId, { ...checkoutInput, clientMutationId: uuidv4() });
    expect(data(next).posOperationIdentity?.deviceId).toBe(identity?.deviceId);
    expect(next.clientMutationId).not.toBe(original.clientMutationId);
  });
  expect(rows).toHaveLength(2);
});

it("does not deduplicate identical content or timestamps: UUID mutation IDs own uniqueness", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-23T10:00:00Z"));
  const first = await enqueueCheckout(siteId, { ...checkoutInput, clientMutationId: uuidv4() });
  const second = await enqueueCheckout(siteId, { ...checkoutInput, clientMutationId: uuidv4() });
  expect(data(first).posOperationIdentity).toEqual(data(second).posOperationIdentity);
  expect(first.clientMutationId).not.toBe(second.clientMutationId);
  expect(first.id).not.toBe(second.id);
  expect(rows).toHaveLength(2);
});

it.each([false, true])("leaves existing queued rows byte-for-byte unchanged (identity present: %s)", async (hasIdentity) => {
  const payload: CheckoutOutboxPayload = { ...checkoutInput, ...(hasIdentity ? {
    posOperationIdentity: { version: 1 as const, deviceId: uuidv4(), createdAt: "2025-01-01T01:00:00+01:00" },
  } : {}) };
  rows.push({ id: "legacy", siteId, kind: "checkout", payload: { kind: "checkout", data: payload },
    clientMutationId: payload.clientMutationId, status: "failed", attempts: 3,
    createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" });
  const saved = JSON.stringify(rows);
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  expect(await listOutbox(siteId)).toEqual(rows);
  expect(await enqueueCheckout(siteId, checkoutInput)).toBe(rows[0]);
  expect(await enqueueCheckout(siteId, { ...checkoutInput, posOperationIdentity: {
    version: 1, deviceId: uuidv4(), createdAt: "2026-10-23T10:00:00Z",
  } })).toBe(rows[0]);
  expect(JSON.stringify(rows)).toBe(saved);
  expect(add).not.toHaveBeenCalled();
});

it("preserves supplied identity rather than regenerating or normalizing it", async () => {
  const identity = { version: 1 as const, deviceId: uuidv4(), createdAt: "2025-01-01T01:00:00+01:00" };
  const row = await enqueueCheckout(siteId, { ...checkoutInput, posOperationIdentity: identity });
  expect(data(row).posOperationIdentity).toEqual(identity);
  expect(localStorage.length).toBe(0);
});

it.each(["read", "write", "silent-write", "invalid"])("stops new enqueues on %s device storage failure", async (failure) => {
  if (failure === "invalid") localStorage.setItem("pos-device-id", "not-a-uuid");
  else if (failure === "silent-write") jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  else jest.spyOn(Storage.prototype, failure === "read" ? "getItem" : "setItem")
    .mockImplementation(() => { throw new Error("Storage unavailable"); });
  await expect(enqueueCheckout(siteId, checkoutInput)).rejects.toThrow();
  expect(add).not.toHaveBeenCalled();
});

it("leaves non-checkout operations untouched", async () => {
  const payload = { siteId, code: "visit", clientMutationId: uuidv4() };
  const row = await enqueueCheckIn(siteId, payload);
  expect(row.payload).toEqual({ kind: "check_in", data: payload });
  expect(localStorage.length).toBe(0);
});