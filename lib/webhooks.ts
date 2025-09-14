import { createClient } from "@/lib/supabase/client";

export type WebhookEventType =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "message.created"
  | "message.updated"
  | "message.deleted";

export interface WebhookEndpoint {
  id: string;
  site_id: string;
  created_by: string;
  name: string;
  description?: string | null;
  target_url: string;
  secret?: string | null;
  is_active: boolean;
  handshake_status?: string | null;
  handshake_token?: string | null;
  handshake_verified_at?: string | null;
  last_handshake_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookEndpointParams {
  site_id: string;
  created_by: string;
  name: string;
  target_url: string;
  description?: string;
  secret?: string;
}

export async function listWebhookEndpoints(siteId: string): Promise<WebhookEndpoint[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("webhooks_endpoints")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createWebhookEndpoint(params: CreateWebhookEndpointParams): Promise<WebhookEndpoint> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("webhooks_endpoints")
    .insert({
      site_id: params.site_id,
      created_by: params.created_by,
      name: params.name,
      target_url: params.target_url,
      description: params.description ?? null,
      secret: params.secret ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as WebhookEndpoint;
}

export async function deleteWebhookEndpoint(endpointId: string, siteId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("webhooks_endpoints")
    .delete()
    .eq("id", endpointId)
    .eq("site_id", siteId);
  if (error) throw new Error(error.message);
}

export interface WebhookSubscription {
  id: string;
  site_id: string;
  endpoint_id: string;
  event_type: WebhookEventType | string;
  is_active: boolean;
  filters: any;
  created_at: string;
  updated_at: string;
}

export async function listWebhookSubscriptions(endpointId: string): Promise<WebhookSubscription[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("webhooks_subscriptions")
    .select("*")
    .eq("endpoint_id", endpointId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function upsertSubscription(
  siteId: string,
  endpointId: string,
  eventType: WebhookEventType,
  isActive: boolean
): Promise<WebhookSubscription> {
  const supabase = createClient();

  // Try update, else insert
  const { data, error } = await supabase
    .from("webhooks_subscriptions")
    .upsert({
      site_id: siteId,
      endpoint_id: endpointId,
      event_type: eventType,
      is_active: isActive,
    }, { onConflict: "endpoint_id,event_type" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as WebhookSubscription;
}


