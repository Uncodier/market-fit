import type { MarketplaceProvider } from '../../providers/types';

/** Server-managed third-party app credentials, never merchant-supplied credentials. */
export interface AppConfig {
  provider: MarketplaceProvider;
  environment: 'production' | 'sandbox';
  country: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  webhook_url: string;
  /** Rappi backend integration ID created by its TAM; required for store mutations. */
  integration_id?: string;
}

export interface MerchantAuthorization {
  /** Rappi OIDC id_token; Uber authorization-code access_token. Server-only. */
  merchant_token: string;
  expires_at?: string;
  refresh_token?: string;
}

export interface MerchantStore {
  id: string;
  name: string;
  integration_status?: 'active' | 'inactive' | 'pending' | 'other_integration';
  integrated?: boolean;
  integration_id?: string;
  parent_id?: string;
  location?: { address?: string; city?: string; country?: string; postal_code?: string };
}

export interface StoreActivationContext {
  /** Trusted native location mapping, not a client-claimed provider store ID. */
  integrator_store_id?: string;
  integrator_brand_id?: string;
  /** Explicitly nominate this app to accept/reject/cancel Uber orders. Default false. */
  is_order_manager?: boolean;
}

export interface MerchantActivationResult {
  status: 'active' | 'pending';
  batch_id?: string;
}

export interface MerchantDeactivationResult {
  /** HTTP acknowledgement is not proof of a completed provisioning transition. */
  status: 'pending';
  acknowledged: true;
  batch_id?: string;
}

export interface UberStoreIntegrationStatus {
  id: string;
  integrated: boolean;
  integration_status: 'active' | 'inactive' | 'pending';
}

export type RappiOrderWebhookEvent = 'NEW_ORDER' | 'NEW_ORDER_SCHEDULED'
  | 'NEW_ORDER_SCHEDULED_CANCELLED' | 'ORDER_EVENT_CANCEL' | 'ORDER_OTHER_EVENT' | 'ORDER_RT_TRACKING';
export type RappiWebhookEvent = RappiOrderWebhookEvent | 'STORE_PROVISIONING_STATUS';
export type RappiWebhookSecrets = Partial<Record<RappiWebhookEvent, string>>;

export interface RappiWebhookRegistrationOptions {
  /** Decrypted GLOBAL app/environment per-event registry, not per-store secrets. */
  existing_secrets: RappiWebhookSecrets;
  /** Persist encrypted immediately, before another registration is attempted. */
  persist_created_secret: (event: RappiWebhookEvent, secret: string) => Promise<void>;
  events?: readonly RappiOrderWebhookEvent[];
}