# Test Spec: Workspace Navigation Smoke

## Status

Ready

## Goal

Verify that all major workspace areas load successfully for an authenticated Admin user. The massive original test has been split into a battery of tests per functional area.

## User Roles

- `admin` (shared Playwright setup using `.auth/<target>/<run-id>/admin.json`)

## Tests in this Battery

1. **Marketing Area Navigation** (`tests/marketing-navigation.test.yaml`)
   - Paths: `/campaigns`, `/segments`, `/promotions`, `/content`, `/assets`
   
2. **Sales Area Navigation** (`tests/sales-navigation.test.yaml`)
   - Paths: `/pos`, `/catalog`, `/price-lists`, `/subscriptions`, `/sales`, `/leads`, `/deals`, `/quotations`, `/people`

3. **Operations Area Navigation** (`tests/operations-navigation.test.yaml`)
   - Paths: `/chat`, `/records`, `/orders`, `/shipments`, `/control-center`, `/reservations`, `/visits`, `/inventory`

4. **Buying & Finance Area Navigation** (`tests/finance-navigation.test.yaml`)
   - Paths: `/bills`, `/transactions`, `/purchases/orders`, `/purchases/quotes`, `/finance`, `/accounting/entries`, `/costs`

5. **Settings & Agents Area Navigation** (`tests/settings-navigation.test.yaml`)
   - Paths: `/dashboard`, `/dashboard?tab=analytics`, `/settings`, `/integrations`, `/billing`, `/applications/database`, `/agents`, `/requirements`

## Preconditions

- The test account has a valid session and at least one active site.
- `app.makinari.com` / `localhost:3000` is reachable.

## Assertions

- `VERIFY: The page has loaded successfully` on each route.

## Production read-only smoke contract

The separate `tests/smoke/` suite selects the exact configured workspace and
requires pre-existing named content, lead and public catalog fixtures. A search
control or shell alone cannot pass. Fixture visibility and completed response-body
inspection use a bounded 45-second read budget; Server Actions dispatch serially
on the client, so ancillary reads may precede the fixture read. Errors, failed
API statuses, empty fallback shells and unresolved required reads still fail.

Next.js speculative prefetch streams, including their redirected request chain,
are not required current-screen reads. They are excluded only from the drain
counter; their HTTP failures are still observed. Before full document navigation,
the smoke drains actual requests and response inspection instead of aborting
them and then reporting an artificial response-body failure at teardown.

## Implementation Plan

- Test files are split by module logic to keep Playwright timeouts under control and enable parallel runs in CI.
