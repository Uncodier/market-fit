# Repository Documentation

This directory contains operational documentation for the Makinari application.
Use the guides below before relying on older implementation notes.

## Start here

- [14035 integration readiness](MERGE_14035_READINESS.md) — route inventory,
  commercial proxy checks, merge preparation and outstanding release gates.

- [Licensing](LICENSING.md) — source-available procurement scope, permitted internal use, commercial licensing requirements and base-license limitations.
- [Module guide](MODULES.md) — current module purposes, capabilities, practical usage,
  cross-module workflows, and implementation limits.
- [Workspace and public commerce guide](MODULES_COMMERCE_AND_ACCOUNT.md) — account tools,
  storefronts, checkout, booking, buyer portal, and public documents.
- [Development](DEVELOPMENT.md) — local setup, scripts, tests, and validation.
- [Architecture](ARCHITECTURE.md) — runtime boundaries and repository layout.
- [Localization coverage and repair](LOCALIZATION_AUDIT.md) — dictionary checks,
  translated surfaces, and remaining hardcoded legacy UI.
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
- [Local QA provisioning](QA_PROVISIONING.md) — deterministic disposable fixtures,
  local safety gates, private ownership journal and offline regression tests.
- [Production harness canaries](HARNESS_PRODUCTION_CANARIES.md) — five explicitly
  scoped requirement tests and a read-only local cron observer; separate from browser suites.

## Integration guides
- [POS receipt printing](POS_PRINTING.md) — direct USB setup, explicit system printing, transport failures, and PostScript driver troubleshooting.
- [Time zone selection](TIMEZONE_SELECTION.md)

- [Unified account search](HOME_SEARCH.md)

- [Course learning experience](COURSE_LEARNING_EXPERIENCE.md) — shared purchased/demo course player, catalog metadata, progression and media safety.

- [Procurement demo walkthrough](PROCUREMENT_DEMO.md) — local fictional fixtures, navigable buyer screens, safety limits and validation.
- [Tender quotation review](PROCUREMENT_QUOTATION_DETAIL.md) — formal buyer quotation details, supplier information, shared certificates and the single-target read migration prerequisite.

- [Open public tender participation](PROCUREMENT_OPEN_PARTICIPATION.md)

