# Suppliers, Procurement, Tenders, and the Unified Account Portal

**Status:** agreed design, not shipped; [local configuration slice](PROCUREMENT_IMPLEMENTATION.md).
**Design baseline:** 2026-10-14; scope extended 2026-10-27. Existing behavior was inspected in the local repository;
the deployed application and remote database schema were not verified.

This document consolidates the final decisions from the product discussion, including
which existing screens must serve as UI/UX references. Proposed names are not proof
that tables, routes, permissions, or migrations already exist.

## 1. Final decisions and superseded proposals

1. Add three internal Buying apps: **Suppliers**, **Purchase Requests**, and **Tenders**.
2. Reuse **quotations** and **quotation_items** for sent, received, manually recorded,
   and tender-related quotations. Do not introduce a parallel `supplier_quotes` or `bids` store.
3. Keep one **catalog_items** collection. Buying and selling are capabilities of an item,
   not reasons to duplicate it. A supplier's item in another site can have a different ID.
4. Preserve the current meaning of **is_purchasable**: customer checkout/variant behavior.
   Introduce separate procurement capability; do not add the misspelling `is_purchsable`.
5. Do not use **is_licitable** as a publication flag. An item participates through tender
   lines with quantities, specifications, deadlines, and a versioned publication.
6. Evolve **/buyer into /home**, retaining its design. Do not build a separate `/supplier`
   portal. One account can purchase and supply at the same time.
7. Add **/tenders**, the global directory based on **/marketplace**, in the initial public
   release; **/tenders/[siteSlug]** mirrors **/shop**. Global listing requires explicit opt-in.
8. Reuse existing **Purchases > Quotes**, **Purchases > Orders**, **Bills**, inventory,
   and accounting surfaces. An additional view is not an additional business document.
9. Separate solicitation, quotation submission, award, order, receipt, bill, and payment.
   None of these automatically proves that the next event has happened.
10. Clone the established **visual composition and interaction patterns**, not CRM,
    checkout, authorization, or accounting side effects. Extract shared presentation.
11. Add structured profile certifications and tender-specific certification requirements;
    see the [certifications design][certifications-design] for evidence, validity, and review rules.

Assumption: private business procurement. Regulated public procurement, certified
sealed-bid custody, and real-time reverse auctions require separate requirements.

## 2. Existing implementation and gaps

| Area | Existing implementation | Gap this design addresses |
| --- | --- | --- |
| Suppliers | Bills reference the global company registry through `vendor_company_id`. | A site-private supplier relationship, contacts, approval, and commercial terms. |
| CRM | Leads represent commercial contacts; Deals have sales stages and sale/quote links. | Reuse their UI without putting suppliers into marketing attribution or sales forecasts. |
| Received quotes | [Received quote route][received-route] uses [BuyerQuotesView][buyer-quotes]; [listBuyerQuotes][buyer-actions] filters by `buyer_user_id`. | Explicit buyer-site ownership/access and external supplier submissions; the current `scope` does not implement that separation. |
| Quotation writes | [Quotation actions][quote-actions] assume seller-side leads, catalog/tax context, and commercial acceptance. | Explicit parties, custody, immutable submissions, and procurement-specific transitions. |
| Catalog | [CatalogItem][catalog-types] includes `is_purchasable`, inventory, POS, and listing fields. | Separate sales/procurement capabilities and supplier-item mappings. |
| Variants | [Variant synchronization][variant-actions] updates `is_purchasable`; [checkout guards][product-details] consume it. | Do not reinterpret this flag as supplier sourcing eligibility. |
| Purchase orders | [Purchase order route][purchase-orders-route] wraps buyer views of existing commercial orders. | Support external procurement orders without pretending every order is already a `sale_order`. |
| Bills | [Purchase actions][purchase-actions] and [finance types][finance-types] already include lines, payments, due dates, and a bill-level stock-received flag. | Supplier/order links, line-level receipts, and matching; preserve existing finance behavior. |
| Account portal | [BuyerShell][buyer-shell] and [buyer profile][buyer-profile] already provide the external account experience. | Neutral naming, two-sided activity, and authorized supplier representation. |
| Public store | [Shop home][shop-page] and [ShopClient][shop-client] provide branded public browsing. | Publish tender briefs instead of products; replace buying with proposal submission. |

## 3. Domain model

### 3.1 Reuse and extend

| Entity | Intended responsibility |
| --- | --- |
| `companies` | Existing shared company identity; do not add tenant-private evaluations or negotiated terms to this global registry. |
| `catalog_items` | Existing site-owned product/service/digital item identity and variants. |
| `quotations`, `quotation_items` | One commercial quotation and its lines, regardless of screen or source. |
| `purchases`, `purchase_items` | Existing Bills and bill lines, not the internal request or purchase order. |
| Existing order, inventory, payment, and journal models | Preserve established commerce and accounting contracts; connect procurement explicitly. |

