type StorageStage = "PROBE" | "DB_OPEN" | "OWNER_READ" | "OWNER_RESERVE" | "PURGE" | "OWNER_PUBLISH" | "SNAPSHOT";
const stages = new WeakMap<object, StorageStage>();

function atStage(stage: StorageStage, error: unknown): never {
  const failure = error && typeof error === "object" ? error : new Error("POS storage operation failed");
  if (!stages.has(failure)) stages.set(failure, stage);
  throw failure;
}

/** Preserve exceptions for callers while keeping diagnostic metadata out of stored data. */
export function posStorageStep<T>(stage: StorageStage, operation: () => T): T {
  try { return operation(); } catch (error) { return atStage(stage, error); }
}

export async function posStorageTask<T>(stage: StorageStage, operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { return atStage(stage, error); }
}

export function posStorageWriteError(): Error {
  const error = new Error("POS storage write could not be verified");
  error.name = "PosStorageWriteError";
  return error;
}

/** Only expose fixed error codes, never browser messages, keys or stored data. */
export function posStorageDiagnostic(error: unknown): string {
  const codes: Record<string, string> = {
    PosStorageTimeoutError: "POS_STORAGE_TIMEOUT",
    QuotaExceededError: "POS_STORAGE_QUOTA",
    SecurityError: "POS_STORAGE_DENIED",
    MissingAPIError: "POS_STORAGE_UNSUPPORTED",
    VersionError: "POS_STORAGE_VERSION",
    InvalidStateError: "POS_STORAGE_STATE",
    UnknownError: "POS_STORAGE_OPEN",
    AbortError: "POS_STORAGE_ABORTED",
    DatabaseClosedError: "POS_STORAGE_CLOSED",
    TypeError: "POS_STORAGE_TYPE",
    ReferenceError: "POS_STORAGE_REFERENCE",
    RangeError: "POS_STORAGE_RANGE",
    PosStorageWriteError: "POS_STORAGE_WRITE_UNVERIFIED",
    PrematureCommitError: "POS_STORAGE_EARLY_COMMIT",
    TransactionInactiveError: "POS_STORAGE_TRANSACTION_INACTIVE",
    OpenFailedError: "POS_STORAGE_OPEN_FAILED",
    InvalidTableError: "POS_STORAGE_TABLE",
    NotFoundError: "POS_STORAGE_NOT_FOUND",
    SchemaError: "POS_STORAGE_SCHEMA",
    UpgradeError: "POS_STORAGE_UPGRADE",
    InvalidArgumentError: "POS_STORAGE_ARGUMENT",
    DataError: "POS_STORAGE_DATA",
    Error: "POS_STORAGE_ERROR",
  };
  if (!error || typeof error !== "object") return "POS_STORAGE_FAILED";
  const { name, message } = error as { name?: unknown; message?: unknown };
  const code = typeof name === "string" && Object.prototype.hasOwnProperty.call(codes, name) ? codes[name] : "POS_STORAGE_FAILED";
  const stage = stages.get(error);
  // Safari's missing global is otherwise hidden behind the same ReferenceError
  // as application bugs. Match complete messages and expose only known API names.
  const reference = name === "ReferenceError" && typeof message === "string"
    ? /^(?:Can't find variable: (indexedDB|CustomEvent|IDBKeyRange)|(indexedDB|CustomEvent|IDBKeyRange) is not defined)$/.exec(message)
    : null;
  const missing = reference ? (reference[1] || reference[2]).toUpperCase() : null;
  return `${code}${stage ? `:${stage}` : ""}${missing ? `:${missing}` : ""}`;
}