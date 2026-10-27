import { posStorageDiagnostic } from "@/app/pos/local/storage-diagnostic";

it.each([
  ["UnknownError", "POS_STORAGE_OPEN"],
  ["QuotaExceededError", "POS_STORAGE_QUOTA"],
  ["SecurityError", "POS_STORAGE_DENIED"],
  ["MissingAPIError", "POS_STORAGE_UNSUPPORTED"],
  ["PosStorageTimeoutError", "POS_STORAGE_TIMEOUT"],
])("maps %s to a fixed diagnostic", (name, code) => {
  expect(posStorageDiagnostic({ name, message: "private details" })).toBe(code);
});

it.each([null, undefined, "private details", { name: "private-key" }, { name: "toString" }])("does not expose unknown errors", (error) => {
  expect(posStorageDiagnostic(error)).toBe("POS_STORAGE_FAILED");
});