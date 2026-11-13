# Inventory assistant API contracts

## Local implementation and external boundary

The local manifest is [`app/inventory/assistant-tools.ts`](../app/inventory/assistant-tools.ts).
It defines function names, JSON schemas and same-origin HTTP transport metadata.
No executable external assistant tool registry was found in this checkout; this
manifest is **not registered with the external orchestration API**. That service
must register an adapter explicitly before an assistant can discover these tools.
The adapter should pass only the `function` descriptor to a model provider, not
the transport metadata, and invoke the fixed local path using the actor's identity.
It must not use service-role credentials or accept arbitrary fetch targets.

## Authentication and authorization

Both POST routes authenticate independently through the inventory-only
`requireInventoryApiAccess` helper. Without an Authorization header they preserve
`requireSiteAccess(request, siteId, { allowLocationScoped: true })` cookie flow.
External assistant adapters can instead supply `Authorization: Bearer <user JWT>`
using the delegated actor's Supabase access token. Invalid or malformed headers
never fall back to cookies. Anonymous, anon-role and service-role tokens are denied.

Bearer authentication uses `@supabase/supabase-js` with
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy
`NEXT_PUBLIC_SUPABASE_ANON_KEY`), fixed global user Authorization, and disabled
session persistence/auto-refresh. It verifies the token with `auth.getUser(token)`
and requires the authenticated role and a matching user identity, then obtains
trusted membership via `current_user_site_role`. Decoded JWT claims only provide
additional denial checks; they never grant access. The same user JWT is sent to
Data API queries/RPCs so RLS executes as `authenticated`, never `service_role`.
Public configuration that resembles a privileged key fails closed.

A supplied site UUID is a resource selector, not a tenant grant. Both transports
use only their user-scoped client. Tokens must be kept out of model prompts, logs
and responses; the external adapter holds the delegated credential privately.
The external registry still requires explicit registration; no integration is
implied by this transport support.

Each destination and both transfer endpoints require location/action `update`
authorization. Receipt queries are scoped by site and purchase under RLS and
require access to the bill's current location too. A destination grant cannot
grant access to a foreign bill. The atomic RPC rechecks resources and permissions
inside its transaction. No sequential or mock fallback is allowed.

## Requests

Requests require `Content-Type: application/json`; unknown keys and type coercion
are rejected. UUIDs are required for all IDs, including the idempotency `requestId`.
Bodies are stream-limited, regardless of `Content-Length`.

`POST /api/inventory/bulk` (maximum 131,072 bytes):

```json
{
  "siteId": "00000000-0000-4000-8000-000000000001",
  "requestId": "00000000-0000-4000-8000-000000000002",
  "operations": [{
    "kind": "transfer",
    "catalogItemId": "00000000-0000-4000-8000-000000000003",
    "fromLocationId": "00000000-0000-4000-8000-000000000004",
    "toLocationId": "00000000-0000-4000-8000-000000000005",
    "quantity": 2,
    "notes": "Move to dispatch"
  }]
}
```

- There must be 1–100 operations. The entire batch commits or rolls back.
- Transfer: distinct origin/destination, positive finite quantity <=1,000,000,000.
  Optional `receivingUserId` identifies an active, enabled, licensed site member
  (or primary owner) eligible for the destination. The server derives the name;
  assignment does not grant access. Requires the receiving responsibility migration.
- Adjustment: `catalogItemId`, `toLocationId`, signed nonzero finite `quantity`
  between -1,000,000,000 and 1,000,000,000. This is a **delta**, not a stock level.
  The database rejects a negative final stock level.
- Transfer/adjustment `notes` are optional strings trimmed to at most 1,000 characters.
- Legacy full receipt: `purchaseId`, `toLocationId`; no quantities, prices or payment state.
  Product lines and receipt state are read from the database. This bulk operation
  rejects partially received bills; use the bill-line endpoint below instead.

`POST /api/inventory/receive-bill` (maximum 131,072 bytes) requires:

```json
{
  "siteId": "00000000-0000-4000-8000-000000000001",
  "requestId": "00000000-0000-4000-8000-000000000002",
  "purchaseId": "00000000-0000-4000-8000-000000000006",
  "toLocationId": "00000000-0000-4000-8000-000000000005",
  "receivingUserId": "00000000-0000-4000-8000-000000000007",
  "lines": [{ "purchaseItemId": "00000000-0000-4000-8000-000000000008", "quantity": 1.5 }]
}
```

Each of 1–100 unique product **bill line IDs** receives a positive incremental
quantity <=1,000,000,000 and <= its locked remaining quantity. Omit zero lines.
No catalog IDs, prices, payment state, tenant overrides or receiver names are
accepted. The required receiver must be an active enabled licensed site member
(or primary owner) eligible for the destination; the server derives their name.
The shared user-scoped helper calls `receive_bill_inventory_lines` once. Stock,
line received quantities, movement attribution and full-receipt flag commit
atomically. Subsequent confirmed deliveries use new request IDs until remaining
quantities reach zero. This endpoint requires the partial bill receipt migration.

## Responses and retry policy

Confirmed success is `{success:true, requestId, movementIds:string[],
alreadyApplied:boolean}`. Responses are private/no-store. Error responses have
`{error:string}` with sanitized messages: 400 malformed/invalid input, 401 no
identity, 403 permission/resource denial, 409 stock/state/idempotency conflict,
413 body too large, 415 unsupported content type, or 503 unconfirmed/unavailable.

After an ambiguous timeout/503, retain the **same UUID and identical operations**.
Do not generate a new request ID or claim success. Reusing an ID with different
operations is a conflict; a confirmed replay returns `alreadyApplied:true`.
Confirm intent and destination with the user before any inventory write.

These routes require the inventory movements RPC migration supplied by the core
inventory implementation. Local contract tests do not establish remote migration
application or external registry integration.

## Bill dialog

The Bills list row options expose the same document actions as its detail toolbar:
edit, register payment, receive stock, print, send/resend, vendor link and journal
publish/unpublish. Dialog actions reload the bill before opening and list data
revalidates after confirmed changes. Demo and view-only rows cannot mutate data.

`/bills/[id]` loads authoritative bill product lines through
`readBillInventoryReceiptLines`, displays purchased/cumulative received/remaining
amounts and editable **Qty received now**, and requires a receiving person from
active site assignee options. It calls `receiveBillInventoryLines` after explicit
confirmation. The receive button remains available until every product line is
fully received. Services are excluded.
An actor-scoped saved request exposes **Retry saved receipt** in both the list
and detail even after full receipt, so a committed operation with a lost response
can be explicitly confirmed. No recovery entry point automatically sends writes.

Before mutation, the complete input is stored in session storage under an
actor/site/bill key. Storage failure blocks admission. An ambiguous result locks
quantities, destination and receiver and offers a manual identical retry (never
auto retry). The saved input survives dialog close/reopen and reload in the same
tab. A definitive first rejection can unlock editing; after uncertainty, even a
permission denial retains the saved request. Confirmed success clears it and
refreshes the bill. No new request is generated for an uncertain receipt.
Receipt destinations do not overwrite the bill's canonical location. The forward
write-boundary migration requires an authorized private transaction capability to
change receipt flags or budgets; direct Data API completion cannot forge receipts.

## Offline checks

```bash
npm test -- --runInBand __tests__/inventory/api-auth.test.ts __tests__/inventory/assistant-routes.test.ts __tests__/inventory/bill-receive-dialog.test.tsx __tests__/inventory/bill-receive-actions.test.ts
```

RPC atomicity, concurrency and durable replay require separate database tests;
mocked route tests establish authorization/validation and single atomic RPC dispatch only.