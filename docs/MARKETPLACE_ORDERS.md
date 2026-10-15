# Native Rappi and Uber Eats orders

This integration extends **Integrations**, **Orders**, and **Shipments**. It does
not introduce another operations screen, charge a customer again, or request an
additional courier for an existing marketplace delivery.

## Merchant connection model

Integrations defaults to **Connect with Makinari**. Makinari owns the approved
application; managers grant consent and select authorized provider stores mapped
to active native locations. Restaurants do not supply Makinari's credentials.
**Use my own application (advanced)** supports approved third-party developer
applications. The legacy manual receiver form is under an Advanced disclosure
and remains intended only for already-onboarded stores.

Platform application credentials are server configuration, never tenant copies.
Own application credentials, PKCE verifiers, and merchant tokens use authenticated
encryption in server-only consent tables. Register these exact HTTPS callbacks:

- `/api/marketplace/oauth/uber_eats/callback`
- `/api/marketplace/oauth/rappi/callback`

Uber's primary webhook uses **Basic HMAC** at
`/api/marketplace/webhooks/uber_eats`. Set its exact dashboard Signing Key in
`UBER_EATS_WEBHOOK_SIGNING_KEY` (or `UBER_EATS_SANDBOX_WEBHOOK_SIGNING_KEY`), on the
market-fit server only. OAuth client credentials remain separate; blank platform
signing keys reject webhooks rather than falling back to the OAuth secret.

OAuth state is bound to an HttpOnly SameSite=Lax browser cookie, hashed in the
database, single-use, ten-minute-lived, and tied to the signed-in manager/site/
provider. Rappi uses Authorization Code + PKCE and its **id_token** in
`Authorization-Partners`, separate from the app M2M token. Uber uses
`eats.pos_provisioning` authorization-code tokens only for discovery/provisioning;
orders use cached app client-credentials tokens. Rappi does not provide a refresh
token in this flow: reauthorize for store changes when its merchant token expires.
Expiry does not stop orders for a durably authorized, active store.

Activation/disconnection acknowledgements are **pending**, never a fabricated
connected state. Signed provisioning events or **Refresh status** reconcile the
actual state. Rappi webhook registration completes before marking the store active.
Unknown remote mutations are durable and never automatically resent. Rappi secrets
are encrypted **per event**, shared at app/environment scope with a serialized
registration lease. Existing registrations without stored keys fail closed rather
than resetting shared secrets. Unknown registration requires operator reconciliation.
Reauthorization of the same app/store preserves order and shipment history and
pending provider claims. A different app cannot take over an active store without
an explicit provider disconnection. Authoritative provider status also disables
order actions if the app is externally revoked or its Uber manager promotion is
still pending; callbacks do not depend on the original manager remaining an admin.

Approved provider/TAM setup, registered redirects, menu readiness, and a sandbox
pilot remain prerequisites. The merchant consent/configuration/provisioning/webhook
and reauthorization migrations (`20261014230900` through `20261014231600`, eight
additional files) follow the original nine; apply all in timestamp
order only through an approved deployment. No remote migration, activation,
deployment, or environment-file change is performed automatically.

## Before enabling a store

1. Obtain approved API access and test-store credentials from the provider.
2. Complete provider-side merchant authorization/provisioning. Saving a Makinari
   configuration does **not** provision the store or certify the integration.
3. Apply the forward-only `20261014230000_marketplace_schema.sql`,
   `20261014230100_marketplace_config.sql`,
   `20261014230200_marketplace_ingestion.sql`,
   `20261014230300_marketplace_actions.sql`,
   `20261014230400_marketplace_poll.sql`,
   `20261014230500_marketplace_ingestion_review.sql`,
   `20261014230600_marketplace_action_review.sql`,
   `20261014230700_marketplace_recovery_review.sql`, and
   `20261014230800_marketplace_print_review.sql` migrations, in that order, through the
   approved database deployment workflow. They have not been applied remotely by
   this implementation. Existing commerce tables and permission helpers are
   prerequisites; these files are not a complete database bootstrap.
4. Configure a nonempty server-only `ENCRYPTION_KEY` and the normal Supabase
   server credentials. No development/fallback encryption key is accepted.
5. Normally, use **Connect with Makinari**, authorize the restaurant, select a
   provider store and map it to an active native location. For the legacy Advanced
   manual receiver only, add the provider, environment, country,
   provider store ID, native location, and credentials. Only authorized managers
   can change configuration. Stored credentials are write-only AES-256-GCM
   envelopes in the native `site_secrets` table, reserved to their integration.
6. Register the callback displayed in the provider dashboard/configuration.
   Uber supports one primary webhook URL per application; the shared callback
   routes authenticated events to the configured store.
7. Subscribe to supported order, cancellation, and courier events. Do not enable
   Rappi's terminal-connectivity PING merely because this backend is reachable:
   that feature requires a separate, truthful store-terminal health integration.
8. Validate a sandbox pilot, including provider retries, manual acceptance,
   cancellation, modifiers, and courier updates, before enabling production.

Callbacks are `/api/marketplace/webhooks/uber_eats` and
`/api/marketplace/webhooks/rappi` on the configured application origin. No
credentials belong in callback URLs. A store ID is only an untrusted selector
until its exact raw request passes provider signature verification.

## Native workflow

- New orders appear in the existing table and the **Awaiting acceptance** Kanban
  column. Provider IDs, schedule, deadline when supplied, and state are metadata.
- Operators use the existing order's modal to accept/reject; acceptance includes
  an explicit cooking time. Provider confirmation, not an optimistic UI update,
  releases the order for preparation/printing.
