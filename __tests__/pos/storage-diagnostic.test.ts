import { posStorageDiagnostic, posStorageStep, posStorageTask, posStorageWriteError } from "@/app/pos/local/storage-diagnostic";

it.each([
  ["UnknownError", "POS_STORAGE_OPEN"],
  ["QuotaExceededError", "POS_STORAGE_QUOTA"],
  ["SecurityError", "POS_STORAGE_DENIED"],
  ["MissingAPIError", "POS_STORAGE_UNSUPPORTED"],
  ["PosStorageTimeoutError", "POS_STORAGE_TIMEOUT"],
  ["TypeError", "POS_STORAGE_TYPE"],
  ["PrematureCommitError", "POS_STORAGE_EARLY_COMMIT"],
  ["TransactionInactiveError", "POS_STORAGE_TRANSACTION_INACTIVE"],
])("maps %s to a fixed diagnostic", (name, code) => {
  expect(posStorageDiagnostic({ name, message: "private details" })).toBe(code);
});

it("preserves frozen browser exceptions and adds only a fixed stage", () => {
  const error = Object.freeze(new TypeError("private browser message"));
  expect(() => posStorageStep("PROBE", () => { throw error; })).toThrow(error);
  expect(posStorageDiagnostic(error)).toBe("POS_STORAGE_TYPE:PROBE");
});

it("keeps the innermost asynchronous stage without exposing error contents", async () => {
  const error = new Error("private database or user details");
  await expect(posStorageTask("PURGE", () => posStorageTask("DB_OPEN", async () => { throw error; }))).rejects.toBe(error);
  expect(posStorageDiagnostic(error)).toBe("POS_STORAGE_ERROR:DB_OPEN");
});

it("distinguishes read-back failures from generic exceptions", () => {
  const error = posStorageWriteError();
  expect(() => posStorageStep("OWNER_PUBLISH", () => { throw error; })).toThrow(error);
  expect(posStorageDiagnostic(error)).toBe("POS_STORAGE_WRITE_UNVERIFIED:OWNER_PUBLISH");
});

it.each([null, undefined, "private details", { name: "private-key" }, { name: "toString" }])("does not expose unknown errors", (error) => {
  expect(posStorageDiagnostic(error)).toBe("POS_STORAGE_FAILED");
});