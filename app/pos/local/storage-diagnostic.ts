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
  };
  if (!error || typeof error !== "object") return "POS_STORAGE_FAILED";
  const { name } = error as { name?: unknown };
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(codes, name) ? codes[name] : "POS_STORAGE_FAILED";
}