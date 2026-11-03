'use strict';

// Requirement archetypes, not copies of customer records or DB seed payloads.
const CASES = [
  {
    id: 'existing-landing-polish', requirementType: 'develop', changeKind: 'design',
    title: 'Polish an existing landing without changing its commercial identity',
    request: 'Improve the existing Cedar Workshop landing page: make the hero and plan cards easier to scan, fix mobile spacing and overflow, and make the primary call to action clearly visible and keyboard accessible. Keep the Cedar Workshop name, logo, brand colors, existing copy, plan prices and billing periods exactly as they are. Keep the current CTA destination and all existing routes. Modify the existing app rather than replacing it.',
    changeChecks: ['mobile-layout', 'hero-and-plan-hierarchy', 'keyboard-cta'],
    preservationChecks: ['branding-unchanged', 'prices-and-periods-unchanged', 'cta-destination-unchanged', 'existing-routes-work'],
  },
  {
    id: 'existing-bug-repair', requirementType: 'develop', changeKind: 'bug',
    title: 'Repair an existing cart quantity bug',
    request: 'In the existing Cedar Workshop app, changing a cart item from quantity one to two leaves the subtotal at the old amount. Reproduce this through the existing cart UI, repair the calculation and ensure decreasing quantity and removing an item also update the total. Keep the existing catalog prices, currency, rounding rules, branding, cart persistence and checkout destination. Do not replace the cart or bypass its real state logic.',
    changeChecks: ['increase-quantity-total', 'decrease-quantity-total', 'remove-item-total'],
    preservationChecks: ['branding-unchanged', 'catalog-prices-unchanged', 'currency-and-rounding-unchanged', 'cart-persists', 'checkout-destination-unchanged'],
  },
  {
    id: 'existing-feature-extension', requirementType: 'develop', changeKind: 'feature',
    title: 'Extend the existing catalog with a category filter',
    request: 'Add a keyboard-accessible category filter to the existing Cedar Workshop catalog, using the categories already present in its local catalog data. Selecting a category should show only its items; All should restore the full list, and an empty category should have a clear empty state. Keep existing item links, displayed prices, cart actions, branding and routes. Extend the existing catalog components; do not create a replacement app, change its data model or add external services.',
    changeChecks: ['category-results', 'all-restores-list', 'empty-category-state', 'keyboard-filter'],
    preservationChecks: ['branding-unchanged', 'catalog-prices-unchanged', 'item-links-work', 'existing-cart-actions-work', 'existing-routes-work'],
  },
];

const safety = 'Use only the explicitly approved disposable existing app. Do not push, deploy, install dependencies, provision services, make payments, contact third parties or change another app. Persist this request against the existing requirement and hand it to the normal requirement cron. Acknowledgement or updating instructions alone is not completion. Report unavailable execution honestly; do not resubmit an ambiguous command.';

function existingAppCases() {
  return CASES.map(spec => ({ ...spec, request: `${spec.request}\n${safety}`,
    intake: 'interactive-assistant', execution: 'requirement-cron',
    changeChecks: [...spec.changeChecks], preservationChecks: [...spec.preservationChecks] }));
}

module.exports = { existingAppCases };