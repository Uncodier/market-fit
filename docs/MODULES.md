# Makinari module guide

Internal functional reference for product, operations, support, and onboarding.
Coverage refreshed against current navigation and new procurement/account source
on **2026-11-04**; unchanged core entries retain their **2026-10-23** review. This describes implemented
screens and workflows, not a certification of deployment or live provider delivery.

## How to use this guide

This is the consolidated summary of all modules, including account/public tools.
Each module explains its purpose, principal capabilities, and a typical use.
New procurement/account entries also state maturity: implemented slice,
configuration only, transitional alias, or deployment-gated. None means production-certified.
Routes identify application destinations; source links identify implementation.
Navigation follows [the current module configuration](../app/config/navigation-areas.ts).
Areas group the menu; they do not add prefixes to routes.

- Select the correct business/project first. A **site** is a workspace, not
  necessarily a website. A **location** is a branch/resource scope within it.
- Visibility and actions depend on membership, role, app access, location access,
  licenses, and resource state. A visible button does not establish permission.
- Save configuration explicitly where a Save action is provided. Confirm the
  returned state before repeating payments, messages, or automation requests.
- External search, AI execution, publishing, payments, and hardware require their
  respective configured services. Saved settings are not proof of execution.
- Demo data illustrates the interface; it is not evidence of real transactions.
- Display language is an account preference; site language also influences public
  content and generated documents. Labels may differ from the English names here.

See [Security](SECURITY.md), [environment configuration](ENVIRONMENT_VARIABLES.md),
and [location access](LOCATION_ACCESS_ENFORCEMENT.md) for operational boundaries.

## Contents

