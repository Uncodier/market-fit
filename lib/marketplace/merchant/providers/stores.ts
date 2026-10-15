import 'server-only';
import { MarketplaceProviderError } from '../../providers/types';
import { array, id, object, optionalObject, requiredText, text } from '../../providers/validation';
import { appEndpoints, bearer, failConfiguration, jsonBody, merchantRequest, RAPPI_BASE, rappiIntegration } from './common';
import type { AppConfig, MerchantActivationResult, MerchantDeactivationResult, MerchantStore, StoreActivationContext } from './types';
import { getUberStoreIntegrationStatus } from './uber-status';

function uniqueStores(stores: MerchantStore[]): MerchantStore[] {
  if (stores.length > 10000 || new Set(stores.map(store => store.id)).size !== stores.length) {
    throw new MarketplaceProviderError('invalid_response', 'Invalid or excessive authorized merchant stores.');
  }
  return stores;
}

function rappiStore(app: AppConfig, value: unknown, parent_id?: string): MerchantStore {
  const store = object(value);
  if (typeof store.integrated !== 'boolean') throw new MarketplaceProviderError('invalid_response', 'Invalid store integration state.');
  const integration_id = store.integrated ? id(store.integration_id) : undefined;
  return { id: id(store.store_id), name: requiredText(store.name), integrated: store.integrated,
    integration_status: !store.integrated ? 'inactive' : integration_id === app.integration_id ? 'active' : 'other_integration',
    ...(integration_id ? { integration_id } : {}), ...(parent_id ? { parent_id } : {}) };
}

function uberStore(app: AppConfig, value: unknown): MerchantStore {
  const store = object(value);
  const pos = optionalObject(store.pos_data);
  if ((pos.integration_enabled !== undefined && typeof pos.integration_enabled !== 'boolean')
    || (pos.is_order_manager_pending !== undefined && typeof pos.is_order_manager_pending !== 'boolean')) {
    throw new MarketplaceProviderError('invalid_response', 'Invalid store POS integration state.');
  }
  const location = optionalObject(store.location);
  const integrated = pos.integration_enabled as boolean | undefined;
  const manager = text(pos.order_manager_client_id);
  // Core order activation is verified only when our app is the promoted, non-pending manager.
  const integration_status = integrated === false ? 'inactive' : pos.is_order_manager_pending || manager !== app.client_id ? 'pending'
    : integrated === true ? 'active' : 'pending';
  return { id: id(store.store_id), name: requiredText(store.name), integration_status,
    ...(integrated !== undefined ? { integrated } : {}), location: {
      address: text(location.address), city: text(location.city), country: text(location.country), postal_code: text(location.postal_code),
    } };
}

