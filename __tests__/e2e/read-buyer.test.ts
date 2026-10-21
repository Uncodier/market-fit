import type { Page } from '@playwright/test';
import { localeMessages } from '../../app/context/locale-catalog';
import type { SupportedLocale } from '../../app/context/locale-preferences';
import { assertBuyerRead } from '../../tests/support/read-buyer';

// Only the Playwright adapter is simulated. No app server or live API is mocked.
jest.mock('@playwright/test', () => ({
  expect: (value: DomLocator | { url: () => string }) => ({
    toHaveURL: async (predicate: (url: URL) => boolean) => expect(predicate(new URL((value as Page).url()))).toBe(true),
    toBeVisible: async () => retry(() => expect((value as DomLocator).elements().some(visible)).toBe(true)),
    toHaveCount: async (count: number) => retry(() => expect((value as DomLocator).elements()).toHaveLength(count)),
    toHaveAttribute: async (name: string, pattern: RegExp) => retry(() => {
      expect(pattern.test((value as DomLocator).elements()[0]?.getAttribute(name) ?? '')).toBe(true);
    }),
  }),
}));

let frames: (() => void)[] = [];
let advances = 0;
function retry(assertion: () => void) {
  for (;;) {
    try { assertion(); return; } catch (error) {
      const next = frames.shift();
      if (!next) throw error;
      advances++;
      next();
    }
  }
}
function visible(element: Element): boolean {
  return !element.closest('[hidden], [style="display:none"]') &&
    !document.documentElement.classList.contains('locale-pending');
}
const roles: Record<string, string> = { main: 'main, [role="main"]', button: 'button, [role="button"]', table: 'table, [role="table"]' };
const matches = (actual: string, expected: string | RegExp, exact?: boolean) =>
  typeof expected === 'string' ? (exact ? actual === expected : actual.includes(expected)) : expected.test(actual);

/** Lazy DOM queries preserve html gating, exact names/text, unions and visibility. */
class DomLocator {
  constructor(readonly elements: () => Element[]) {}
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }) {
    return new DomLocator(() => this.elements().flatMap(root => Array.from(root.querySelectorAll(roles[role])))
      .filter(element => options?.name === undefined || matches(
        element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '', options.name, options.exact,
      )));
  }
  getByText(value: string | RegExp, options?: { exact?: boolean }) {
    return new DomLocator(() => this.elements().flatMap(root => Array.from(root.querySelectorAll('*')))
      .filter(element => matches(element.textContent?.trim() ?? '', value, options?.exact) &&
        !Array.from(element.children).some(child => matches(child.textContent?.trim() ?? '', value, options?.exact))));
  }
  or(other: DomLocator) { return new DomLocator(() => [...new Set([...this.elements(), ...other.elements()])]); }
  filter() { return new DomLocator(() => this.elements().filter(visible)); }
  first() { return new DomLocator(() => this.elements().slice(0, 1)); }
}

const origin = 'http://localhost:3100';
const email = 'buyer@example.test';
function pageAt(route: string, url = `${origin}${route}`): Page {
  const root = new DomLocator(() => [document.documentElement]);
  return {
    url: () => url,
    getByRole: root.getByRole.bind(root),
    getByText: root.getByText.bind(root),
    locator: (selector: string) => new DomLocator(() => Array.from(document.querySelectorAll(selector.replace(/:visible/g, '')))
      .filter(element => !selector.includes(':visible') || visible(element))),
  } as unknown as Page;
}
function render(locale: string, content: string, extra = '') {
  document.documentElement.lang = locale;
  document.documentElement.className = '';
  document.body.innerHTML = `<main>${content}</main>${extra}`;
}
function text(value: string, tag = 'h3') {
  const element = document.createElement(tag);
  element.textContent = value;
  return element.outerHTML;
}
const locales = Object.keys(localeMessages) as SupportedLocale[];
const emptyKeys = {
  '/buyer/orders': 'buyer.orders.empty.title',
  '/buyer/quotes': 'buyer.quotes.empty.title',
  '/buyer/subscriptions': 'buyer.subscriptions.empty.title',
  '/buyer/library': 'buyer.library.empty.title',
};
const envNames = ['TEST_BASE_URL', 'TEST_COMMERCE_BASE_URL', 'TEST_BUYER_EMAIL'] as const;
const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
beforeEach(() => {
  process.env.TEST_BASE_URL = 'http://localhost:3000';
  process.env.TEST_COMMERCE_BASE_URL = origin;
  process.env.TEST_BUYER_EMAIL = email;
  frames = [];
  advances = 0;
  render('en', '');
});
afterAll(() => {
  for (const name of envNames) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
});

