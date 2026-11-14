import Dexie, { type ObservabilitySet } from "dexie";
import { subscribePosOrderPickerChanges } from "@/app/pos/local/order-picker-changes";

test("committed order, payment, mapping and cancellation writes notify without sync counters", () => {
  const notify = jest.fn();
  const unsubscribe = subscribePosOrderPickerChanges(notify);
  const publish = (table: string) => Dexie.on("storagemutated").fire({
    [`idb://market-fit-pos/${table}/`]: {},
  } as ObservabilitySet);
  try {
    publish("catalogItems");
    expect(notify).not.toHaveBeenCalled();
    publish("pendingOrders");
    publish("outbox");
    publish("idMaps");
    expect(notify).toHaveBeenCalledTimes(3);
  } finally { unsubscribe(); }
  publish("outbox");
  expect(notify).toHaveBeenCalledTimes(3);
});