Quotation extensions must distinguish **issuer**, **recipient**, and **record custodian**.
An imported supplier PDF is recorded by the buyer, but the buyer is not its issuer.
Allow external issuers without a seller workspace and lines without a seller catalog item.
Do not create fake seller sites or sales leads to satisfy the existing implementation.

Add provenance, buyer-site context, supplier relationship, request context, and revision
support where appropriate. Private buyer annotations belong in buyer-scoped context,
not in fields automatically exposed to the issuer. Do not silently redefine the legacy
`quotations.site_id`; audit its readers, writers, RLS, public DTOs, and tax/checkout paths.

**Sent/received is a view relative to an authorized party, not a global direction flag.**
If both companies use Makinari, the same quotation appears in the issuer's Sent and
recipient's Received views. Linking it to a tender must not copy it into a second inbox row.

### 3.2 New conceptual entities

Physical names and constraints must be verified against the target schema before migration.

| Proposed entity | Responsibility and key relationships |
| --- | --- |
| `suppliers` | Site-private relationship to a company or independent professional; status, categories, owner, terms, and private notes. |
| `supplier_contacts` | Contact details and relationship roles. Being listed as a contact does not grant account access. |
| Supplier representation grants | Verified account-to-supplier/organization authority, permissions, and revocation; separate from buyer-site membership. |
| `catalog_item_suppliers` | Many-to-many sourcing relationship: buyer item, supplier SKU, purchase unit/conversion, minimum quantity, lead time, preferred/approved status, and dated price/currency. |
| `procurement_requests` and request lines | Internal need, justification, requester, budget/currency, required date, approval, destination, and requested items. |
| `tenders`, `tender_items`, and published revisions | Solicitation linked to a request; public brief, line requirements, dates, visibility, participation rules, and immutable published bases. |
| `tender_participants` | Invited or registered supplier participation and eligibility in one solicitation. |
| `tender_submissions` | Participant + quotation + exact submitted revision + server timestamp + submission/withdrawal/supersession state. Not another quotation. |
| Tender evaluations | Buyer-private scores, evaluator identity, notes, and decision evidence. Never supplier-editable quotation fields. |
| `tender_awards` and allocations | Approved selection of submitted revisions and awarded lines/quantities; supports eventual split awards. |
| `purchase_orders` and order lines | Proposed procurement commitment model, integrated into the existing Orders screens; explicit origin links for platform commerce. |
| Receipts and receipt lines | Actual accepted/rejected quantities, location, actor, evidence, and service acceptance; linked to order lines. |
| Amendments, clarifications, and audit records | Dated changes and communication, with explicit public/participant/internal visibility. |
| Certification types, holder credentials, revisions, requirement rules, submission evidence, and reviews | Structured qualifications belonging to a person or organization; pin submitted evidence and scope acceptance to each tender. See [certifications design][certifications-design]. |

One request can have multiple tenders, including a replacement after an unsuccessful
round. One tender has many participants and submissions. One order can have multiple
receipts and bills; allow explicit line allocations rather than assuming a universal 1:1.

Use supplier lifecycle states such as `prospect`, `under_review`, `approved`, `blocked`,
and `archived`. Losing one tender does not block the supplier. A new registration does
not approve it. A company can be both customer and supplier without duplicate identity.

### 3.3 Catalog integration

- Proposed `sales_enabled`: eligible for internal sales workflows.
- Proposed `procurement_enabled`: eligible for internal sourcing workflows.
- Keep `is_purchasable`, `is_pos_available`, `is_marketplace_listed`, and
  `track_inventory` independent, with their existing behavior preserved.
- A resale item can enable both capabilities; office supplies can enable only procurement.
- Procurement-only items must not leak into sales selectors, POS, or public shop listings.
- Never infer procurement permission or stock availability from the checkout flag.
- Supplier price/currency/validity belongs to an agreement or quotation, not our sale price.
- Buyer and supplier SKUs require an authorized equivalence and explicit unit conversion.
- Source a product family when useful, but resolve the actual buyer SKU before stock receipt.
- Tender lines may be freeform services or specifications with no catalog ID.
- Copy the relevant description/specification into published/submitted revisions; later
  catalog edits must not rewrite historic bases, quotations, awards, or orders.
- Show **Create tender**, active-tender counts, and sourcing history through relations,
  not a manually maintained `is_licitable` flag.

## 4. Business flows and invariants

```text
Internal need -> approval -> tender or direct sourcing
Tender -> publication/invitations -> quotation submissions -> evaluation -> award
Approved award -> purchase order -> receipt/service acceptance -> Bill -> payment
```

This is a typical sequence, not a requirement that payment always follows receipt.
Simple purchases may enter directly as Bills; advances and partial deliveries remain
separate facts. Preserve the documented [accounting policy][accounting-guide].

