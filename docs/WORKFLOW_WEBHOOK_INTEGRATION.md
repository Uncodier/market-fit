# Retired Workflow Webhook Note

The route previously documented at `/api/workflows/webhook` is not present in
the current application. The old examples accepted caller-provided site and user
IDs without a documented authentication mechanism and must not be reused.

If workflow callbacks are reintroduced:

- authenticate the external service with a server-only credential or signed
  request;
- validate timestamp and replay/idempotency state;
- derive or verify tenant and actor scope instead of trusting payload IDs;
- validate a bounded payload schema;
- make repeated and concurrent delivery safe;
- avoid storing or logging sensitive response content by default;
- add route tests for missing/invalid auth, cross-tenant payloads, replay,
  malformed input, and retry behavior;
- document the exact implemented route and contract only after the code exists.

See [Security](SECURITY.md) for API and webhook requirements.
