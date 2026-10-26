# Workspace, personal tools, and public commerce

Companion to [the Makinari module guide](MODULES.md). Reviewed against local
source on **2026-10-23**; availability remains permission-, deployment-, and
provider-dependent. See the main guide for shared concepts and limitations.

## Workspace and personal tools

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
- **Limits:** Personal queries are buyer-identity scoped. Purchased-site views in Buying do not grant everyone identical redemption rights; the proposed `/home` migration is not current behavior.
- **Source:** [Buyer hub](../app/buyer/components/BuyerHomeView.tsx); [buyer actions](../app/buyer/actions.ts); [experience routes](../app/buyer/experience-routes.ts).

### Public documents — `/q/[token]`, `/so/[token]`, `/i/[token]`, `/vb/[token]`
- **Purpose/capabilities:** Share limited customer/vendor views of quotations, sales orders, invoices and vendor bills, with only the actions supported by the document's current state.
- **Use:** Share the generated document link with its intended recipient and perform payment/acceptance only through the eligible document flow.
- **Limits:** Tokens are bearer credentials subject to lifecycle rules. A PDF/export route is not equivalent to public token authorization; never publish real tokens in documentation.
- **Source:** [Quotation](../app/q); [sales order](../app/so); [invoice](../app/i); [vendor bill](../app/vb); [public-link security](SECURITY.md).

