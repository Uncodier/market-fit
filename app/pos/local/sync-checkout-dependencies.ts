import { getPosDb } from "./db";
import { getServerIdForLocal, listOutbox, mapLocalId } from "./outbox";
import { isPosPermissionCurrent, type PosPermissionLease } from "./location-permission-state";
import type { PosOutboxRow } from "./types";

/** Resolve only the local identities used by this checkout, never the whole queue. */
export async function syncCheckoutDependencies(
  row: PosOutboxRow,
  permission: PosPermissionLease,
  sync: (dependency: PosOutboxRow) => Promise<void>,
): Promise<void> {
  if (row.payload.kind !== "checkout") return;
  const data = row.payload.data;
  const assertCurrent = () => {
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
  };
  const syncDependency = async (dependency: PosOutboxRow | undefined, message: string) => {
    assertCurrent();
    if (!dependency || dependency.id === row.id) throw new Error(message);
    await sync(dependency);
    assertCurrent();
    const current = await getPosDb().outbox.get(dependency.id);
    assertCurrent();
    if (current?.status !== "synced") throw new Error(message);
    return current;
  };

  if (data.localLeadId && !data.leadId && !await getServerIdForLocal(data.localLeadId)) {
    assertCurrent();
    const rows = await listOutbox(row.siteId);
    await syncDependency(rows.find((candidate) => candidate.siteId === row.siteId &&
      candidate.payload.kind === "create_lead" && candidate.payload.data.localLeadId === data.localLeadId),
    "Waiting for local lead to sync");
    if (!await getServerIdForLocal(data.localLeadId)) throw new Error("Waiting for local lead to sync");
  }

  const localOrderId = data.existingOrderId;
  if (localOrderId?.startsWith("local_") && !await getServerIdForLocal(localOrderId)) {
    assertCurrent();
    // New local orders are named local_<creator mutation>, not by outbox row ID.
    const creatorMutationId = localOrderId.slice("local_".length);
    const rows = await listOutbox(row.siteId);
    const creator = await syncDependency(rows.find((candidate) => candidate.siteId === row.siteId &&
      candidate.payload.kind === "checkout" && candidate.clientMutationId === creatorMutationId),
    "Waiting for local order to sync");
    if (!creator.resultOrderId) throw new Error("Waiting for local order to sync");
    assertCurrent();
    await mapLocalId({ localId: localOrderId, serverId: creator.resultOrderId, kind: "order", siteId: row.siteId });
  }
  assertCurrent();
}