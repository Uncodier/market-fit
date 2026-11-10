# Shipment documents and printing

## Packing slips

Shipment detail exposes **Download packing slip PDF** and **Print packing slip**.
Only active items assigned to that shipment are included; another shipment's
items and cancelled/draft lines are excluded. The generated document is explicitly
an internal packing slip, not an official carrier label. Manual actions refresh
shipment data before output and reject stale site/user/detail contexts.

Enable **Shipments** in Settings > Printers to route packing slips to a bound
USB/Bluetooth printer. Preview and test-print options support 58mm and 80mm paper.
Manual printing uses all ready shipment hardware printers and does not switch to
system printing after hardware failure. Without hardware configured, manual
printing uses the browser's system dialog.

**Auto-print packing slips** is opt-in per hardware printer. It runs only while
the preparing shipment's detail view is mounted, including its first eligible
load. It is not a background server/warehouse print service. The browser must
support Web Locks and local storage. A persisted site/user/shipment claim is
written before dispatch, preventing replay across tabs and reloads in that browser
profile. Other users or browser profiles have separate claims. Missing hardware,
partial writes and interrupted claims are not retried automatically; use explicit
manual reprint after checking paper output. Automatic jobs never open a system
dialog. Carrier PDFs do not auto-print and are not sent to thermal transports.

## Private carrier PDFs

Applied to project `rnjgeloamtszdjplmqxy` on **2026-11-10 at 00:22:24 UTC**;
independently verified at 00:22:57 UTC. Canonical SQL and application evidence are
also recorded in the sibling `makinari-db-scheme` repository. Other environments
must apply `supabase/migrations/20261109223000_shipment_carrier_documents.sql`
through the approved migration workflow **before enabling the UI**.
It requires the existing shipments, site permissions,
location-access functions, and Supabase Storage schema. Regenerate database types
after deployment through the established process.

- `GET /api/shipments/{id}/documents` returns `{documents: [...]}`, newest first.
- `POST /api/shipments/{id}/documents` accepts multipart with exactly one `file`.
  Returns 201 `{document: {...}}`.
- `GET /api/shipments/{id}/documents/{documentId}` returns PDF bytes as an
  attachment. Explicit `?disposition=inline` opts into inline rendering.
- Metadata: `id`, `shipment_id`, `file_name`, `mime_type`, `size_bytes`,
  `created_at`, `uploaded_by`. No storage URL or signed bearer URL is returned.
- Errors: `{error: string}`; 400 invalid input, 401 unauthenticated, 403 shipment
  inaccessible/permission denied, 404 missing document, 413 oversized upload,
  415 unsupported/invalid PDF, 500 provider/configuration failure.

All routes authenticate using the real cookie-scoped client, not demo or service
credentials. Reads require shipment visibility and site/location select access;
uploads require update access. Shipment RLS retains assigned-only restrictions.
POST rejects mismatched Origin and cross-site Fetch Metadata headers; clients
without browser origin headers still require an authenticated session.
The private bucket has a 10 MiB limit and PDF-only MIME allowlist. Metadata and
storage policies independently enforce shipment access; overwrites are forbidden.
Upload names use server-generated UUIDs, not user filenames. Tenant/user/path
fields are not accepted from the multipart request. Failed metadata insertion
attempts cleanup of the unattached object. Interrupted uploads can leave private
orphans; operator cleanup must check attachment references before deletion.

API validation checks `.pdf`, MIME, byte bounds, PDF version header and EOF marker;
the streamed multipart envelope is capped at 10 MiB + 64 KiB before parsing.
These are format checks, **not antivirus scanning or a PDF parser guarantee**.
Direct authenticated Storage uploads are still possible under RLS and bucket
constraints; the download endpoint rechecks PDF bytes. Treat all uploaded PDFs
as untrusted. Downloads use no-store, nosniff, and sandbox headers. No external
URL fetching, carrier integration, official-label generation, or DELETE API is
provided. Uploading a file does not establish carrier authenticity.

Before rollout, exercise actual authenticated cross-site, assigned-only and
location-restricted identities against both Data API and Storage. Jest mocks and
SQL assertions do not replace this deployment verification.

The linked project's preexisting `location_acl_private_storage` restrictive policy
still blocks Storage for location-restricted users. This migration does not relax
that policy; permitted metadata reads do not imply PDF upload/download availability.