1. Creating a tender may also create its linked internal request in one guided flow.
2. Publishing requires complete bases, dates, participation rules, and authorization under the configured approval policy.
3. Submitting requires an authenticated, authorized participant and validated totals.
   Store the submitted revision and return a dated receipt; do not overwrite that revision.
4. Before the deadline, replacement or withdrawal follows the published rules and retains
   history. Amendments to the bases are versioned and notify affected participants.
5. Validate deadline and eligibility atomically using server/database time, including
   retries and concurrent closing. Neither a cached page nor a scheduled job is authority.
6. Evaluation does not modify an offer. An award records selected revision, quantities,
   amount/currency, reason, approver, and time; it is not merely `winner_supplier_id`.
7. Generate orders idempotently from approved awards. Repeated clicks cannot duplicate
   commitments. Use a canonical mapping for any order linked to existing commerce.
8. Supplier delivery updates are not buyer receipt confirmation. Receive against our
   SKU/location, and make receipt + stock changes atomic and retry-safe.
9. Match ordered, received, and billed quantities/amounts; show discrepancies explicitly.
   Bill payment state and financial posting remain separate from order fulfillment.
10. No request, tender, submission, or award automatically creates a sale, Bill, or payment.
    In particular, do not reuse quote checkout or Deal closed-won side effects for awards.

## 5. Screen inventory: internal workspace

All routes in this section require authorized access to the relevant site. **New** means
planned; **modified** means extending an existing screen, not replacing its current flows.

| Screen / route | Change | Content and primary actions |
| --- | --- | --- |
| Suppliers `/suppliers` | New | Directory, company/category/status/owner filters; create, invite, review, block. |
| Supplier `/suppliers/[id]` | New | **Overview, Contacts, Items, Documents, Activity**; Documents includes explicitly shared certifications, alongside quotes/orders/Bills. |
| Purchase Requests `/purchases/requests` | New | Table/Kanban; requester, budget, required date, approval and sourcing status. |
| Request `/purchases/requests/[id]` | New | **Overview, Items, Approvals, Sourcing, Activity**; submit, approve/reject, launch tender or direct purchase. |
| Tenders `/purchases/tenders` | New | Table/Kanban; owner, visibility, dates, participation/submission counts and lifecycle. |
| Tender `/purchases/tenders/[id]` | New | **Overview, Requirements, Publication, Participants, Proposals, Evaluation, Award, Clarifications, Activity**; Requirements defines certifications, Publication controls global listing, Evaluation reviews evidence. |
| Catalog `/catalog` | Modified | One catalog, filters for sales/procurement use; preserve existing item kinds and variants. |
| Item `/catalog/[id]` | Modified | **Procurement** tab: capability, suppliers, units/terms, history, create request/tender. |
| Received Quotes `/purchases/quotes` | Modified | Buyer-site inbox for direct, imported, and tender quotations; supplier/source/request/tender filters; record external quote. |
| Received Quote `/purchases/quotes/[id]` | Modified | Document/revisions, own-item matching, supplier and tender context; permitted recipient actions. |
| Sent Quotes `/quotations`, `/quotations/[id]` | Modified | Link an authorized outgoing quotation to a tender and submit an immutable revision. |
| Purchase Orders `/purchases/orders` | Modified | Unified list with explicit origin; retain online purchases alongside procurement orders. |
| Purchase Order `/purchases/orders/[id]` | Modified | **Overview, Items, Deliveries, Bills, Activity**; confirm, receive partially, accept service, link Bill. |
| Bills `/bills`, `/bills/[id]` | Modified | Supplier/order/receipt references, invoice reference/duplicate checks, matching; preserve due dates, payments, and posting. |
| Inventory `/inventory` | Modified | Receipt provenance and order references; no second stock ledger. |
| Settings `/settings?tab=procurement`; Rules `/purchases/rules` | Separate settings section and Buying screen | Settings: visibility, portal and base periods. Rules: product/category requirements, approvals and participation, using Subscriptions/Requirements tables; see [policy configuration](PROCUREMENT_POLICIES_DESIGN.md). |
| Team `/settings?tab=team` | Modified | Explicit capabilities for supplier management, publication, evaluation, awards, receiving, and payments. |
| Companies `/companies/[id]` | Contextual change | Link to the authorized site's supplier relationship without exposing other sites' private data. |
| Control Center, notifications, and navigation | Modified integration | Procurement tasks/events, module icons, breadcrumbs, screen-access keys, and links. |

**Do not add standalone apps** for comparisons, approvals, awards, receipts, supplier
contacts, certifications, or supplier quotations. Use detail tabs, related-record links, and dialogs.
New/create flows reuse the same editor as subsequent editing; a submission receipt is
a state in the quote detail, not an extra top-level destination.

Internal Buying navigation adds **Suppliers, Purchase Requests, Tenders** before the
existing quote/order/Bill destinations. Keep Transactions, Subscriptions, and Library.
Catalog remains shared; procurement entry points must not create a second catalog app.

