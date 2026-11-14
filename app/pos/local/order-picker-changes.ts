import Dexie, { type ObservabilitySet } from "dexie";

/** Dexie publishes only committed writes, including writes from another tab. */
export function subscribePosOrderPickerChanges(onChange: () => void) {
  const changed = (parts: ObservabilitySet) => {
    if (Object.keys(parts).some(part => /^idb:\/\/market-fit-pos\/(pendingOrders|outbox|idMaps)\//.test(part))) onChange();
  };
  Dexie.on("storagemutated", changed);
  return () => Dexie.on("storagemutated").unsubscribe(changed);
}