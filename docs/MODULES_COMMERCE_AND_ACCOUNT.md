# Workspace, personal tools, and public commerce

Companion to [the Makinari module guide](MODULES.md). Reviewed against local
source for new account/procurement capabilities on **2026-11-04**; unchanged
commerce entries retain their **2026-10-23** review. Availability remains permission-, deployment-, and
provider-dependent. See the main guide for shared concepts and limitations.

## Workspace and personal tools

### Lead price-list assignment — `/leads/[id]`
- **Use:** In About → Info (contact information), reveal empty fields and edit **Price list**. Search for an active list in the current site, save, or clear the selection to remove the lead-specific preference. Existing inactive assignments remain labeled and can be replaced or cleared.
- **Controls:** The server requires authentication, site update permission, an active same-site list, and a lead writable through user-scoped RLS. Failed saves retain the editor draft; failed option reads expose a retry rather than pretending the site has no lists.
- **Pricing scope:** Uses the existing `leads.default_price_list_id` column. POS customer selection and authenticated Shop/Marketplace prices honor active same-site lists enabled for their channel. Public caches remain unpersonalized; checkout verifies prices independently. Historical orders and accepted quotes remain unchanged. See [customer price lists](CUSTOMER_PRICE_LISTS.md) for identity, fallback, manual override and synchronization rules. No schema migration is introduced.
- **Validation:** `npm test -- --runInBand __tests__/leads/price-list-actions.test.ts __tests__/leads/price-list-field.test.tsx __tests__/leads/company-detail-page.test.tsx` covers reads, selection, clearing, permissions, site scoping, and failed saves. These are local regression tests, not live database/browser verification.
- **Source:** [Field](../app/leads/components/LeadPriceListField.tsx); [option reads](../app/leads/price-list-actions.ts); [lead mutation](../app/leads/mutation-actions.ts).
- **Demo mode:** Known demo sites use the existing cookie-selected in-memory client for option reads and assignment/clearing. Demo site/list/lead IDs do not need to be UUIDs; unknown demos, mismatched demo clients, inactive/foreign lists, and extra mutation fields are rejected. Real sites retain UUID validation, authentication and RLS. Demo changes are not durable database writes. Regression: `npm test -- --runInBand __tests__/leads/price-list-demo.test.ts`.

### Customer subscriptions — `/subscriptions`
- **Amount changes:** Open a subscription and use the pencil button beside **Amount** in its About panel. Enter the recurring amount and confirm with Save. The new amount is used for the next ungenerated billing cycle and subsequent renewals; existing invoices and payments remain unchanged, including invoices already generated for the next period.
- **Controls:** Editing requires subscription update permission and server-side site authorization. Amounts must be non-negative with at most two decimal places; period invoice generation requires an amount greater than zero. Concurrent subscription edits are rejected for reload and retry.
- **Scope:** This updates the workspace subscription record, not a Stripe price or the platform billing plan at `/billing`.
- **Source:** [Amount editor](../app/subscriptions/components/SubscriptionAboutPanel.tsx); [authorized update](../app/subscriptions/update-details.ts); [period invoices](../app/subscriptions/generate-period-invoice.ts).

### Projects — `/projects`
- **Purpose/capabilities:** Choose an accessible business workspace; open project management or start creating a business. Selecting a project opens AI Workspace.
- **Use:** Confirm the business before opening its CRM, commerce, or operational records. Use `/projects?manage=1` to manage projects even when one is already selected.
- **Source:** [Projects](../app/projects/page.tsx); [site archival](SITE_ARCHIVAL.md).

### Create site and onboarding — `/create-site`, `/onboarding`
- **Purpose/capabilities:** Establish a business workspace and complete its setup tasks and configuration.
- **Use:** Create the workspace, supply business information, then follow setup progress before enabling customer-facing channels or commerce.
- **Source:** [Create site](../app/create-site); [Onboarding](../app/onboarding); [setup launch](SITE_SETUP_LAUNCH.md).

### Navigation — `/navigation`
- **Purpose/capabilities:** Discover modules grouped by business area and open their canonical destinations; includes AI Workspace in Automation.
- **Use:** Use the launcher when a module is not pinned in the sidebar. Availability still follows access and license rules.
- **Source:** [Navigation](../app/navigation); [menu configuration](../app/config/navigation-areas.ts).

