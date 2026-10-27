# Test Spec: Disposable QA Coverage and Completion Gaps

**Scope:** Existing Robot/social CRUD and cross-channel reservations, with local
Supabase and Stripe test mode; no external OAuth credentials.
**Source material:** User request, source inventory below, and the provisioning
agent's proposed fixture contract. This is a plan, not a live verification report.
**Priority:** No upstream P0–P3 priorities were supplied. All formal priorities are
`UNKNOWN`; the sequence below is a recommended implementation order.

## Three-phase execution contract

The user requested an initial fixture battery, execution in the disposable
environment, and completion of journeys previously blocked on that environment.

1. **Prepare a disposable environment and identities.** Confirm local schema,
   auth, tenant isolation, roles, fixture ownership and expiry before any test
   mutation. Provisioning is a prerequisite, not evidence that a UI journey works.
2. **Exercise the existing feasible suites.** Authenticate dedicated accounts,
   select the exact workspace, run supported read/CRUD/role journeys, collect
   exact-run reports, and verify scoped cleanup. Explicitly retain unsupported
   Robot/social guards; do not turn blocked journeys into empty successes.
3. **Author and verify the missing complete live journeys.** Finish POS/manual/
   Shop reservation evidence and paid Stripe paths. Real social connection,
   reconnect, pending-account selection and disconnect remain a separate
   credential-dependent OAuth sweep. Each journey needs its own ownership journal,
   assertions and cleanup before it can claim completion.

This division separates environment delivery, reuse of existing tests, and new
live-flow authoring. It does not authorize production or provider mutations.

## Testing what and mandatory invariants

- A created entity has an identity attributable to this run before an ambiguous
  response, navigation failure or rename can orphan it.
- Reads prove persisted values for the same tenant, actor and entity; toast text,
  a checkout URL, dialog closure and row-count increases are insufficient alone.
- Cleanup uses exact journaled identities and user-scoped authorization. A lost
  response requires reconciliation, not blind replay, generic-name deletion,
  deleting the last card, service-role resets or dropping tenant data.
- Reservations correlate catalog item, customer, order line, payment state and
  channel. Do not assume `reservations` has a channel/source column: follow the
  order/sale association and actual checkout source.
- A Stripe result requires an actual test-mode payment and authenticated/signed
  server settlement evidence. Cash, zero-price orders and local billing
  entitlements are not Stripe evidence.
- Keep RLS, location access, permissions, billing limits, trusted pricing,
  origin checks, webhook signatures and idempotency enabled.

Environment/missing-fixture failures are `BLOCKED`, not successful skips. A
verified environment followed by a broken product assertion is `FAIL`.
Orchestration interruption without sufficient evidence is `ABORTED`.

## Feasible versus blocked matrix

“Feasible” means technically authorable with the stated local capabilities. It
does not mean an execution occurred or that fixtures have already been delivered.

