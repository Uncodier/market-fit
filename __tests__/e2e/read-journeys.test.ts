/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { routeProofs } from '../../tests/support/read-navigation';

const root = path.join(process.cwd(), 'tests');
const files = [
  ...fs.readdirSync(root).filter(name => name.endsWith('navigation.test.yaml')),
  ...['dashboard-reports', 'context-tabs', 'security-tabs', 'skills-read', 'read-person',
    'browser-quality-mobile', 'check-in-validation', 'crud-inventory-item', 'crud-order',
    'crud-reservation', 'crud-shipment', 'finance-read-flows', 'formal-navigation-gaps'].map(name => `${name}.test.yaml`),
];
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
type Step = { description?: string; js?: string; VERIFY?: string; WAIT_UNTIL?: string; URL?: string };
const steps = (file: string): Step[] => parse(read(file)).statements;

describe('read-only YAML regression contracts', () => {
  it.each(files)('%s has hard assertions, not negative-title or wait-only success', file => {
    const source = read(file);
    expect(source).not.toMatch(/not\.toHaveTitle|first available project|name: ['"]Select['"]|WAIT_UNTIL:/);
    expect(source).not.toMatch(/^\s+- VERIFY:/m);
    expect(steps(file).some(step => step.description && step.js?.includes('assertRead'))).toBe(true);
    expect(steps(file).at(-1)?.js).toContain('await assertReadObservation(page)');
    expect(source.split('\n').length).toBeLessThan(500);
  });

  it.each(files.filter(file => !['buyer-navigation.test.yaml', 'public-commerce-navigation.test.yaml'].includes(file)))(
    '%s uses the shared exact-name/validated-ID workspace helper', file => {
      expect(read(file)).toContain("require(process.cwd() + '/tests/support/workspace')");
      expect(read(file)).toContain('await selectWorkspace(page)');
    },
  );

  it.each(files)('%s uses a registered positive route proof', file => {
    for (const step of steps(file)) {
      const matches = step.js?.matchAll(/assertReadRoute\(page, '([^']+)'\)/g) ?? [];
      for (const match of matches) expect(routeProofs[match[1]]).toBeInstanceOf(Function);
    }
  });

  it('requires named commerce fixtures and actually empty checkout content', () => {
    const source = read('public-commerce-navigation.test.yaml');
    for (const name of ['TEST_SHOP_SLUG', 'TEST_CATALOG_ITEM_ID', 'TEST_CATALOG_ITEM_NAME', 'TEST_COMMERCE_BASE_URL']) {
      expect(source).toContain(name);
    }
    expect(source).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(source).toContain("name: 'Checkout empty'");
    expect(source).toContain('catalogItemLink(page, `/shop/${slug}/${itemId}`, itemName)');
    for (const step of steps('public-commerce-navigation.test.yaml').filter(step => step.js?.includes('page.goto'))) {
      expect(step.js).toContain('commerceUrl(');
      expect(step.js).toContain('assertReadReady(');
    }
  });

  it('requires buyer identity and positive list/empty outcomes, not ownership claims', () => {
    const source = read('buyer-navigation.test.yaml');
    expect(source).toContain("requiredReadFixture('TEST_BUYER_EMAIL')");
    expect(source.indexOf("commerceUrl('/buyer/profile')")).toBeLessThan(source.indexOf("commerceUrl('/buyer/orders')"));
    expect(source).toContain('await assertBuyerRead(');
    expect(source).not.toContain('input[name="email"]');
    expect(source).toContain('without claiming record ownership isolation');
  });

  it('requires successful People requests and a completed result, with shared consent handling', () => {
    expect(read('read-person.test.yaml')).toContain('await searchPeopleAndAssertResults(page)');
    expect(read('sales-navigation.test.yaml')).toContain('await searchPeopleAndAssertResults(page)');
    const helper = fs.readFileSync(path.join(root, 'support/read-people.ts'), 'utf8');
    expect(helper).toContain('await dismissConsent(page)');
    expect(helper).toContain("page.waitForResponse(matches('')");
    expect(helper).toContain("page.waitForResponse(matches('/totals')");
    expect(helper).toContain("getByText('No results', { exact: true })");
    expect(helper).not.toContain("getByText('Find the right people'");
  });

  it('uses the current built-in skills route and never the Company loading skeleton', () => {
    expect(read('skills-read.test.yaml')).toContain('/skills?tab=makinari-skills');
    expect(read('context-tabs.test.yaml')).toContain("#context-form #ai-focus-mode");
    expect(read('uncovered-admin-navigation.test.yaml')).not.toContain("name: 'Company'");
  });

  it('rejects check-in success/offline toasts instead of accepting any notification', () => {
    const source = read('check-in-validation.test.yaml');
    expect(source).toContain('data-type="error"');
    expect(source).toContain('/^Invalid code$/');
    expect(source).toContain('data-type="success"');
    expect(source).toContain('toHaveValue(\'\')');
  });

  it('hard-gates mobile focus, overflow and keyboard behavior without deleting the app DOM', () => {
    const source = read('browser-quality-mobile.test.yaml');
    expect(source).toContain('page.viewportSize()?.width');
    expect(source).toContain('toBeLessThan(768)');
    expect(source).toContain('scrollWidth <= document.documentElement.clientWidth');
    expect(source).toContain('toBeFocused()');
    expect(source).not.toContain('?.remove()');
    expect(source).toContain("requiredReadFixture('TEST_BASE_URL')");
    expect(source).toContain("commerceUrl('/marketplace')");
  });
});