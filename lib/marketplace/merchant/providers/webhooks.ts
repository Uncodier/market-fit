import 'server-only';
import { randomBytes } from 'node:crypto';
import { MarketplaceProviderError } from '../../providers/types';
import { array, id, object } from '../../providers/validation';
import { applicationUrl, bearer, failConfiguration, jsonBody, rappiAppRequest, rappiIntegration } from './common';
import { getMerchantStoreStatus } from './stores';
import type { AppConfig, RappiOrderWebhookEvent, RappiWebhookRegistrationOptions, RappiWebhookSecrets } from './types';

export const RAPPI_ORDER_WEBHOOK_EVENTS: readonly RappiOrderWebhookEvent[] = [
  'NEW_ORDER', 'NEW_ORDER_SCHEDULED', 'NEW_ORDER_SCHEDULED_CANCELLED',
  'ORDER_EVENT_CANCEL', 'ORDER_OTHER_EVENT', 'ORDER_RT_TRACKING',
];

function registration(value: unknown, event: string): Record<string, unknown>[] {
  const payload = object(value);
  if (payload.event !== event) throw new MarketplaceProviderError('invalid_response', 'Unexpected Rappi webhook event.');
  const stores = array(payload.stores).map(value => object(value));
  for (const store of stores) {
    id(store.store_id);
    if (typeof store.url !== 'string' || !['ENABLE', 'DISABLE'].includes(String(store.state))) {
      throw new MarketplaceProviderError('invalid_response', 'Invalid Rappi webhook registration.');
    }
  }
  if (new Set(stores.map(store => store.store_id)).size !== stores.length) {
    throw new MarketplaceProviderError('invalid_response', 'Duplicate Rappi webhook stores.');
  }
  return stores;
}

function verifyStoreRegistration(value: unknown, event: string, storeId: string, webhookUrl: string): void {
  const stores = registration(value, event);
  if (!stores.some(store => store.store_id === storeId && store.url === webhookUrl && store.state === 'ENABLE')) {
    throw new MarketplaceProviderError('invalid_response', 'Rappi did not register the requested store webhook.');
  }
}

/**
 * Caller MUST serialize across the entire app/environment registry, including countries. Never reset secrets.
 * GET does not reveal existing secrets: missing encrypted registry entries fail closed.
 * A timeout after a create can leave an unknown secret and needs explicit operator recovery.
 */
export async function registerRappiStoreWebhooks(app: AppConfig, merchantToken: string, storeId: string,
  options: RappiWebhookRegistrationOptions): Promise<RappiWebhookSecrets> {
  const integrationId = rappiIntegration(app);
  applicationUrl(app.webhook_url);
  id(storeId);
  if (!options || typeof options.persist_created_secret !== 'function' || !options.existing_secrets) failConfiguration();
  const events = options.events ?? RAPPI_ORDER_WEBHOOK_EVENTS;
  if (!events.length || new Set(events).size !== events.length || events.some(event => !RAPPI_ORDER_WEBHOOK_EVENTS.includes(event))) {
    failConfiguration();
  }
  const store = await getMerchantStoreStatus(app, merchantToken, { id: storeId });
  if (!store.integrated || store.integration_id !== integrationId) {
    throw new MarketplaceProviderError('unsupported_operation', 'Webhooks require a store integrated with this app.');
  }
  // Preflight every event before any mutation to detect missing global secrets early.
  const plan: { event: RappiOrderWebhookEvent; registered: boolean; add: boolean; secret?: string }[] = [];
  for (const event of events) {
    const payload = array(await rappiAppRequest(app, `/webhook/${event}`));
    const entries = payload.map(value => object(value));
    if (entries.some(entry => entry.event !== event) || entries.length > 1) {
      throw new MarketplaceProviderError('invalid_response', 'Unexpected Rappi webhook configuration.');
    }
    const secret = options.existing_secrets[event];
    if (secret !== undefined) bearer(secret);
    if (entries.length) {
      if (!secret) failConfiguration();
      const stores = registration(entries[0], event);
      const existing = stores.find(store => store.store_id === storeId);
      if (existing && (existing.url !== app.webhook_url || existing.state !== 'ENABLE')) failConfiguration();
      plan.push({ event, registered: true, add: !existing, secret });
    } else {
      // A known secret with a missing provider registration signals registry drift, not safe create.
      if (secret) failConfiguration();
      plan.push({ event, registered: false, add: true });
    }
  }
  const secrets: RappiWebhookSecrets = { ...options.existing_secrets };
  for (const entry of plan) {
    if (!entry.add) continue;
    if (entry.registered) {
      const response = await rappiAppRequest(app, `/webhook/${entry.event}/add-stores`, {
        method: 'PUT', ...jsonBody({ url: app.webhook_url, stores: [storeId] }),
      });
      verifyStoreRegistration(response, entry.event, storeId, app.webhook_url);
    } else {
      const response = object(await rappiAppRequest(app, '/webhook', {
        method: 'POST', ...jsonBody({ event: entry.event, data: [{ url: app.webhook_url, stores: [storeId] }] }),
      }));
      const secret = bearer(response.secret);
      // Save before validation or another provider side-effect: the provider may already use this key.
      await options.persist_created_secret(entry.event, secret);
      secrets[entry.event] = secret;
      verifyStoreRegistration(response, entry.event, storeId, app.webhook_url);
    }
  }
  return secrets;
}

/** Global, one-time signed provisioning callback. Persist the custom secret before dispatch. */
export async function registerRappiProvisioningWebhook(app: AppConfig,
  options: Pick<RappiWebhookRegistrationOptions, 'existing_secrets' | 'persist_created_secret'>): Promise<RappiWebhookSecrets> {
  rappiIntegration(app);
  if (!options || typeof options.persist_created_secret !== 'function' || !options.existing_secrets) failConfiguration();
  const path = `/clients/${encodeURIComponent(app.client_id)}/webhooks`;
  const registrations = array(await rappiAppRequest(app, path)).map(value => object(value));
  const existing = registrations.filter(entry => entry.event === 'STORE_PROVISIONING_STATUS');
  if (existing.length > 1) failConfiguration();
  let secret = options.existing_secrets.STORE_PROVISIONING_STATUS;
  if (existing.length) {
    if (!secret || existing[0].clientId !== app.client_id || existing[0].url !== app.webhook_url || existing[0].state !== true) {
      failConfiguration();
    }
    bearer(secret);
    return { ...options.existing_secrets };
  }
  secret = secret ? bearer(secret) : randomBytes(32).toString('base64url');
  await options.persist_created_secret('STORE_PROVISIONING_STATUS', secret);
  const response = object(await rappiAppRequest(app, path, { method: 'POST',
    ...jsonBody({ event: 'STORE_PROVISIONING_STATUS', url: app.webhook_url, secret }) }));
  if (response.event !== 'STORE_PROVISIONING_STATUS' || response.clientId !== app.client_id
    || response.url !== app.webhook_url || response.state !== true) {
    throw new MarketplaceProviderError('invalid_response', 'Rappi did not register the provisioning webhook.');
  }
  return { ...options.existing_secrets, STORE_PROVISIONING_STATUS: secret };
}