# Agent reporting hierarchy

In **Agents → Basic Information**, `Supervisor` selects the saved agent an agent reports to. `No supervisor` makes it a root. A new agent may have a supervisor from its first save. This relationship describes the organization chart only: it grants no permissions or tools and does not transfer conversations, trigger Voice sync, or change channel routing.

## Identity and editing

- The source of truth is the existing nullable `public.agents.supervisor` UUID, referencing `public.agents.id`. It is not stored in `configuration`, a display name, a role, or a command's `supervisor` JSON.
- The [options route](../app/api/agents/supervisors/route.ts) uses the authenticated site's RLS-visible agent directory. It excludes self, descendants, unverifiable chains and unsaved templates. Inactive agents can be part of a reporting structure; they are not activated by assigning a supervisor.
- `POST /api/agents/create` accepts an optional `supervisor` UUID or `null`. Selecting a different parent changes the draft fingerprint; a retry cannot silently replace the original reporting line. Existing profile saves omit `supervisor` unless it was edited in Basic Information. Clearing it explicitly writes SQL `NULL`.
- The [diagram](../app/agents/list/agent-hierarchy.ts) uses saved IDs, including for agents with the same name or role. Unconfigured templates are shown separately. A supervisor outside the search results is labeled rather than replaced with a visible ancestor. Legacy missing parents or circular references do not invent reporting lines.

## Database rollout

Apply [the integrity guard](../supabase/migrations/20261120233000_agent_supervisor_integrity.sql) **before enabling hierarchy writes**. The existing self-referencing foreign key alone enforces existence, not same-site membership or acyclicity. The guard checks edited parent paths (up to 128 ancestors), serializes competing hierarchy edits per site and preserves ordinary RLS. It does not change any existing agent, infer parents from the previous chart, or backfill historical anomalies. Review historical inconsistencies with the site owner and correct relationships explicitly.

Concurrent or stale edits may be rejected by the database (`40001`); refresh the directory and review before retrying. The local PostgreSQL integrity and concurrency suites use a disposable database, not the configured remote project.