describe.each(locales)('Buyer exact read proofs in %s', locale => {
  const dictionary = localeMessages[locale];
  it.each(Object.entries(emptyKeys))('accepts completed empty %s', async (route, key) => {
    render(locale, text(dictionary[key]));
    await expect(assertBuyerRead(pageAt(route), route)).resolves.toBeUndefined();
  });
  it('accepts populated orders', async () => {
    render(locale, text(dictionary['buyer.orders.viewPurchase'], 'button'));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).resolves.toBeUndefined();
  });
  it('accepts populated quotes', async () => {
    render(locale, '<table><tbody><tr><td>Quote fixture</td></tr></tbody></table>');
    await expect(assertBuyerRead(pageAt('/buyer/quotes'), '/buyer/quotes')).resolves.toBeUndefined();
  });
  it('accepts populated subscriptions', async () => {
    render(locale, text(dictionary['buyer.subscriptions.table.nextBilling'], 'span'));
    await expect(assertBuyerRead(pageAt('/buyer/subscriptions'), '/buyer/subscriptions')).resolves.toBeUndefined();
  });
  it.each(['course', 'ticket', 'file', 'book', 'access'])('accepts populated library action %s', async action => {
    render(locale, text(dictionary[`buyer.library.actions.${action}`], 'button'));
    await expect(assertBuyerRead(pageAt('/buyer/library'), '/buyer/library')).resolves.toBeUndefined();
  });
  it.each(['/buyer', '/buyer/profile'])('requires exact configured email on %s', async route => {
    render(locale, text(email, 'p'));
    await expect(assertBuyerRead(pageAt(route), route)).resolves.toBeUndefined();
    render(locale, text('another@example.test', 'p'));
    await expect(assertBuyerRead(pageAt(route), route)).rejects.toThrow();
  });
  it.each(Object.entries(emptyKeys))('rejects translated read errors beside positive %s proof', async (route, key) => {
    const errorKey = key.replace('empty.title', 'errorLoading');
    render(locale, text(dictionary[key]) + text(dictionary[errorKey], 'p'));
    await expect(assertBuyerRead(pageAt(route), route)).rejects.toThrow();
  });
  it('rejects translated home failure even with the configured email', async () => {
    render(locale, text(email, 'p') + text(dictionary['buyer.home.failedToLoad'], 'p'));
    await expect(assertBuyerRead(pageAt('/buyer'), '/buyer')).rejects.toThrow();
  });
  it('rejects translated loading beside positive content', async () => {
    render(locale, text(dictionary['buyer.orders.empty.title']) + text(dictionary['buyer.layout.loading'], 'p'));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
});

describe('Buyer hydration and dictionary behavior', () => {
  it.each([
    ['en', 'es'], ['es', 'en'], ['en', 'fr'], ['fr', 'de'], ['de', 'ja'],
  ])('re-resolves %s to %s during the positive proof wait', async (initial, final) => {
    render(initial, '');
    frames.push(() => render(final, text(localeMessages[final as SupportedLocale]['buyer.orders.empty.title'])));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).resolves.toBeUndefined();
    expect(advances).toBe(1);
    expect(document.documentElement.lang).toBe(final);
  });
  it('waits through the cookie bootstrap locale-pending class', async () => {
    render('es', text(localeMessages.en['buyer.orders.empty.title']));
    document.documentElement.classList.add('locale-pending');
    frames.push(() => render('es', text(localeMessages.es['buyer.orders.empty.title'])));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).resolves.toBeUndefined();
    expect(advances).toBe(1);
  });
  it('does not freeze lang when it changes during the loading gate', async () => {
    render('en', text(localeMessages.en['buyer.orders.empty.title']) + '<div class="animate-pulse"></div>');
    frames.push(() => render('es', text(localeMessages.es['buyer.orders.empty.title'])));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).resolves.toBeUndefined();
    expect(advances).toBe(1);
  });
  it('rejects stale English copy after lang changes during loading', async () => {
    render('en', text(localeMessages.en['buyer.orders.empty.title']) + '<div class="animate-pulse"></div>');
    frames.push(() => render('es', text(localeMessages.en['buyer.orders.empty.title'])));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
  it('uses existing catalog fallback, not invented translations or key-as-proof', async () => {
    const key = 'buyer.orders.empty.title';
    const saved = localeMessages.fr[key];
    try {
      delete localeMessages.fr[key];
      render('fr', text(localeMessages.en[key]));
      await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).resolves.toBeUndefined();
      render('fr', text(key));
      await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
    } finally { localeMessages.fr[key] = saved; }
  });
  it('treats punctuation as literal button text, not regex syntax', async () => {
    const key = 'buyer.library.actions.access';
    const saved = localeMessages.fr[key];
    try {
      localeMessages.fr[key] = 'Access (A+B)?';
      render('fr', text('Access (A+B)?', 'button'));
      await expect(assertBuyerRead(pageAt('/buyer/library'), '/buyer/library')).resolves.toBeUndefined();
      render('fr', text('Access AAB', 'button'));
      await expect(assertBuyerRead(pageAt('/buyer/library'), '/buyer/library')).rejects.toThrow();
    } finally { localeMessages.fr[key] = saved; }
  });
});

