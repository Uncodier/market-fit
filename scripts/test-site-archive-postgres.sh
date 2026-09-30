#!/usr/bin/env bash
# Run only against a new, disposable PostgreSQL cluster; never use DATABASE_URL.
set -euo pipefail
export LC_ALL=C LANG=C
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d /tmp/site-archive-test.XXXXXX)
port=55439
cleanup() {
  if [ -f "$work/data/postmaster.pid" ]; then
    pg_ctl -D "$work/data" -m fast -w stop > /dev/null
  fi
  rm -rf "$work"
}
trap cleanup EXIT
initdb -D "$work/data" -A trust --no-locale > "$work/init.log"
pg_ctl -D "$work/data" -l "$work/postgres.log" \
  -o "-k $work -p $port -c listen_addresses=''" -w start > /dev/null
sql=(psql -X -h "$work" -p "$port" -d postgres -v ON_ERROR_STOP=1)
"${sql[@]}" \
  -f "$root/__tests__/fixtures/site-archive-bootstrap.sql" \
  -f "$root/supabase/migrations/20260929221000_archive_sites.sql" \
  -f "$root/__tests__/fixtures/site-archive-assertions.sql"

# Hold the archive lock while a duplicate archive and a new domain write race.
"${sql[@]}" > "$work/archive.log" 2>&1 <<'SQL' &
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
BEGIN;
SELECT public.archive_site('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001');
\echo archive-lock-acquired
SELECT pg_sleep(2);
COMMIT;
SQL
first=$!
for ((attempt=0; attempt<100; attempt++)); do
  if grep -q 'archive-lock-acquired' "$work/archive.log"; then break; fi
  sleep 0.05
done
grep -q 'archive-lock-acquired' "$work/archive.log"
"${sql[@]}" > "$work/duplicate.log" 2>&1 <<'SQL' &
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
SELECT public.archive_site('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001');
SQL
second=$!
if "${sql[@]}" > "$work/domain.log" 2>&1 <<'SQL'
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
INSERT INTO public.allowed_domains VALUES
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'racing.example');
SQL
then
  echo 'Concurrent domain write unexpectedly succeeded' >&2
  exit 1
fi
grep -q 'An active site is required' "$work/domain.log"
wait "$first"
wait "$second"
"${sql[@]}" <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.allowed_domains WHERE site_id = '10000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Concurrent domain write survived archival';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000003' AND archive_snapshot->>'url' = 'https://reusable.example' AND jsonb_array_length(archive_snapshot->'allowed_domains') = 1) THEN
    RAISE EXCEPTION 'Concurrent archive lost the original snapshot';
  END IF;
END;
$$;
SQL
echo 'Site archive concurrency assertions passed'

# Existing-domain UPDATE takes the child lock before the parent-site trigger.
# PostgreSQL may roll back either participant; the API retries archive deadlocks.
"${sql[@]}" <<'SQL'
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
INSERT INTO public.sites(id, name, url, user_id) VALUES
  ('10000000-0000-4000-8000-000000000004', 'Update race', 'https://update.example', '00000000-0000-4000-8000-000000000001');
INSERT INTO public.allowed_domains VALUES
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'update.example');
SQL
"${sql[@]}" > "$work/update-archive.log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
BEGIN;
SELECT id FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000004' FOR UPDATE;
\echo update-race-lock-acquired
SELECT pg_sleep(1);
SELECT public.archive_site('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001');
COMMIT;
SQL
archive_pid=$!
for ((attempt=0; attempt<100; attempt++)); do
  if grep -q 'update-race-lock-acquired' "$work/update-archive.log"; then break; fi
  sleep 0.05
done
grep -q 'update-race-lock-acquired' "$work/update-archive.log"
"${sql[@]}" > "$work/domain-update.log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
UPDATE public.allowed_domains SET domain = 'updated.example'
  WHERE id = '20000000-0000-4000-8000-000000000005';
SQL
update_pid=$!
if ! wait "$archive_pid"; then
  grep -q '40P01' "$work/update-archive.log"
  "${sql[@]}" <<'SQL'
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
SELECT public.archive_site('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001');
SQL
fi
if ! wait "$update_pid"; then
  grep -Eq '40P01|An active site is required' "$work/domain-update.log"
fi
"${sql[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = '10000000-0000-4000-8000-000000000004' AND archived_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.allowed_domains WHERE site_id = '10000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'Archive/domain UPDATE race did not resolve safely';
  END IF;
END;
$$;
SQL
echo 'Site archive/domain UPDATE race assertions passed'