| Behavior | Local Supabase + Stripe test key, no OAuth | Existing artifact / gap | Selected proof and next action |
| --- | --- | --- | --- |
| Mutation safety, evidence gates, supported social platform configuration | Feasible now, nonmutating | Jest contracts exist | Run targeted Jest; preserve rejection behavior. |
| Existing named reads and supported CRUD/role suites | Feasible after schema/auth/fixture preflight | Provisioning agent is preparing prerequisites, not live passes | Existing browser suites plus exact user-scoped persistence/cleanup reads. Validate effective roles, not only membership labels. |
| Robot session read/rename on an exact run-owned pending fixture | Conditionally feasible; fixture absent | Placeholder has default name; existing Robot YAML intentionally throws | Author a separate fixture-backed read/rename test with UUID/site/creator journal. Do not call it UI creation coverage. Preflight cleanup before navigating to Robots. |
| Robot UI create → persist → delete | Blocked under Supabase + Stripe alone | No failed-create reconciliation fixture; deletion needs external orchestration API | New live flow and exact-response capture/reconciliation, plus real orchestration deletion service with provider shutdown and atomic cleanup. No direct DB-delete substitute. |
| Social add/select/save/reload/remove an inactive **id-less draft** | Conditionally feasible; new narrow test required | New cards are form entries, not connected provider accounts | Use an exclusively run-owned site with empty social settings, verify inactive/no provider ID, persist and remove only that draft. This is settings persistence, not OAuth CRUD. Stop on unexpected entries or concurrent changes. |
| Real Pinterest/social connection, reconnect, pending selection/finalize, implicit callback sync and remote disconnect | Blocked without external integration/account credentials | Current social CRUD YAML intentionally throws; active identity comes from Outstand | New live OAuth authoring and dedicated provider account/Outstand setup, stable account ID, tenant authorization review and remote cleanup verification. Never seed fake active accounts. |
| Create run-named reservable catalog item | Feasible after baseline fixtures | YAML names item before creation and journals catalog UUID after UI success | Existing create segment plus RLS read of item flags; add failed-response reconciliation and explicit price/publication/availability checks. |
| Manual reservation create | Feasible after customer/availability fixtures and new identity capture | Current YAML asserts an increased “Confirmed” count only | Capture successful action's exact reservation ID; prove site/item/customer/start/end/status via RLS; journal cleanup. |
| Shop zero-total cash reservation | Feasible after storefront/cash/identity fixtures and new correlation | Current YAML finishes at `#your-orders`; it is explicitly not Stripe coverage | Capture order/sale/line IDs and exact associated reservation; prove persisted state and cleanup, not just hash navigation. |
| POS reservation completion | Feasible with local fixtures; needs rewritten completion segment | YAML stops at `/checkout`, but current POS opens an in-page payment dialog | Author current payment-dialog flow, customer/run identity, register prerequisites, sync confirmation, exact order/sale/reservation reads and cleanup. Cash completion is valid local POS evidence, not Stripe evidence. |
| Nonzero paid Shop reservation / paid order | Feasible only after Stripe webhook + pricing/payment configuration | No complete paid reservation YAML in this group | New Stripe test Checkout flow, real test card, provider session/PaymentIntent correlation, signed webhook delivery, settlement and buyer/reservation reads. A test secret key alone is insufficient. |
| Full three-channel reservation agent result | Blocked today by test/evidence/cleanup gaps, not inherently by OAuth | Agent requires three distinct persisted reservation observations and verified cleanup | Finish POS flow, strengthen Shop/manual evidence and build exact dependency cleanup; retain full gate until all three have successful UI artifacts. |

## Robot ownership and cleanup findings

- `app/robots/use-instance-creation.tsx:30–63` performs a browser/user-scoped
  `remote_instances` insert with `name: 'Assistant Session'`, pending status,
  site/user/creator and a returned row. The name is an application literal, not
  a unique run marker. The hook checks lifecycle after insertion and may discard
  the returned identity if the site context changed.
- `app/robots/use-instance-creation.tsx:159–200` can auto-create when an empty
  site loads. Consequently a fresh site does not make `/robots` read-only.
  Capture pre-navigation intent and reconcile only an exclusively owned site's
  new exact rows; a generic name alone cannot establish ownership.
- `app/robots/use-robots-controller.tsx:253–278` renames after creation. Renaming
  cannot repair ownership of a failed create whose UUID was never recorded.
- `app/robots/delete-robot-instance.ts:14–35` requires a matching successful
  `instance_id` response. `app/api/robots/instance/delete/route.ts:46–100` checks
  unrestricted location access, owner/admin plus delete capability, forwards the
  user's token to the configured API, and expressly forbids independent database
  fallback. The external API owns shutdown and atomic deletion.
- `tests/crud-robot.test.yaml:8–18` remains intentionally blocked.
  `tests/support/mutation-fixtures.ts:7–16` supports neither Robot nor social nor
  reservation/order dependencies; do not force them into generic CRUD cleanup.

## Social ownership and cleanup findings