### Profile — `/profile`
- **Purpose/capabilities:** Maintain personal name, phone, biography and avatar; manage email security, display preferences, calendar preferences, and site notification preferences.
- **Use:** Update personal preferences here rather than changing business settings. A profile job title is not a workspace authorization role.
- **Source:** [Profile](../app/profile/page.tsx).

### Notifications — `/notifications`
- **Purpose/capabilities:** Search notification titles/messages, filter unread items, mark individual/all items read, and delete notifications.
- **Use:** Review unread notifications and follow relevant activity; deleting a notification does not delete its business record.
- **Source:** [Notifications](../app/notifications/page.tsx).

## Public commerce and buyer portal

These experiences are not seller sidebar modules. They have their own identity,
visibility and payment/access contracts; buyer identity is not workspace membership.

### Unified account — `/home`
- **Purpose/capabilities:** Account hub combining existing buyer purchases, quotations, subscriptions and library with Marketplace/public-tender discovery, personal credentials and supplier activity. It reuses BuyerShell and does not require creating a business workspace to use account tools.
- **Use:** Open `/home/orders`, `/home/quotes`, `/home/subscriptions` or `/home/library` to review personal commerce; use `/home/profile` for profile/credentials and `/home/submissions` for invitations, drafts and submitted quotations.
- **Limits/maturity:** Additive, transitional alias, not a completed replacement for `/buyer`. Live detail, course, download, ticket and booking experiences still use existing buyer routes. `/home/preview/[kind]/[id]` is demo-only and never evidence of a real purchase or access grant.
- **Source:** [Home](../app/home/page.tsx); [account shell](../app/home/layout.tsx); [entitlement destinations](../app/buyer/experience-routes.ts); [demo previews](../app/home/preview/[kind]/[id]/page.tsx).

### Account search — `/home/search?q=…`
- **Purpose/capabilities:** Search across personal purchases, quotations, subscriptions, library, reservations, accessible businesses, credentials, submissions, drafts, supplier opportunities, Marketplace products and public tenders; filter by collection and open its matching record.
- **Use:** Enter a term in the Home search field, choose a collection if needed and open the original record for its authorized actions.
- **Limits/maturity:** Implemented aggregation, not an unrestricted tenant-wide index or file-content search. Sources retain personal/public authorization. Paginated sources are read within a bounded limit; failures/truncation are disclosed rather than presented as complete empty collections. Some search UI labels remain English-only.
- **Source:** [Search view](../app/home/search/search-view.tsx); [source loading](../app/home/search/load-sources.ts).

### Personal credentials — `/home/profile`
- **Purpose/capabilities:** Maintain personal credential metadata, private files, immutable revisions, authorized downloads and archival alongside the buyer profile. Select exact revisions when sharing submission evidence; buyers cannot browse the holder's complete private profile.
- **Use:** Create the credential, finish uploading its revision, then explicitly choose evidence in the relevant proposal. Updating a credential never silently replaces an already submitted revision.
- **Limits/maturity:** Implemented, Storage/migration-gated slice. Person-owned credentials only; uploading legal evidence does not establish organization authority, authenticity, eligibility or AI acceptance. No issuer verification, assessment worker, malware scanning or automated abandoned-upload cleanup is claimed.
- **Storage:** PDF/PNG/JPEG, up to 8 MiB per file and 128 MiB account reserved storage; archived/pending revisions still count. Archival retains history and is not erasure. Downloads are private attachments, not public bearer links.
- **Source:** [Profile](../app/home/profile/page.tsx); [credential manager](../app/home/profile/credential-manager.tsx); [evidence controls and rollout](../app/purchases/procurement/evidence/README.md).