## 6. Screen inventory: unified authenticated `/home`

Use the **same visual design as `/buyer`**, evolving its shell rather than creating
another branded dashboard. Home is the activity summary; Profile is a separate screen.

| Screen / route | Change from today | Content |
| --- | --- | --- |
| Home `/home` | Migrate/extend `/buyer` | Pending actions and recent buyer/supplier activity; retain current account/experience access. |
| Orders `/home/orders` | Migrate/extend | **Purchases / To fulfill**; perspectives over authorized documents, with origin retained. |
| Order `/home/orders/[id]` | Migrate/extend | Buyer tracking or supplier confirmation/delivery actions; never supplier-confirmed buyer receipt. |
| Quotations `/home/quotes` | Migrate/extend | **Received / Sent**; one quotation model, not duplicated buyer/supplier stores. |
| Quote `/home/quotes/[id]` | Migrate/extend | Document/editor, technical answers, attachments, revisions, submission receipt and permitted transitions. |
| Tenders `/home/tenders` | New within shared shell | **Invitations / My participations**; accept/decline invitations and resume participation. |
| Participation `/home/tenders/[id]` | New within shared shell | Authorized bases, amendments, clarifications, certification checklist with select/upload evidence, own submissions, and published outcome. |
| Subscriptions `/home/subscriptions` | Migrate | Existing purchased-subscription behavior and detail links. |
| Library `/home/library` | Migrate | Existing entitlements, content, reservations, courses, tickets, downloads, and booking links. |
| Profile `/home/profile` | Migrate/extend | **Personal information, Organizations, Supplier registrations, Certifications**; upload reusable credentials for authorized person/organization holders, not necessarily the uploader. |

The external portal requires no buyer-workspace membership or workspace creation.
There is no exclusive `user_type = buyer | supplier`. Derive each action from verified
document ownership and representation grants. An **Acting as** selector, when needed,
offers only authorized identities; it is not an authorization mechanism.

Supplier approval is specific to the buyer relationship. Registration under Buyer A
does not approve the supplier under Buyer B. External profiles never expose internal
ratings, competitors, private procurement budgets, or buyer-only notes.

Do not reproduce BuyerShell's count-only navigation filtering for first-use actions:
zero submissions must not make the tender workflow undiscoverable. Cache/query keys
must include account and acting identity; switching identities must not retain foreign data.

## 7. Screen inventory: public tender portal

| Screen / route | Content | Access |
| --- | --- | --- |
| Global directory `/tenders` | Marketplace-style search, filters, cards and pagination across buyers; show buyer, title/category, location, closing date, participation mode and optional public budget. | Anonymous; only published public tenders with global-listing opt-in and an active public portal. |
| Portal `/tenders/[siteSlug]` | Branding, opportunity cards, category/location/deadline filters, optional closed archive, sign-in/register links. | Anonymous, published public records only. |
| Tender `/tenders/[siteSlug]/[tenderSlug]` | Public brief, requirements, bases, deadlines, published criteria, clarifications/amendments, optional public budget/outcome. | According to visibility; never raw internal request data. |
| Registration entry `/tenders/[siteSlug]/register` | Explain registration requirements and start verified access. | Public entry; sensitive forms continue authenticated in `/home/profile`. |
| Terms `/tenders/[siteSlug]/terms` | Portal and participation terms with actual approved version/date. | Public. |
| Privacy `/tenders/[siteSlug]/privacy` | Buyer-specific data handling with approved version/date. | Public. |

The main CTA is **Submit proposal**, not Buy or Checkout. Authentication returns to the
correct participation under `/home/tenders/[id]`, preserving safe intent and authorized scope.

Visibility and eligibility are independent; [workspace policies and tender overrides](PROCUREMENT_POLICIES_DESIGN.md) configure defaults, allowed values and approval rules:

- Global discoverability is separate from site publication: `is_globally_listed` is a
  proposed tender-level opt-in, never a catalog flag. Exclude drafts, unlisted/private
  tenders and disabled/archived sites from results, counts and caches; cards link to the
  existing site-scoped tender detail. Unpublishing or removing opt-in removes global exposure.
- Visibility: **public**, **unlisted**, or **private**. Unlisted is accessible by link,
  not confidential. Private tenders are absent from public listings and require access.
- Participation: **open**, **invitation-only**, or **approved suppliers only**.
- Opening policy: declare whether authorized evaluators can read offers on receipt or
  only after closing; formal tenders should default to after-close review. Enforce this
  in data/file access, not just UI. Stronger regulated sealing is outside this scope.
- Use stable unique slugs, not names recalculated on every rename. Public cache entries
  contain only public DTOs; publication/revocation must invalidate affected entries.
- Never expose competitor proposals, attachments, private budgets, or evaluation notes.
  Public award notices are deliberate redacted publications, not raw award rows.

Public `/shop` and `/marketplace` keep their selling behavior. Tender listing does not
publish catalog internals. Public quote-token paths must not bypass tender confidentiality.

