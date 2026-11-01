export function RegisterReadError({ error, hasPreviousData = false }: { error: string; hasPreviousData?: boolean }) {
  const originRejected = error === "Forbidden POS request origin.";
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">{originRejected ? "Cash register request blocked" : "Unable to load cash register"}</p>
      <p>{originRejected
        ? "The server could not verify this page's origin. This is a request security check, not a catalog sync or printer error."
        : error}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {hasPreviousData ? "Last loaded figures have not been reset. They may be out of date. " : "No balance has been reset. "}
        {originRejected
          ? "Reopen POS using the application's configured address. If this persists, ask your administrator to check the host and proxy configuration."
          : "Close and reopen this dialog to try again. If the problem persists, contact your administrator."}
      </p>
      {originRejected && <p className="text-xs text-muted-foreground">Technical detail: {error}</p>}
    </div>
  );
}