# Historical Robots catalogue reads and reporting adapters

The sections below describe the earlier read-only path, not the provider-direct Ask gateway. Its saved settings, reviewed inventory and project-specific reporting examples do not establish current execution authority. For the new private Ask path, see [Provider-direct execution](CONNECTORS_PROVIDER_DIRECT.md): it requires independent verification of the external account and a separate manager opt-in, and it does not offer these SQL/report adapters as a fallback.

This is a per-connection setting for the private interactive instance assistant. It does
not change the Customer Support, public chat, voice, workflow or legacy MCP
permissions. Browsing an integration, saving a tool ID or selecting an account
in Robots is not a grant.

## Setup and discovery

1. After the creation-default migration below, newly verified OAuth and Supabase
   token connections start with **Allow instance catalogue reads** on and **All
   compatible tools** selected. No second policy save is needed. Existing accounts
   keep their saved settings. In **Connectors → Tools & permissions**, a manager
   can turn reads off or choose **Only selected tools** to restrict candidates to
   exact tool IDs. Replaying an authorization callback never resets that choice.
2. The instance turn must originate in a verified human user's direct Ask session. An
   owner-bound API key, background job, Plan step or resumed workflow does not supply
   that admission. The member and prompt agent must each have direct use of this connection.
   Restricted business screens, location/assigned-resource access or a public
   context cannot be broadened by a connector. An access request is not a
   grant to run an unreviewed catalog action.
3. `tools search` / `list` returns bounded summaries, not the full provider
   catalog. `catalog_query` narrows candidates locally: use short public action
   terms or an exact slug. Only server-owned public search terms or previously
   saved catalog IDs are sent to Composio, not the user's free text. `connector_id` narrows results;
   it never expands visibility. Continue an empty page if it has a cursor. A
   partial provider failure preserves native and already available results. In selected mode only saved tool IDs are looked up, including on keyword searches. To
   disable catalog reads, save the opt-out by itself. If the upstream catalog
   is unavailable, **Manage local catalogue access** on Connectors or on the
   account's detail page lets its manager disable the grant. This requires the
   Makinari API and database, but not Composio or the old selected tool IDs.
4. `manual_only` means the provider lists the action but Robots cannot execute
   it. `describe_required` means *candidate*, not *granted*. Describe checks the
   live action and exact account; execution checks again. Cursors and old
   successes never authorize future use.

### Correcting tool arguments

In Robots, a verified **pre-dispatch** argument error identifies the first
actionable schema field and rule, for example `arguments.limit`, `maximum: 25`.
The assistant can correct the value on the same tool and account. The response
does not echo submitted values or unknown keys, and the runtime does not replay
the call. A stale descriptor must be described again; an unsupported operation,
missing permission, quota or unconfirmed outcome is not a field to fix. Do not
substitute a different scope, reconnect an account, or claim that no data exists.
Provider-specific semantics still need their own validated adapter. Customer
Support does not disclose a private schema or its errors to public audiences.

## Execution boundaries

- Existing reviewed operations retain their previous policies. The new ordinary
  read path is for bounded native API collection operations (`LIST`, `GET`, or `FETCH`, optionally `ALL`) with a recognized
  read-only contract, an exact private OAuth or API-key account, a verified
  resource-specific action contract and safe input/output projections. The
  updated API leaves resource access to the provider for that account rather
  than trying to reconstruct it from the account's OAuth scope list. A credential
  with additional scopes cannot change the pinned action being dispatched. It does not require adding a
  tool slug for every compatible provider operation. It does not support every
  provider schema, grant type or possible read operation.
- External account credentials are not evidence that an unsupported action is safe.
  A limited published list profile can fix optional provider fields on the server
  and return a smaller projection; reauthorization is not the fix for a schema
  the adapter cannot verify. The pinned HubSpot company/deal profiles read the
  first bounded page of active IDs and short names without associations or
  history. The Google Calendar list profile relies on the provider to authorize
  the read and returns only generated labels, not calendar addresses, names or events.
- `readOnlyHint` alone is not proof. Writes, mixed/unknown effects, credential
  overrides, proxy/file/code execution, shared or Instant accounts and arbitrary
  SQL are not enabled. The creation default cannot override these boundaries.
- Use the exact described tool version and schema hash. Neither credentials nor
  account/project selectors are model inputs. A standalone plan runs as a background
  host even if its parent was a human turn. A new user session cannot elevate a
  stored checkpoint to interactive authority.

### Private delivery

