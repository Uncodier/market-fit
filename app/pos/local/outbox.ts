import { v4 as uuidv4 } from "uuid";
import { getPosDb } from "./db";
import type {
  CheckInOutboxPayload,
  CheckoutOutboxPayload,
  CreateLeadOutboxPayload,
  OutboxStatus,
  PosOutboxRow,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

export async function enqueueOutbox(params: {
  siteId: string;
  kind: PosOutboxRow["kind"];
  clientMutationId: string;
  payload: PosOutboxRow["payload"];
}): Promise<PosOutboxRow> {
  const db = getPosDb();
  const existing = await db.outbox
    .where("clientMutationId")
    .equals(params.clientMutationId)
    .first();
  if (existing) return existing;

  const row: PosOutboxRow = {
    id: uuidv4(),
    siteId: params.siteId,
    kind: params.kind,
    clientMutationId: params.clientMutationId,
    payload: params.payload,
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.outbox.add(row);
  return row;
}

export async function enqueueCheckout(
  siteId: string,
  data: CheckoutOutboxPayload,
) {
  return enqueueOutbox({
    siteId,
    kind: "checkout",
    clientMutationId: data.clientMutationId,
    payload: { kind: "checkout", data },
  });
}

export async function enqueueCheckIn(
  siteId: string,
  data: CheckInOutboxPayload,
) {
  return enqueueOutbox({
    siteId,
    kind: "check_in",
    clientMutationId: data.clientMutationId,
    payload: { kind: "check_in", data },
  });
}

export async function enqueueCreateLead(
  siteId: string,
  data: CreateLeadOutboxPayload,
) {
  return enqueueOutbox({
    siteId,
    kind: "create_lead",
    clientMutationId: data.clientMutationId,
    payload: { kind: "create_lead", data },
  });
}

export async function listOutbox(
  siteId: string,
  statuses?: OutboxStatus[],
): Promise<PosOutboxRow[]> {
  const rows = await getPosDb().outbox.where("siteId").equals(siteId).toArray();
  const filtered = statuses
    ? rows.filter((r) => statuses.includes(r.status))
    : rows;
  return filtered.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export async function countPendingOutbox(siteId: string): Promise<number> {
  const rows = await listOutbox(siteId, ["pending", "syncing", "failed"]);
  return rows.length;
}

export async function updateOutboxRow(
  id: string,
  patch: Partial<PosOutboxRow>,
) {
  await getPosDb().outbox.update(id, { ...patch, updatedAt: nowIso() });
}

export async function getServerIdForLocal(
  localId: string,
): Promise<string | null> {
  const row = await getPosDb().idMaps.get(localId);
  return row?.serverId ?? null;
}

export async function mapLocalId(params: {
  localId: string;
  serverId: string;
  kind: "lead" | "order" | "sale";
  siteId: string;
}) {
  await getPosDb().idMaps.put(params);
}

/** Pure helper for tests: order outbox by createdAt ascending. */
export function sortOutboxFifo(rows: PosOutboxRow[]): PosOutboxRow[] {
  return [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Pure helper: which statuses are still awaiting successful sync. */
export function isOutboxOpen(status: OutboxStatus): boolean {
  return status === "pending" || status === "syncing" || status === "failed";
}