### Public tenders
- **Routes:** Global directory `/tenders`, buyer portal `/tenders/[siteSlug]` and publication detail `/tenders/[siteSlug]/[tenderSlug]`.
- **Purpose/capabilities:** Discover eligible public publications, inspect published requirements and deadlines and follow the authenticated participation action. Unlisted visibility and global-directory opt-in are separate choices; public pages expose minimal published data, not internal estimates or competitor proposals.
- **Use:** Review the publication and choose an applicant authorized by the server before preparing the proposal. Readable site URLs derive from site names using the Shop resolver; legacy portal UUID links redirect while underlying publication/RLS checks remain intact.
- **Limits/maturity:** Implemented, deployment-gated slice. Discovery does not confer representation or submission rights. Public pages do not establish legal acceptance, supplier authenticity, stock or award. Full branding/legal/clarification workflows remain incomplete.
- **Source:** [Directory](../app/tenders/page.tsx); [publication route](../app/tenders/[siteSlug]/[tenderSlug]/page.tsx); [identity resolver](../app/tenders/site-identity.ts); [buyer tender module](MODULES_PROCUREMENT.md#tenders--purchasestenders).

### Supplier participation — `/home/submissions`
- **Purpose/use:** Review direct invitations, saved drafts and immutable submitted quotations; `/home/tenders` aliases the same activity page. Publication-specific links offer personal, represented supplier or business applicants only when the server permits them. Internal buyer supplier grants are distinct from personal/business participation choices.
- **Discovery:** The account activity list shows only direct buyer invitations, not general public opportunities or approved-supplier eligibility. Public tenders remain discoverable at `/tenders`; publication-specific links open their applicant selector and quotation form.
- **Drafts:** Save draft persists incomplete quotation fields privately in the database, scoped to the authenticated account, publication version and applicant. Browser storage is not used for these drafts. Uploaded files must finish processing before saving their selected revision IDs.
- **Saved draft list:** The Drafts tab lists database-backed drafts, including public-tender drafts, independently of current invitation eligibility. Saving confirms success, opens this tab, and refreshes the list. A draft can be resumed only when the server permits its applicant/publication or an immutable receipt retry.
- **Submission:** The immutable receipt key and attempted payload are persisted before sending. Optimistic draft revisions prevent stale browser tabs from overwriting a newer draft; reload after a conflict. A confirmed quotation clears its saved draft without treating a cleanup failure as a failed submission.
- **Evidence/opening:** Explicitly selected evidence revisions remain pinned to the publication/submission; authorized buying managers cannot inspect sealed proposal contents before the opening gate. Supplier submissions are quotations, not payments or automatic awards. Replacement/withdrawal and complete clarification workflows remain incomplete.
- **Maturity:** Implemented slice with database-backed drafts and immutable receipts; authenticated applicant eligibility is enforced independently of public discovery or draft existence.
- **Deployment:** Requires the forward-only `20261030170000_procurement_submission_drafts.sql` migration. Without its RPCs the UI reports a persistence failure and does not silently fall back to local storage. Applying the migration to a remote database requires separate explicit approval.
- **Source:** [Supplier activity](../app/home/submissions); [draft API](../app/api/procurement/credentials/drafts/route.ts).

### Shop — `/shop/[siteSlug]`
- **Purpose/capabilities:** Browse a single seller's catalog, item details and promotions; choose supported booking/fulfillment options and prepare its cart.
- **Use:** Open the shared store URL/QR, choose eligible items and complete the appropriate checkout or location self-service request.
- **Limits:** The slug is derived from site name and may also accept a site UUID. Self-service payment release is separately enforced.
- **Source:** [Shop](../app/shop); [self-service](SHOP_SELF_SERVICE.md).

### Public Marketplace — `/marketplace`
- **Purpose/capabilities:** Discover publicly listed offerings across sellers, inspect item/promotional pages and begin eligible purchase/booking flows.
- **Use:** Select an offering and confirm its seller and fulfillment/access conditions before checkout.
- **Limits:** Requires explicit marketplace listing; Shop and Marketplace carts have separate scopes. Featured rankings are not a guarantee of suitability or stock.
- **Source:** [Marketplace](../app/marketplace); [sorting](MARKETPLACE_SORTING.md).

### Cart and commerce checkout — `/cart/checkout`
- **Purpose/capabilities:** Review the scoped cart, buyer and eligible fulfillment/payment details; start the authorized commerce settlement flow.
- **Use:** Confirm seller, items and delivery choice; after paying, inspect the resulting order/entitlement rather than relying solely on the return page.
- **Limits:** Prices/payment state are server-owned. `/checkout` is also used for platform billing and must not be confused with the commerce cart.
- **Source:** [Cart checkout](../app/cart/checkout/page.tsx); [commerce implementation](../app/commerce); [Stripe setup](STRIPE_SETUP.md).

### Public booking — `/book/[siteSlug]/…`, Shop/Marketplace item booking pages
- **Purpose/capabilities:** Select available appointment/service options through an individual or round-robin calendar or bookable catalog item.
- **Use:** Follow the shared booking link and confirm the appropriate customer/time/resource information.
- **Limits:** Availability, scheduled reservation, paid booking and completed attendance are separate states.
- **Source:** [Calendar booking](../app/book); [Shop booking](../app/shop); [Marketplace booking](../app/marketplace).

### Buyer portal — `/buyer`
- **Purpose/capabilities:** Personal account hub with purchase history (`/buyer/orders`), received quotations (`/buyer/quotes`), acquired subscriptions (`/buyer/subscriptions`) and digital access (`/buyer/library`).
- **Use:** Review purchased items, proceed through eligible quotation checkout, use acquired content/pass/ticket access, or manage supported subscription actions.
- **Additional tools:** `/buyer/profile` maintains buyer profile information; `/buyer/visits/new` registers enabled online visits. The hub can show an expiring identity QR and business-management links.
- **Limits/maturity:** Personal queries are buyer-identity scoped. Purchased-site views in Buying do not grant everyone identical redemption rights. `/home` now provides additive account list/hub routes; `/buyer` remains supported for legacy URLs and live detail/access experiences, not fully migrated.
- **Source:** [Buyer hub](../app/buyer/components/BuyerHomeView.tsx); [buyer actions](../app/buyer/actions.ts); [experience routes](../app/buyer/experience-routes.ts).

#### Purchase detail
- Purchase history groups actions once per order, previews up to three non-modifier products and links to remaining items. Dates and totals follow the account language; completed orders are not presented as delivered without shipment evidence. Status tabs include cancelled orders, with result count, filter reset and read retry controls.
- Shared by `/buyer/orders/[id]` and `/purchases/orders/[id]`; preserves the caller's back route.
- Order status and recorded shipment dates appear before items. Each shipment has its own status, carrier, tracking number, address and estimated/actual dates; cancelled, failed and delivered shipments do not present estimates as upcoming deliveries.
- The order summary sits below the full-width items list and includes recorded shipping cost and currency. Status without shipments uses a compact header rather than an empty full-height card. Payment details show the recorded balance and calculate paid amount as sale charge minus balance only when both values are valid. Missing payment data is not assumed to mean unpaid or paid.
- Payment history shows recorded dates, methods and amounts without exposing internal payment notes. Digital access and reservation destinations remain available below the detail cards.
- The detail's existing Payment card owns its conditional action footer: the pay action does not create a second card, heading or balance. Paid/cancelled/refunded records have no payment action footer; unavailable links and demos explain the disabled action in place. Primary-button width is constrained by a separate responsive container so its glass wrapper cannot compress the descriptive text. Purchase-list actions retain their compact balance display.
- Buyer purchase lists and details expose a pending-payment action for a single payable sale with a positive recorded balance. It reuses `/api/stripe/checkout/order` with the existing order-bound public token; no amount or currency is submitted by the browser. This is the existing token-authorized checkout, not a new session-only payment API. Missing, revoked or expired tokens disable online payment with an explanation. Demo previews never initiate checkout. The server rechecks balance, currency and eligibility and reuses/reserves Stripe sessions; a success query parameter never marks a buyer purchase as paid. Errors remain inline and are not automatically retried.
- Labels, dates and currency formatting follow the account display language. No tracking URL, payment, cancellation, return or invoice action is invented by this view.
- Regression coverage: `__tests__/buyer/order-detail-display.test.ts` and `__tests__/buyer/order-detail-view.test.tsx`.
- Payment regression coverage: `__tests__/buyer/order-payment.test.ts`, `__tests__/buyer/order-pay-action.test.tsx` and the existing public-checkout authorization/payment-guard suites. Real Stripe payment settlement still requires an explicitly scoped live test.

### Public documents — `/q/[token]`, `/so/[token]`, `/i/[token]`, `/vb/[token]`
- **Purpose/capabilities:** Share limited customer/vendor views of quotations, sales orders, invoices and vendor bills, with only the actions supported by the document's current state.
- **Use:** Share the generated document link with its intended recipient and perform payment/acceptance only through the eligible document flow.
- **Limits:** Tokens are bearer credentials subject to lifecycle rules. A PDF/export route is not equivalent to public token authorization; never publish real tokens in documentation.
- **Source:** [Quotation](../app/q); [sales order](../app/so); [invoice](../app/i); [vendor bill](../app/vb); [public-link security](SECURITY.md).

