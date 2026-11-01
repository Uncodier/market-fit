/** @jest-environment node */
import { isSameOriginRequest } from '@/lib/http/is-same-origin-request';
import { POST as operation } from '@/app/api/pos/operation/route';
import { POST as cancel } from '@/app/api/pos/checkout-cancel/route';
import { executePosOperation } from '@/app/pos/operation-boundary';
import { cancelPosCheckout } from '@/app/pos/checkout-cancel-boundary';

jest.mock('server-only', () => ({}));
jest.mock('@/app/pos/operation-boundary', () => ({ executePosOperation: jest.fn() }));
jest.mock('@/app/pos/checkout-cancel-boundary', () => ({ cancelPosCheckout: jest.fn() }));

type Case = {
  name: string;
  url?: string;
  host?: string | null;
  origin?: string | null;
  site?: string | null;
  extra?: Record<string, string>;
};
const accepted: Case[] = [
  { name: 'localhost:3000 page with the Next 0.0.0.0:3000 bind URL' },
  { name: 'localhost URL', url: 'http://localhost:3000' },
  { name: 'older browser without fetch metadata', site: null },
  { name: 'exact loopback IPv4', host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
  { name: 'exact loopback IPv6', host: '[::1]:3000', origin: 'http://[::1]:3000' },
  { name: 'case-insensitive Host', host: 'LOCALHOST:3000' },
  { name: 'HTTPS proxy preserving public Host and scheme', url: 'https://internal:3000',
    host: 'pos.example.com', origin: 'https://pos.example.com' },
  { name: 'explicit default HTTPS port', url: 'https://internal:3000',
    host: 'pos.example.com:443', origin: 'https://pos.example.com' },
  { name: 'explicit default HTTP port', host: 'localhost:80', origin: 'http://localhost' },
  { name: 'forwarded headers cannot override a matching Host', extra: {
    'X-Forwarded-Host': 'evil.invalid', 'X-Forwarded-Proto': 'https',
    'X-Forwarded-Port': '443', Forwarded: 'host=evil.invalid;proto=https',
  } },
];
const rejected: Case[] = [
  ...[null, '', 'null', 'http://localhost:3001', 'http://127.0.0.1:3000',
    'http://0.0.0.0:3000', 'http://sub.localhost:3000', 'https://localhost:3000',
    'http://localhost:3000.evil.invalid', 'http://localhost:3000/',
    'http://localhost:3000/path', 'http://localhost:3000?x', 'http://localhost:3000#x',
    'http://user@localhost:3000', 'http://localhost:3000, http://evil.invalid',
    'http://localhost:3000 http://evil.invalid', 'file://localhost:3000',
  ].map(origin => ({ name: `invalid or foreign Origin ${origin}`, origin })),
  ...[null, '', 'evil.invalid:3000', 'localhost:3001', 'localhost:3000,evil.invalid',
    'localhost:3000 evil.invalid', 'user@localhost:3000', 'localhost:3000/path',
    'localhost:3000?x', 'localhost:3000#x', 'localhost:3000\\evil.invalid',
    'localhost:3000:', 'localhost:03000', 'localhost:65536', 'localhost:',
    'localhost%3a3000', 'http://localhost:3000', 'localhost\t:3000',
  ].map(host => ({ name: `invalid or mismatching Host ${host}`, host })),
  ...['', 'same-site', 'cross-site', 'none', 'Same-Origin', 'same-origin, cross-site']
    .map(site => ({ name: `invalid fetch metadata ${site}`, site })),
  { name: 'matching URL cannot rescue mismatching Host', url: 'http://localhost:3000', host: 'evil.invalid' },
  { name: 'forwarded headers cannot rescue rewritten internal Host', host: 'internal:3000', extra: {
    'X-Forwarded-Host': 'localhost:3000', 'X-Forwarded-Proto': 'http',
    'X-Forwarded-Port': '3000', Forwarded: 'host="localhost:3000";proto=http',
  } },
  { name: 'missing Host cannot fall back to URL or forwarding', host: null,
    url: 'http://localhost:3000', extra: { 'X-Forwarded-Host': 'localhost:3000' } },
  { name: 'forwarded proto cannot rescue mismatching URL scheme',
    origin: 'https://localhost:3000', extra: { 'X-Forwarded-Proto': 'https' } },
  { name: 'public sibling is not same-origin', url: 'https://internal:3000',
    host: 'pos.example.com', origin: 'https://shop.example.com' },
  { name: 'public sibling with same-site metadata', url: 'https://internal:3000',
    host: 'pos.example.com', origin: 'https://shop.example.com', site: 'same-site' },
  { name: 'non-HTTP URL', url: 'ftp://localhost:3000' },
];

function request(test: Case, path = 'operation') {
  const headers = new Headers({ 'Content-Type': 'application/json', ...test.extra });
  for (const [key, value] of Object.entries({
    Host: test.host === undefined ? 'localhost:3000' : test.host,
    Origin: test.origin === undefined ? 'http://localhost:3000' : test.origin,
    'Sec-Fetch-Site': test.site === undefined ? 'same-origin' : test.site,
  })) {
    if (value !== null) headers.set(key, value);
  }
  // Deliberately invalid JSON: even accepted origins cannot dispatch an action.
  return new Request(`${test.url ?? 'http://0.0.0.0:3000'}/api/pos/${path}`, {
    method: 'POST', headers, body: '{',
  });
}

it.each(accepted)('helper accepts $name', test => {
  expect(isSameOriginRequest(request(test))).toBe(true);
});
it.each(rejected)('helper rejects $name', test => {
  expect(isSameOriginRequest(request(test))).toBe(false);
});

describe.each([['operation', operation], ['checkout-cancel', cancel]] as const)('%s origin boundary', (path, post) => {
  beforeEach(() => jest.clearAllMocks());
  function noActions() {
    expect(executePosOperation).not.toHaveBeenCalled();
    expect(cancelPosCheckout).not.toHaveBeenCalled();
  }
  it.each(accepted)('accepts $name but rejects invalid JSON before dispatch', async test => {
    const response = await post(request(test, path));
    expect(response.status).toBe(400);
    noActions();
  });
  it.each(rejected)('rejects $name before reading the body or dispatching', async test => {
    const req = request(test, path);
    const response = await post(req);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden POS request origin.' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(req.bodyUsed).toBe(false);
    noActions();
  });
});