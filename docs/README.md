# Repository Documentation

This directory contains operational documentation for the Makinari application.
Use the guides below before relying on older implementation notes.

## Start here

- [Development](DEVELOPMENT.md) — local setup, scripts, tests, and validation.
- [Architecture](ARCHITECTURE.md) — runtime boundaries and repository layout.
- [Security](SECURITY.md) — mandatory controls for auth, data access, payments,
  public links, webhooks, and outbound requests.
- [Database migrations](DATABASE_MIGRATIONS.md) — safe Supabase migration workflow.
- [Critical flow security rollout](SECURITY_FINDINGS_ROLLOUT.md) — purchase permissions,
  internal webhook visibility, task reordering, and deployment validation.
- [Environment variables](ENVIRONMENT_VARIABLES.md) — configuration by subsystem.
- [Maintenance](MAINTENANCE.md) — dependency, documentation, and release hygiene.
- [SPA navigation reliability](NAVIGATION_RELIABILITY.md) — idle session recovery,
  consent-only document reloads, and middleware lookup deadlines.
- [`specs/context.md`](../specs/context.md) — browser-test routes, roles, targets,
  and data assumptions.
- [E2E execution and evidence](E2E_TESTING.md) — safe suite selection, fixtures,
  run provenance, strict assertions and unresolved live-verification blockers.

## Integration guides

- [Content Creator speech voice/language options](CONTENT_CREATOR_AUDIO.md)
- [Agent channel phone numbers](AGENT_CHANNEL_NUMBERS.md)
- [Accounting integrity and rollout](ACCOUNTING.md)
- [Financial due dates and subscription terms](FINANCIAL_DUE_DATES.md)
- [POS inventory availability and backorder markers](POS_INVENTORY.md)
- [Site archival](SITE_ARCHIVAL.md)
- [Instance and requirement deletion](INSTANCE_DELETION.md)
- [Support chat identity](CHAT_IDENTITY.md)
- [Outstand Instagram DM display identity](OUTSTAND_DM_IDENTITY.md)
- [Public social comment conversations and reply context](SOCIAL_COMMENT_CONVERSATIONS.md)
- [Chat intervention delivery and voice/Temporal boundaries](CHAT_INTERVENTION_DELIVERY.md)
- [Lead outbound-call consent editing](LEAD_CALL_CONSENT.md)
- [Lead invoice balance payments](LEAD_INVOICE_PAYMENTS.md)
- [Public visitor sessions and image delivery](PUBLIC_VISITOR_AND_IMAGE_DELIVERY.md)
- [Embedded application and external tracker diagnostics](EMBEDDED_APPLICATION_DIAGNOSTICS.md)
- [Report sections and data contracts](REPORTS.md)
- [Report exports](REPORT_EXPORTS.md)
- [Automated outreach settings](OUTREACH_SETTINGS.md)
- [Pending ICP mining list selection](ICP_MINING_LIST_SELECTION.md)
- [Daily Standup settings](DAILY_STANDUP_SETTINGS.md)
- [Stripe setup](STRIPE_SETUP.md)
- [Stripe environment variables](STRIPE_ENVIRONMENT_VARIABLES.md)
- [Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md)
- [Subscription invoice settlement and recovery](STRIPE_INVOICE_RECOVERY.md)
- [Monthly credit reset and protected balances](BILLING_CREDIT_RESET.md)
- [Social network OAuth](SOCIAL_NETWORK_OAUTH_SETUP.md)
- [Content and Outstand deletion](CONTENT_DELETION.md)
- [Content loading and trend-provider availability](CONTENT_RELIABILITY.md)
- [Google authentication](GOOGLE_AUTH_SETUP.md)
- [Magic links](MAGIC_LINKS_SETUP.md)
- [Secure Tokens API](../app/api/secure-tokens/README.md)

Integration guides explain setup details, but the code and migrations remain the
source of truth for implemented behavior. Revalidate event names, routes, and
environment variables before changing production configuration.

## Architecture reviews

- [External API authentication audit and remaining authorization debt — 2026-09-30](API_AUTH_AUDIT_2026-09-30.md)
- [Local QA repair and live-test blockers — 2026-09-29](QA_REPAIR_2026-09-29.md)
- [Static analysis repair — 2026-09-29](STATIC_ANALYSIS_REPAIR_2026-09-29.md)
- [Redis/Upstash availability and self-amplification audit — 2026-09-20](REDIS_UPSTASH_AVAILABILITY_AUDIT_2026-09-20.md)

## Implementation notes

The following documents record specific implementations. They are useful
background, not canonical architecture or security policy:

- `HTML_CLEANING_SOLUTION.md`
- `LOGGING_SYSTEM.md`
- `NAVIGATION_HELPERS.md`
- `PERFORMANCE_OPTIMIZATIONS.md`
- `REFRESH_PREVENTION_IMPLEMENTATION.md`
- `RLS_SECURITY_FIX.md`
- `WEBHOOK_IDEMPOTENCY.md`
- `WORKFLOW_RESPONSE_DETECTION_EXAMPLE.md`

Some implementation notes predate the current code. When they conflict with
tests, timestamped files in `supabase/migrations/`, or the current
implementation, follow the latter and update the note in the same change.

`WORKFLOW_WEBHOOK_INTEGRATION.md` and
`WORKFLOW_RESPONSE_DETECTION_EXAMPLE.md` are explicit retirement markers for a
route that no longer exists. Keep them only while external links may still
reference those paths.

## Documentation conventions

- Write repository documentation and code examples in English.
- Prefer links to source files over copied implementation blocks.
- Document commands exactly as they appear in `package.json`.
- Never include real credentials, customer data, internal access tokens, or
  production-only URLs that are not already public configuration.
- Date-sensitive implementation notes should identify the migration or source
  file that establishes the behavior.
- Update this index when adding, renaming, or retiring a guide.
