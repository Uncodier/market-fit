import { v4 as uuidv4, validate as isUuid } from "uuid";
import type { PosOperationIdentity } from "@/app/commerce/checkout-types";

const DEVICE_KEY = "pos-device-id";

/** Browser-profile metadata only. Never rotate identity to hide a storage failure. */
function getPosDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing !== null) {
    if (!isUuid(existing)) throw new Error("Invalid POS device identity in local storage");
    return existing;
  }
  const deviceId = uuidv4();
  localStorage.setItem(DEVICE_KEY, deviceId);
  if (localStorage.getItem(DEVICE_KEY) !== deviceId) {
    throw new Error("Unable to persist POS device identity");
  }
  return deviceId;
}

/** Call only for a new checkout row, before its initial durable write. */
export function createPosOperationIdentity(createdAt: string): PosOperationIdentity {
  return { version: 1, deviceId: getPosDeviceId(), createdAt };
}