## 8. Mandatory UI/UX reuse map

### 8.1 What "clone" means

Before implementing each screen, inspect its reference below. Match its information
hierarchy, spacing, typography, header actions, filters, tab behavior, responsive layout,
loading skeletons, empty/error states, and dialog conventions. Do not invent a new design
system for procurement. Reference code is not automatically an approved security template.

**Reuse** means compose an existing presentation primitive. **Adapt** means extract a
neutral view from a domain-bound component and supply new typed data/actions. **Extend**
means modify the existing screen. Do not copy oversized pages or pass fake Lead/Deal/
CatalogItem objects into incompatible components just to reuse their JSX.

### 8.2 Internal screens and editors

| Target screen/section | Existing screen to clone as UI/UX reference | Reuse/adaptation and mandatory differences |
| --- | --- | --- |
| Suppliers list | `/leads`: [LeadsTable][leads-table] | Adapt row density, company/contact identity, search/filter/pagination and empty states. Replace sales segments/statuses with supplier categories/approval; no marketing actions. |
| Supplier detail | `/leads/[id]`: [lead detail page][lead-detail], [LeadIdentityHeader][lead-header], [LeadDetail][lead-about] | Adapt identity header, property panel, responsive tabs and skeleton. Replace journey/attribution with supplier activity and sourcing documents. |
| Supplier contacts/representatives | Deal stakeholders: [DealContactsList][deal-contacts], [DealTeamList][deal-team] | Adapt relation rows, primary badges and add/remove dialogs. New representation grants are not `deal_leads` or membership in the buyer's team. |
| Supplier-item relation / Catalog Procurement tab | `/catalog/[id]`: [PlanItemsTab][plan-items], [ChannelsTab][catalog-channels] | Adapt relation table, add dialog and capability controls; add SKU, unit conversion, minimum, lead time and dated price. Do not invoke plan entitlement actions. |
| Request and tender lists | `/deals`: [Deals page][deals-page], [DealsTable][deals-table], [DealsKanban][deals-kanban] | Adapt view selector, mobile filters, stage columns and skeletons. Use procurement stages; dragging cannot bypass approval/publication guards. |
| Request and tender details | `/deals/[id]`: [Deal detail][deal-detail], [DealIdentityHeader][deal-header], [DealAboutPanel][deal-about], [DealStageBar][deal-stages] | Adapt title/properties/stage presentation and linked sections. Replace sales qualification and closed-won logic with request/tender lifecycle. |
| Create supplier/request/tender | [CreateDealDialog][create-deal] + existing relation controls | Adapt DialogForm, validation placement, busy state and action footer. Use supplier/request fields, not sales leads or Deal mutations. Continue complex tender editing on its detail page. |
| Request/tender line editor | [CreateQuotationLineItems][quote-lines], [ItemSpecsEditor][spec-editor] | Adapt repeatable lines, item picker and specifications. Support freeform lines and published snapshots; do not write changes back to the catalog inadvertently. |
| Received quote/manual entry | Existing [BuyerQuotesView][buyer-quotes], [BuyerQuoteDocument][quote-document], [CreateQuotationDialog][create-quote] | Extend existing views and extract editor fields. Explicit supplier/recipient context, external lines, input validation, and source-specific actions replace seller assumptions. |
| Tender comparison | [QuotesTable][quotes-table] + [shared table][ui-table] | Reuse table, status, currency and document-link styling. New comparison matrix inside Evaluation, not a new app; show revisions, units, tax/currency basis and missing values, not invented zero prices. |
| Approval/award dialogs | [Shared dialog][ui-dialog], [confirmation dialog][confirm-dialog], [SectionCard][section-card] | Compose approver, reason, selected revision and totals with explicit confirmation; never copy commercial quote acceptance handlers. |
| Purchase order list/detail | [BuyerOrdersView][buyer-orders], [BuyerOrderDetailView][buyer-order-detail] | Extend current buying screens; add origin, supplier and Deliveries/Bills tabs without duplicating online orders. |
| Receipt and Bill workflows | [CreatePurchaseDialog][create-bill], [PurchaseInvoice][bill-document], [payment dialog][bill-payment] | Preserve document/form style; add receipt line quantities and evidence. Receipt writes are new atomic operations, not copies of legacy stock updates. |
| Procurement settings | Existing [Settings page][settings-page], [CompanyProfileCard][company-profile], [SectionCard][section-card] | Add a section with existing save/dirty-state UX; use procurement fields and policy permissions rather than copying company settings writes. |

### 8.3 Unified external portal

