import type { Json } from "./database.types"
import type { MarketplaceIntegrationConfig } from "@/lib/marketplace/config-types"

type BackendTable<Row> = { Row: Row; Insert: Row; Update: Partial<Row> }

export interface MarketplaceDatabaseTables {
  marketplace_integrations: BackendTable<MarketplaceIntegrationConfig & {
    created_at: string; updated_at: string; last_polled_at: string | null; poll_sent_next: boolean
    provisioning_operation: "activate" | "deactivate" | null; provisioning_result: "pending" | "unknown" | "confirmed" | "failed" | null;
    provisioning_claim_id: string | null
  }>
  marketplace_oauth_sessions: BackendTable<{
    id: string; state_hash: string; site_id: string; user_id: string; provider: "rappi" | "uber_eats";
    environment: "production" | "sandbox"; country: string; credential_mode: "platform" | "custom";
    encrypted_context: string | null; expires_at: string; status: "created" | "claimed" | "completed" | "failed";
    claimed_at: string | null; finished_at: string | null; created_at: string
  }>
  marketplace_merchant_connections: BackendTable<{
    id: string; oauth_session_id: string; site_id: string; provider: "rappi" | "uber_eats";
    environment: "production" | "sandbox"; country: string; credential_mode: "platform" | "custom";
    app_client_id_hash: string; encrypted_authorization: string | null; token_expires_at: string | null;
    authorized_stores: Json; actor_user_id: string; status: "authorized" | "revoked"; created_at: string; updated_at: string
  }>
  marketplace_provider_webhook_keys: BackendTable<{
    id: string; app_client_id_hash: string; provider: "rappi" | "uber_eats";
    environment: "production" | "sandbox"; country: string | null; integration_id: string | null;
    event: string; secret_ciphertext: string; created_at: string
  }>
  marketplace_events: BackendTable<{
    id: string; integration_id: string; event_key: string; event_at: string | null;
    normalized_payload: Json; status: "completed"; order_id: string | null;
    shipment_id: string | null; created_at: string
  }>
  marketplace_actions: BackendTable<{
    id: string; order_id: string; actor_user_id: string; action: "accept" | "reject" | "ready" | "cancel";
    status: "pending" | "confirmed" | "failed" | "unknown"; created_at: string; finished_at: string | null
  }>
}

export interface MarketplaceDatabaseFunctions {
  save_marketplace_integration: {
    Args: { p_config: Json; p_secret_id: string | null; p_encrypted_credentials: string | null; p_actor_user_id: string }
    Returns: Json
  }
  ingest_marketplace_event: {
    Args: { p_integration_id: string; p_event_key: string; p_order: Json; p_event_at?: string | null }
    Returns: Json
  }
  claim_marketplace_action: {
    Args: { p_order_id: string; p_action: string; p_actor_user_id: string }
    Returns: Json
  }
  finish_marketplace_action: {
    Args: { p_action_id: string; p_result: string; p_metadata?: Json }
    Returns: Json
  }
  claim_marketplace_poll: {
    Args: { p_limit?: number }
    Returns: Json
  }
  begin_marketplace_oauth: { Args: { p_context: Json; p_state_hash: string; p_encrypted_context: string; p_actor_user_id: string }; Returns: Json }
  claim_marketplace_oauth: { Args: { p_state_hash: string; p_provider: string; p_actor_user_id: string }; Returns: Json }
  complete_marketplace_oauth: { Args: { p_session_id: string; p_encrypted_authorization: string; p_expires_at: string | null;
    p_app_client_id_hash: string; p_actor_user_id: string; p_authorized_stores?: Json }; Returns: Json }
  fail_marketplace_oauth: { Args: { p_session_id: string; p_actor_user_id: string }; Returns: undefined }
  claim_marketplace_provisioning: { Args: { p_integration_id: string; p_operation: string; p_actor_user_id: string }; Returns: Json }
  finish_marketplace_provisioning: { Args: { p_integration_id: string; p_batch_id: string; p_result: string; p_actor_user_id: string;
    p_provider_batch_id?: string | null }; Returns: Json }
  reconcile_marketplace_provisioning: { Args: { p_integration_id: string; p_provider_batch_id: string | null; p_status: string }; Returns: Json }
  reconcile_marketplace_provisioning_status: { Args: { p_integration_id: string; p_actor_user_id: string; p_status: string }; Returns: Json }
  reconcile_marketplace_provider_status: { Args: { p_integration_id: string; p_status: string }; Returns: Json }
  rebind_marketplace_merchant_connection: { Args: { p_integration_id: string; p_connection_id: string; p_actor_user_id: string }; Returns: Json }
  claim_marketplace_webhook_registration: { Args: { p_app_hash: string; p_provider: string; p_environment: string; p_country: string | null;
    p_actor_user_id: string; p_site_id: string }; Returns: Json }
  finish_marketplace_webhook_registration_app: { Args: { p_claim_id: string; p_result: string }; Returns: undefined }
}