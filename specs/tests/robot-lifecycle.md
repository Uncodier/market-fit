# Robot placeholder lifecycle regression

`tests/crud-robot.test.yaml` exercises real UI creation, rename, reload, and
confirmation-dialog deletion. It does not send assistant messages, start a
provider, or run a workflow. Generated TypeScript must be refreshed with strict
transpilation, not edited directly.

The existing regression guard requires explicit local/staging target and site,
both mutation acknowledgements, a public Supabase key and the dedicated admin
account. Browser and cleanup identities must match. Never run this on production.
The external deletion API and applicable RLS migrations must be operational.

Normal frontend inserts allocate a UUID before transmission. The fixture installs
request interception before workspace selection (including empty-site automatic
creation), validates the site/creator and UUID, proves that ID is absent under the
bound account, journals it, then forwards the real request unchanged. No responses
are mocked. Duplicate or uncorrelatable inserts are refused and fail the test.
The UUID is correlation, not authorization; backend RLS remains mandatory.

The journey uses exact-ID tabs, verifies persisted names and deletion through
user-scoped reads before teardown. Cleanup leaves Robots for the project chooser,
revalidates ownership, calls the authenticated deletion API for each exact ID,
and verifies absence. It never deletes by placeholder name, resets the site, or
deletes database children directly. Failed cleanup reports residual IDs and fails.
As with the existing in-memory fixture journals, process termination requires
operator inspection of the disposable environment; this is not crash recovery.

Offline Jest and strict transpilation are not live E2E evidence. Run only after
an explicitly approved disposable target is configured:

```sh
npm run test:e2e -- --suite regression --target local --grep 'Robot session'
```
