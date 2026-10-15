const path = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');

const failure = (code, status = null) => ({ ready: false, code, httpStatus: status });
function httpStatus(error) {
  const value = Number(error?.response?.status ?? error?.response?.statusCode ?? error?.status);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : null;
}

/** An empty, random tag filter proves read authorization without fetching unrelated work.
 * Credentials must be complete: the SDK must never infer/create a default project.
 */
async function probeSandboxAccess(settings, overrides = {}) {
  const { token, teamId, projectId } = settings.credentials || {};
  if (![token, teamId, projectId].every(value => typeof value === 'string' && value.trim())) return failure('SANDBOX_CONFIGURATION_MISSING');
  const signal = AbortSignal.timeout(10000);
  let attempts = 0;
  try {
    const sdk = overrides.Sandbox || createRequire(path.join(settings.apiRoot, 'package.json'))('@vercel/sandbox').Sandbox;
    const request = overrides.fetch || fetch;
    const result = await sdk.list({ token, teamId, projectId, limit: 1,
      tags: { harnessE2ePreflight: randomUUID() }, signal,
      fetch: (url, init) => {
        // Defense in depth against scope inference, SDK writes and unbounded retries.
        const target = new URL(typeof url === 'string' || url instanceof URL ? url : url.url);
        const method = init?.method || url?.method || 'GET';
        // SDK 3.x uses vercel.com/api, not the deployment API origin.
        const endpoint = (target.origin === 'https://vercel.com' && target.pathname === '/api/v2/sandboxes') ||
          (target.origin === 'https://api.vercel.com' && target.pathname === '/v2/sandboxes');
        if (attempts++ !== 0 || method !== 'GET' || !endpoint || target.username || target.password) throw new Error('Unexpected provider probe request');
        return request(url, { ...init, redirect: 'error', signal });
      } });
    if (!Array.isArray(result?.sandboxes)) return failure('SANDBOX_RESPONSE_INVALID');
    return { ready: true, code: 'SANDBOX_READ_AUTHORIZED', httpStatus: 200 };
  } catch (error) { return failure('SANDBOX_ACCESS_UNAVAILABLE', httpStatus(error)); }
}

module.exports = { probeSandboxAccess };