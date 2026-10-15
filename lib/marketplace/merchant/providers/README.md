# Merchant OAuth provider adapters

These server-only adapters use official public contracts fetched on 2026-10-14.
App credentials belong to a registered **third-party integration**, not to a
merchant's personal account. Merchant state, credentials encryption, authenticated
site authorization, durable operation tracking and global registration leases are
caller responsibilities. No production calls or live credentials were used.

## Interfaces

See [types.ts](types.ts) and [index.ts](index.ts). All store mutations perform fresh
token-authorized discovery and use the provider's store ID and name. A browser
store claim cannot bypass that discovery. Rappi children are flattened with their
`parent_id`. Uber location data is included for selecting the correct native site;
merchant/external IDs must not be the sole matching signal.

- `buildAuthorizationUrl(app, state, verifier)` and
  `exchangeAuthorization(app, code, verifier)`.
- `listMerchantStores(app, merchantToken)` and
  `getMerchantStoreStatus(app, merchantToken, { id })`.
- `getUberStoreIntegrationStatus(app, { id })` uses app `eats.store` credentials;
  callers must authorize their persisted native store/app association first.
- `activateMerchantStore(app, merchantToken, { id, name }, context?)`.
- `deactivateMerchantStore(app, merchantToken, { id })`.
- `registerRappiProvisioningWebhook(app, options)` and
  `registerRappiStoreWebhooks(app, merchantToken, storeId, options)`.

Only a verified existing integration yields `status: active`. Activation HTTP
acknowledgements remain `pending`; Rappi includes `batch_id`. Deactivation also
remains `pending`, not a fabricated disabled state. Uber DELETE permanently
revokes this app and requires onboarding again to reconnect.

## Official contracts

### Rappi

- [Self-Onboarding](https://dev-portal.rappi.com/en/self-onboarding/)
- [M2M authentication](https://dev-portal.rappi.com/en/authentication-process/)
- [Stores API](https://dev-portal.rappi.com/en/api-reference/stores/)
- [Webhooks API](https://dev-portal.rappi.com/en/api-reference/webhooks/)
- [Webhook events](https://dev-portal.rappi.com/en/webhook-events/)
- [Country domains](https://dev-portal.rappi.com/en/rests-api/#country-domains)

The TAM must create the integration and register the client ID and redirect URI.
Production OAuth uses `login.partners.rappi.com`; development uses
`login.partners.dev.rappi.com`. PKCE S256 with `openid profile email` is documented;
the public token exchange does **not** send `client_secret`. Its merchant token is
`id_token`, never the opaque/encrypted `access_token`. Expiry is derived only from
the ID token's `exp` as an expiry hint, not as locally verified authorization.
Rappi validates it on every authorized store request. No `offline_access` or
refresh token is requested; expiry requires merchant browser authorization again.

Self-onboarding uses `api.rappi.<country>` (and `api.dev.rappi.com`), not legacy
order `services.*` origins. Store calls require both `X-Authorization` M2M token
and `Authorization-Partners` merchant ID token. Provisioning/deprovisioning are
asynchronous and require the signed `STORE_PROVISIONING_STATUS` callback to
reconcile `ACTIVE`/`INACTIVE` results. Rappi mutations require `integration_id`
from the TAM to avoid treating another integration as this app. Unsupported PING
and menu-pull handshakes are explicitly disabled, not faked. Menu management
still requires independent per-store integration work outside these adapters.

### Uber Eats

- [Authentication](https://developer.uber.com/docs/eats/guides/authentication)
- [Sandbox](https://developer.uber.com/docs/eats/guides/sandbox)
- [Activation flow](https://developer.uber.com/docs/eats/guides/integration-activation-flows)
- [Store discovery](https://developer.uber.com/docs/eats/references/api/v1/get-eats-stores)
- [Authoritative POS status](https://developer.uber.com/docs/eats/references/api/v1/get-eats-stores-storeid-posdata)
- [Activate](https://developer.uber.com/docs/eats/references/api/v1/post-eats-stores-storeid-posdata)
- [Remove](https://developer.uber.com/docs/eats/references/api/v1/delete-eats-stores-storeid-posdata)

The confidential authorization-code flow uses only `eats.pos_provisioning`.
Official Eats docs do not document PKCE for Uber; the verifier argument is
validated but not sent. Durable single-use state and user/site binding are
mandatory. Production uses `auth.uber.com` and `api.uber.com`; sandbox uses
`sandbox-login.uber.com` and `test-api.uber.com`, never mixed environments.

GET `/v1/eats/stores` paginates via opaque `next_key` values encoded into fixed
origin requests (never followed as URLs). POST `/v1/eats/stores/{id}/pos_data`
uses documented query parameters. `pos_integration_enabled` is deprecated and
ignored; it is never sent despite a stale example in the official reference.
Native order workflow must explicitly request `is_order_manager: true` in context
and process `store.provisioned`. Pending manager promotion is not active. Menu
and order APIs continue to require separate app client-credentials tokens.

Discovery includes a subset of `pos_data` in official examples, but missing
summary fields are unknown/pending, not proof of inactivity. Status reconciliation
reads the authoritative flat GET `/v1/eats/stores/{id}/pos_data` response using
an app client-credentials token with `eats.store`, cached separately from order
tokens. Merchant `eats.pos_provisioning` is not authorized for this GET.
`integration_enabled: true` alone does not prove core order readiness: the
`order_manager_client_id` must match this app and `is_order_manager_pending` must
not be true. Signed `store.provisioned` only triggers a fresh status read.
An authoritative POS 404 indicates absent app integration; other errors never
fabricate revocation. The app-only status helper works after merchant OAuth expiry.

## Rappi shared webhook secrets and recovery

1. Serialize registration using a **global app/environment** lease across countries.
2. Load encrypted per-event app secrets, not per-store copies.
3. Register signed provisioning webhook before provisioning. Its custom key is
   persisted before dispatch, allowing safe retries with the same key.
4. Await verified store activation before adding order webhooks.
5. GET each order event's registration before any mutation. Existing registration
   requires the saved key; GET does not reveal it. Missing keys fail closed.
6. Add a newly authorized store through `add-stores`, preserving other stores.
   No automatic reset, change-URL, removal or disabling is performed.
7. New event POST returns its secret. Mandatory `persist_created_secret` saves
   it immediately, before another provider side effect. The result is a key map.

A creation timeout or persistence failure can leave an unrecoverable provider key.
Do not retry a create blindly or reset the app key: this may break other stores.
Require explicit operator recovery, with coordinated rotation for all affected
stores if the original key cannot be recovered. Provisioning acknowledgements and
unknown network outcomes must remain durable pending operations.

Country domains select API targets; official docs do not promise separate
client-level webhook secrets/configuration across countries. Do not infer country
isolation from the host. Use a stable app-level provisioning callback and registry,
never overwrite shared callback URLs or secrets during another country's onboarding.
If the same saved app key does not match a country-specific provider registration,
stop and obtain TAM confirmation of the actual scope; do not reset automatically.

Outbound calls reuse the existing fixed-origin allowlist, redirect rejection,
10-second timeout, no-store caching and 2 MiB streaming limit. Tests use runtime
synthetic secrets and real `Response` objects with offline fetch doubles.