| Target | Existing screen/components to reuse | Adaptation |
| --- | --- | --- |
| Entire `/home` shell | [BuyerShell][buyer-shell] + [CommerceShellHeader][commerce-header] | Evolve in place into a neutral account shell; same visual language and mobile behavior. Replace buyer-only links/count filtering and identity-unsafe cache keys. |
| `/home` | [BuyerHomeView][buyer-home] | Extend existing cards/recent activity with invitations and actions to fulfill; no new dashboard design. |
| `/home/orders` and detail | [BuyerOrdersView][buyer-orders], [BuyerOrderDetailView][buyer-order-detail] | Add Purchases/To fulfill perspectives using authorized data adapters and distinct actions. |
| `/home/quotes` and detail/editor | [BuyerQuotesView][buyer-quotes], [BuyerQuoteDetailView][buyer-quote-detail], [BuyerQuoteDocument][quote-document], [CreateQuotationDialog][create-quote] | Add Received/Sent and reusable editing fields. Separate rendering from checkout/public-token loading; participation does not invoke Buy. |
| `/home/tenders` | [BuyerQuotesView][buyer-quotes] and [QuotesTable][quotes-table] | Adapt the same list/tabs/search/skeleton pattern for Invitations/My participations, deadlines and next actions. |
| `/home/tenders/[id]` | [BuyerQuoteDetailView][buyer-quote-detail] document layout + tender brief presentation | Reuse shell/document/action placement; add authorized bases, own submission and clarifications. No internal evaluation tabs. |
| `/home/profile` | [Buyer profile][buyer-profile] + existing [personal profile][personal-profile] fields | Reuse account identity/forms; add Organizations/Supplier registrations/Certifications. Use the [certification UI reuse map][certifications-design]; never duplicate identity or expose the full credential dossier. |
| Subscriptions, library and experiences | [BuyerSubscriptionsView][buyer-subscriptions], [BuyerLibraryView][buyer-library] and existing experience routes | Retain current UX and entitlements; update links and preserve specialized course/ticket/booking layouts. |

### 8.4 Public screens

| Target | Existing screen/components to clone as reference | Adaptation |
| --- | --- | --- |
| `/tenders` global directory | [MarketplaceClient][marketplace-client], [MarketplaceHeader][marketplace-header], [MarketplaceProductList][marketplace-list] | Adapt search, category/location/deadline filters, buyer identity cards, pagination and loading/empty states. Replace products with opportunities and View tender/Submit proposal; no cart, checkout or sales-ranking rules. |
| `/tenders/[siteSlug]` | [Shop home][shop-page], [ShopClient][shop-client], [ShopHeader][shop-header], [ShopCatalogMain][shop-catalog], [ShopCategoryChips][shop-categories], [ShopSiteFooter][shop-footer] | Extract branded header, search, card/list grid, filters and footer. Replace merchandise with opportunities and deadline/status metadata; exclude cart, promotions and checkout hooks. |
| Public tender detail | [Shop item page][shop-item-page], [ProductDetailPage][product-detail] | Adapt public header, back/share controls, content/action hierarchy and responsive layout. Render brief/requirements/deadlines and Submit proposal; do not fabricate a product or import purchase side effects. |
| Public loading/not-found | [ShopHomeSkeleton][shop-skeleton], [ShopSlugNotFound][shop-not-found] | Match final tender layout in loading and error states; exclude cart/price skeleton sections. |
| Registration entry | [Buyer profile][buyer-profile] card style + existing auth flow | Public explanation and sign-in CTA; authorized forms under `/home/profile`. No separate registration identity system. |
| Terms and privacy | [Shop PrivacyClient][shop-privacy] | Reuse legal-page structure, header and readable content width; use approved procurement texts and actual version dates, not today's date on every render. |

Shared building blocks: [document-list primitives][document-list], [responsive tabs][responsive-tabs],
[StickyHeader][sticky-header], [RelationSelect][relation-select], [mobile filters][mobile-filters],
[SectionCard][section-card], [Dialog][ui-dialog], [Table][ui-table], and [icons][icons].
Keep new/touched files below 500 lines. Read the installed Next.js guides before writing
route, cache, auth, or Server Action code; this document does not prescribe outdated APIs.

## 9. Authorization, confidentiality, and migration

- Apply [repository security rules][security-guide] to each API, action, RPC, storage
  download, and export. Screen visibility is not authorization. Prefer user-scoped RLS.
- Split internal management/publication/evaluation/award/receipt/payment capabilities.
  Keep current stored roles; define new capabilities rather than inventing role values.
- A supplier contact, matching email, company name, or tax ID alone grants no access.
  Invitations/representation claims require verification, expiry/revocation and audit.
- Do not disclose unpublished drafts, sealed submissions, or internal notes through
  list counts, caches, logs, PDFs, exports, share tokens, or attachment URLs.
- Uploads require size/type validation, private storage and authorized retrieval;
  public bases and confidential offers use different visibility policies.
- Recalculate submitted monetary totals on the server from validated offer inputs;
  do not reuse catalog sale prices/taxes as the supplier's offered amounts or taxes.
- Compare different currencies only with an explicit dated conversion basis; otherwise
  keep amounts separated. Never sum currencies into a misleading total.