export async function listMerchantStores(app: AppConfig, merchantToken: string): Promise<MerchantStore[]> {
  appEndpoints(app);
  bearer(merchantToken);
  if (app.provider === 'rappi') {
    const payload = object(await merchantRequest(app, merchantToken, `${RAPPI_BASE}/stores/integration-status`));
    const stores: MerchantStore[] = [];
    for (const value of array(payload.stores)) {
      const parent = rappiStore(app, value);
      stores.push(parent);
      for (const child of array(object(value).children)) stores.push(rappiStore(app, child, parent.id));
    }
    return uniqueStores(stores);
  }
  const stores: MerchantStore[] = [];
  const seen = new Set<string>();
  let next: string | undefined;
  for (let page = 0; page < 200; page++) {
    const query = new URLSearchParams({ limit: '100' });
    if (next) query.set('start_key', next);
    const payload = object(await merchantRequest(app, merchantToken, `/v1/eats/stores?${query}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    }));
    stores.push(...array(payload.stores).map(value => uberStore(app, value)));
    uniqueStores(stores);
    if (payload.next_key !== undefined && payload.next_key !== null && typeof payload.next_key !== 'string') {
      throw new MarketplaceProviderError('invalid_response', 'Invalid authorized store pagination.');
    }
    next = text(payload.next_key);
    if (!next) return stores;
    if (next.length > 4096 || seen.has(next)) break;
    seen.add(next);
  }
  throw new MarketplaceProviderError('invalid_response', 'Authorized store pagination exceeds safe limits.');
}

/** Fresh token-authorized discovery, never accepting a user-supplied store claim as ownership. */
async function authorizedStore(app: AppConfig, merchantToken: string, store: Pick<MerchantStore, 'id'>): Promise<MerchantStore> {
  const storeId = id(store.id);
  const authorized = (await listMerchantStores(app, merchantToken)).find(candidate => candidate.id === storeId);
  if (!authorized) throw new MarketplaceProviderError('store_mismatch', 'The store is not authorized by this merchant.');
  return authorized;
}

export async function getMerchantStoreStatus(app: AppConfig, merchantToken: string, store: Pick<MerchantStore, 'id'>): Promise<MerchantStore> {
  const authorized = await authorizedStore(app, merchantToken, store);
  if (app.provider === 'rappi') return authorized;
  return { ...authorized, ...await getUberStoreIntegrationStatus(app, authorized) };
}

function contextValue(context: StoreActivationContext): void {
  if (context.integrator_store_id !== undefined) id(context.integrator_store_id);
  if (context.integrator_brand_id !== undefined) id(context.integrator_brand_id);
  if (context.is_order_manager !== undefined && typeof context.is_order_manager !== 'boolean') failConfiguration();
}

function batchResult(payload: unknown, storeId: string, integrationId: string): { batch_id: string } {
  const result = object(payload);
  const accepted = array(result.accepted).map(value => object(value));
  const rejected = array(result.rejected).map(value => object(value));
  if (rejected.some(store => id(store.store_id) === storeId)) {
    throw new MarketplaceProviderError('unsupported_operation', 'Rappi rejected this store provisioning operation.');
  }
  if (accepted.length !== 1 || id(accepted[0].store_id) !== storeId || id(accepted[0].integration_id) !== integrationId) {
    throw new MarketplaceProviderError('invalid_response', 'Rappi did not acknowledge the requested store integration.');
  }
  return { batch_id: id(result.batch_id) };
}

export async function activateMerchantStore(app: AppConfig, merchantToken: string, store: Pick<MerchantStore, 'id' | 'name'>,
  context: StoreActivationContext = {}): Promise<MerchantActivationResult> {
  contextValue(context);
  const integrationId = app.provider === 'rappi' ? rappiIntegration(app) : undefined;
  const authorized = await authorizedStore(app, merchantToken, store);
  if (authorized.integration_status === 'other_integration') {
    throw new MarketplaceProviderError('unsupported_operation', 'The store belongs to another integration.');
  }
  if (authorized.integration_status === 'active' && (app.provider === 'rappi'
    || (await getUberStoreIntegrationStatus(app, authorized)).integration_status === 'active')) return { status: 'active' };
  if (app.provider === 'rappi') {
    const payload = await merchantRequest(app, merchantToken, `${RAPPI_BASE}/stores/provisioning`, {
      method: 'POST', ...jsonBody({ stores: [{ store_id: authorized.id, name: authorized.name, status: 'ACTIVE',
        // We do not implement Rappi's POS connectivity or menu-pull handshakes.
        ping_active: false, get_menu_active: false, cancellation_events: true, other_events: true,
        ...(context.integrator_store_id ? { store_integration_id: context.integrator_store_id } : {}) }] }),
    });
    return { status: 'pending', ...batchResult(payload, authorized.id, integrationId!) };
  }
  const query = new URLSearchParams();
  if (context.is_order_manager !== undefined) query.set('is_order_manager', String(context.is_order_manager));
  if (context.integrator_store_id) query.set('integrator_store_id', context.integrator_store_id);
  if (context.integrator_brand_id) query.set('integrator_brand_id', context.integrator_brand_id);
  await merchantRequest(app, merchantToken, `/v1/eats/stores/${encodeURIComponent(authorized.id)}/pos_data${query.size ? `?${query}` : ''}`,
    { method: 'POST' }, true);
  return { status: 'pending' };
}

/** Uber DELETE permanently revokes this app; Rappi deprovisioning is an asynchronous batch. */
export async function deactivateMerchantStore(app: AppConfig, merchantToken: string,
  store: Pick<MerchantStore, 'id'>): Promise<MerchantDeactivationResult> {
  const integrationId = app.provider === 'rappi' ? rappiIntegration(app) : undefined;
  const authorized = await authorizedStore(app, merchantToken, store);
  if (app.provider === 'rappi') {
    if (!authorized.integrated || authorized.integration_id !== integrationId) {
      throw new MarketplaceProviderError('unsupported_operation', 'The store is not integrated with this app.');
    }
    const payload = await merchantRequest(app, merchantToken, `${RAPPI_BASE}/stores/deprovisioning`, {
      method: 'POST', ...jsonBody({ stores: [{ store_id: authorized.id }] }),
    });
    return { status: 'pending', acknowledged: true, ...batchResult(payload, authorized.id, integrationId!) };
  }
  await merchantRequest(app, merchantToken, `/v1/eats/stores/${encodeURIComponent(authorized.id)}/pos_data`, { method: 'DELETE' }, true);
  return { status: 'pending', acknowledged: true };
}