Instance connector reads return a **private receipt**, not the response payload,
to the model. The assistant cannot automatically summarize those rows. Its own
history, follow-up turns, shared instance logs and recovery therefore receive
only the receipt and instructions to open it. The original user opens the link
or **Connectors → Private reports** in their authenticated browser. The URL
alone is not a credential. Other workspace members who can view the instance
do not gain access to the report. Do not paste private rows into a shared chat.

The private page checks ownership, parent instance visibility and current local
account, agent, workspace and tool grants on every read. A provider-only revocation
is known locally only after verification or sync; viewing a saved report does not
contact the provider. Locally revoked or expired reports cannot be reopened. No service
role or model tool is offered a read-back route. Reports expire after one hour;
the latest 20 per owner are retained, with opportunistic cleanup on writes.
Expiry of access is immediate even without a subsequent cleanup. Previously
delivered output or historical chat content from older versions is not erased.

### Direct Supabase SQL

Search for `SUPABASE_RUN_READ_ONLY_QUERY` on the selected Supabase connection.
This exact action uses a Makinari reporting projection, not the provider's raw
SQL schema. Other connector actions do not inherit its analytics-grant checks.
Use `describe`, then supply `query` to calculate figures instead of listing reports.
No view per KPI is required. The description lists the actual logical tables
and columns registered for that workspace and project. The local database is recognized automatically from an authorized request, including verified custom domains. A list of report names must not be substituted for a KPI or a different tool capability. Model-supplied project references,
credentials or site IDs are not accepted. Only the verified read-only action
is used: no fallback to a SQL writer, direct admin client, or service key.

For example, these are the **arguments** inside the normal version/hash envelope:

```json
{
  "query": "SELECT currency, COUNT(DISTINCT site_id) AS accounts, SUM(amount) AS total FROM analytics.paid_sales WHERE sale_date < $1 GROUP BY currency ORDER BY total DESC",
  "parameters": ["2026-10-01"],
  "scope": "workspace"
}
```

`workspace` is the default. `platform` requests aggregates across sites and needs
a separate, current platform grant for this exact actor, agent, connector and
project. It is not granted by the PAT, site ownership, catalog opt-in or tool
selection. A denied platform query is not rerun against one site. The operator
grant is also checked when storing and opening a private platform report;
revocation, expiry or a replacement grant cannot resurrect an old result.

The direct path accepts a single bounded SELECT over a declared fact source,
typed literals or positional parameters, comparisons, filters, GROUP BY,
COUNT (including distinct site count), SUM, AVG, MIN/MAX, ordering and limits.
For monthly summaries use `date_trunc('month', sale_date) AS period` (or a listed
timestamp column). It returns a month-start date; timestamps are grouped in UTC.
`GROUP BY 1,2 ORDER BY 1,2` refers to the first two SELECT items, e.g. period
and currency. A currency subtotal's distinct site count is not additive across
months or currencies. If validation rejects a clause, correct it without
changing the account or scope; a validation failure does not mean access was denied.
Workspace queries may also select the listed nonidentifying facts; platform
queries must aggregate. UUIDs cannot be returned as raw identifiers. Native
sources encode the authorized joins and tenant bounds before aggregation.
System catalogs, arbitrary relations, routines, DML, DDL and multi-statement
SQL are not executed. Output is a private table: up to five columns and 25 rows
with an explicit truncation notice. Exact decimals and large integers are
returned as text. An unverified scope or malformed provider response is not zero.
These boundaries apply to the Makinari connector and private report UI. A
database administrator, backup operator, or holder of an independent project-wide
management credential is already a trusted database principal. The provider
processes the query and its bound values; check its retention and logging policies
before production use. The adapter never exposes a general SQL console.

**Financial interpretation:** `paid_sales` represents completed sales with zero
current recorded balance, filtered by **sale date**; it is not a payment-event
ledger. Do not describe that result as cash collected on a historical date.
`tender_awards` and `approved_orders` refer to materialized, approved procurement
events; their amounts are in minor currency units and their dates are creation
timestamps. Keep currencies separate and establish the requested cutoff timezone.

### Existing published reports (optional)

