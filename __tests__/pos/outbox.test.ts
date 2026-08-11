import {
  isOutboxOpen,
  sortOutboxFifo,
} from "@/app/pos/local/outbox";
import type { PosOutboxRow } from "@/app/pos/local/types";

function row(
  partial: Partial<PosOutboxRow> & Pick<PosOutboxRow, "id" | "createdAt">,
): PosOutboxRow {
  return {
    siteId: "site-1",
    kind: "checkout",
    clientMutationId: partial.id,
    payload: {
      kind: "checkout",
      data: {
        siteId: "site-1",
        lines: [],
        fulfillment: "dine_in",
        source: "pos",
        clientMutationId: partial.id,
      },
    },
    status: "pending",
    attempts: 0,
    updatedAt: partial.createdAt,
    ...partial,
  };
}

describe("pos outbox helpers", () => {
  it("sorts FIFO by createdAt", () => {
    const a = row({ id: "a", createdAt: "2026-08-10T10:00:00.000Z" });
    const b = row({ id: "b", createdAt: "2026-08-10T09:00:00.000Z" });
    const c = row({ id: "c", createdAt: "2026-08-10T11:00:00.000Z" });
    expect(sortOutboxFifo([a, c, b]).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("treats pending/syncing/failed as open", () => {
    expect(isOutboxOpen("pending")).toBe(true);
    expect(isOutboxOpen("syncing")).toBe(true);
    expect(isOutboxOpen("failed")).toBe(true);
    expect(isOutboxOpen("synced")).toBe(false);
  });
});