- `app/components/settings/SocialSection.tsx:74–88` prepends a blank inactive
  form entry; card/DOM identity is array-index based (`SocialAccountCard.tsx:87`).
  OAuth platforms expose Connect Account, not an editable run-specific identity
  (`SocialAccountCard.tsx:232–268`, `social-section-config.tsx:40–54`).
- `SocialSection.tsx:171–184` disconnects remotely before removing and saving the
  form entry. `disconnect-remote-accounts.ts:58–77` calls no provider when `id`
  is absent, but calls `/api/social/accounts/<id>` when an ID exists. This makes a
  strictly inactive id-less draft a possible **separate** local settings case.
- Provider identity (`id`, nickname, network unique ID) is mapped into settings
  by `app/api/social/lib/sync-outstand-accounts.ts:19–36,60–140`. Matching may use
  empty/inactive slots, so an index or platform is not durable account ownership.
- Auth URL and account deletion proxy to Outstand with a server service API key
  (`app/api/social/[network]/auth-url/route.ts:19–36` and
  `app/api/social/accounts/[accountId]/route.ts:19–44`). Local Supabase cannot
  replace this provider boundary. Bluesky uses real account credentials too.
- `docs/SOCIAL_NETWORK_OAUTH_SETUP.md:6–24,47–74` records the callback/session/
  finalize flow and explicit tenant-authorization debt. The shared client adds
  authenticated and unrestricted-location checks (`app/api/social/supabase-client.ts:43–45`),
  but this is not proof of requested-site manager authorization. Do not weaken or
  copy this boundary into a fixture shortcut.
- `tests/crud-settings-social.test.yaml:8–18` must retain its real OAuth blocker.

## Reservation completion gaps and acceptance criteria

1. **Catalog:** `create-reservable-item.test.yaml:13–35` sets a run name and
   reservation flag but no explicit nonzero price, availability or storefront
   publication. `fixture.ts:18–32` stores only item/site/run identity; it does not
   journal customers, orders, payments or reservations.
2. **POS drift:** `reserve-in-pos.test.yaml:29–40` uses a generic customer name
   and a timestamp email outside the shared run journal. Lines 75–82 demand a
   `/checkout` URL. Current `app/pos/hooks/use-pos-checkout.ts:127–135` opens a
   payment dialog; `PaymentConfirmationDialog.tsx:104–114,139–141` exposes
   pay/send/complete intents. `/checkout` actually buys credits
   (`app/checkout/page.tsx:76–89`). Update the journey to the real POS flow;
   do not redirect or mock the application to satisfy this stale expectation.
3. **Durable POS result:** Current checkout enqueues work and observes background
   confirmation (`use-pos-checkout.ts:162–280,329–335`). Require a confirmed sync
   outcome from the current attempt, not a cleared cart or closed payment dialog.
   Resolve reservation through its exact `sale_order_item_id`.
4. **Shop:** `reserve-in-shop.test.yaml:56–66` asserts a zero-total cash/hash
   result. Author a separate nonzero Stripe case rather than relabel this one.
5. **Manual:** `reserve-in-reservations-page.test.yaml:74–90` asserts a count
   increase. The actual dialog calls `submitServiceReservationForm`
   (`app/reservations/components/reservation-dialog-submit.ts:188–204`), which
   awaits `saveServiceReservation`, then discards the successful row locally.
   `app/reservations/sale-order-actions.ts:261–313` returns `{ data: Reservation }`
   after reservation persistence and order/sale creation. An order failure can
   return `{ error }` after the reservation already committed. Capture the
   decoded save action result, not an arbitrary UUID from the Flight/UI payload,
   and reconcile partial commits before any retry or cleanup.
6. **Persistence:** `app/commerce/checkout-reservations.ts:112–174` links order
   lines and creates/updates pending or confirmed reservations based on intent
   and full payment. Verify expected channel-specific state, dates, quantity,
   customer and same-site links; do not infer paid from reservation presence.
