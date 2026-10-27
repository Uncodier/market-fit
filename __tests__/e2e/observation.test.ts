/** @jest-environment node */
import { hasApplicationError, isUnexpectedHttp, safeEndpoint } from '../../tests/support/read-observation';
import { invalidJsonDiagnostics } from '../../tests/support/read-observation';
import { createHash } from 'node:crypto';

describe('read observations do not mistake UI visibility for dependency health', () => {
  it.each([503, 500, 403, 404, 429])('records unexpected API status %s', status => {
    expect(isUnexpectedHttp(status, 'https://app.makinari.com/api/trends/google')).toBe(true);
  });
  it('allows intentional public document 404s but not database read failures', () => {
    expect(isUnexpectedHttp(404, 'https://app.makinari.com/q/invalid')).toBe(false);
    expect(isUnexpectedHttp(400, 'https://db.example.com/rest/v1/records')).toBe(true);
    expect(isUnexpectedHttp(200, 'https://app.makinari.com/api/data')).toBe(false);
  });
  it('does not expose tokens, query strings, fragment identities or UUIDs', () => {
    expect(safeEndpoint('https://app.makinari.com/q/private-token?email=a%40b.com#secret')).toEqual({ origin: 'https://app.makinari.com', path: '/public-document/[redacted]' });
    expect(safeEndpoint('https://app.makinari.com/api/records/11111111-1111-4111-8111-111111111111').path).toBe('/api/records/[id]');
  });
  it('does not accept error payloads hidden behind HTTP 200', () => {
    expect(hasApplicationError('{"success":false}', 'application/json')).toBe(true);
    expect(hasApplicationError('{"error":"provider unavailable"}', 'application/json')).toBe(true);
    expect(hasApplicationError('{"error":null,"data":[]}', 'application/json')).toBe(false);
    expect(hasApplicationError('[]', 'application/json')).toBe(false);
    expect(hasApplicationError('1:E{"digest":"redacted"}', 'text/x-component')).toBe(true);
    expect(hasApplicationError('0:{"a":"$@1"}\n1:{"error":"Permission denied"}', 'text/x-component')).toBe(true);
    expect(hasApplicationError('1:{"error":"Invalid code"}', 'text/x-component', 'Invalid code')).toBe(false);
    expect(hasApplicationError('1:{"error":"Permission denied"}', 'text/x-component', 'Invalid code')).toBe(true);
    expect(hasApplicationError('1:E{"error":"Invalid code"}', 'text/x-component', 'Invalid code')).toBe(true);
    expect(hasApplicationError('1:{"name":"E{ ordinary text"}', 'text/x-component')).toBe(false);
  });
  it('accepts valid rates JSON without producing diagnostics', () => {
    const body = JSON.stringify({ base: 'USD', rates: { USD: 1, EUR: 0.92 }, date: '2030-01-01' });
    expect(hasApplicationError(body, 'application/json')).toBe(false);
    expect(invalidJsonDiagnostics(body, 'application/json')).toEqual({});
  });
  it.each(['', '<Buffer>', '{"private":"é",', '\uFFFD\uFFFD'])('fingerprints invalid decoded JSON without content: %j', body => {
    const diagnostics = invalidJsonDiagnostics(body, 'application/json; charset=utf-8; private=secret');
    expect(hasApplicationError(body, 'application/json')).toBe(true);
    expect(diagnostics).toEqual({ contentType: 'application/json',
      bodyLength: Buffer.byteLength(body, 'utf8'), bodyHash: createHash('sha256').update(body, 'utf8').digest('hex'),
      parseClassification: 'invalid-json', bodyRepresentation: 'response-text-utf8' });
    expect(Object.keys(diagnostics)).not.toContain('body');
    expect(JSON.stringify(diagnostics)).not.toContain('secret');
  });
  it('does not fingerprint valid error JSON or Flight streams', () => {
    expect(invalidJsonDiagnostics('{"error":"private message"}', 'application/json')).toEqual({});
    expect(invalidJsonDiagnostics('1:E{"digest":"private"}', 'text/x-component')).toEqual({});
  });
});