- [Native Rappi and Uber Eats orders](MARKETPLACE_ORDERS.md)
- [Public marketplace sorting and featured rankings](MARKETPLACE_SORTING.md)
- [Shared catalog search consumers](CATALOG_SEARCH.md)
- [Content Creator speech voice/language options](CONTENT_CREATOR_AUDIO.md)
- [Content Creator account-specific destinations](CONTENT_CREATOR_DESTINATIONS.md)
- [Agent channel phone numbers](AGENT_CHANNEL_NUMBERS.md)
- [Agent channel activation and billing capacity](AGENT_CHANNEL_ACTIVATION.md)
- [Shared email-domain setup](EMAIL_DOMAIN_REUSE.md)
- [Accounting integrity and rollout](ACCOUNTING.md)
- [Financial due dates and subscription terms](FINANCIAL_DUE_DATES.md)
- [POS inventory availability and backorder markers](POS_INVENTORY.md)
- [POS customer search and offline fallback](POS_CUSTOMER_SEARCH.md)
- [POS cash register shifts and closing history](POS_REGISTER.md)
- [POS checkout conflicts and payment recovery](POS_CHECKOUT_RECOVERY.md)
- [POS soft updates and connection recovery](POS_UPDATE_RECOVERY.md)
- [Location self-service Shop ordering and payment release](SHOP_SELF_SERVICE.md)
- [Catalog category archival](CATALOG_CATEGORY_ARCHIVAL.md)
- [Catalog import and large catalogs](CATALOG_IMPORT.md)
- [Site archival](SITE_ARCHIVAL.md)
- [Per-site license limits and upgrade dialogs](SITE_LICENSE_LIMITS.md)
- [Instance and requirement deletion](INSTANCE_DELETION.md)
- [Support chat identity](CHAT_IDENTITY.md)
- [Outstand Instagram DM display identity](OUTSTAND_DM_IDENTITY.md)
- [Public social comment conversations and reply context](SOCIAL_COMMENT_CONVERSATIONS.md)
- [Chat intervention delivery and voice/Temporal boundaries](CHAT_INTERVENTION_DELIVERY.md)
- [Lead outbound-call consent editing](LEAD_CALL_CONSENT.md)
- [Lead invoice balance payments](LEAD_INVOICE_PAYMENTS.md)
- [Public visitor sessions and image delivery](PUBLIC_VISITOR_AND_IMAGE_DELIVERY.md)
- [Embedded application and external tracker diagnostics](EMBEDDED_APPLICATION_DIAGNOSTICS.md)
- [Security resource provenance and display order](SECURITY_RESOURCE_PROVENANCE.md)
- [Location access foundations and activation gates](LOCATION_ACCESS_IMPLEMENTATION.md)
- [Location ACL enforcement, member editor, and rollout](LOCATION_ACCESS_ENFORCEMENT.md)
- [Location ACL review and corrective migrations](LOCATION_ACCESS_REVIEW.md)
- [Commerce RLS planning and POS polling repair](COMMERCE_RLS_PLANNING.md)
- [Resource amplification guards for polling, caches and Realtime](RESOURCE_AMPLIFICATION_GUARDS.md)
- [Report sections and data contracts](REPORTS.md)
- [Demo report data and isolation](DEMO_REPORTS.md)
- [Report exports](REPORT_EXPORTS.md)
- [Automated outreach settings](OUTREACH_SETTINGS.md)
- [Pending ICP mining list selection](ICP_MINING_LIST_SELECTION.md)
- [Daily Standup settings](DAILY_STANDUP_SETTINGS.md)
- [Stripe setup](STRIPE_SETUP.md)
- [Stripe sale payment fee policy and rollout](STRIPE_SALE_PAYMENT_FEES.md)
- [Annual Stripe Price provisioning script](STRIPE_ANNUAL_PRICE_SCRIPT.md)
- [Stripe environment variables](STRIPE_ENVIRONMENT_VARIABLES.md)
- [Stripe webhook security](STRIPE_WEBHOOK_SECURITY.md)
- [Stripe sale currency and wallet recovery](STRIPE_SALE_CURRENCY_RECOVERY.md)
- [Stripe sale total payment fee schedule and rollout](STRIPE_SALE_COMMISSION_RATES.md)
- [Subscription invoice settlement and recovery](STRIPE_INVOICE_RECOVERY.md)
- [Monthly credit reset and protected balances](BILLING_CREDIT_RESET.md)
- [No-card 15-day Startup trial](STARTUP_TRIAL.md)
- [Automatic credit top-up rollout](AUTO_TOP_UP.md)
- [Monthly/annual pricing UI and signup preference](ANNUAL_PRICING_UI.md)
- [Site setup launch and safe status feedback](SITE_SETUP_LAUNCH.md)
- [Social network OAuth](SOCIAL_NETWORK_OAUTH_SETUP.md)
- [Content and Outstand deletion](CONTENT_DELETION.md)
- [Content loading and trend-provider availability](CONTENT_RELIABILITY.md)
- [Google authentication](GOOGLE_AUTH_SETUP.md)
- [Magic links](MAGIC_LINKS_SETUP.md)
- [Secure Tokens API](../app/api/secure-tokens/README.md)

Integration guides explain setup details, but the code and migrations remain the
source of truth for implemented behavior. Revalidate event names, routes, and
environment variables before changing production configuration.

## Product designs

- [Procurement implementation](PROCUREMENT_IMPLEMENTATION.md) — local operational routes, security, migration prerequisites, validation and remaining workflows.
- [Inventory replenishment](PROCUREMENT_REPLENISHMENT.md) — SKU/location minimums, draft requisitions, duplicate guards and deployment-gated inventory worker.
- [Procurement repair validation](PROCUREMENT_REPAIR_VALIDATION.md) — review regressions, local PostgreSQL/PostgREST checks and rollout prerequisites.
- [Procurement localization](PROCUREMENT_LOCALIZATION.md) — deep five-language coverage, preserved business data and locale-switch regression checks.
- [Procurement delivery checklist](PROCUREMENT_DELIVERY_CHECKLIST.md) — full agreed scope tracked independently of route availability.
- [Procurement UI reuse](PROCUREMENT_UI_REUSE.md) — prescribed screen references, shared components, verification evidence and visual acceptance limits.
- [Procurement settings and rules](PROCUREMENT_POLICIES_DESIGN.md) — direct purchases and tenders, net thresholds, cumulative requirements, human/AI approvals, supervisor exceptions, urgent presets and deadlines; design only, with remaining decisions tracked explicitly.
- [Team Settings location-scoped access](LOCATION_ACCESS_DESIGN.md) — target restricted-location model and module matrix; implementation, supported boundaries, limitations, and deployment steps are in the enforcement guide.
- [Suppliers, procurement, tenders, and the unified account portal](/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/PROCUREMENT_AND_TENDERS_DESIGN.md) — planned model, screens, Marketplace-style global `/tenders`, UI/UX reuse references, and `/buyer` to `/home` migration; not implemented behavior.
- [Procurement certifications and tender evidence](PROCUREMENT_CERTIFICATIONS_DESIGN.md) — profile credentials, optional representation evidence, provisional AI review, scoped acceptance and platform retention; not implemented behavior.

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