7. **Stripe:** `app/api/stripe/checkout/order/route.ts` creates Checkout sessions;
   `app/api/stripe/webhook/route.ts:15,70` uses the webhook secret/signature;
   `sale-checkout-settlement.ts:53–94,100–139` checks complete/paid session state
   and validates settlement identifiers. Required paths include successful
   nonzero payment, cancel/no settlement, authentic webhook replay without a
   second reservation/charge, and recoverable interrupted return. Never forge
   provider responses or manually mark records paid.
8. **Cleanup:** Journal exact customers, reservation IDs, order/sale/line IDs,
   test Stripe resources and catalog item. Inspect actual FK/accounting/payment
   side effects before defining teardown. Preserve financial audit invariants;
   verify allowed terminal/archive states through user-scoped reads, and report
   anything not safely removable. The existing agent expressly requires exact
   cleanup (`reserve-across-channels.md:170–182`), not a broad reset.

## Fixtures, prerequisites and recommended order

1. **Baseline first:** Verify a complete local schema. The repository does not
   contain a full bootstrap history (`docs/DATABASE_MIGRATIONS.md:8–15`), so
   applying the checked-in migrations alone is not a proven local setup.
   Require explicit local URLs/site names/UUIDs, both mutation flags, public-key
   browser/verification access, fresh per-role auth state, and foreign-site denial.
2. **Provisioning handoff:** The provisioning agent proposes deterministic
   admin/collaborator/marketing/foreign/buyer identities, main and foreign sites,
   settings, categories/company/accounting prerequisites, inactive agent,
   pending campaign, catalog products/service, content and buyer-linked lead,
   plus a private ownership-intent journal under `.auth/qa-fixtures/<id>`.
   Its contract does **not** include Robot, OAuth, completed reservations,
   Stripe payments or environment cleanup. This paragraph is a planned contract,
   not confirmation of seeded data or local execution.
3. **Reuse existing suites next:** Validate readable smoke names and effective
   roles, then supported mutation tests with existing exact cleanup. Coordinate
   fixture aliases; reservation manual UI specifically needs
   `TEST_RESERVATION_CUSTOMER_ID` and `TEST_RESERVATION_CUSTOMER_NAME`.
4. **Finish provider-free reservation paths:** Declare timezone/business hours,
   future nonoverlapping slots, published reservable item and price, customer,
   service/delivery restrictions, cash payment eligibility, origin location and
   POS register session for paid cash. Rewrite POS completion and strengthen
   manual/Shop ID capture before running the full agent gate.
5. **Add paid Stripe flow:** Configure test-mode secret, supported currency,
   positive server-owned price, trusted return origins, signed webhook secret
   and delivery to the local endpoint, settlement schema and buyer identity.
   Use a real test Checkout session and payment; keep resource IDs in private
   evidence. Coordinate any Stripe cleanup/refund with explicit authorization.
6. **Defer external cases honestly:** Robot full deletion needs the real local
   orchestration service. Social needs dedicated Outstand/provider accounts and
   registered callbacks, plus new successful/error/pending/implicit/reconnect/
   disconnect tests. A Stripe key does not unlock these integrations.

## Evidence collected in this analysis

- Only source inspection and nonmutating Jest ran; no browser, provider or
  database mutations, deployment, build or live fixture provisioning occurred.
- Command (npm on the installed Homebrew PATH):
  `npm test -- --runInBand __tests__/e2e/mutation-safety.test.ts __tests__/e2e/agent-evidence.test.ts __tests__/components/settings/social-section-config.test.ts`
  completed with **3 suites / 60 tests passed**. This proves these local contracts
  only; it is not a live Robot/social/payment/reservation pass.
- No existing guard, YAML, application or provisioning file was edited by this
  analysis. Future live reports must name target/run/actor/site, exact artifacts,
  persisted observations, cleanup and residual blockers. Missing POS completion
  or cleanup must continue to prevent a full reservation PASS.