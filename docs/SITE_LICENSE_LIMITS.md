# Per-site license limits

## Scope and admission

Licenses belong to `billing.site_id`. Toolbox (`commission`) includes one member,
Engine five, Foundry ten, and Enterprise/Reactor supports teams above ten without
a configured upper seat cap. This is not a quota on the number of projects owned
by a user. No site-count limit is introduced.

The primary owner reserves one seat, even when their `site_members` row is absent.
Active members and pending invitations reserve seats. Rejected memberships do not.
Connection add-ons never purchase member seats. Suspended memberships retain their
original active/pending status but do not authorize workspace access.

The team selector loads the authenticated site's member-license summary. At the
limit, selecting a new invitation opens the upgrade dialog before creating a
draft. A last-seat race returns a structured `MEMBER_LIMIT` response that opens
the same dialog instead of an invitation failure toast. Drafts are retained when
a partially saved batch needs an upgrade.

Accepting an unsuspended pending invitation does not consume a second seat. A
suspended invitation shows a license dialog without an error toast. Only a trusted
existing owner/manager can navigate to upgrade that site's billing. Other invitees
are instructed to ask the owner, then explicitly retry; acceptance does not run in
an automatic retry loop. Emails require a previously reserved membership.

## Effective changes and reversible suspension

`20261007220000_site_license_enforcement.sql` enforces admission under a parent-site
lock and reconciles effective billing changes. PostgreSQL, not browser counters,
owns the invariant. Direct Data API and service writes pass through the same
triggers. Repeatable-read license writes fail closed with a serialization error;
callers must retry the complete transaction using supported isolation.

When allowances shrink, the primary owner stays enabled, followed by the earliest
members by trusted `created_at`, with ID as a deterministic tie-breaker. Remaining
members are marked `license_suspended`, not removed. An upgrade or a freed seat
restores eligible license-suspended members in that order. Role, invitation status,
assignment history and business records remain intact.

Connected social accounts retain limits 1/3/6/10; custom agent connections retain
0/1/3/10. The web channel is not a paid custom connection. Social and custom-channel
excesses share one `addons_count` pool. Resource JSON receives protected
`_license.order` metadata; future additions keep server-assigned order even when
the client prepends or reorders cards. The initial backfill uses existing social
array order, then agent array order because historic cross-category chronology
was not persisted. ID-less legacy records use a state-independent fingerprint;
changing their identifying fields makes them a new, later resource.

Existing duplicate identities are retained, not merged or deleted. Each stored
occurrence receives a distinct server-managed order and consumes capacity when
active. Writes cannot introduce duplicates or increase an existing identity's
occurrence count. Duplicate edits, reorders or removals must retain the returned
`_license` metadata to match the correct stored occurrence. Unchanged arrays may
omit this metadata; ambiguous changes fail closed rather than transferring another
record's suspension or restoration state.

Excess socials become inactive and excess custom channels receive the
`license_suspended` status. Original activation state is retained in `_license`
only for resources suspended by licensing. Increasing allowances restores those
resources, not manually disconnected resources. Removing a suspended connection
also removes its restoration intent. A social record already inactive because of
licensing needs an authorized server action/removal to distinguish an intentional
manual disconnect from an ordinary settings save.

The app's publication and routing selectors exclude suspension markers even if
provider metadata reports a connection as active. Settings writes publish the row
returned after database enforcement, not the optimistic submitted JSON. The app
does not delete provider accounts as part of a downgrade. Independently running
provider/Temporal jobs must honor the same persisted flags; stopping work already
dispatched by external services is not implemented by this repository.

## Upgrade and billing safety

The billing selector displays seat allowances and highlights the minimum plan for
the site's member and connection demand, including suspended resources. If even
Enterprise exceeds connection allowances, extra connection add-ons are still
required; it does not mean unlimited connections. A URL's `requiredPlan` is only a
display preference, not authority to change billing.

Upgrade deep links select only an accessible site before rendering its billing.
The previous site's checkout is never rendered while selection is pending.
Paid changes keep the existing Stripe confirmation/portal and annual-price
contracts. No provider account is disconnected before Stripe confirms a change;
suspension is an effective database entitlement transition, not a button-click
side effect. Scheduled cancellation retains current allowances until terminal
subscription status.

## Rollout and validation

Apply the forward migration only after explicit approval of the database target,
reviewing existing triggers, policies and shared API credit/annual prerequisites.
It includes a non-destructive backfill that immediately suspends existing excesses;
review the impact before application. Deploy the migration before the application
uses the new column and service-only `get_site_member_license` RPC. Missing or
malformed licensing data produces availability failure, never a guessed valid
entitlement. No migration is applied merely by adding this file.

### Failed draft installation: duplicate resource identity

The original draft rejected legacy duplicate resource identities even during a
member-only settings synchronization. The corrected draft handles those stored
occurrences as described above; it does not bypass triggers or remove accounts.
Its disposable PostgreSQL regression reproduces the full member-reconciliation
failure before verifying the fix.

If execution failed inside the complete `BEGIN`/`COMMIT` transaction, the schema
and backfill changes from that execution roll back. If the SQL connection remains
in an aborted transaction, run `ROLLBACK;` before retrying. After confirming that
`20261007220000` has never committed in the target environment, execute the entire
corrected file, not just its final backfill block or a previously copied version.
Do not mark a failed migration as applied. If this timestamp was already applied
successfully elsewhere, preserve that environment's migration history and use a
separate forward correction; editing the local draft does not update installed
functions. Remote application requires explicit target approval.

Apply `20261007220001_atomic_partner_license.sql` after the license-enforcement
migration. The partner route uses its service-only RPC to claim the license and
apply entitlements atomically. Inactive, refunded, unowned or already-linked
licenses cannot grant a plan. Existing Stripe subscription bindings require a
separate billing-support reconciliation instead of silently replacing paid service.
Provider billing errors roll back the license claim too; repeat applications do
not directly read or overwrite credit balances.

The migration also restricts the legacy unrestricted partner-license management
policy to `service_role` and makes role/list/RLS boundaries suspension-aware. It
preserves the existing financial billing guards. Suspended users retain historical
records but cannot use old active membership or ownership policies to bypass the
new access check.

Run focused regression suites with npm/Jest. The database suites start disposable,
socket-only PostgreSQL clusters and never use an environment database URL:

```sh
npm test -- --runInBand __tests__/security/site-member-license-migration.test.ts __tests__/security/site-resource-license-migration.test.ts
npm test -- --runInBand __tests__/components/settings/member-license.test.tsx __tests__/components/billing/team-invitation-license.test.tsx __tests__/components/billing/member-license-ui.test.tsx __tests__/lib/license-entitlements.test.ts
```

`LICENSE_TEST_PG_BIN` selects local PostgreSQL binaries; the default is the
Homebrew PostgreSQL 17 location. Review skipped database tests if binaries are
unavailable. UI and mocked API tests alone do not establish concurrency safety.