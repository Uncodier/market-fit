import { type Locator, type Page } from '@playwright/test';
import { assertReadReady } from './read-assertions';

type Proof = (page: Page) => Locator;
const tab = (name: string): Proof => page => page.getByRole('tab', { name, exact: true }).filter({ visible: true });
const text = (name: string): Proof => page => page.getByText(name, { exact: true }).filter({ visible: true }).first();
const heading = (name: string): Proof => page => page.getByRole('heading', { name, exact: true });
const search = (name: string): Proof => page => page.getByRole('button', { name, exact: true }).filter({ visible: true });

// Locators are grounded in app/<route>/page.tsx and its imported view components.
// These prove rendered read surfaces, not record ownership or correctness of totals.
export const routeProofs: Record<string, Proof> = {
  '/bills': tab('Pending'),
  '/transactions': tab('All'),
  '/purchases/orders': tab('Completed'),
  '/finance': tab('Profit & Loss'),
  '/accounting/entries': tab('Opening'),
  '/costs': heading('Costs'),
  '/campaigns': tab('Drafts'),
  '/segments': tab('All Segments'),
  '/promotions': tab('Expired'),
  '/content': search('Search content...'),
  '/assets': tab('Images'),
  '/pos': page => page.getByPlaceholder('New Order'),
  '/catalog': tab('All Items'),
  '/price-lists': search('Search price lists...'),
  '/subscriptions': tab('Expired'),
  '/sales': tab('All Sales'),
  '/leads': tab('All Companies'),
  '/deals': tab('All Deals'),
  '/quotations': tab('Accepted'),
  '/people': page => page.getByRole('button', { name: 'Search', exact: true }),
  '/chat': page => page.getByPlaceholder('Search conversations...'),
  '/records': tab('Team Member'),
  '/orders': tab('Completed Orders'),
  '/shipments': tab('In Transit'),
  '/control-center': search('Search'),
  '/reservations': tab('By Date'),
  '/visits': heading('Register your visit'),
  '/inventory': tab('Stock Levels'),
  '/settings': page => page.locator('#settings-form'),
  '/integrations': heading('Outbound Webhooks'),
  '/billing': tab('Billing Info'),
  '/applications/database': search('Search databases...'),
  '/applications/repositories': search('Search repositories...'),
  '/agents': heading('Growth Team Structure'),
  '/requirements': search('Search requirements...'),
  '/pos/check-in': page => page.getByPlaceholder('Enter code...'),
  '/purchases/subscriptions': search('Search subscriptions...'),
  '/purchases/quotes': tab('Pending Review'),
  '/purchases/library': search('Search library...'),
  '/context': page => page.locator('#context-form #brand-essence'),
  '/skills?tab=makinari-skills': heading('Code agent skills'),
  '/robots?mode=workflow': page => page.getByRole('button', { name: 'Trigger', exact: true }),
  '/robots?mode=imprenta': page => page.getByRole('button', { name: 'Fit to screen', exact: true }),
  '/accounting': tab('Asset'),
  '/payments': text('Total Usable Credits'),
  '/security': page => page.getByRole('heading', { name: 'Two-Factor Authentication', exact: true }),
  '/profile': page => page.getByPlaceholder('Your name'),
  '/notifications': tab('Unread'),
  '/navigation': heading('Marketing'),
  '/dashboard': text('Performance Metrics'),
  '/dashboard?tab=performance': text('Performance Metrics'),
  '/dashboard?tab=overview': text('Recent commercial activity'),
  '/dashboard?tab=analytics': text('Clients by Segment'),
  '/dashboard?tab=traffic': text('Top Visited Pages'),
  '/dashboard?tab=sales': text('Total Sales'),
  '/dashboard?tab=social': text('By Network'),
};

export async function assertReadRoute(page: Page, route: string): Promise<void> {
  const proof = routeProofs[route];
  if (!proof) throw new Error(`No positive read proof registered for ${route}`);
  await assertReadReady(page, route, proof(page));
}