- Extend quote party/custody/line models and RLS before enabling external quote writes.
  Check legacy `lead_id`, `catalog_item_id` and `site_id` constraints against the real schema.
- Preserve historical Bills and vendor-company attribution. A supplier backfill can use
  reviewed `(site_id, vendor_company_id)` pairs; do not invent identities for unmatched rows.
- Preserve commercial order IDs and origins. Decide the canonical order bridge before
  exposing mixed-source detail URLs; one order/event must not create duplicate Bills or stock.
- Follow [forward-only migration guidance][migration-guide]. No remote migration, backfill,
  production build, deployment, or regulated accounting policy change is authorized here.

### `/buyer` to `/home` compatibility

| Existing destination | Proposed canonical destination |
| --- | --- |
| `/buyer` | `/home` |
| `/buyer/orders` | `/home/orders?tab=purchases` |
| `/buyer/orders/[id]` | `/home/orders/[id]` |
| `/buyer/quotes` | `/home/quotes?tab=received` |
| `/buyer/quotes/[id]` | `/home/quotes/[id]` |
| `/buyer/profile` | `/home/profile` |
| `/buyer/subscriptions`, `/buyer/library` and their details | Equivalent `/home` routes, preserving IDs and permitted query parameters. |
| `/buyer/course`, `/buyer/ticket`, `/buyer/downloads`, `/buyer/book`, `/buyer/reservations`, `/buyer/visits` descendants | Explicit equivalent experience routes; preserve access grants, parameters and specialized layouts. |

Retain legacy redirects and update new link generation; do not use blind string replacement
for all query strings or document paths. Preserve safe return destinations through auth,
checkout, email, invitation, recovery and sign-out flows without granting access through URL data.

Review [post-auth redirects][post-auth], [workspace-site redirects][site-redirect],
[route layout configuration][route-config], navigation/breadcrumb keys, middleware,
commerce sign-in helpers, and both sides of the www-to-app proxy in [Next config][next-config].
Coordinate the commercial-site proxy changes; do not assume an app-only route rename is enough.
External default landing becomes `/home`; workspace default remains `/projects`; a safe
explicit return destination takes precedence. `/home` stays authenticated but must work
without a current workspace site. Public `/tenders` and private `/home/tenders` stay distinct.

## 10. Delivery sequence, acceptance, and limits

1. **Foundation:** verify live schema, define party/representation and order bridge
   contracts, supplier relationships, catalog capabilities, and backward-compatible RLS.
2. **Unified account portal:** extract/reuse BuyerShell, migrate navigation and profile,
   preserve existing purchases/entitlements, and add authorized supplier context/certifications.
3. **First vertical slice:** request -> publish public or invite-only tender -> external
   participant submits quotation -> buyer compares -> approves whole-tender award to one
   supplier -> generates purchase order. Include versioning, deadlines, permissions,
   private attachments, certification requirements/evidence, basic clarification/amendment
   history, and the opt-in **global `/tenders` directory** from the initial public release.
4. **Operational completion:** partial receipts/service acceptance, Bill matching,
   discrepancy handling and reliable stock integration without duplicate legacy receipts.
5. **Later:** split/lot awards, advanced weighted evaluation, supplier performance,
   contracts/renewals, automated sourcing, advanced search and global-directory recommendations.

The [policy extension](PROCUREMENT_POLICIES_DESIGN.md) defines direct purchases, net thresholds,
cumulative rules, fallback, supervisor exceptions, urgent presets and human/AI decisions.
It tracks remaining decisions; legal evidence is optional by rule and AI review provisional.
Do not block the first vertical slice on replacing the entire CRM or building an ERP.

### Required acceptance checks

- Compare each new screen with its section 8 reference on desktop/mobile and light/dark
  themes; verify keyboard/focus, loading, empty, error, denied and read-only states.
- Existing buyer orders, subscriptions, downloads, courses, tickets and booking links
  still work through new and legacy URLs, with no forced workspace onboarding.
- One account can receive a quote and submit another; changing Acting as never leaks data.
- External suppliers participate without fake sites/leads; manual and portal quotes
  appear once in the existing buyer-site inbox, with their true issuer/provenance.
- Public/unlisted/private visibility and open/invited/approved eligibility work independently.
- Global listing requires separate opt-in; revocation affects results/counts/caches, while
  public site-only tenders remain accessible without appearing in the directory.
- Verify the [certification acceptance checklist][certifications-design]: holder authority,
  required type/scope/validity, per-tender reviews, selective sharing and immutable evidence.
- Cross-site reads/writes and competitor/private attachment access are denied, including
  public tokens, exports, cache responses, and after representation revocation.
- Submitted versions and published bases remain stable after later edits; deadline races,
  duplicate submissions, award retries and receipt retries do not duplicate effects.
- Procurement capability does not alter checkout variant selection or publish catalog items.
- Awarding is not paying; supplier delivery is not buyer receipt; accounting is not posted
  twice through online-commerce and procurement representations of the same event.