`{}` still lists published reports, **not** direct query sources or KPI totals.
For this mode a database administrator publishes aggregate views intended for
the workspace in `makinari_reports_<lowercase site UUID without hyphens>`. Both the
schema and ordinary view must be owned by `postgres`; the existing
`supabase_read_only_user` must already have USAGE on the schema and SELECT on
the view. Only `label` (text) and `value` (numeric, smallint, integer or bigint)
are returned. Decimal values are delivered as unrounded text (up to 32 characters,
including sign and decimal point); published labels must be short nonsecret text.
Define each view with the exact metric, currency, distinct-account
and period semantics required. Use `{}` to list published report names. While
`has_more` is true, pass the returned `next_after` as `after` to continue listing.
The cursor applies to names, not rows; a result page or an empty page is never a sales total. Use
`{"view":"sales_by_currency","limit":10}` to read that named report. A bounded
sample is not a substitute for a total. In the private results page the user
can select a report or the next page there, without putting view names in chat.
Publication is a separate data
authorization decision: an account connected to
a shared project does not automatically gain access to reports for all tenants.
If nothing is published, ask the authorized owner for the report or an export;
do not interpret this as zero sales or zero accounts. No external views or DB
privileges are provisioned by this feature. The read adapter is checked against the
[published versioned schema](https://docs.composio.dev/api/tools/SUPABASE_RUN_READ_ONLY_QUERY?version=20261116_00),
including its `data.result` row array. Offline contract tests are not evidence of
the grants or connectivity of a particular external account.

## Agent recovery

Use the returned `code` and `recovery`, not provider prose. When a report is
unavailable, say what is missing; do not substitute a partial report without
explaining its scope or claim no data exists. Ask the user to perform a manual
step, provide a limited export, or explicitly choose an independently authorized
route covering the same scope. Never switch credentials/accounts to evade a denial.

| Signal | Action |
| --- | --- |
| Connection inactive or application authentication rejected | Ask its owner to verify/reconnect the selected account in Connectors. Never request tokens in chat. |
| Composio project credential rejected | Ask the manager to verify the workspace integration configuration, not every user's OAuth grant. |
| Verified missing scope | Ask the connection owner to grant that permission if intended. Unreported/unsupported scopes are not proof permission is missing. |
| Makinari cannot evaluate the catalog actor predicate | Fail closed. A database permission failure in that RPC is not an OAuth or member denial. Verify the actor-location ACL repair before asking anyone to reconnect. |
| Analytics source or scope denied | Ask the operator to verify the dataset, procurement role or platform grant. Never present a workspace result as an all-account result. |
| Application rejected a resource | Ask the user to check that specific resource; do not disable the tool for other resources. |
| Rate limit or temporary outage | Explain the quota or outage and wait. No retry loop. |
| Stale cursor or changed contract | Restart the search or describe the exact reference again. |
| Unconfirmed outcome after dispatch | Reconcile in the original system before any retry or alternate execution. |

There is no background permission probe and no persisted connection-by-tool
matrix. Account state and grants are checked when needed; a tool receipt is a
record of one call, not permanent authorization.

## Rollout

Apply `20261120235000_connector_catalog_reads.sql`, then
`20261121002000_connector_private_results.sql`, through the approved migration
process **before** deploying the matching API and web versions. The latter
adds the private delivery destination, not external reporting views or provider
grants. Do not enable production accounts until both applications are updated.
The private-result migration needs a database migration administrator that can
create a non-login, non-RLS-bypass role, grant membership in `authenticated` to
that role and transfer function ownership. Validate this in staging first;
do not substitute a service-role reader if the target lacks these privileges.
Validate discovery, real descriptor shapes, missing scopes, revocation and result projection on an
explicitly approved disposable account before enabling a production connection.
Disabling catalog reads stops new admissions; it cannot undo a dispatched call.

**Direct SELECT rollout:** install `20261121020000_connector_analytics_authority.sql`
after the private-result and actor-location migrations and before deploying the
API that accepts `query`. It creates no platform grant or KPI view. Confirm the
project binding and real role/column/ownership checks in an approved staging
project. Custom domains need consistent Supabase DNS and gateway identity on the existing server authorization read, not an account environment variable. External facts use the private workspace/project registry (`20261121024000_connector_external_analytics_registry.sql`); import any reviewed legacy mappings before switching runtimes. Keep
private result delivery enabled. See the API [analytics dataset and grant guide](../../API/docs/CONNECTOR_ANALYTICS_DATASETS.md).

**Production table privileges:** `20261121013000_connector_catalog_actor_location_acl.sql`
preserves the original admission predicate and its service-only callers. It lets
the predicate evaluate the protected location ACL without granting the runtime
role direct access to that table. It does not depend on the creation-default change.

**Creation default:** `20261121012000_connector_creation_catalog_reads.sql`
changes only the policy inserted by `connector_finalize_auth` for a newly verified
account. The column default stays `false`, including for older policy writers
creating a missing policy. No existing accounts, grants or public-channel settings
are updated. Coordinate the cutover with the updated onboarding disclosure: pause
new authorizations, drain or expire pending attempts started under the old notice,
and reopen onboarding once both the migration and the new web copy are in place.