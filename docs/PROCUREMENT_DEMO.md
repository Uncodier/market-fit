# Procurement demo walkthrough

Procurement supports the existing demo workspace mode with explicitly local,
fictional presentation data. No seed, migration, credentials, or remote writes
are required. Production API behavior and authorization remain unchanged.

## Start locally

With the development server running, open:

`http://localhost:3000/demo?client=demo-saas-en-123&lang=en&page=/purchases/requests`

The normal demo selector also works. The existing chip on the right identifies
demo mode without extra page notices or entry toasts; use normal navigation and document
links to move between sections. The fixtures are available for existing `demo-*` workspaces;
they are not a fallback for failed real-workspace requests.

## Buyer workspace tour

1. **Requests** (`/purchases/requests`): browse approval states, switch between
   table and board, open the workplace request, inspect lines and approvals,
   follow its linked tender, or open the prefilled new-request form.
2. **Tenders** (`/purchases/tenders`): inspect the workplace tender's activity,
   requirements, invited suppliers, received quotations and publication review.
   A separate closed support-renewal tender illustrates an awarded contract.
3. **Quotations** (`/purchases/quotes`): compare Northstar and Summit proposals,
   open their formal review pages, inspect supplier contacts and products, preview fictional supplier evidence and review
   approval stages. Cedar's awarded proposal links to the order scenario.
   Review pages also have direct `/purchases/quotes/demo-quote-*` URLs, with
   Overview, Products, Certificates & proposal and Approvals tabs. Supplier
   contacts and commercial terms appear in the details sidebar.
4. **Approvals** (`/purchases/procurement/approvals`): filter by stage/status and
   open the pending Northstar award to inspect reviewers, votes and reason input.
5. **Suppliers** (`/suppliers`): inspect fictional supplier profiles, contacts,
   activity, categories and read-only representatives.
6. **Orders** (`/purchases/orders`): open `PO-DEMO-2026-001`, its printable document,
   and the existing acceptance form with example received quantities.
7. **Rules** (`/purchases/rules`): expand sample rules and run the local policy
   simulator. **Settings** (`/settings?tab=tenders`) shows workspace policy and
   portal configuration without allowing persistence.
8. **Inventory minimums** (`/inventory/minimums`): inspect enabled/disabled rules,
   a shortage case, the rule form and a local stock-check preview.
9. A catalog item's **Procurement** tab shows two sample supplier offers and
   navigation to requests, suppliers and inventory minimums.

## Supplier portal tour

- Open `/demo?client=demo-saas-en-123&lang=en&page=/home` for the account home preview.
  It shows a fictional profile, business and commerce counters, all four library
  types, upcoming/recent reservations and supplier activity. Home does not load
  live account or procurement data in demo mode, even with a signed-in session.
  All home cards remain navigable. Commerce lists support local filtering and
  link to `/home/preview/[kind]/[id]` details; reservation cards open the same
  isolated preview route. Only mutations such as Buy Again remain disabled.
  The existing demo chip identifies the mode without an extra home notice or toast.
- Order previews reuse the buyer purchase detail view, including line prices,
  totals, delivery and payment cards. Pending orders have no fictional payment
  collected; completed orders show a sample delivery. Buy Again is disabled,
  and opening a preview never calls the live order action. Unknown order IDs
  and access without a demo cookie return not found.
- Every `/home/preview/[kind]/[id]` detail now uses its real buyer presentation,
  not the generic summary card. Quotations share `BuyerQuotePresentation` and
  `BuyerQuoteDocument`; subscriptions share the storefront PDP and subscription
  management panel; reservations share `ServicePdpLayout` and reservation
  management. Tickets, files and passes share `BuyerLibraryExperience` with the
  authenticated buyer routes. Their mini-experience shell replaces the account
  header, rather than rendering a second header inside it.
- Demo reservation/ticket QR values are fictional and cannot authorize entry.
  Reservation pass downloads, cancellation, reprogramming, quotation responses,
  checkout and pass redemption are disabled. File links contain only local
  fictional text samples; ticket downloads generate only a local image with an
  explicitly invalid demo token. Pass availability is injected locally into the actual
  booking calendar; date/slot selection does not query live availability or
  create a reservation.
- Course library previews use the catalog's existing `metadata.videos` (`url`,
  `title`), `metadata.attributes` (`duration`, `level`, `language`) and
  `metadata.specs` (`label`, `value`) shape. The configured database was checked
  read-only on 2026-10-29: it had no `digital_subtype = 'course'` rows, so these
  are fictional metadata examples, not copied customer course recordings.
  `/home/preview/library/demo-course-1` uses the same `CourseExperienceClient`,
  `CoursePdpLayout` and lesson player as an authenticated purchased course,
  including lesson navigation and completion controls. A bundled CC0 flower clip from MDN is
  explicitly credited as sample footage, not instruction; all lessons use that
  same short clip. No external media CSP permissions are added. YouTube/Vimeo URLs use embeds;
  embedded lessons require manual completion.
  They also require provider hosts to be allowed by the deployment's existing CSP;
  the preview does not change that global security policy.
  Demo lesson progress is local to the preview and never invokes the server
  progress action, syncs to an account, or grants a certificate or entitlement.
  The separate `CourseStudyPlayer` component is not used by account previews.
- `/tenders` and `/tenders/demo-procurement` show the fictional public directory.
  Open the workplace tender, the closed support renewal, or the future
  **Office connectivity upgrade** (`demo-tender-sealed`) with sealed proposals.
- `/home/tenders` shows opportunities; `/home/submissions` shows a saved draft
  and submitted quotation. Open a proposal preview without sending it.
- `/home/profile` shows credential metadata and revision history. Credential
  preview inputs are read-only; no uploads or private downloads are performed.
- The closed tender links back to the sample awarded order in the workspace.

The demo cookie is retained across `/tenders` and `/home`. Paid storefront,
checkout and public payment-document routes retain their existing demo-exit
behavior. Invitation-only snapshots displayed in the demo are fictional, not
an exception to production tender visibility checks.

## Safety and limitations

- All examples are fictional and identified by the global demo chip. Evidence previews retain file-specific safety labels and are text,
  not real certificates or private downloads.
- Saving, publishing, notifications, uploads, access grants, approval decisions,
  purchase orders, payments and receipts cannot be submitted from these demos.
- Editable form values and simulator results are transient previews, not saved
  records. Navigation/reload restores fixtures.
- The sample stock check does not run the replenishment worker or create a
  requisition. Real-workspace behavior still uses its existing API and RLS.
- The primary offers are USD 6,000 and USD 6,500 net, with 8% tax. The prior
  Cedar award/order is a separate USD 6,000 net scenario.

## Verification

Focused regression tests live in `__tests__/procurement/demo-*.test.tsx` and
verify presentation, linked IDs, totals, demo write guards and absence of
procurement API requests. Run with npm/Jest, for example:

```bash
npm test -- --runInBand __tests__/procurement/demo-commerce.test.tsx __tests__/procurement/demo-workflow.test.tsx __tests__/procurement/demo-suppliers-policy.test.tsx
npm test -- --runInBand __tests__/commerce/course-study-player.test.tsx
npm test -- --runInBand __tests__/commerce/demo-library-preview.test.tsx __tests__/quotations/demo-quote-detail.test.tsx __tests__/procurement/demo-service-details.test.tsx __tests__/procurement/account-order-preview.test.tsx __tests__/procurement/home-demo-details.test.tsx
```

Local browser verification uses a separate browser context with the demo cookie;
it must never reuse an authenticated production context.