Existing focused Jest suites for catalog checkout variants, buyer quote ownership,
public-document exposure, navigation and auth redirects provide regression baselines.
They do **not** validate this unimplemented procurement flow. Add domain/security tests
and approved disposable-target browser scenarios during implementation. Documentation
handoff checks cover link/reference integrity, current-source grounding, and file length.

## Source references

[accounting-guide]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/ACCOUNTING.md
[bill-document]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/bills/components/PurchaseInvoice.tsx
[bill-payment]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/bills/components/RegisterPurchasePaymentDialog.tsx
[buyer-actions]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/actions.ts
[buyer-home]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerHomeView.tsx
[buyer-library]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerLibraryView.tsx
[buyer-order-detail]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerOrderDetailView.tsx
[buyer-orders]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerOrdersView.tsx
[buyer-profile]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/profile/page.tsx
[buyer-quote-detail]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerQuoteDetailView.tsx
[buyer-quotes]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerQuotesView.tsx
[buyer-shell]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerShell.tsx
[buyer-subscriptions]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerSubscriptionsView.tsx
[catalog-channels]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/catalog/components/ChannelsTab.tsx
[catalog-types]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/types/catalog.ts
[commerce-header]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/commerce/CommerceShellHeader.tsx
[company-profile]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/settings/CompanyProfileCard.tsx
[confirm-dialog]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/confirm-dialog.tsx
[create-bill]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/bills/components/CreatePurchaseDialog.tsx
[create-deal]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/CreateDealDialog.tsx
[create-quote]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/quotations/components/CreateQuotationDialog.tsx
[deal-about]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/DealAboutPanel.tsx
[deal-contacts]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/DealContactsList.tsx
[deal-detail]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/[id]/page.tsx
[deal-header]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/DealIdentityHeader.tsx
[deal-stages]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/DealStageBar.tsx
[deal-team]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/DealTeamList.tsx
[deals-kanban]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/DealsKanban.tsx
[deals-page]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/page.tsx
[deals-table]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/deals/components/DealsTable.tsx
[document-list]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/documents/document-list.tsx
[finance-types]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/types/finance.ts
[icons]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/icons.tsx
[lead-about]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/leads/components/LeadDetail.tsx
[lead-detail]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/leads/[id]/page.tsx
[lead-header]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/leads/components/LeadIdentityHeader.tsx
[leads-table]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/leads/components/LeadsTable.tsx
[migration-guide]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/DATABASE_MIGRATIONS.md
[mobile-filters]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/mobile-filters-drawer.tsx
[next-config]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/next.config.js
[personal-profile]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/profile/page.tsx
[plan-items]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/catalog/components/PlanItemsTab.tsx
[post-auth]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/lib/auth/post-auth-redirect.ts
[product-detail]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/commerce/pdp/ProductDetailPage.tsx
[product-details]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/catalog/product-details.ts
[purchase-actions]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/purchases/actions.ts
[purchase-orders-route]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/purchases/orders/page.tsx
[quote-actions]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/quotations/actions.ts
[quote-document]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/buyer/components/BuyerQuoteDocument.tsx
[quote-lines]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/quotations/components/CreateQuotationLineItems.tsx
[quotes-table]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/documents/quotes-table.tsx
[received-route]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/purchases/quotes/page.tsx
[relation-select]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/relation-select.tsx
[responsive-tabs]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/responsive-tabs-list.tsx
[route-config]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/config/routes.ts
[section-card]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/section-card.tsx
[security-guide]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/SECURITY.md
[settings-page]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/settings/page.tsx
[shop-catalog]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/ShopCatalogMain.tsx
[shop-categories]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/ShopCategoryChips.tsx
[shop-client]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/ShopClient.tsx
[shop-footer]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/ShopSiteFooter.tsx
[shop-header]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/ShopHeader.tsx
[shop-item-page]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/[itemId]/page.tsx
[shop-not-found]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/ShopSlugNotFound.tsx
[shop-page]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/(home)/page.tsx
[shop-privacy]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/privacy/PrivacyClient.tsx
[shop-skeleton]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/shop/[siteSlug]/ShopHomeSkeleton.tsx
[site-redirect]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/lib/auth/workspace-site-redirect.ts
[spec-editor]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/catalog/components/ItemSpecsEditor.tsx
[sticky-header]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/sticky-header.tsx
[ui-dialog]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/dialog.tsx
[ui-table]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/components/ui/table.tsx
[variant-actions]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/catalog/variant-actions.ts
[certifications-design]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/docs/PROCUREMENT_CERTIFICATIONS_DESIGN.md
[marketplace-client]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/marketplace/MarketplaceClient.tsx
[marketplace-header]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/marketplace/MarketplaceHeader.tsx
[marketplace-list]: /Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit/app/marketplace/MarketplaceProductList.tsx