describe('Buyer reads remain fail-closed', () => {
  it('pins the confirmed Spanish saved-run strings', () => {
    expect(localeMessages.es['buyer.orders.empty.title']).toBe('No se encontraron compras');
    expect(localeMessages.es['buyer.orders.viewPurchase']).toBe('Ver compra');
  });
  it.each(['', 'pt', 'es-MX', 'constructor'])('rejects missing/unsupported html lang %j', async locale => {
    render(locale, text(localeMessages.en['buyer.orders.empty.title']));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
  it.each(['http://localhost:3100/auth', 'http://localhost:3100/buyer/quotes', 'http://localhost:3000/buyer/orders'])(
    'rejects redirect/wrong route/wrong host %s', async url => {
      render('es', text(localeMessages.es['buyer.orders.empty.title']));
      await expect(assertBuyerRead(pageAt('/buyer/orders', url), '/buyer/orders')).rejects.toThrow();
    },
  );
  it.each(['', 'invalid', 'buyer example.test'])('rejects missing/invalid identity %j', async value => {
    process.env.TEST_BUYER_EMAIL = value;
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow('TEST_BUYER_EMAIL');
  });
  it('rejects an unknown route', async () => {
    await expect(assertBuyerRead(pageAt('/buyer/unknown'), '/buyer/unknown')).rejects.toThrow('Unknown buyer read route');
  });
  it.each([
    '', '<h1>Purchases</h1><input placeholder="Search purchases...">',
    '<h3>No se encontraron compras today</h3>', '<button>Ver compra now</button>',
    '<p>Ver compra</p>', '<h3 hidden>No se encontraron compras</h3>',
    '<h3>No purchases found</h3>',
  ])('rejects shell/partial/non-button/hidden/wrong-locale proof %s', async content => {
    render('es', content);
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
  it('rejects proof outside main', async () => {
    render('es', '', text(localeMessages.es['buyer.orders.empty.title']));
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
  it('rejects a hidden main', async () => {
    render('es', text(localeMessages.es['buyer.orders.empty.title']));
    document.querySelector('main')!.hidden = true;
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
  it.each([
    '<div class="animate-pulse"></div>', '<div aria-busy="true"></div>', '<p>Loading...</p>',
    '<p>Searching…</p>', '<div data-sonner-toast data-type="error">Failure</div>',
    '<p>Application error</p>', '<p>Access denied</p>', '<p>Error loading orders</p>',
    '<p>注文の読み込みエラー</p>',
  ])('rejects loading/toast/general or mixed-locale error beside proof: %s', async failure => {
    render('es', text(localeMessages.es['buyer.orders.empty.title']) + failure);
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
  it('rejects permanently pending locale hydration', async () => {
    render('es', text(localeMessages.es['buyer.orders.empty.title']));
    document.documentElement.classList.add('locale-pending');
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).rejects.toThrow();
  });
  it('ignores hidden failures and selects visible proof among repeated purchases', async () => {
    render('es', text(localeMessages.es['buyer.orders.viewPurchase'], 'button') +
      text(localeMessages.es['buyer.orders.viewPurchase'], 'button') + '<p hidden>Error loading orders</p>');
    document.querySelector('button')!.hidden = true;
    await expect(assertBuyerRead(pageAt('/buyer/orders'), '/buyer/orders')).resolves.toBeUndefined();
  });
});
