# Makinari module guide

Internal functional reference for product, operations, support, and onboarding.
Coverage refreshed against current navigation and new procurement/account source
on **2026-11-04**; unchanged core entries retain their **2026-10-23** review. This describes implemented
screens and workflows, not a certification of deployment or live provider delivery.

## How to use this guide

This is the consolidated summary of all modules, including account/public tools.
Each module explains its purpose, principal capabilities, and a typical use.
Creation dates, authored Jest/E2E counts, exact DB counts, evidence states and comparable scores appear in the final maturation matrix. No Limits or speculative backlog is assigned to individual modules.
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
- [Cross-module workflows](#cross-module-workflows) · [Module maturation matrix](#module-maturation-matrix)

## Workspace and personal tools
### Projects — `/projects`
- **Purpose/use:** Choose an accessible business workspace, open AI Workspace or manage businesses with `/projects?manage=1`.
### Create site and onboarding — `/create-site`, `/onboarding`
- **Purpose/use:** Create a business workspace, supply its information and complete setup before enabling customer-facing channels.
### Navigation — `/navigation`
- **Purpose/use:** Discover all business-area modules and open canonical destinations when they are not pinned in the sidebar.
### Profile — `/profile`
- **Purpose/use:** Maintain personal information, avatar, email security, display/calendar preferences and notification preferences.
### Notifications — `/notifications`
- **Purpose/use:** Search messages, filter unread notifications, mark read and delete notifications.

## Marketing
### Campaigns — `/campaigns`
- **Purpose/capabilities:** Organize marketing initiatives with audience/segment links, status, requirements, promotions, recorded expenses, and attributed sales; browse table/Kanban views.
- **Use:** Create an initiative, associate its audience and brief, then record spending and sales to review campaign economics.
- **Source:** [Campaigns](../app/campaigns/page.tsx); [creation](../app/campaigns/actions/campaigns/create.ts).
### Segments — `/segments`
- **Purpose/capabilities:** Define audiences using descriptions, language, size estimates and status; inspect stored targeting analysis, ICP profiles, and activity metrics.
- **Use:** Define the target audience, review its stored analysis, and reuse it in campaigns and prospect-enrichment requests.
- **Source:** [Segments](../app/segments/page.tsx); [segment detail](../app/segments/[id]/page.tsx).
### Promotions — `/promotions`
- **Purpose/capabilities:** Configure percentage, fixed-amount and buy/get offers, coupon codes, product/category eligibility, cart requirements, dates, usage limits, channels, and location rules; inspect redemptions.
- **Use:** Define the offer and eligible items, choose its commercial channels, then inspect resulting redemption orders.
- **Source:** [Promotions](../app/promotions/page.tsx); [promotion detail](../app/promotions/[id]/page.tsx).
### Content — `/content`
- **Purpose/capabilities:** Maintain content items and their lifecycle, inspect/edit details, and request supported publishing operations; additional research and teleprompter surfaces support content preparation.
- **Use:** Prepare and review an item before publishing to an authorized connected destination; use the teleprompter for script reading.
- **Source:** [Content](../app/content/page.tsx); [Deep Research](../app/content/deepResearch/page.tsx); [Teleprompter](../app/teleprompter/[id]/page.tsx); [reliability](CONTENT_RELIABILITY.md).
### Content Creator — `/robots?mode=imprenta`
- **Purpose/capabilities:** Compose a persistent canvas with Text, Image, Video, Audio, Audience, and Publish nodes; connect prompts/media, generate variants, and copy/download outputs.
- **Use:** Create connected source and generation nodes, review output, select an audience where needed, and choose exact connected publishing/delivery accounts.
- **Source:** [Robots](../app/robots); [account-specific destinations](CONTENT_CREATOR_DESTINATIONS.md); [speech options](CONTENT_CREATOR_AUDIO.md).
### Assets — `/assets`
- **Purpose/capabilities:** Browse and manage the workspace's reusable media/file assets for content and other business workflows.
- **Use:** Locate or add a reusable asset, inspect it, and use its supported reference in the consuming module.
- **Source:** [Assets](../app/assets/page.tsx).

## Sales
### Sales Home — `/sales-home`
- **Purpose/capabilities:** Shortcut hub for Sales, Leads, Deals, Control Center, Chat, and People; can hand off to sale registration.
- **Use:** Open the relevant commercial workflow rather than treating this hub as a financial report.
- **Source:** [Sales Home](../app/sales-home/page.tsx).
### POS — `/pos`
- **Purpose/capabilities:** Build a customer cart, choose items/options and location, apply eligible pricing/promotions, complete supported checkout, and operate register shifts and receipts.
- **Use:** Select the operating location/register, prepare the cart, confirm inventory and payment, then review the resulting order and receipt.
- **Source:** [POS](../app/pos/page.tsx); [inventory](POS_INVENTORY.md); [register shifts](POS_REGISTER.md); [checkout recovery](POS_CHECKOUT_RECOVERY.md).
### Catalog — `/catalog`
- **Purpose/capabilities:** Maintain sellable items, prices, categories, media, item-specific configuration and channel visibility; import catalog data and maintain modifier groups at `/catalog/modifier-groups`.
- **Use:** Define the product/service or digital offering, configure its options and fulfillment/access requirements, then expose it in the intended channel.
- **Source:** [Catalog](../app/catalog/page.tsx); [modifier groups](../app/catalog/modifier-groups/page.tsx); [import](CATALOG_IMPORT.md); [category archival](CATALOG_CATEGORY_ARCHIVAL.md).
### Price Lists — `/price-lists`
- **Purpose/capabilities:** Maintain named sets of catalog prices and inspect/edit their item-level pricing.
- **Use:** Define the appropriate commercial pricing and use it in workflows that support price-list selection.
- **Source:** [Price Lists](../app/price-lists/page.tsx); [detail](../app/price-lists/[id]/page.tsx).
### Customer Subscriptions — `/subscriptions`
- **Purpose/capabilities:** Inspect and maintain customer-facing commercial subscriptions, their terms/status, and related invoicing.
- **Use:** Open a customer's subscription, review its dates and terms, and perform the permitted lifecycle or invoice operation.
- **Amount changes:** Authorized revision-checked edits apply to the next ungenerated cycle and renewals, not existing invoices/payments or Stripe prices. Amounts are non-negative with at most two decimals; invoice generation requires a positive amount.
- **Source:** [Subscriptions](../app/subscriptions/page.tsx); [detail](../app/subscriptions/[id]/page.tsx); [terms and due dates](FINANCIAL_DUE_DATES.md).
### Accounts Receivable — `/accounts-receivable`
- **Purpose/capabilities:** Review customer invoice balances and due-date collection work, opening the related sale/invoice to inspect settlement.
- **Use:** Prioritize outstanding balances, inspect the document, then record or request the supported balance payment through its authorized flow.
- **Source:** [Accounts Receivable](../app/accounts-receivable/page.tsx); [invoice payments](LEAD_INVOICE_PAYMENTS.md); [due dates](FINANCIAL_DUE_DATES.md).
### Sales — `/sales`
- **Purpose/capabilities:** Register and inspect commercial sale records, customer associations, amounts/status, and related financial documents and payment evidence.
- **Use:** Register the commercial transaction or open an existing sale to review its actual collection/document state.
- **Source:** [Sales](../app/sales/page.tsx); [sale detail](../app/sales/[id]/page.tsx); [sales reporting](REPORTS.md).
### Leads — `/leads`
- **Purpose/capabilities:** Maintain customer/prospect contact records, qualification/status and associations; inspect related commercial activity, conversations, and follow-up work.
- **Use:** Create or qualify a contact, associate the appropriate campaign/segment, and follow up using tasks, deals, or customer conversations.
- **Source:** [Leads](../app/leads/page.tsx); [call consent](LEAD_CALL_CONSENT.md); [invoice balance payments](LEAD_INVOICE_PAYMENTS.md).
### Deals — `/deals`
- **Purpose/capabilities:** Maintain sales opportunities, stages/status, value, ownership and related customer/quotation information.
- **Use:** Track an opportunity through negotiation and issue an associated quotation when commercial terms are ready.
- **Source:** [Deals](../app/deals/page.tsx); [detail](../app/deals/[id]/page.tsx).
### Quotations — `/quotations`
- **Purpose/capabilities:** Prepare itemized offers with quantities, pricing, notes and totals; send/resend PDFs and public review links; request configured dynamic pricing.
- **Use:** Prepare the offer for a customer/deal, resolve prices and authorization, then explicitly send it or share its client link.
- **Source:** [Quotations](../app/quotations/page.tsx); [actions](../app/quotations/actions.ts); [pricing requests](../app/quotations/dynamic-quote-request.ts).
### People and company details — `/people`, `/companies/[id]`
- **Purpose/capabilities:** Search external prospects with person/role/company criteria, manage saved Finder lists and request enrichment; company detail maintains persisted company information.
- **Use:** Search prospects, save useful results, and request enrichment; use Leads for CRM follow-up and Settings Team for workspace membership.
- **Source:** [People](../app/people/page.tsx); [Finder proxy](../app/api/finder/[...path]); [company detail](../app/companies/[id]/page.tsx).

## Operations
### Chat — `/chat`
- **Purpose/capabilities:** Browse customer and internal agent conversations, search/filter history, manage pending messages, and send team interventions through available channels.
- **Use:** Review the thread and select the intended channel/context before replying; use internal agent discussion when the customer should not receive the message.
- **Source:** [Chat](../app/chat/page.tsx); [intervention delivery](CHAT_INTERVENTION_DELIVERY.md); [social comments](SOCIAL_COMMENT_CONVERSATIONS.md).
### Records — `/records`
- **Purpose/capabilities:** Define category templates and structured fields; maintain rich-text records, relationships/status and diagrams; browse table, Kanban, calendar and graph views.
- **Use:** Define a category for an inspection, document or knowledge entry, create records, link related entities, and save changes.
- **Source:** [Records](../app/records/page.tsx); [record detail](../app/records/[id]).
### Customer Orders — `/orders`
- **Purpose/capabilities:** Inspect the selected seller's customer orders, lines, fulfillment/payment state and related documents; perform permitted order operations.
- **Use:** Open the customer's order, verify its payment release and fulfillment requirements, then process its lines/shipment.
- **Source:** [Orders](../app/orders/page.tsx); [seller query](../app/orders/query-orders.ts); [self-service payment release](SHOP_SELF_SERVICE.md).
### Order Lines — `/order-lines`
- **Purpose/capabilities:** Item-level work queue across orders, with pending, in-progress, ready, returned and cancelled views; filter by location/date and open the parent order.
- **Use:** Process the specific line assigned to operational work and inspect its parent when customer/payment context is needed.
- **Source:** [Order Lines](../app/order-lines/page.tsx); [line operations](../app/order-lines/use-order-line-operations.ts).
### Shipments — `/shipments`
- **Purpose/capabilities:** Maintain order-related shipment records and inspect delivery status, origin/destination and tracking information.
- **Use:** Open or prepare the shipment for a released order and update supported operational tracking as delivery progresses.
- **Source:** [Shipments](../app/shipments/page.tsx); [detail](../app/shipments/[id]/page.tsx).
### Control Center — `/control-center`
- **Purpose/capabilities:** Organize tasks, assignees, priorities, dates/status and linked business work; use the available views to monitor progress.
- **Use:** Create a follow-up or operational task, assign responsibility, and update it as the work is completed.
- **Source:** [Control Center](../app/control-center).
### Reservations — `/reservations`
- **Purpose/capabilities:** Browse and create scheduled reservations with customer, time and resource/location context.
- **Use:** Choose the service/resource and available time, confirm the customer booking, and later complete the supported check-in flow.
- **Source:** [Reservations](../app/reservations/page.tsx); [new reservation](../app/reservations/new/page.tsx).
### Visits — `/visits`
- **Purpose/capabilities:** Register visitors and review visit records, terms acceptance and configured identity/signature/photo evidence; physical and online registration are distinct channels.
- **Use:** Configure visit requirements first, then register the visitor through the enabled channel and review the recorded attestation.
- **Source:** [Visits](../app/visits/page.tsx); [registration](../app/visits/new/page.tsx); [visit settings](../app/components/settings/VisitsSection.tsx).
### Check-in — `/pos/check-in`
- **Purpose/capabilities:** Operational admission/redeeming surface for identifying customers and completing eligible reservation or entitlement check-ins.
- **Use:** Identify the customer/access record, verify eligibility and remaining uses, then explicitly confirm the supported admission operation.
- **Source:** [Check-in](../app/pos/check-in/page.tsx); [buyer identity QR](../app/buyer/identity-qr-actions.ts).
### Inventory — `/inventory`
- **Purpose/capabilities:** Inspect stock levels by catalog item/location, maintain locations, perform supported stock adjustments/transfers, and configure commerce inventory policies.
- **Use:** Select the location, review availability, and apply the appropriate adjustment or transfer before relying on stock in POS/fulfillment.
- **Source:** [Inventory](../app/inventory/page.tsx); [actions](../app/inventory/actions.ts); [POS inventory](POS_INVENTORY.md).
### Inventory Minimums — `/inventory/minimums`
- **Purpose/use:** Configure SKU/location thresholds, inspect recorded-stock checks and review generated draft requisitions or alerts.
### Printers — `/settings?tab=printers`
- **Purpose/capabilities:** Maintain printer configuration used by supported operational printing and inspect synchronization status in consuming modules.
- **Use:** Configure the printer/service and verify it in the intended POS or operational workflow before depending on printed output.
- **Source:** [Printer settings](../app/components/settings/PrintersSection.tsx); [development boundaries](DEVELOPMENT.md).

## Buying
### Suppliers — `/suppliers`, `/suppliers/[id]`
- **Purpose/use:** Maintain private supplier relationships, company/professional identity, contacts, categories, commercial terms, notes, lifecycle and verified-account representation grants.
### Purchase Requests — `/purchases/requests`
- **Purpose/use:** Create/revise catalog or service requisitions, resolve server-owned costs/taxes or internal estimates, submit against a pinned policy revision and follow approval/history.
### Approvals — `/purchases/procurement/approvals`
- **Purpose/use:** Review requisition/publication/award/order documents in a filtered paginated inbox and cast reasoned eligible human decisions with quorum, revision and self-approval controls.
### Tenders — `/purchases/tenders`
- **Purpose/use:** Prepare requirements and request links, register supplier invitations, request independent publication approval, inspect immutable publications/sealed receipt activity, review opened offers and initiate award/order approvals.
### Procurement Rules — `/purchases/rules`
- **Purpose/use:** Save versioned event/scope rules with thresholds, cumulative conditions, approvers/quorum and timing; search/filter and simulate policy resolution before real submission.
### Vendor Bills — `/bills`
- **Purpose/capabilities:** Maintain itemized purchase/vendor-bill records, totals, dates/status, payment terms and related financial documents.
- **Use:** Record the vendor obligation and review its due/payment state; use accounting synchronization for its supported ledger posting.
- **Source:** [Bills](../app/bills/page.tsx); [detail](../app/bills/[id]/page.tsx); [due dates](FINANCIAL_DUE_DATES.md); [accounting](ACCOUNTING.md).
### Accounts Payable — `/accounts-payable`
- **Purpose/capabilities:** Review supplier balances with aging/due-date filters, active/cancelled scope and currency-separated totals; open an eligible bill's existing payment-entry flow.
- **Use/limits:** Prioritize obligations and select the actual bill to settle. Recorded payment entry is not a bank transfer, procurement receipt or automatic reconciliation; supplier links currently use Companies details.
- **Source:** [Accounts Payable](../app/accounts-payable/page.tsx); [behavior and verification](ACCOUNTS_PAYABLE.md).
### Transactions — `/transactions`
- **Purpose/capabilities:** Record and maintain expense transactions, categories and associations used by cost analysis and accounting.
- **Use:** Record an expense with its correct date/category and relevant campaign/business context, then review it in Costs or the ledger.
- **Source:** [Transactions](../app/transactions/page.tsx); [detail](../app/transactions/[id]/page.tsx).
### Purchased Orders — `/purchases/orders`
- **Purpose/use:** Review procurement orders by default; choose `?source=online` for commerce purchases filed under the purchasing site.
### Purchased Subscriptions — `/purchases/subscriptions`
- **Purpose/capabilities:** Review subscriptions acquired through commerce under the purchasing context and their supported buyer lifecycle controls.
- **Use:** Open the acquired subscription to review its current status and available management action.
- **Source:** [Purchased Subscriptions](../app/purchases/subscriptions/page.tsx); [buyer subscription actions](../app/buyer/subscription-actions.ts).
### Received Quotations — `/purchases/quotes`
- **Purpose/use:** Workspace received/procurement quotations with opening-aware sealed receipt summaries; personal quotations remain in `/home/quotes` or `/buyer/quotes`.
### Purchased Library — `/purchases/library`
- **Purpose/capabilities:** Browse acquired course, ticket, file, pass or license entitlements; open supported access experiences and eligible signed file downloads.
- **Use:** Locate the acquired digital offering and use its authorized viewing/download/booking experience.
- **Source:** [Purchased Library](../app/purchases/library/page.tsx); [library view](../app/buyer/components/BuyerLibraryView.tsx); [download actions](../app/catalog/digital-file-actions.ts).

## Finance
### Finance Reports — `/finance`
- **Purpose/capabilities:** Review Profit & Loss, Balance Sheet and Trial Balance from posted journals; choose period/currency, refresh and export CSV.
- **Use:** Select the accounting period and currency, inspect balances, and resolve journal/source discrepancies before relying on statements.
- **Source:** [Finance](../app/finance); [accounting contracts](ACCOUNTING.md).
### Journal Entries — `/accounting/entries`
- **Purpose/capabilities:** Inspect journal sources and debit/credit lines, open source documents, maintain permitted balanced manual journals, and synchronize source records for a period.
- **Use:** Trace an unexpected balance to its source; correct the source and synchronize, or enter an explicit authorized manual adjustment.
- **Source:** [Journal Entries](../app/accounting/entries/page.tsx); [accounting](ACCOUNTING.md).
### Chart of Accounts — `/accounting`
- **Purpose/capabilities:** Maintain the site's accounting accounts and classification used by journal lines and financial statements.
- **Use:** Establish the appropriate account structure before posting manual entries or mapping operational sources.
- **Source:** [Chart of Accounts](../app/accounting/page.tsx); [accounting](ACCOUNTING.md).
### Payments / Balances — `/payments`
- **Purpose/capabilities:** Inspect business wallet/balance summaries, recorded operations and withdrawal history; request permitted withdrawals through the configured payout flow.
- **Use:** Review available balances and operation evidence before initiating a withdrawal and checking its subsequent status.
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
### Business Overview — `/dashboard?tab=overview`
- **Purpose/capabilities:** Summary, Unit economics and Activity sections combine business KPIs, sales/expense/purchase context and activity information.
- **Use:** Assess the business at a glance, then investigate financial or operational changes in the dedicated reports.
### Analytics — `/dashboard?tab=analytics`
- **Purpose/capabilities:** Distribution, Customer cohorts and Lead cohorts analyze recorded populations and retention patterns.
- **Use:** Compare distributions and cohort progression while respecting the selected window and incomplete-period disclosures.
### Traffic — `/dashboard?tab=traffic`
- **Purpose/capabilities:** Acquisition, Audience and Sessions analyze session-entry attribution, sources, URLs, geography, devices/browsers and aggregate session activity.
- **Use:** Install tracking on the intended pages, preserve campaign UTMs, and inspect acquisition/coverage before drawing attribution conclusions.
### Costs — `/costs`
- **Purpose/capabilities:** Summary and Categories analyze recorded expenses and eligible purchases, cost composition and sales-to-cost context; includes campaign filtering.
- **Use:** Review recorded spending and categories, then open Transactions or Bills to inspect/correct source records.
### Sales Report — `/dashboard?tab=sales`
- **Purpose/capabilities:** Summary, Channels and Categories distinguish active sales, net collected cash, outstanding balances, trends and allocation breakdowns.
- **Use:** Select period/currency and compare commercial activity with actual collections before investigating an outstanding invoice.
### Social — `/dashboard?tab=social`
- **Purpose/capabilities:** Engagement, Networks & audience and Top posts analyze stored social metrics, connected-network results and post rankings.
- **Use:** Connect accounts and ensure metric ingestion is configured, then review published-content performance.

## Applications
### Applications hub — `/applications`
- **Purpose/capabilities:** Entry point for the workspace's application-related data and recorded development outputs.
- **Use:** Choose Database or Repositories; configure application credentials under Secrets when required.
- **Source:** [Applications](../app/applications/page.tsx).
### Database — `/applications/database`
- **Purpose/capabilities:** Inspect requirement-linked application databases, tables/columns and row counts; filter/sort/paginate data and perform authorized row insertion/edit/deletion.
- **Use:** Open an existing application database and inspect the table before applying an intentional data change.
- **Source:** [Database](../app/applications/database/page.tsx); [application actions](../app/applications/actions.ts).
### Repositories — `/applications/repositories`
- **Purpose/capabilities:** Browse recorded repository artifacts, repository/preview links and archive-based source contents associated with requirements.
- **Use:** Inspect a generated implementation and its external links; use the linked development workflow for changes.
- **Source:** [Repositories](../app/applications/repositories/page.tsx).
### Secrets — `/settings?tab=secrets`
- **Purpose/capabilities:** Maintain encrypted site integration credentials and metadata; authorized managers can replace, reveal or delete secrets.
- **Use:** Store a credential in its intended provider/use-case/scope and configure the consuming integration separately.
- **Source:** [Secrets settings](../app/components/settings/SecretsSection.tsx); [Secrets API](../app/api/secrets/route.ts).

## Automation
### AI Workspace — `/robots`
- **Purpose/capabilities:** Work with assistant instances, instructions and interactive execution; inspect returned messages, logs, work artifacts and execution state.
- **Use:** Select the appropriate instance, provide scoped instructions, start supported work, and monitor its explicit result before issuing dependent actions.
- **Source:** [Robots workspace](../app/robots/robots-workspace.tsx); [execution boundaries](ARCHITECTURE.md).
### Context — `/context`
- **Purpose/capabilities:** Maintain shared company, branding, marketing, copy sequences and customer-journey guidance consumed by AI/business workflows.
- **Use:** Record accurate business facts, voice/tone, offerings and constraints before asking agents to communicate or generate content.
- **Source:** [Context](../app/context/page.tsx).
### Agent Configuration — `/agents`
- **Purpose/capabilities:** Maintain agent roles, personality/prompts and activity configuration; inspect related conversations/command records and launch supported activities.
- **Use:** Configure responsibility and instructions, select a supported activity, and inspect its actual execution result.
- **Source:** [Agents](../app/agents/page.tsx); [agent saving](../app/agents/save-agent.ts).
### Requirements — `/requirements`
- **Purpose/capabilities:** Maintain work briefs, instructions, status/completion and campaign/segment associations; inspect related implementation/work artifacts and planning metadata.
- **Use:** Write the acceptance intent and context, associate the business initiative, and follow execution/output through the supported agent workflow.
- **Source:** [Requirements](../app/requirements/page.tsx); [detail](../app/requirements/[id]/page.tsx); [deletion lifecycle](INSTANCE_DELETION.md).
### Agent Channels — `/settings?tab=channels`
- **Purpose/capabilities:** Configure agent communication connections, sender identities and applicable email/phone/voice options; manage activation within licensed capacity.
- **Use:** Connect and verify the intended account/number, activate eligible capacity, then select that connection in messaging/publishing workflows.
- **Source:** [Channels](../app/components/settings/ChannelsSection.tsx); [activation](AGENT_CHANNEL_ACTIVATION.md); [numbers](AGENT_CHANNEL_NUMBERS.md).
### AI Activities — `/settings?tab=activities`
- **Purpose/capabilities:** Configure recurring/business activity inputs, activation and supported timing/selection options, including specialized outreach and standup settings.
- **Use:** Configure the activity's audience/input and timing before enabling it; inspect execution through the actual agent/backend workflow.
- **Source:** [Activities](../app/components/settings/ActivitiesSection.tsx); [standup](DAILY_STANDUP_SETTINGS.md); [ICP mining lists](ICP_MINING_LIST_SELECTION.md).
### Skills — `/skills`
- **Purpose/capabilities:** Upload/paste/edit Markdown skills, enable/disable or delete permitted skills, and search/preview/import community instructions; inspect system skills and external-agent setup downloads.
- **Use:** Review the instructions and provenance before enabling/importing a skill and assigning it to supported agent work.
- **Source:** [Skills](../app/skills/page.tsx).
### Workflows — `/robots?mode=workflow`
- **Purpose/capabilities:** Persist visual trigger/step graphs, relations and instructions; configure manual, scheduled, event, webhook or channel-message triggers; request runs/tests and inspect recorded results.
- **Use:** Configure an enabled trigger, connect steps with appropriate success/failure conditions, then run and inspect explicit outcomes.
- **Source:** [Workflow components](../app/components/workflows); [relation and execution contracts](ARCHITECTURE.md).

## Settings

Settings tabs share [the Settings page](../app/settings/page.tsx); some are grouped
under Operations, Applications or Automation above because that is their menu placement.
### Procurement / Tender Settings — `/settings/procurement`, `/settings?tab=tenders`
- **Purpose/use:** Save versioned defaults for visibility, participation/opening, approvals, timings, supervisors, urgency and notifications; enable the public portal through a separate save. `/settings/tenders` redirects to the tender tab; `?tab=procurement` is an alias.
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
- **Source:** [Shop settings](../app/components/settings/ShopSection.tsx); [self-service](SHOP_SELF_SERVICE.md).
### Visit Settings — `/settings?tab=visits`
- **Purpose/capabilities:** Enable physical/online visit registration, configure terms and identity/signature/photo requirements, and set default duration.
- **Use:** Set the required evidence before opening visitor registration in Operations or the buyer portal.
- **Source:** [Visit settings](../app/components/settings/VisitsSection.tsx).
### Team — `/settings?tab=team`
- **Purpose/capabilities:** Invite/manage members, roles and activation; configure app access and eligible location exclusions in member cards.
- **Use:** Grant the minimum required role/apps/branches and explicitly save the member changes.
- **Source:** [Team](../app/components/settings/TeamSection.tsx); [location access enforcement](LOCATION_ACCESS_ENFORCEMENT.md); [license limits](SITE_LICENSE_LIMITS.md).
### Calendar — `/settings?tab=calendar`
- **Purpose/capabilities:** Maintain round-robin calendar definitions, member selection, duration/buffer and public booking links.
- **Use:** Choose eligible team members, define the calendar, and share its generated booking link after confirming availability setup.
- **Source:** [Calendar settings](../app/components/settings/CalendarSection.tsx); [public booking](../app/book).
### Social Networks — `/settings?tab=social`
- **Purpose/capabilities:** Maintain social account connections and initiate supported OAuth/provider-specific connection flows.
- **Use:** Connect the exact business account and verify its state before selecting it for publishing or social reporting.
- **Source:** [Social settings](../app/components/settings/SocialSection.tsx); [OAuth setup](SOCIAL_NETWORK_OAUTH_SETUP.md).
### Integrations — `/integrations`
- **Purpose/capabilities:** Maintain outbound webhook endpoints/event subscriptions and test requests; configure communication providers, marketplace merchant connections and supported Composio integrations.
- **Use:** Configure the intended integration through its specific flow and verify the supported event/delivery contract.
- **Source:** [Integrations](../app/integrations/page.tsx); [marketplace orders](MARKETPLACE_ORDERS.md); [retired webhook marker](WORKFLOW_WEBHOOK_INTEGRATION.md).
### Billing — `/billing`
- **Purpose/capabilities:** Manage the site's Makinari plan, billing information, credits and eligible extras/trial/top-up options; inspect related billing history.
- **Use:** Review licensed resource capacity and credit balances before upgrading or buying additional capacity; activate an eligible trial only through its explicit action.
- **Source:** [Billing](../app/billing/page.tsx); [trial](STARTUP_TRIAL.md); [credit reset](BILLING_CREDIT_RESET.md); [auto top-up](AUTO_TOP_UP.md).
### Security — `/security`
- **Purpose/capabilities:** Change account password, manage supported MFA, API keys, robot sessions and allowed domains.
- **Use:** Secure the account and maintain only the credentials/sessions/domains needed by authorized integrations.
- **Source:** [Security page](../app/security/page.tsx); [security policy](SECURITY.md); [resource provenance](SECURITY_RESOURCE_PROVENANCE.md).

## Public commerce and buyer portal

Buyer identity and workspace membership are separate. These tools have their own public/personal authorization boundaries.
### Unified account — `/home`
- **Purpose/use:** Account hub for personal purchases, quotes, subscriptions and library; discover products/tenders, manage credentials and supplier activity without forced business creation. Lists live at `/home/orders`, `/home/quotes`, `/home/subscriptions` and `/home/library`.
### Account search — `/home/search?q=…`
- **Purpose/use:** Search personal commerce, reservations, accessible businesses, credentials, submissions/drafts/opportunities, Marketplace products and public tenders; filter by collection and open original records.
### Personal credentials — `/home/profile`
- **Purpose/use:** Maintain credential metadata/private immutable file revisions, download/archive files and select exact revisions for submission evidence.
### Supplier participation — `/home/submissions`, `/home/tenders`
- **Purpose/use:** Review invitations, database-backed drafts and submitted quotations; choose a server-authorized personal, business or represented-supplier applicant and explicitly share evidence. Saved receipt keys/revisions protect ambiguous submission retries and stale draft edits.
### Public tenders — `/tenders`, `/tenders/[siteSlug]`, `/tenders/[siteSlug]/[tenderSlug]`
- **Purpose/use:** Search the global directory or buyer portal, inspect published requirements/deadlines and follow authenticated participation. Visibility, global listing and portal activation are independent.
### Shop — `/shop/[siteSlug]`
- **Purpose/use:** Browse one seller's eligible products/promotions, select variants/options, add to cart or use supported booking/self-service ordering; review seller shipping/trust information.
### Marketplace — `/marketplace`
- **Purpose/use:** Discover eligible offerings across sellers, inspect products/promotions and proceed through supported purchase or booking paths.
### Cart and commerce checkout — `/cart/checkout`
- **Purpose/use:** Complete eligible commerce cart/quotation flows using server-authorized records/prices, buyer details and supported payment methods.
### Public booking — `/book/[siteSlug]/[userSlug]/[eventSlug]`, `/book/[siteSlug]/rr/[eventSlug]`
- **Purpose/use:** Choose eligible personal/round-robin availability and confirm supported appointments; catalog booking is also exposed through Shop/Marketplace item booking routes.
### Buyer tools and purchase detail — `/buyer`
- **Purpose/use:** Review `/buyer/orders`, `/buyer/quotes`, `/buyer/subscriptions`, `/buyer/library`, profile/visits and eligible quote/order checkout; inspect order balance, payment history, shipments and authorized course/file/ticket/pass access.
### Public documents — `/q/[token]`, `/so/[token]`, `/i/[token]`, `/vb/[token]`
- **Purpose/use:** Share limited quotation, sales-order, invoice and vendor-bill views with only eligible document actions.

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

## Module maturation matrix

Snapshot: **2026-11-05**. Global Makinari DB counts observed **2026-11-05 00:24–00:29 UTC**, using read-only exact COUNT(*) queries; no customer fields were retrieved.
Creation = earliest addition of the selected source path in available Git history, not product launch or first DB use. Renames/replacements may make this date younger than the original feature.
Jest / E2E = active authored test declarations statically associated by reviewed filename/import or literal route; skipped/todo excluded, parameterized declarations counted once. YAML/generated pairs count only the generated spec. Counts are NOT passing tests or feature coverage percentages.
Association is module-level: shared suite declarations may exercise dependencies or multiple modules. Counts overlap across rows and must not be summed. Demo/mocked/source-contract tests are included in Jest; E2E declarations may include API/RLS journeys, not only UI journeys. See exact file attribution in the evidence JSON.
DB: `own` = primary entity; `filtered` = explicit subset; `shared` = another module/shared configuration source; `none` = no own store identified. Shared counts do not establish screen usage. Deleted/archived/test rows are not distinguished; record volume is not proof of correctness.
**Rubric (evidence index, not functionality/completeness):** history /2: <30 days 0.5, 30–89 1, 90–179 1.5, ≥180 2; Jest /3: 0→0, 1–4→1, 5–19→2, ≥20→3; E2E /3: 0→0, 1→1, 2–4→2, ≥5→3; own/filtered DB /2: 0→0, 1–9→1, 10–99→1.5, ≥100→2.
Score /10 = earned points ÷ applicable maximum ×10. Shared/no-own/unknown DB and unknown history are N/A, excluded—not zero. States: ≥8 Strong, ≥6 Established, ≥4 Developing, <4 Limited evidence. Age/volume favor established modules; this is a heuristic, not a release gate.
Current source state describes the implemented surface, not end-to-end completion; no module-wide pass rate/deployed SHA was established. **Code Quality /10:** ESLint on the selected creation source file (or subtree for directory sources), not all dependencies: max(0, 10 − 100 × (2×errors + warnings)/source lines), rounded to one decimal; fatal parse errors →0, excluded/no source →N/A. This lint-density proxy is not security, architecture, type correctness or functional quality. Exact files/rules/counts are in the evidence JSON.
**Final result — Meta Score /10:** 70% maturation + 30% Code Quality; N/A when quality is unavailable. Rows sort by final Meta Score, highest first; ties use maturation then module name, and N/A remains last. Final evidence state uses the same ≥8/≥6/≥4 thresholds on Meta Score. Generate ascending with `node scripts/docs/module-maturity.cjs --sort=asc`; validate that order with `--check --sort=asc`.
Reproduce locally: `node scripts/docs/module-maturity.cjs --check`. [Inputs and exact DB sources](MODULE_MATURITY_INPUT.json) · [File-level attribution and component scores](MODULE_MATURITY_EVIDENCE.json). Refresh DB inputs explicitly before generating a new snapshot.

| Module | Current source state | Created (Git) | Jest | E2E | DB source / exact rows | Final evidence state | Maturation /10 | Code Quality /10 | Final Meta Score /10 |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: |
| AI Workspace | Implemented service-backed flow | 2025-08-04 | 109 | 9 | own: public.remote_instances / 1,055 | Strong evidence | 10.0 | 10.0 | 10.0 |
| Customer Orders | Implemented record workflow | 2026-07-21 | 74 | 6 | own: public.sale_orders / 575 | Strong evidence | 9.5 | 10.0 | 9.6 |
| POS | Implemented service-backed flow | 2026-07-17 | 1217 | 5 | shared: public.sale_orders / 575 | Strong evidence | 9.4 | 10.0 | 9.6 |
| Projects | Implemented record workflow | 2025-09-19 | 58 | 12 | own: public.sites / 66 | Strong evidence | 9.5 | 9.3 | 9.4 |
| Content | Implemented record workflow | 2025-03-11 | 167 | 4 | own: public.content / 278 | Strong evidence | 9.0 | 10.0 | 9.3 |
| Control Center | Implemented record workflow | 2025-04-07 | 32 | 2 | own: public.tasks / 5,891 | Strong evidence | 9.0 | 10.0 | 9.3 |
| Leads | Implemented record workflow | 2025-02-26 | 170 | 3 | own: public.leads / 34,704 | Strong evidence | 9.0 | 10.0 | 9.3 |
| Security | Implemented configuration | 2025-03-03 | 254 | 2 | shared: public.api_keys / 5,020 | Strong evidence | 8.8 | 10.0 | 9.2 |
| Requirements | Implemented record workflow | 2025-02-26 | 39 | 2 | own: public.requirements / 615 | Strong evidence | 9.0 | 9.2 | 9.1 |
| Catalog | Implemented record workflow | 2026-07-17 | 284 | 3 | own: public.catalog_items / 2,186 | Strong evidence | 8.5 | 10.0 | 9.0 |
| Chart of Accounts | Implemented record workflow | 2026-08-01 | 165 | 3 | own: public.accounting_accounts / 108 | Strong evidence | 8.5 | 10.0 | 9.0 |
| Deals | Implemented record workflow | 2026-03-06 | 25 | 2 | own: public.deals / 85 | Strong evidence | 8.5 | 10.0 | 9.0 |
| Marketplace | Implemented read surface | 2026-08-01 | 341 | 3 | filtered: public.catalog_items [is_marketplace_listed IS TRUE] / 328 | Strong evidence | 8.5 | 10.0 | 9.0 |
| Public tenders | Implemented read surface | 2026-10-27 | 20 | 6 | shared: public.procurement_tender_publications / 1 | Strong evidence | 8.1 | 10.0 | 8.7 |
| Agent Configuration | Implemented configuration | 2025-02-26 | 104 | 2 | own: public.agents / 415 | Strong evidence | 9.0 | 7.8 | 8.6 |
| Context | Implemented configuration | 2025-07-31 | 124 | 2 | shared: public.settings / 64 | Strong evidence | 8.8 | 8.1 | 8.6 |
| People and company details | Implemented record workflow | 2025-09-24 | 64 | 2 | shared: public.companies / 26,621 | Strong evidence | 8.8 | 8.2 | 8.6 |
| Quotations | Implemented record workflow | 2026-08-01 | 87 | 3 | filtered: public.quotations [procurement_tender_id IS NULL] / 12 | Strong evidence | 8.0 | 10.0 | 8.6 |
| Chat | Implemented record workflow | 2025-03-05 | 149 | 1 | own: public.conversations / 21,327 | Strong evidence | 8.0 | 9.6 | 8.5 |
| Profile | Implemented configuration | 2025-02-27 | 9 | 2 | own: public.profiles / 112 | Strong evidence | 8.0 | 9.5 | 8.5 |
| Vendor Bills | Implemented record workflow | 2026-08-07 | 67 | 2 | own: public.purchases / 71 | Strong evidence | 8.0 | 9.5 | 8.5 |
| Promotions | Implemented record workflow | 2026-07-17 | 96 | 2 | own: public.promotions / 15 | Strong evidence | 8.0 | 9.3 | 8.4 |
| Analytics | Implemented read surface | 2026-09-29 | 20 | 2 | shared: public.leads / 34,704 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Billing | Implemented configuration | 2025-04-10 | 153 | 1 | own: public.billing / 66 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Content Creator | Implemented service-backed flow | 2026-04-14 | 123 | 1 | shared: public.content / 278 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Costs | Implemented read surface | 2025-05-02 | 59 | 1 | shared: public.transactions / 110 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Create site and onboarding | Implemented record workflow | 2025-02-28 | 54 | 1 | shared: public.sites / 66 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Customer Subscriptions | Implemented record workflow | 2026-07-21 | 157 | 3 | own: public.subscriptions / 9 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Journal Entries | Implemented record workflow | 2026-08-01 | 165 | 1 | own: public.journal_entries / 788 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Public documents | Implemented read surface | 2026-08-10 | 43 | 3 | shared: public.quotations [procurement_tender_id IS NULL] / 12 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Received Quotations | Implemented record workflow | 2026-08-01 | 68 | 2 | filtered: public.quotations [procurement_tender_id IS NOT NULL] / 1 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Shipments | Implemented record workflow | 2026-07-17 | 20 | 2 | own: public.shipments / 9 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Team | Implemented configuration | 2025-04-24 | 107 | 1 | own: public.site_members / 39 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Tenders | Implemented record workflow | 2026-10-27 | 115 | 5 | own: public.procurement_tenders / 1 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Transactions | Implemented record workflow | 2026-08-01 | 7 | 2 | own: public.transactions / 110 | Strong evidence | 7.5 | 10.0 | 8.3 |
| Reservations | Implemented record workflow | 2026-07-21 | 126 | 2 | own: public.reservations / 191 | Strong evidence | 8.5 | 7.6 | 8.2 |
| Shop | Implemented read surface | 2026-07-17 | 183 | 2 | shared: public.catalog_items / 2,186 | Strong evidence | 8.1 | 8.5 | 8.2 |
| Agent Channels | Implemented configuration | 2025-04-30 | 40 | 1 | shared: public.settings / 64 | Strong evidence | 7.5 | 9.1 | 8.0 |
| AI Activities | Implemented configuration | 2025-10-07 | 86 | 1 | shared: public.settings / 64 | Established evidence | 7.5 | 8.9 | 7.9 |
| Buyer tools and purchase detail | Supported buyer routes | 2026-08-01 | 93 | 1 | shared: public.sale_orders / 575 | Established evidence | 6.9 | 10.0 | 7.8 |
| Cart and commerce checkout | Implemented service-backed flow | 2026-08-01 | 721 | 1 | shared: public.sale_orders / 575 | Established evidence | 6.9 | 10.0 | 7.8 |
| Finance Reports | Implemented read surface | 2026-08-01 | 37 | 1 | shared: public.journal_entries / 788 | Established evidence | 6.9 | 10.0 | 7.8 |
| Navigation | Implemented read surface | 2026-05-28 | 226 | 1 | none: N/A | Established evidence | 6.9 | 10.0 | 7.8 |
| Unified account | Additive account alias | 2026-10-27 | 31 | 2 | shared: public.sale_orders / 575 | Established evidence | 6.9 | 10.0 | 7.8 |
| Campaigns | Implemented record workflow | 2025-05-16 | 7 | 2 | own: public.campaigns / 130 | Established evidence | 8.0 | 7.0 | 7.7 |
| Payments / Balances | Implemented record workflow | 2026-09-10 | 20 | 2 | own: public.payments / 410 | Established evidence | 8.0 | 7.1 | 7.7 |
| Price Lists | Implemented record workflow | 2026-07-17 | 5 | 2 | own: public.price_lists / 71 | Established evidence | 7.0 | 9.4 | 7.7 |
| Inventory | Implemented record workflow | 2026-07-17 | 10 | 2 | own: public.inventory_levels / 2 | Established evidence | 6.5 | 10.0 | 7.6 |
| Supplier participation | Implemented record workflow | 2026-10-27 | 66 | 2 | filtered: public.quotations [procurement_source = 'supplier_submitted'] / 1 | Established evidence | 6.5 | 10.0 | 7.6 |
| Workflows | Implemented service-backed flow | 2026-08-24 | 63 | 1 | own: public.workflow_runs / 96 | Established evidence | 6.5 | 10.0 | 7.6 |
| Segments | Implemented record workflow | 2025-02-26 | 6 | 3 | own: public.segments / 221 | Established evidence | 8.0 | 6.3 | 7.5 |
| Records | Implemented record workflow | 2026-08-19 | 96 | 2 | own: public.records / 24 | Established evidence | 7.5 | 7.0 | 7.4 |
| Business Overview | Implemented read surface | 2026-09-29 | 21 | 1 | shared: public.sales / 598 | Established evidence | 6.3 | 10.0 | 7.4 |
| Performance | Implemented read surface | 2026-09-29 | 21 | 1 | shared: public.tasks / 5,891 | Established evidence | 6.3 | 10.0 | 7.4 |
| Sales Report | Implemented read surface | 2026-09-29 | 24 | 1 | shared: public.sales / 598 | Established evidence | 6.3 | 10.0 | 7.4 |
| Social | Implemented read surface | 2026-09-29 | 34 | 1 | shared: public.content_performance / 26 | Established evidence | 6.3 | 10.0 | 7.4 |
| Traffic | Implemented read surface | 2026-09-29 | 63 | 1 | shared: public.visitor_sessions / 324,239 | Established evidence | 6.3 | 10.0 | 7.4 |
| Visits | Implemented record workflow | 2026-08-10 | 35 | 1 | shared: public.reservations / 191 | Established evidence | 6.3 | 10.0 | 7.4 |
| Notifications | Implemented record workflow | 2025-03-04 | 17 | 1 | own: public.notifications / 14,128 | Established evidence | 7.0 | 7.0 | 7.0 |
| Visit Settings | Implemented configuration | 2026-08-10 | 35 | 1 | shared: public.settings / 64 | Established evidence | 6.3 | 8.7 | 7.0 |
| Integrations | Implemented configuration | 2025-09-14 | 7 | 1 | own: public.webhooks_endpoints / 5 | Established evidence | 6.0 | 9.5 | 7.0 |
| Order Lines | Implemented record workflow | 2026-09-21 | 26 | 0 | own: public.sale_order_items / 1,106 | Established evidence | 6.0 | 9.0 | 6.9 |
| Applications hub | Implemented read surface | 2026-05-26 | 4 | 2 | none: N/A | Established evidence | 5.6 | 10.0 | 6.9 |
| Marketplace / Shop Settings | Implemented configuration | 2026-07-21 | 12 | 1 | shared: public.settings / 64 | Established evidence | 5.6 | 10.0 | 6.9 |
| Purchased Subscriptions | Implemented read surface | 2026-08-01 | 7 | 1 | shared: public.subscriptions / 9 | Established evidence | 5.6 | 10.0 | 6.9 |
| Purchased Orders | Implemented record workflow | 2026-08-01 | 19 | 2 | own: public.purchase_orders / 0 | Established evidence | 5.5 | 10.0 | 6.9 |
| Printers | Implemented configuration | 2026-08-12 | 105 | 1 | shared: public.settings / 64 | Established evidence | 6.3 | 8.0 | 6.8 |
| Assets | Implemented record workflow | 2025-02-26 | 1 | 1 | own: public.assets / 1,613 | Established evidence | 6.0 | 8.3 | 6.7 |
| Public booking | Implemented service-backed flow | 2026-05-20 | 25 | 0 | shared: public.reservations / 191 | Established evidence | 5.6 | 9.1 | 6.7 |
| Skills | Implemented configuration | 2026-04-21 | 10 | 2 | own: public.site_skills / 0 | Established evidence | 6.0 | 7.9 | 6.6 |
| Calendar | Implemented configuration | 2026-05-20 | 5 | 1 | shared: public.settings / 64 | Established evidence | 5.6 | 8.3 | 6.4 |
| General Settings | Implemented configuration | 2025-04-24 | 0 | 2 | shared: public.settings / 64 | Established evidence | 5.0 | 9.6 | 6.4 |
| Approvals | Implemented record workflow | 2026-10-27 | 48 | 0 | own: public.procurement_event_approvals / 6 | Established evidence | 4.5 | 10.0 | 6.2 |
| Personal credentials | Implemented record workflow | 2026-10-27 | 26 | 1 | own: public.procurement_credentials / 0 | Established evidence | 4.5 | 10.0 | 6.2 |
| Procurement Rules | Implemented configuration | 2026-10-27 | 36 | 0 | own: public.procurement_policy_versions / 5 | Established evidence | 4.5 | 10.0 | 6.2 |
| Suppliers | Implemented record workflow | 2026-10-27 | 24 | 0 | own: public.suppliers / 1 | Established evidence | 4.5 | 10.0 | 6.2 |
| Sales | Implemented record workflow | 2025-05-02 | 0 | 2 | own: public.sales / 598 | Established evidence | 6.0 | 6.2 | 6.1 |
| Database | Implemented record workflow | 2026-05-26 | 7 | 1 | shared: public.apps_tenants / 0 | Established evidence | 5.6 | 7.4 | 6.1 |
| Accounts Payable | Implemented read surface | 2026-11-03 | 44 | 0 | shared: public.purchases / 71 | Established evidence | 4.4 | 10.0 | 6.1 |
| Accounts Receivable | Implemented read surface | 2026-10-14 | 38 | 0 | shared: public.sales / 598 | Established evidence | 4.4 | 10.0 | 6.1 |
| Check-in | Implemented record workflow | 2026-08-01 | 0 | 2 | shared: public.reservations / 191 | Established evidence | 4.4 | 10.0 | 6.1 |
| Social Networks | Implemented configuration | 2025-04-24 | 2 | 1 | shared: public.settings / 64 | Developing evidence | 5.0 | 8.1 | 5.9 |
| Secrets | Implemented configuration | 2026-09-09 | 3 | 1 | own: public.site_secrets / 3 | Developing evidence | 4.0 | 10.0 | 5.8 |
| Repositories | Implemented record workflow | 2026-05-26 | 2 | 1 | shared: public.cloud_files / 2 | Developing evidence | 4.4 | 8.7 | 5.7 |
| Company | Implemented configuration | 2025-04-24 | 0 | 1 | shared: public.settings / 64 | Developing evidence | 3.8 | 10.0 | 5.7 |
| Inventory Minimums | Implemented record workflow | 2026-10-30 | 88 | 0 | own: public.procurement_replenishment_rules / 0 | Developing evidence | 3.5 | 10.0 | 5.4 |
| Purchase Requests | Implemented record workflow | 2026-10-27 | 35 | 0 | own: public.procurement_requests / 0 | Developing evidence | 3.5 | 10.0 | 5.4 |
| Account search | Implemented read surface | 2026-10-30 | 9 | 0 | shared: public.sale_orders / 575 | Developing evidence | 3.1 | 10.0 | 5.2 |
| Procurement / Tender Settings | Implemented configuration | 2026-10-27 | 17 | 0 | shared: public.procurement_tender_portals / 1 | Developing evidence | 3.1 | 10.0 | 5.2 |
| Purchased Library | Implemented read surface | 2026-08-01 | 0 | 1 | shared: public.entitlements / 2 | Developing evidence | 3.1 | 10.0 | 5.2 |
| Sales Home | Hidden legacy entry | 2026-05-26 | 0 | 1 | none: N/A | Developing evidence | 3.1 | 10.0 | 5.2 |
