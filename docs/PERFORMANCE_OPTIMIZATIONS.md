# Historical RLS Performance Note

This path previously documented an unverified, repository-wide RLS optimization
and cited a migration that is not present in the current migration directory.
Its benchmark claims and policy template must not be used as current guidance.

Why the previous guidance was unsafe:

- It recommended a broad `SECURITY DEFINER` helper without documenting an
  explicit `search_path` or execution grants.
- It treated service-role behavior as something that every user-facing policy
  needed to encode.
- It implied that fewer policies are inherently faster or safer.
- It presented estimated performance improvements as measured results.
- It suggested applying a generic policy template without validating each
  table's authorization model.

For current work:

- Follow [Security](SECURITY.md) and
  [Database migrations](DATABASE_MIGRATIONS.md).
- Inspect actual policies and query plans in the target environment.
- Optimize only after reproducing a concrete query problem.
- Preserve tenant isolation and mutation restrictions.
- Record `EXPLAIN (ANALYZE, BUFFERS)` evidence before and after a change using
  sanitized, representative data.
- Add a forward-only migration and authorization regression tests.

Multiple permissive policies can be valid PostgreSQL design. Policy count alone
is not evidence of a performance defect, and HTTP `406` responses are not proof
of an RLS performance problem.