- Early scheduled Rappi notifications have provisional prices. They cannot be
  accepted or treated as final sale totals; the released order supplies prices.
- Items/modifiers and aggregate totals are provider snapshots. Internal catalog
  pricing and promotions are not reapplied. Catalog mapping/inventory policy and
  financial payout reconciliation need separate validation; importing a sale is
  not proof that the marketplace has settled funds with the restaurant.
- Available customer identity and preparation instructions are displayed inside
  the native order; item instructions are preserved on kitchen tickets.
- Delivery orders link to native Shipments. Courier identity remains external
  metadata, never a new internal profile or a fake site-member assignment.
- Provider-owned status, tracking, pricing and courier fields cannot be edited
  through generic local commerce mutations or direct browser database writes.

## Supported actions and limitations

| Provider | Supported order actions |
| --- | --- |
| Uber Eats | Accept, deny, and cancel an order using the explicitly previous-version POS API. |
| Rappi | Accept, reject, and ready-for-pickup only when Rappi has enabled manual ready and the integration is configured accordingly. |

Uber POS denial can fall back to acceptance on its tablet. A confirmed **deny**
is therefore **rejected**, not proof of final cancellation. Uber marketplace
ready and Rappi post-acceptance cancellation are not fabricated using unrelated
delivery endpoints.

Shipments request/cancel-delivery actions are unavailable in this first
marketplace integration. Uber Direct and Rappi's own-channel logistics require
separate access and provider contracts. Merchant-managed delivery must not be
misrepresented as a platform-dispatched courier.

## Retries, uncertainty and refreshing

Event receipts and native data changes commit in one transaction. Database
failure returns retryable HTTP 503, not an acknowledgement of a lost order.
Duplicate receipts do not duplicate sales, orders, lines or shipments.

An action is durably claimed before contacting the provider. A timeout/network
failure or failure committing the result leaves it **unknown/pending**, preventing
an unsafe second accept/cancel request. Do not resolve this by clearing metadata
or manually replaying a mutation.

**Refresh provider status** invokes an authorized provider read and then applies
an authoritative snapshot. It never repeats a mutation. Uber exposes order
details; Rappi's documented new/SENT lists do not expose every accepted order.
When no supported query can confirm a state, retain the saved state and wait for
a provider event or recover with the provider's support process.

The internally authenticated `POST /api/marketplace/worker` performs bounded recovery passes:
alternating new/SENT-order recovery for Rappi and active-order/courier snapshots for Uber. The
database leases at most three stores per pass and enforces a minimum poll
interval and rotates active Uber orders using durable poll checkpoints. It never
retries an uncertain provider mutation. Scheduling lives exclusively in the
sibling API repository: `/api/cron/marketplace` dispatches once per minute.
market-fit has no cron entries, and its former worker GET no longer executes.
Reuse `SERVICE_API_KEY` in both deployments (`x-api-key`), and the existing
`CRON_SECRET` and `NEXT_PUBLIC_APP_URL` in API; the cron credential is not forwarded.
Validate migrations before deploying either side. No
remote polling schedule or production deployment was created here. The forward
migration adds Shipments to the existing Supabase Realtime publication when
needed, without changing unrelated publication members. Live
merchant onboarding, successful delivery and provider certification are not
established by offline tests.

Signed provider webhooks remain the primary delivery path. They do not depend
on the worker or scheduler. The worker is only bounded recovery/reconciliation,
not a replacement for real-time webhook delivery. Retire market-fit's schedule
and deploy its POST-only workers before enabling API dispatch.

## Review corrections

The follow-up review added failing regression cases before correcting:

- Late provisional notifications replacing already released pending orders with
  zero totals; final prices and native lines are now preserved.
- A cancellation incorrectly marking a timed-out acceptance as successful;
  operation outcomes now follow the committed database result.
- Stale shipment state after order actions, and stale courier identity/contact
  details being carried into a replacement courier.
- Rappi new-order reads consuming unrelated orders during action preflight;
  actions now use authorized native identity, while recovery alternates new and
  SENT lists without silently dropping everything after the first twenty orders.
- One failing Uber order blocking subsequent recovery; failed attempts now
  advance their polling checkpoint too.
- Provider mutations leaving a five-second Redis order list stale after the only
  realtime refresh. Connected sites bypass that cache on list reads.
- Toppings counted twice, and removed ingredients/order instructions lost during
  normalization. Provider aggregate totals remain authoritative.
- Repeated ADD/VOID printing of unchanged imported lines, missing nested kitchen
  options, suppressed cancellation tickets, and scheduled orders becoming too old
  to print before their release. Printing now uses stable native item identities,
  recursive options and the authoritative `accepted_at` timestamp; cancellation
  tickets contain only voids for quantities already recorded as printed.

Authoritative snapshots have distinct observation IDs rather than permanent
content-only deduplication. Incoming provider event retries still deduplicate by
event identity. Database review migrations are forward-only and do not modify
previous migration files. No remote migration or provider certification was run.

Remaining operational limitations: Uber recovery currently refreshes imported
orders, not orders whose initial webhook was never received. Rappi recovery fails
closed on a malformed provider list; operators must investigate the unavailable
pass rather than assume every order was imported. These are not substitutes for
provider sandbox certification, live delivery checks or production monitoring.

## Verification

From the repository root:

```sh
npm test -- --runInBand __tests__/marketplace __tests__/orders __tests__/shipments
npm run typecheck
```

Provider tests use synthetic runtime-generated credentials and HTTP doubles.
Database tests use an isolated local PostgreSQL cluster, not an environment
database URL. See [provider contracts](../lib/marketplace/providers/README.md)
for official endpoint/version references and test boundaries.