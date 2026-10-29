/** @jest-environment node */
import { POST } from '@/app/api/pos/checkout-cancel/route';
import { cancelPosCheckout } from '@/app/pos/checkout-cancel-boundary';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { lookupCurrentUserSiteRole } from '@/lib/auth/site-role-lookup';
import { canAccessUnscopedSite } from '@/lib/permissions/location-boundary';
import { ids } from '../security/isolated-postgres';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }));
jest.mock('@/lib/auth/site-role-lookup', () => ({
  lookupCurrentUserSiteRole: jest.fn(), SiteRoleLookupError: class extends Error {},
}));
jest.mock('@/lib/permissions/location-boundary', () => ({ canAccessUnscopedSite: jest.fn() }));

const getUser = jest.fn();
const rpc = jest.fn();
const input = { siteId: ids.site, clientMutationId: 'original-checkout', reason: ' Customer changed their mind. ' };
const headers = { Origin: 'http://localhost', 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' };
const request = (body: unknown = input, overrides: Record<string, string> = {}) => new Request(
  'http://localhost/api/pos/checkout-cancel', {
    method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify(body),
  },
);
const noService = () => {
  expect(createServiceClient).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never);
  getUser.mockResolvedValue({ data: { user: { id: ids.owner } }, error: null });
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue('owner');
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(true);
  jest.mocked(createServiceClient).mockResolvedValue({ rpc } as never);
  rpc.mockResolvedValue({ data: { state: 'rejected', orderId: null, saleId: null }, error: null });
});

it.each(['owner', 'admin', 'collaborator'])('authorizes %s before service access and returns the recovery contract', async role => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(role);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: {
    state: 'rejected', orderId: null, saleId: null,
    message: expect.stringContaining('Operation cancelled'),
  } });
  expect(createClient).toHaveBeenCalledWith(true);
  expect(lookupCurrentUserSiteRole).toHaveBeenCalledWith(expect.anything(), ids.site);
  expect(canAccessUnscopedSite).toHaveBeenCalledWith(expect.anything(), ids.site);
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: 'workspace' });
  expect(jest.mocked(canAccessUnscopedSite).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0]);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('pos_checkout_cancel', {
    p_site_id: ids.site, p_mutation_id: input.clientMutationId, p_actor_id: ids.owner, p_reason: input.reason,
  });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
});

it.each([null, 'marketing', 'viewer'])('denies absent membership or role %p', async role => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(role);
  expect((await POST(request())).status).toBe(403);
  noService();
});

it('requires an authenticated session', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request())).status).toBe(401);
  noService();
});

it('fails closed for a location-restricted actor', async () => {
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(false);
  expect((await POST(request())).status).toBe(403);
  noService();
});

it.each([
  null, [], {}, { ...input, siteId: 'demo-site' }, { ...input, clientMutationId: '' },
  { ...input, clientMutationId: 'x'.repeat(129) }, { ...input, reason: '' },
  { ...input, reason: ' \n\t ' }, { ...input, reason: 'x'.repeat(501) },
  { ...input, reason: null }, { ...input, actorId: ids.foreign }, { ...input, ownerToken: ids.owner },
  { ...input, payments: [] }, { ...input, existingOrderId: ids.purchase },
])('strictly rejects malformed or additional input %p', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
  noService();
});

it('accepts the exact length bounds without altering the reason', async () => {
  expect((await cancelPosCheckout({ ...input, clientMutationId: 'x', reason: 'a' })).status).toBe(200);
  expect((await cancelPosCheckout({ ...input, clientMutationId: 'x'.repeat(128), reason: 'a'.repeat(500) })).status).toBe(200);
});

it.each(['', 'null', 'https://attacker.invalid', 'http://sub.localhost', 'http://localhost:3000'])(
  'denies missing or foreign origin %p without trusting forwarding headers', async origin => {
    expect((await POST(request(input, { Origin: origin, 'X-Forwarded-Host': 'attacker.invalid' }))).status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
    noService();
  },
);
it.each(['same-site', 'cross-site', 'none'])('denies fetch site %s', async site => {
  expect((await POST(request(input, { 'Sec-Fetch-Site': site }))).status).toBe(403);
  noService();
});
it.each(['', 'text/plain', 'application/x-www-form-urlencoded'])('denies content type %p', async type => {
  expect((await POST(request(input, { 'Content-Type': type }))).status).toBe(415);
  noService();
});
it('accepts JSON parameters and absent fetch metadata for same-origin clients', async () => {
  const req = request(input, { 'Content-Type': 'Application/JSON; charset=utf-8' });
  req.headers.delete('sec-fetch-site');
  expect((await POST(req)).status).toBe(200);
});
it('rejects malformed JSON', async () => {
  expect((await POST(new Request('http://localhost/api/pos/checkout-cancel', {
    method: 'POST', headers, body: '{',
  }))).status).toBe(400);
  noService();
});
it.each<Record<string, string>>([{}, { 'Content-Length': '32769' }, { 'Content-Length': '1' }])('bounds actual and declared body size %p', async extra => {
  const response = await POST(request({ ...input, reason: 'x'.repeat(32769) }, extra));
  expect(response.status).toBe(413);
  expect(createClient).not.toHaveBeenCalled();
  noService();
});

it.each(['not_found', 'processing', 'writes_started', 'completed', 'review_required'])(
  'returns conflict for %s, never a successful cancellation', async state => {
    rpc.mockResolvedValue({ data: { state }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: expect.any(String), cancellationState: state });
  },
);
it.each([{ data: { state: 'identity_conflict' } }, { error: { code: '42501', message: 'private SQL' } }])(
  'denies a foreign actor or revoked database permission', async outcome => {
    rpc.mockResolvedValue(outcome);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden checkout cancellation.' });
  },
);
it.each([{ data: null }, { data: { state: 'cancelled' } }, { error: { code: 'PGRST202', message: 'private SQL' } }])(
  'fails closed on unavailable RPC or invalid output', async outcome => {
    rpc.mockResolvedValue(outcome);
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.stringContaining('Unable to confirm') });
  },
);
it('treats a lost response as ambiguous and permits an explicit idempotent retry', async () => {
  rpc.mockRejectedValueOnce(new Error('private transport error'));
  expect((await POST(request())).status).toBe(500);
  expect((await POST(request())).status).toBe(200);
  expect((await POST(request({ ...input, reason: 'Different reason on retry' }))).status).toBe(200);
});