- [Workspace tools](#workspace-and-personal-tools) · [Marketing](#marketing) · [Sales](#sales)
- [Operations](#operations) · [Buying](#buying) · [Finance](#finance) · [Reports](#reports)
- [Applications](#applications) · [Automation](#automation) · [Settings](#settings)
- [Public commerce and buyer portal](#public-commerce-and-buyer-portal)
- [Cross-module workflows](#cross-module-workflows) · [Limits and maintenance](#limits-and-maintenance)

## Workspace and personal tools
### Projects — `/projects`
- **Purpose/use:** Choose an accessible business workspace, open AI Workspace or manage businesses with `/projects?manage=1`.
- **Limits:** Workspace selection does not grant additional membership, location or license rights. **Source:** [Projects](../app/projects/page.tsx).
### Create site and onboarding — `/create-site`, `/onboarding`
- **Purpose/use:** Create a business workspace, supply its information and complete setup before enabling customer-facing channels.
- **Limits:** Setup completion alone does not prove commerce/provider readiness. **Source:** [Setup launch](SITE_SETUP_LAUNCH.md).
### Navigation — `/navigation`
- **Purpose/use:** Discover all business-area modules and open canonical destinations when they are not pinned in the sidebar.
- **Limits:** Availability still follows access/license rules. **Source:** [Navigation](../app/navigation).
### Profile — `/profile`
- **Purpose/use:** Maintain personal information, avatar, email security, display/calendar preferences and notification preferences.
- **Limits:** Job title and preferences are not authorization roles or business settings. **Source:** [Profile](../app/profile/page.tsx).
### Notifications — `/notifications`
- **Purpose/use:** Search messages, filter unread notifications, mark read and delete notifications.
- **Limits:** Deleting a notification does not delete its business record. **Source:** [Notifications](../app/notifications/page.tsx).

## Marketing
### Campaigns — `/campaigns`
- **Purpose/capabilities:** Organize marketing initiatives with audience/segment links, status, requirements, promotions, recorded expenses, and attributed sales; browse table/Kanban views.
- **Use:** Create an initiative, associate its audience and brief, then record spending and sales to review campaign economics.
- **Limits:** AI-assisted creation can create a linked requirement; it does not prove execution. Recorded financial aggregates are not independent advertising attribution.
- **Source:** [Campaigns](../app/campaigns/page.tsx); [creation](../app/campaigns/actions/campaigns/create.ts).
### Segments — `/segments`
- **Purpose/capabilities:** Define audiences using descriptions, language, size estimates and status; inspect stored targeting analysis, ICP profiles, and activity metrics.
- **Use:** Define the target audience, review its stored analysis, and reuse it in campaigns and prospect-enrichment requests.
- **Limits:** Analysis display does not itself run research. Some legacy profile/metric presentations have fallback or comparison limitations; do not treat estimates as measured outcomes.
- **Source:** [Segments](../app/segments/page.tsx); [segment detail](../app/segments/[id]/page.tsx).
### Promotions — `/promotions`
- **Purpose/capabilities:** Configure percentage, fixed-amount and buy/get offers, coupon codes, product/category eligibility, cart requirements, dates, usage limits, channels, and location rules; inspect redemptions.
- **Use:** Define the offer and eligible items, choose its commercial channels, then inspect resulting redemption orders.
- **Limits:** Merchandising visibility and discount eligibility are separate. Generated banners require the configured generation service.
- **Source:** [Promotions](../app/promotions/page.tsx); [promotion detail](../app/promotions/[id]/page.tsx).
### Content — `/content`
- **Purpose/capabilities:** Maintain content items and their lifecycle, inspect/edit details, and request supported publishing operations; additional research and teleprompter surfaces support content preparation.
- **Use:** Prepare and review an item before publishing to an authorized connected destination; use the teleprompter for script reading.
- **Limits:** Publishing/scheduling depends on the external provider. Request acceptance or a local status is not proof that a post is publicly available.
- **Source:** [Content](../app/content/page.tsx); [Deep Research](../app/content/deepResearch/page.tsx); [Teleprompter](../app/teleprompter/[id]/page.tsx); [reliability](CONTENT_RELIABILITY.md).
### Content Creator — `/robots?mode=imprenta`
- **Purpose/capabilities:** Compose a persistent canvas with Text, Image, Video, Audio, Audience, and Publish nodes; connect prompts/media, generate variants, and copy/download outputs.
- **Use:** Create connected source and generation nodes, review output, select an audience where needed, and choose exact connected publishing/delivery accounts.
- **Limits:** Requires an assistant instance and external generation/delivery services. It is not a pixel editor, video timeline, or audio mixer; canvas configuration is not a scheduling engine.
- **Source:** [Robots](../app/robots); [account-specific destinations](CONTENT_CREATOR_DESTINATIONS.md); [speech options](CONTENT_CREATOR_AUDIO.md).
### Assets — `/assets`
- **Purpose/capabilities:** Browse and manage the workspace's reusable media/file assets for content and other business workflows.
- **Use:** Locate or add a reusable asset, inspect it, and use its supported reference in the consuming module.
- **Limits:** File access follows storage authorization; an asset record is not a public-sharing or purchased-content entitlement.
- **Source:** [Assets](../app/assets/page.tsx).

## Sales
### Sales Home — `/sales-home`
- **Purpose/capabilities:** Shortcut hub for Sales, Leads, Deals, Control Center, Chat, and People; can hand off to sale registration.
- **Use:** Open the relevant commercial workflow rather than treating this hub as a financial report.
- **Limits:** Hidden from normal module entries; it is not a separate sales ledger. People is prospect search, not team administration.
- **Source:** [Sales Home](../app/sales-home/page.tsx).
### POS — `/pos`
- **Purpose/capabilities:** Build a customer cart, choose items/options and location, apply eligible pricing/promotions, complete supported checkout, and operate register shifts and receipts.
- **Use:** Select the operating location/register, prepare the cart, confirm inventory and payment, then review the resulting order and receipt.
- **Limits:** Local snapshots and synchronization support POS operation, not unrestricted offline payment or stock guarantees. Resolve ambiguous/conflicted checkout instead of charging again.
- **Source:** [POS](../app/pos/page.tsx); [inventory](POS_INVENTORY.md); [register shifts](POS_REGISTER.md); [checkout recovery](POS_CHECKOUT_RECOVERY.md).
### Catalog — `/catalog`
- **Purpose/capabilities:** Maintain sellable items, prices, categories, media, item-specific configuration and channel visibility; import catalog data and maintain modifier groups at `/catalog/modifier-groups`.
- **Use:** Define the product/service or digital offering, configure its options and fulfillment/access requirements, then expose it in the intended channel.
- **Limits:** Catalog definition, branch inventory, public listing, and post-payment access are separate concerns; creating an item does not complete those workflows automatically.
- **Procurement:** Maintain independent sourcing capability and dated supplier offers with units/conversion, validity, minimum quantities and commercial terms. This implemented slice does not automatically exclude items from sales channels or provide complete sourcing/request-launch workflows.
- **Source:** [Catalog](../app/catalog/page.tsx); [modifier groups](../app/catalog/modifier-groups/page.tsx); [import](CATALOG_IMPORT.md); [category archival](CATALOG_CATEGORY_ARCHIVAL.md).
### Price Lists — `/price-lists`
- **Purpose/capabilities:** Maintain named sets of catalog prices and inspect/edit their item-level pricing.
- **Use:** Define the appropriate commercial pricing and use it in workflows that support price-list selection.
- **Limits:** A saved list is not a universal override of every channel; checkout validates applicable server-owned prices.
- **Source:** [Price Lists](../app/price-lists/page.tsx); [detail](../app/price-lists/[id]/page.tsx).
### Customer Subscriptions — `/subscriptions`
- **Purpose/capabilities:** Inspect and maintain customer-facing commercial subscriptions, their terms/status, and related invoicing.
- **Use:** Open a customer's subscription, review its dates and terms, and perform the permitted lifecycle or invoice operation.
- **Amount changes:** Authorized revision-checked edits apply to the next ungenerated cycle and renewals, not existing invoices/payments or Stripe prices. Amounts are non-negative with at most two decimals; invoice generation requires a positive amount.
- **Limits:** Not the business's Makinari license or its purchased subscriptions. Subscription terms, invoice due dates, and confirmed payment remain distinct.
- **Source:** [Subscriptions](../app/subscriptions/page.tsx); [detail](../app/subscriptions/[id]/page.tsx); [terms and due dates](FINANCIAL_DUE_DATES.md).
### Accounts Receivable — `/accounts-receivable`
- **Purpose/capabilities:** Review customer invoice balances and due-date collection work, opening the related sale/invoice to inspect settlement.
- **Use:** Prioritize outstanding balances, inspect the document, then record or request the supported balance payment through its authorized flow.
- **Limits:** Due date is not subscription renewal or payment confirmation. Payment actions must use the current outstanding balance.
- **Source:** [Accounts Receivable](../app/accounts-receivable/page.tsx); [invoice payments](LEAD_INVOICE_PAYMENTS.md); [due dates](FINANCIAL_DUE_DATES.md).
### Sales — `/sales`
- **Purpose/capabilities:** Register and inspect commercial sale records, customer associations, amounts/status, and related financial documents and payment evidence.
- **Use:** Register the commercial transaction or open an existing sale to review its actual collection/document state.
- **Limits:** A sale record, a completed order, collected cash, and posted accounting revenue are not interchangeable.
- **Source:** [Sales](../app/sales/page.tsx); [sale detail](../app/sales/[id]/page.tsx); [sales reporting](REPORTS.md).
### Leads — `/leads`
- **Purpose/capabilities:** Maintain customer/prospect contact records, qualification/status and associations; inspect related commercial activity, conversations, and follow-up work.
- **Use:** Create or qualify a contact, associate the appropriate campaign/segment, and follow up using tasks, deals, or customer conversations.
- **Limits:** Outbound calling requires appropriate contact data and consent; contact presence is not permission to call.
- **Source:** [Leads](../app/leads/page.tsx); [call consent](LEAD_CALL_CONSENT.md); [invoice balance payments](LEAD_INVOICE_PAYMENTS.md).
### Deals — `/deals`
- **Purpose/capabilities:** Maintain sales opportunities, stages/status, value, ownership and related customer/quotation information.
- **Use:** Track an opportunity through negotiation and issue an associated quotation when commercial terms are ready.
- **Limits:** Pipeline value is prospective, not collected revenue. Deal location and quotation scope must remain consistent.
- **Source:** [Deals](../app/deals/page.tsx); [detail](../app/deals/[id]/page.tsx).
### Quotations — `/quotations`
- **Purpose/capabilities:** Prepare itemized offers with quantities, pricing, notes and totals; send/resend PDFs and public review links; request configured dynamic pricing.
- **Use:** Prepare the offer for a customer/deal, resolve prices and authorization, then explicitly send it or share its client link.
- **Limits:** Setting Sent does not itself email the customer. Dynamic pricing needs the configured backend; buyer checkout requires an eligible current quotation.
- **Source:** [Quotations](../app/quotations/page.tsx); [actions](../app/quotations/actions.ts); [pricing requests](../app/quotations/dynamic-quote-request.ts).
### People and company details — `/people`, `/companies/[id]`
- **Purpose/capabilities:** Search external prospects with person/role/company criteria, manage saved Finder lists and request enrichment; company detail maintains persisted company information.
- **Use:** Search prospects, save useful results, and request enrichment; use Leads for CRM follow-up and Settings Team for workspace membership.
- **Limits:** Finder requires its external backend. An accepted enrichment request is not completed research; company detail is not a complete standalone company-directory module.
- **Source:** [People](../app/people/page.tsx); [Finder proxy](../app/api/finder/[...path]); [company detail](../app/companies/[id]/page.tsx).

## Operations
### Chat — `/chat`
- **Purpose/capabilities:** Browse customer and internal agent conversations, search/filter history, manage pending messages, and send team interventions through available channels.
- **Use:** Review the thread and select the intended channel/context before replying; use internal agent discussion when the customer should not receive the message.
- **Limits:** Public social comments are not DMs. Voice intervention requests an outbound call, not proof of an answered call; delivery needs active connections and consent checks.
- **Source:** [Chat](../app/chat/page.tsx); [intervention delivery](CHAT_INTERVENTION_DELIVERY.md); [social comments](SOCIAL_COMMENT_CONVERSATIONS.md).
### Records — `/records`
- **Purpose/capabilities:** Define category templates and structured fields; maintain rich-text records, relationships/status and diagrams; browse table, Kanban, calendar and graph views.
- **Use:** Define a category for an inspection, document or knowledge entry, create records, link related entities, and save changes.
- **Limits:** Calendar placement uses creation time, not a reservation schedule. Stored-field insights are not a guarantee of AI-generated analysis.
- **Source:** [Records](../app/records/page.tsx); [record detail](../app/records/[id]).
### Customer Orders — `/orders`
- **Purpose/capabilities:** Inspect the selected seller's customer orders, lines, fulfillment/payment state and related documents; perform permitted order operations.
- **Use:** Open the customer's order, verify its payment release and fulfillment requirements, then process its lines/shipment.
- **Limits:** These are orders the site sells, not purchases it makes. Operational completion must not substitute for authoritative payment settlement.
- **Source:** [Orders](../app/orders/page.tsx); [seller query](../app/orders/query-orders.ts); [self-service payment release](SHOP_SELF_SERVICE.md).
### Order Lines — `/order-lines`
- **Purpose/capabilities:** Item-level work queue across orders, with pending, in-progress, ready, returned and cancelled views; filter by location/date and open the parent order.
- **Use:** Process the specific line assigned to operational work and inspect its parent when customer/payment context is needed.
- **Limits:** Line progress is not a separate sale or payment. Parent authorization and permitted transitions still apply.
- **Source:** [Order Lines](../app/order-lines/page.tsx); [line operations](../app/order-lines/use-order-line-operations.ts).
### Shipments — `/shipments`
- **Purpose/capabilities:** Maintain order-related shipment records and inspect delivery status, origin/destination and tracking information.
- **Use:** Open or prepare the shipment for a released order and update supported operational tracking as delivery progresses.
- **Limits:** A recorded shipment/tracking state is not proof that an external carrier accepted or delivered it.
- **Source:** [Shipments](../app/shipments/page.tsx); [detail](../app/shipments/[id]/page.tsx).
### Control Center — `/control-center`
- **Purpose/capabilities:** Organize tasks, assignees, priorities, dates/status and linked business work; use the available views to monitor progress.
- **Use:** Create a follow-up or operational task, assign responsibility, and update it as the work is completed.
- **Limits:** Marking a task done does not settle an invoice, deliver an order, or confirm an external workflow finished.
- **Source:** [Control Center](../app/control-center).
### Reservations — `/reservations`
- **Purpose/capabilities:** Browse and create scheduled reservations with customer, time and resource/location context.
- **Use:** Choose the service/resource and available time, confirm the customer booking, and later complete the supported check-in flow.
- **Limits:** Reserved time is distinct from payment, purchased access rights, and actual attendance.
- **Source:** [Reservations](../app/reservations/page.tsx); [new reservation](../app/reservations/new/page.tsx).
### Visits — `/visits`
- **Purpose/capabilities:** Register visitors and review visit records, terms acceptance and configured identity/signature/photo evidence; physical and online registration are distinct channels.
- **Use:** Configure visit requirements first, then register the visitor through the enabled channel and review the recorded attestation.
- **Limits:** Visits reuse reservation storage but represent a different workflow. Registration does not automatically establish payment or redeem an entitlement.
- **Source:** [Visits](../app/visits/page.tsx); [registration](../app/visits/new/page.tsx); [visit settings](../app/components/settings/VisitsSection.tsx).
### Check-in — `/pos/check-in`
- **Purpose/capabilities:** Operational admission/redeeming surface for identifying customers and completing eligible reservation or entitlement check-ins.
- **Use:** Identify the customer/access record, verify eligibility and remaining uses, then explicitly confirm the supported admission operation.
- **Limits:** Identity QR, reservation, ticket and pass are different credentials. Admission depends on current authorization/validity, not merely a readable code.
- **Source:** [Check-in](../app/pos/check-in/page.tsx); [buyer identity QR](../app/buyer/identity-qr-actions.ts).
### Inventory — `/inventory`
- **Purpose/capabilities:** Inspect stock levels by catalog item/location, maintain locations, perform supported stock adjustments/transfers, and configure commerce inventory policies.
- **Use:** Select the location, review availability, and apply the appropriate adjustment or transfer before relying on stock in POS/fulfillment.
- **Limits:** Transfers authorize both branches atomically. Stock availability/backorder markers do not guarantee every cart quantity is currently fulfillable.
- **Source:** [Inventory](../app/inventory/page.tsx); [actions](../app/inventory/actions.ts); [POS inventory](POS_INVENTORY.md).
### Inventory Minimums — `/inventory/minimums`
- **Purpose/use:** Configure SKU/location thresholds, inspect recorded-stock checks and review generated draft requisitions or alerts.
- **Limits/maturity:** Implemented slice using recorded on-hand stock, not reserved/projected availability; duplicate open demand is guarded. Automatic processing needs migrations, a server-only worker secret and scheduler. No automatic submission, purchase, payment or stock receipt. **Source:** [Minimums](../app/inventory/minimums).
### Printers — `/settings?tab=printers`
- **Purpose/capabilities:** Maintain printer configuration used by supported operational printing and inspect synchronization status in consuming modules.
- **Use:** Configure the printer/service and verify it in the intended POS or operational workflow before depending on printed output.
- **Limits:** Saving configuration or seeing a sync indicator does not prove hardware printed successfully.
- **Source:** [Printer settings](../app/components/settings/PrintersSection.tsx); [development boundaries](DEVELOPMENT.md).

## Buying
### Suppliers — `/suppliers`, `/suppliers/[id]`
- **Purpose/use:** Maintain private supplier relationships, company/professional identity, contacts, categories, commercial terms, notes, lifecycle and verified-account representation grants.
- **Maturity/limits:** Implemented slice. Contacts do not verify legal authority or send invitations; organization credential authority and complete related-document history remain incomplete. **Source:** [Suppliers](../app/suppliers).
### Purchase Requests — `/purchases/requests`
- **Purpose/use:** Create/revise catalog or service requisitions, resolve server-owned costs/taxes or internal estimates, submit against a pinned policy revision and follow approval/history.
- **Maturity/limits:** Manager-led implemented slice, not unrestricted employee self-service. Estimates are not supplier prices; requisition approval does not approve publication, award, order, stock receipt or payment. **Source:** [Requests](../app/purchases/requests).
### Approvals — `/purchases/procurement/approvals`
- **Purpose/use:** Review requisition/publication/award/order documents in a filtered paginated inbox and cast reasoned eligible human decisions with quorum, revision and self-approval controls.
- **Maturity/limits:** Implemented, deployment-gated human decisions. Accessible rows are not always actionable; obsolete approvals are read-only. Reload after an ambiguous timeout. AI/delegation/escalation workers remain absent. **Source:** [Approvals](../app/purchases/procurement/approvals/page.tsx).
### Tenders — `/purchases/tenders`
- **Purpose/use:** Prepare requirements and request links, register supplier invitations, request independent publication approval, inspect immutable publications/sealed receipt activity, review opened offers and initiate award/order approvals.
- **Maturity/limits:** Implemented slice, not the complete design. Portal activation is separate; draft changes do not rewrite publications. Invitations do not prove email delivery, and sealed metadata cannot reveal proposals before opening. Full clarification/legal/amendment workflows and advanced/split awards remain incomplete. **Source:** [Tenders](../app/purchases/tenders); [implementation](PROCUREMENT_IMPLEMENTATION.md).
### Procurement Rules — `/purchases/rules`
- **Purpose/use:** Save versioned event/scope rules with thresholds, cumulative conditions, approvers/quorum and timing; search/filter and simulate policy resolution before real submission.
- **Maturity/limits:** Configuration with selected human-approval enforcement. Simulation is never authorization; saved AI, urgency, deadline or notification options do not establish operational workers. **Source:** [Rules](../app/purchases/rules/page.tsx).
### Vendor Bills — `/bills`
- **Purpose/capabilities:** Maintain itemized purchase/vendor-bill records, totals, dates/status, payment terms and related financial documents.
- **Use:** Record the vendor obligation and review its due/payment state; use accounting synchronization for its supported ledger posting.
- **Limits:** A bill is not an approved purchase request, tender award, physical receipt or automatic bank reconciliation.
- **Source:** [Bills](../app/bills/page.tsx); [detail](../app/bills/[id]/page.tsx); [due dates](FINANCIAL_DUE_DATES.md); [accounting](ACCOUNTING.md).
### Accounts Payable — `/accounts-payable`
- **Purpose/capabilities:** Review supplier balances with aging/due-date filters, active/cancelled scope and currency-separated totals; open an eligible bill's existing payment-entry flow.
- **Use/limits:** Prioritize obligations and select the actual bill to settle. Recorded payment entry is not a bank transfer, procurement receipt or automatic reconciliation; supplier links currently use Companies details.
- **Source:** [Accounts Payable](../app/accounts-payable/page.tsx); [behavior and verification](ACCOUNTS_PAYABLE.md).
### Transactions — `/transactions`
- **Purpose/capabilities:** Record and maintain expense transactions, categories and associations used by cost analysis and accounting.
- **Use:** Record an expense with its correct date/category and relevant campaign/business context, then review it in Costs or the ledger.
- **Limits:** These records are not the Payments wallet-operation history or proof of a bank/provider transfer.
- **Source:** [Transactions](../app/transactions/page.tsx); [detail](../app/transactions/[id]/page.tsx).
### Purchased Orders — `/purchases/orders`
- **Purpose/use:** Review procurement orders by default; choose `?source=online` for commerce purchases filed under the purchasing site.
- **Limits/maturity:** Procurement follows separate award/order approvals and supports partial non-stock acceptance, not full SKU/location stock receipt, bill allocation or reconciliation. Direct orders without tenders remain incomplete. Online purchases retain distinct purchasing-site ownership and buyer access checks. **Source:** [Orders](../app/purchases/orders/page.tsx).
### Purchased Subscriptions — `/purchases/subscriptions`
- **Purpose/capabilities:** Review subscriptions acquired through commerce under the purchasing context and their supported buyer lifecycle controls.
- **Use:** Open the acquired subscription to review its current status and available management action.
- **Limits:** Not customer subscriptions sold by the business or its Makinari plan. Management rights still depend on buyer identity and provider state.
- **Source:** [Purchased Subscriptions](../app/purchases/subscriptions/page.tsx); [buyer subscription actions](../app/buyer/subscription-actions.ts).
### Received Quotations — `/purchases/quotes`
- **Purpose/use:** Workspace received/procurement quotations with opening-aware sealed receipt summaries; personal quotations remain in `/home/quotes` or `/buyer/quotes`.
- **Limits/maturity:** Implemented, migration-gated slice with eligible buyer-recorded offers and opening-aware envelope counts, never sealed identities/prices/files. Procurement quotations reuse records but are isolated from legacy tokens/checkout; review is not award approval/payment. Freeform direct sourcing remains incomplete. **Source:** [Received quotations](../app/purchases/quotes/page.tsx).
### Purchased Library — `/purchases/library`
- **Purpose/capabilities:** Browse acquired course, ticket, file, pass or license entitlements; open supported access experiences and eligible signed file downloads.
- **Use:** Locate the acquired digital offering and use its authorized viewing/download/booking experience.
- **Limits:** Site visibility is not automatically team-wide redemption/download permission. Status, expiry, buyer identity and remaining uses must be checked downstream.
- **Source:** [Purchased Library](../app/purchases/library/page.tsx); [library view](../app/buyer/components/BuyerLibraryView.tsx); [download actions](../app/catalog/digital-file-actions.ts).

## Finance
### Finance Reports — `/finance`
- **Purpose/capabilities:** Review Profit & Loss, Balance Sheet and Trial Balance from posted journals; choose period/currency, refresh and export CSV.
- **Use:** Select the accounting period and currency, inspect balances, and resolve journal/source discrepancies before relying on statements.
- **Limits:** No currency conversion. Generate Report opens journal synchronization, which can write entries; incomplete/invalid ledger coverage must not become assumed zero totals.
- **Source:** [Finance](../app/finance); [accounting contracts](ACCOUNTING.md).
### Journal Entries — `/accounting/entries`
- **Purpose/capabilities:** Inspect journal sources and debit/credit lines, open source documents, maintain permitted balanced manual journals, and synchronize source records for a period.
- **Use:** Trace an unexpected balance to its source; correct the source and synchronize, or enter an explicit authorized manual adjustment.
- **Limits:** Synchronization posts accounting records; it is not bank reconciliation. Generated journals and manual journals have different edit/delete rules.
- **Source:** [Journal Entries](../app/accounting/entries/page.tsx); [accounting](ACCOUNTING.md).
### Chart of Accounts — `/accounting`
- **Purpose/capabilities:** Maintain the site's accounting accounts and classification used by journal lines and financial statements.
- **Use:** Establish the appropriate account structure before posting manual entries or mapping operational sources.
- **Limits:** Account changes affect reporting classification, not the underlying commercial payment state; referential and role restrictions apply.
- **Source:** [Chart of Accounts](../app/accounting/page.tsx); [accounting](ACCOUNTING.md).
### Payments / Balances — `/payments`
- **Purpose/capabilities:** Inspect business wallet/balance summaries, recorded operations and withdrawal history; request permitted withdrawals through the configured payout flow.
- **Use:** Review available balances and operation evidence before initiating a withdrawal and checking its subsequent status.
- **Limits:** Wallet balances, AI credits, sales collections and ledger balances are separate measures. A requested payout is not a completed bank transfer.
- **Source:** [Payments](../app/payments/page.tsx); [balance history](../app/payments/payment-balance-history.ts).

## Reports

Reports analyze stored operational/tracking data, not hypothetical forecasts.
Choose the report, its section, and the applicable date/segment/currency filters.
Export the loaded section where supported; missing coverage is not zero activity.
See [report sections and data contracts](REPORTS.md), [exports](REPORT_EXPORTS.md),
and [demo data boundaries](DEMO_REPORTS.md).
### Performance — `/dashboard?tab=performance`
- **Purpose/capabilities:** Outcomes, Operations and AI usage sections compare recorded commercial/lead activity, conversations/tasks and AI consumption over time.
- **Use:** Review workload and operational outcomes, then open the underlying business module for action.
- **Limits:** Sales-record counts are not revenue or cash collection; date buckets and scope follow the report's disclosed contracts.
### Business Overview — `/dashboard?tab=overview`
- **Purpose/capabilities:** Summary, Unit economics and Activity sections combine business KPIs, sales/expense/purchase context and activity information.
- **Use:** Assess the business at a glance, then investigate financial or operational changes in the dedicated reports.
- **Limits:** Some activity and purchase context is site-wide even when a segment is selected; chart expenses/purchases do not reconstruct net accounting profit.
### Analytics — `/dashboard?tab=analytics`
- **Purpose/capabilities:** Distribution, Customer cohorts and Lead cohorts analyze recorded populations and retention patterns.
- **Use:** Compare distributions and cohort progression while respecting the selected window and incomplete-period disclosures.
- **Limits:** Customer cohorts are based on observed qualifying sales in the window, not necessarily lifetime-first purchases or confirmed payments; not all distributions separate currencies/statuses.
### Traffic — `/dashboard?tab=traffic`
- **Purpose/capabilities:** Acquisition, Audience and Sessions analyze session-entry attribution, sources, URLs, geography, devices/browsers and aggregate session activity.
- **Use:** Install tracking on the intended pages, preserve campaign UTMs, and inspect acquisition/coverage before drawing attribution conclusions.
- **Limits:** No segment filtering for session attribution; Direct / unknown is not proof of direct entry. Sessions is aggregate reporting, not an individual-session replay tool.
### Costs — `/costs`
- **Purpose/capabilities:** Summary and Categories analyze recorded expenses and eligible purchases, cost composition and sales-to-cost context; includes campaign filtering.
- **Use:** Review recorded spending and categories, then open Transactions or Bills to inspect/correct source records.
- **Limits:** Purchase coverage varies with filters; incompatible currencies or incomplete data can make efficiency unavailable. Cost efficiency is not accounting net profit.
### Sales Report — `/dashboard?tab=sales`
- **Purpose/capabilities:** Summary, Channels and Categories distinguish active sales, net collected cash, outstanding balances, trends and allocation breakdowns.
- **Use:** Select period/currency and compare commercial activity with actual collections before investigating an outstanding invoice.
- **Limits:** Outstanding is the current balance of selected-period sales; category allocations are proportional, and missing receipt/refund history remains unavailable.
### Social — `/dashboard?tab=social`
- **Purpose/capabilities:** Engagement, Networks & audience and Top posts analyze stored social metrics, connected-network results and post rankings.
- **Use:** Connect accounts and ensure metric ingestion is configured, then review published-content performance.
- **Limits:** Refresh reloads stored data, not necessarily provider synchronization. Metrics are accumulated snapshots; reach is not deduplicated and segment filtering is unsupported.

## Applications
### Applications hub — `/applications`
- **Purpose/capabilities:** Entry point for the workspace's application-related data and recorded development outputs.
- **Use:** Choose Database or Repositories; configure application credentials under Secrets when required.
- **Source:** [Applications](../app/applications/page.tsx).
### Database — `/applications/database`
- **Purpose/capabilities:** Inspect requirement-linked application databases, tables/columns and row counts; filter/sort/paginate data and perform authorized row insertion/edit/deletion.
- **Use:** Open an existing application database and inspect the table before applying an intentional data change.
- **Limits:** Requires provisioned tenant database infrastructure/RPCs, manager access and unrestricted location access. It does not provision databases; row editing/deletion requires a primary key.
- **Source:** [Database](../app/applications/database/page.tsx); [application actions](../app/applications/actions.ts).
### Repositories — `/applications/repositories`
- **Purpose/capabilities:** Browse recorded repository artifacts, repository/preview links and archive-based source contents associated with requirements.
- **Use:** Inspect a generated implementation and its external links; use the linked development workflow for changes.
- **Limits:** Not Git hosting or a commit/deploy interface. Source-viewer edits remain local; sending changes hands a message to robot chat rather than saving a repository.
- **Source:** [Repositories](../app/applications/repositories/page.tsx).
### Secrets — `/settings?tab=secrets`
- **Purpose/capabilities:** Maintain encrypted site integration credentials and metadata; authorized managers can replace, reveal or delete secrets.
- **Use:** Store a credential in its intended provider/use-case/scope and configure the consuming integration separately.
- **Limits:** Secrets are not automatically injected into deployment environments. Never copy revealed credentials into documentation or use this screen instead of a provider-specific connection flow.
- **Source:** [Secrets settings](../app/components/settings/SecretsSection.tsx); [Secrets API](../app/api/secrets/route.ts).

## Automation
### AI Workspace — `/robots`
- **Purpose/capabilities:** Work with assistant instances, instructions and interactive execution; inspect returned messages, logs, work artifacts and execution state.
- **Use:** Select the appropriate instance, provide scoped instructions, start supported work, and monitor its explicit result before issuing dependent actions.
- **Limits:** Needs external orchestration and any required runtime/provider capacity. A streamed step, accepted request or disconnected browser is not terminal completion; Stop requests cancellation.
- **Source:** [Robots workspace](../app/robots/robots-workspace.tsx); [execution boundaries](ARCHITECTURE.md).
### Context — `/context`
- **Purpose/capabilities:** Maintain shared company, branding, marketing, copy sequences and customer-journey guidance consumed by AI/business workflows.
- **Use:** Record accurate business facts, voice/tone, offerings and constraints before asking agents to communicate or generate content.
- **Limits:** Saved context is guidance, not authorization or guaranteed model compliance. Some company information overlaps Settings Company.
- **Source:** [Context](../app/context/page.tsx).
### Agent Configuration — `/agents`
- **Purpose/capabilities:** Maintain agent roles, personality/prompts and activity configuration; inspect related conversations/command records and launch supported activities.
- **Use:** Configure responsibility and instructions, select a supported activity, and inspect its actual execution result.
- **Limits:** Organizational hierarchy is not an execution graph; only wired activity launches execute, through the separate backend. Hidden tabs do not establish connector capabilities.
- **Source:** [Agents](../app/agents/page.tsx); [agent saving](../app/agents/save-agent.ts).
### Requirements — `/requirements`
- **Purpose/capabilities:** Maintain work briefs, instructions, status/completion and campaign/segment associations; inspect related implementation/work artifacts and planning metadata.
- **Use:** Write the acceptance intent and context, associate the business initiative, and follow execution/output through the supported agent workflow.
- **Limits:** Requirement planning/draft diagrams are not equivalent to persisted executable workflow nodes. Completion should be supported by the actual output.
- **Source:** [Requirements](../app/requirements/page.tsx); [detail](../app/requirements/[id]/page.tsx); [deletion lifecycle](INSTANCE_DELETION.md).
### Agent Channels — `/settings?tab=channels`
- **Purpose/capabilities:** Configure agent communication connections, sender identities and applicable email/phone/voice options; manage activation within licensed capacity.
- **Use:** Connect and verify the intended account/number, activate eligible capacity, then select that connection in messaging/publishing workflows.
- **Limits:** Configured, licensed, connected and active are different states. Sending and outbound calling remain provider- and consent-dependent.
- **Source:** [Channels](../app/components/settings/ChannelsSection.tsx); [activation](AGENT_CHANNEL_ACTIVATION.md); [numbers](AGENT_CHANNEL_NUMBERS.md).
### AI Activities — `/settings?tab=activities`
- **Purpose/capabilities:** Configure recurring/business activity inputs, activation and supported timing/selection options, including specialized outreach and standup settings.
- **Use:** Configure the activity's audience/input and timing before enabling it; inspect execution through the actual agent/backend workflow.
- **Limits:** A saved activity/schedule is configuration, not proof that the external scheduler or worker ran it.
- **Source:** [Activities](../app/components/settings/ActivitiesSection.tsx); [standup](DAILY_STANDUP_SETTINGS.md); [ICP mining lists](ICP_MINING_LIST_SELECTION.md).
### Skills — `/skills`
- **Purpose/capabilities:** Upload/paste/edit Markdown skills, enable/disable or delete permitted skills, and search/preview/import community instructions; inspect system skills and external-agent setup downloads.
- **Use:** Review the instructions and provenance before enabling/importing a skill and assigning it to supported agent work.
- **Limits:** Instructions are not installed executables. External-agent setup does not launch the external tool; catalog/import operations require the configured Skills API.
- **Source:** [Skills](../app/skills/page.tsx).
### Workflows — `/robots?mode=workflow`
- **Purpose/capabilities:** Persist visual trigger/step graphs, relations and instructions; configure manual, scheduled, event, webhook or channel-message triggers; request runs/tests and inspect recorded results.
- **Use:** Configure an enabled trigger, connect steps with appropriate success/failure conditions, then run and inspect explicit outcomes.
- **Limits:** Saving nodes/tools does not prove backend execution/provider support. Test requests are not a guarantee of side-effect isolation; channel-message triggers have execution restrictions.
- **Source:** [Workflow components](../app/components/workflows); [relation and execution contracts](ARCHITECTURE.md).

## Settings

Settings tabs share [the Settings page](../app/settings/page.tsx); some are grouped
under Operations, Applications or Automation above because that is their menu placement.
### Procurement / Tender Settings — `/settings/procurement`, `/settings?tab=tenders`
- **Purpose/use:** Save versioned defaults for visibility, participation/opening, approvals, timings, supervisors, urgency and notifications; enable the public portal through a separate save. `/settings/tenders` redirects to the tender tab; `?tab=procurement` is an alias.
- **Maturity/limits:** Shared configuration editor with selected operational enforcement, not independent policy systems. Activation does not publish a tender; editable slugs, branding/legal versions and notification/AI execution remain incomplete. **Source:** [Settings editor](../app/purchases/procurement/components/procurement-page.tsx).
### General Settings — `/settings?tab=general`
- **Purpose/capabilities:** Maintain workspace name, logo, URL/language and general resources/tracking setup; access permitted site archival controls.
- **Use:** Keep workspace identity and tracked resources accurate; changing the site name can affect the derived Shop URL.
- **Source:** [General](../app/components/settings/GeneralSection.tsx); [site form](../app/components/settings/site-form.tsx); [archival](SITE_ARCHIVAL.md).
### Company — `/settings?tab=company`
- **Purpose/capabilities:** Maintain the business profile, locations, business hours, goals and SWOT information.
- **Use:** Establish the locations and operating context used by commercial/operational workflows and AI guidance.
- **Source:** [Company settings](../app/components/settings/CompanySection.tsx).
### Marketplace / Shop Settings — `/settings?tab=marketplace`
- **Purpose/capabilities:** Configure the site's public Shop presentation, sharing URL/QR, trust/shipping information, payment/payout options and location self-service ordering policy.
- **Use:** Configure the public selling experience and payment release rules, then separately verify catalog visibility and checkout readiness.
- **Limits:** This tab configures a seller's Shop; it is not the cross-site public Marketplace catalog. A QR/order request is not paid fulfillment authorization.
- **Source:** [Shop settings](../app/components/settings/ShopSection.tsx); [self-service](SHOP_SELF_SERVICE.md).
### Visit Settings — `/settings?tab=visits`
- **Purpose/capabilities:** Enable physical/online visit registration, configure terms and identity/signature/photo requirements, and set default duration.
- **Use:** Set the required evidence before opening visitor registration in Operations or the buyer portal.
- **Source:** [Visit settings](../app/components/settings/VisitsSection.tsx).
### Team — `/settings?tab=team`
- **Purpose/capabilities:** Invite/manage members, roles and activation; configure app access and eligible location exclusions in member cards.
- **Use:** Grant the minimum required role/apps/branches and explicitly save the member changes.
- **Limits:** Owners/admins are exempt from branch exclusions; location editing depends on the deployed enforcement gate. The historical record-assignment screen is currently hidden/redirected.
- **Source:** [Team](../app/components/settings/TeamSection.tsx); [location access enforcement](LOCATION_ACCESS_ENFORCEMENT.md); [license limits](SITE_LICENSE_LIMITS.md).
### Calendar — `/settings?tab=calendar`
- **Purpose/capabilities:** Maintain round-robin calendar definitions, member selection, duration/buffer and public booking links.
- **Use:** Choose eligible team members, define the calendar, and share its generated booking link after confirming availability setup.
- **Limits:** Personal calendar preferences belong in Profile; saving a definition does not establish provider calendar synchronization.
- **Source:** [Calendar settings](../app/components/settings/CalendarSection.tsx); [public booking](../app/book).
### Social Networks — `/settings?tab=social`
- **Purpose/capabilities:** Maintain social account connections and initiate supported OAuth/provider-specific connection flows.
- **Use:** Connect the exact business account and verify its state before selecting it for publishing or social reporting.
- **Limits:** Connection does not publish content or guarantee metrics ingestion; platform permissions, licensed capacity and provider availability apply.
- **Source:** [Social settings](../app/components/settings/SocialSection.tsx); [OAuth setup](SOCIAL_NETWORK_OAUTH_SETUP.md).
### Integrations — `/integrations`
- **Purpose/capabilities:** Maintain outbound webhook endpoints/event subscriptions and test requests; configure communication providers, marketplace merchant connections and supported Composio integrations.
- **Use:** Configure the intended integration through its specific flow and verify the supported event/delivery contract.
- **Limits:** The legacy displayed workflow-webhook URL is not an active general-purpose workflow entry point. Use current workflow trigger contracts; test delivery can have external effects.
- **Source:** [Integrations](../app/integrations/page.tsx); [marketplace orders](MARKETPLACE_ORDERS.md); [retired webhook marker](WORKFLOW_WEBHOOK_INTEGRATION.md).
### Billing — `/billing`
- **Purpose/capabilities:** Manage the site's Makinari plan, billing information, credits and eligible extras/trial/top-up options; inspect related billing history.
- **Use:** Review licensed resource capacity and credit balances before upgrading or buying additional capacity; activate an eligible trial only through its explicit action.
- **Limits:** Not merchant customer subscription management. Trial credits, purchased/protected balances and withdrawable funds have distinct rules; authoritative settlement owns paid upgrades.
- **Source:** [Billing](../app/billing/page.tsx); [trial](STARTUP_TRIAL.md); [credit reset](BILLING_CREDIT_RESET.md); [auto top-up](AUTO_TOP_UP.md).
### Security — `/security`
- **Purpose/capabilities:** Change account password, manage supported MFA, API keys, robot sessions and allowed domains.
- **Use:** Secure the account and maintain only the credentials/sessions/domains needed by authorized integrations.
- **Limits:** Account authentication controls and site resource permissions are different. Treat keys and reusable sessions as credentials, not shareable reference material.
- **Source:** [Security page](../app/security/page.tsx); [security policy](SECURITY.md); [resource provenance](SECURITY_RESOURCE_PROVENANCE.md).

## Public commerce and buyer portal

Buyer identity and workspace membership are separate. These tools have their own public/personal authorization boundaries.
### Unified account — `/home`
- **Purpose/use:** Account hub for personal purchases, quotes, subscriptions and library; discover products/tenders, manage credentials and supplier activity without forced business creation. Lists live at `/home/orders`, `/home/quotes`, `/home/subscriptions` and `/home/library`.
- **Maturity/limits:** Additive transitional alias, not a completed `/buyer` replacement. Live detail/access routes still use Buyer; `/home/preview/[kind]/[id]` is demo-only. **Source:** [Home](../app/home/page.tsx).
### Account search — `/home/search?q=…`
- **Purpose/use:** Search personal commerce, reservations, accessible businesses, credentials, submissions/drafts/opportunities, Marketplace products and public tenders; filter by collection and open original records.
- **Maturity/limits:** Implemented bounded aggregation, not tenant-wide or file-content search. Source authorization remains intact; failed/truncated sources are disclosed. Some labels remain English-only. **Source:** [Search](../app/home/search/search-view.tsx).
### Personal credentials — `/home/profile`
- **Purpose/use:** Maintain credential metadata/private immutable file revisions, download/archive files and select exact revisions for submission evidence.
- **Maturity/limits:** Person-owned, Storage/migration-gated slice. PDF/PNG/JPEG: 8 MiB/file, 128 MiB reserved/account including pending/archived files. No organization authority, authenticity/eligibility certification, AI assessment, malware scan or automated cleanup. **Source:** [Evidence controls](../app/purchases/procurement/evidence/README.md).
### Supplier participation — `/home/submissions`, `/home/tenders`
- **Purpose/use:** Review invitations, database-backed drafts and submitted quotations; choose a server-authorized personal, business or represented-supplier applicant and explicitly share evidence. Saved receipt keys/revisions protect ambiguous submission retries and stale draft edits.
- **Maturity/limits:** Implemented slice; discovery/drafts do not grant submission rights. Evidence is pinned and opening-gated; a quotation is not an award/payment. Full replacement/withdrawal/clarification workflows remain incomplete. **Source:** [Submissions](../app/home/submissions).
### Public tenders — `/tenders`, `/tenders/[siteSlug]`, `/tenders/[siteSlug]/[tenderSlug]`
- **Purpose/use:** Search the global directory or buyer portal, inspect published requirements/deadlines and follow authenticated participation. Visibility, global listing and portal activation are independent.
- **Maturity/limits:** Implemented, deployment-gated discovery; no internal estimates or competitor proposals are public. Readable name-derived site URLs preserve publication authorization; discovery does not prove legal authority or grant award/submission rights. **Source:** [Public tenders](../app/tenders).
### Shop — `/shop/[siteSlug]`
- **Purpose/use:** Browse one seller's eligible products/promotions, select variants/options, add to cart or use supported booking/self-service ordering; review seller shipping/trust information.
- **Limits:** Listing/QR/order request is not confirmed stock, payment or fulfillment. Availability depends on seller/channel configuration. **Source:** [Shop](../app/shop).
### Marketplace — `/marketplace`
- **Purpose/use:** Discover eligible offerings across sellers, inspect products/promotions and proceed through supported purchase or booking paths.
- **Limits:** Discovery is distinct from external merchant integrations and does not guarantee checkout/stock/provider readiness. **Source:** [Marketplace](../app/marketplace).
### Cart and commerce checkout — `/cart/checkout`
- **Purpose/use:** Complete eligible commerce cart/quotation flows using server-authorized records/prices, buyer details and supported payment methods.
- **Limits:** `/checkout` also serves platform billing, not the commerce cart. Shop and Marketplace carts have separate scopes. Redirect/success parameters are not payment evidence; settlement owns order/access changes. **Source:** [Checkout security](SECURITY.md); [cart](../app/cart/checkout).
### Public booking — `/book/[siteSlug]/[userSlug]/[eventSlug]`, `/book/[siteSlug]/rr/[eventSlug]`
- **Purpose/use:** Choose eligible personal/round-robin availability and confirm supported appointments; catalog booking is also exposed through Shop/Marketplace item booking routes.
- **Limits:** A booking is not payment, attendance or admission; provider availability and reservation rules remain separate. **Source:** [Booking](../app/book).
### Buyer tools and purchase detail — `/buyer`
- **Purpose/use:** Review `/buyer/orders`, `/buyer/quotes`, `/buyer/subscriptions`, `/buyer/library`, profile/visits and eligible quote/order checkout; inspect order balance, payment history, shipments and authorized course/file/ticket/pass access.
- **Maturity/limits:** Supported legacy routes alongside `/home`. Status is not delivery evidence; missing financial data is not assumed paid/unpaid. Pending online payment needs an eligible order/token and server balance checks; personal or purchasing-site visibility does not grant all team members redemption rights. **Source:** [Buyer](../app/buyer); [access destinations](../app/buyer/experience-routes.ts).
### Public documents — `/q/[token]`, `/so/[token]`, `/i/[token]`, `/vb/[token]`
- **Purpose/use:** Share limited quotation, sales-order, invoice and vendor-bill views with only eligible document actions.
- **Limits:** Tokens are bearer credentials with lifecycle rules; PDF/export is not public authorization. Procurement proposals are isolated from legacy public checkout/token readers. **Source:** [Public-link security](SECURITY.md).

## Cross-module workflows

| Goal | Typical path | Completion boundary |
| --- | --- | --- |
| Convert an audience | Segments → People/Leads → Campaigns/Chat → Deals → Quotations | Actual settlement, not pipeline value |
| Sell and fulfill | Catalog + Inventory + Prices/Promotions → POS or Shop/Marketplace → Order → shipment/access | Confirmed payment plus authorized delivery/redemption |
| Book/admit/register | Calendar/Catalog → Booking → Reservation → Check-in; Visit Settings → Visits | Booking, attendance, identity and terms are separate evidence |
| Collect/analyze finances | Subscriptions/Sales → Receivables; Bills → Payables; Transactions → Journals → Finance | Authoritative receipts and posted currency-specific ledger, not wallet balance |
| Produce content/AI work | Context + Assets/Skills → Content Creator or Requirement/Workflow → artifacts/provider | Explicit terminal result and inspected output/delivery |
| Replenish/buy | Minimums → draft Request → approval → Tender → supplier quote → award/order approvals | Approved order; stock receipt, bill allocation and payment remain incomplete/separate |
| Share supplier evidence | Profile → private revision → explicit proposal selection → opening-aware review | Pinned evidence, not authenticity/eligibility certification |

## Limits and maintenance

- Source review is not live acceptance: provider delivery, hardware, migrations and Storage must be verified in the chosen environment. Demo rows/tests do not certify deployment.
- Procurement is partial, not absent: full receiving/bill allocation, organization credential authority, operational AI/escalation and complete buyer URL migration remain unfinished.
- Legacy/dormant folders do not establish supported standalone modules; Companies is a detail surface and Experiments is not a current menu module.
- Maintain this consolidated summary with navigation and implementation changes. Detailed references: [procurement](MODULES_PROCUREMENT.md), [commerce/account](MODULES_COMMERCE_AND_ACCOUNT.md), [workflow evidence](MODULES_WORKFLOWS.md). They complement rather than replace these summaries.
