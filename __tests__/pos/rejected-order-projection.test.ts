import { isRejectedLocalDraft } from "@/app/pos/local/rejected-order-projection";
import { readLocalPendingOrders } from "@/app/pos/local/snapshot-pull";
import { getPosDb } from "@/app/pos/local/db";
import type { LocalPendingOrder, PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/actions/pull-snapshot", () => ({}));
const order: LocalPendingOrder = { id: "local_original", site_id: "site", status: "pending", created_at: "", raw: { pending_sync: true } };
const rejected: PosOutboxRow = { id: "row", siteId: "site", kind: "checkout", clientMutationId: "original",
  status: "failed", recoveryState: "rejected", attempts: 1, createdAt: "", updatedAt: "",
  payload: { kind: "checkout", data: { siteId: "site", userId: "actor", clientMutationId: "original", source: "pos",
    lines: [], fulfillment: "pickup", payments: [] } },
};

it("retires a rejected legacy local draft from the selector without requiring hash metadata", () => {
  expect(isRejectedLocalDraft(order, [rejected])).toBe(true);
  expect(rejected.payload.data).not.toHaveProperty("posOperationIdentity");
});

it.each([
  { recoveryState: "review_required" }, { recoveryState: "payment_recorded" }, { recoveryState: undefined },
  { status: "synced" }, { status: "pending" }, { siteId: "foreign" },
  { resultOrderId: "server-order" }, { recoveryOrderId: "server-order" }, { recoverySaleId: "sale" }, { resultSaleId: "sale" },
])("keeps unresolved or server-linked evidence visible: %j", (patch) => {
  expect(isRejectedLocalDraft(order, [{ ...rejected, ...patch } as PosOutboxRow])).toBe(false);
});

it("never hides server orders or drafts without original evidence", () => {
  expect(isRejectedLocalDraft({ ...order, id: "server-order" }, [rejected])).toBe(false);
  expect(isRejectedLocalDraft(order, [])).toBe(false);
});

it("keeps a cancelled creator visible if a dependent payment remains uncertain", () => {
  const dependent: PosOutboxRow = { ...rejected, id: "payment", clientMutationId: "payment", recoveryState: "review_required",
    payload: { kind: "checkout", data: { ...rejected.payload.data, clientMutationId: "payment", existingOrderId: order.id,
      payments: [{ paymentId: "receipt", method: "cash", amount: 10 }] } } as PosOutboxRow["payload"],
  };
  expect(isRejectedLocalDraft(order, [rejected, dependent])).toBe(false);
  expect(isRejectedLocalDraft(order, [rejected, { ...dependent, recoveryState: "rejected" }])).toBe(true);
});

it("filters persisted cancelled drafts on reload while retaining the original history", async () => {
  const orders = [order, { ...order, id: "server-order" }];
  const rows = [rejected];
  const before = JSON.stringify({ orders, rows });
  const table = (data: unknown[]) => ({ where: () => ({ equals: () => ({ toArray: async () => data }) }) });
  jest.mocked(getPosDb).mockReturnValue({ pendingOrders: table(orders), outbox: table(rows),
    transaction: async (_mode: string, _tables: unknown, work: () => Promise<unknown>) => work(),
  } as never);
  expect(await readLocalPendingOrders("site")).toEqual([orders[1]]);
  expect(JSON.stringify({ orders, rows })).toBe(before);
});