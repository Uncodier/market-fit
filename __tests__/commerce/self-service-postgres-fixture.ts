import { ids, migration, uuid } from '../security/isolated-postgres'
import { installRegisterFixture, registerIds } from '../pos/register-postgres-fixture'

export const orderId = uuid(200), parentId = uuid(201), modifierId = uuid(202), productId = uuid(203)
export const claimId = uuid(204)
export const marked = JSON.stringify([{ metadata: { self_service: true, self_service_location_id: registerIds.location } }])
export const selfServiceMigrations = [
  '20261022220000_self_service_payment_guards.sql', '20261022220001_self_service_atomic_release.sql',
  '20261022220002_self_service_pos_cash_source.sql',
]

export function installSelfServiceFixture(db: (sql: string) => string) {
  installRegisterFixture(db)
  db(`ALTER TABLE public.sales ADD COLUMN lead_id uuid,ADD COLUMN buyer_user_id uuid,ADD COLUMN owner_site_id uuid,
    ADD COLUMN campaign_id uuid,ADD COLUMN segment_id uuid,ADD COLUMN company_id uuid,ADD COLUMN title text,
    ADD COLUMN product_name text,ADD COLUMN user_id uuid,ADD COLUMN payment_method text,ADD COLUMN stripe_checkout_session_id text,
    ADD COLUMN stripe_checkout_attempt bigint NOT NULL DEFAULT 0,ADD COLUMN stripe_payment_intent_id text,ADD COLUMN payment_details jsonb;
    ALTER TABLE public.settings ADD COLUMN commerce jsonb DEFAULT '{}';
    ALTER TABLE public.site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false;
    CREATE TABLE public.sale_orders(id uuid PRIMARY KEY,site_id uuid NOT NULL REFERENCES public.sites,
      sale_id uuid REFERENCES public.sales,status text DEFAULT 'pending',price_list_id uuid,buyer_user_id uuid,
      owner_site_id uuid,fulfillment_method text DEFAULT 'pickup',origin_location_id uuid,shipping_address jsonb,scheduled_for timestamptz,
      subtotal numeric DEFAULT 100,tax_total numeric DEFAULT 0,shipping_cost numeric DEFAULT 0,total numeric DEFAULT 100,
      currency text DEFAULT 'USD',discount_total numeric DEFAULT 0,promotion_id uuid,user_id uuid,seller_user_id uuid,
      requested_by_lead_id uuid,items jsonb DEFAULT '[]',notes text,updated_at timestamptz DEFAULT now());
    CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.shipments(id uuid PRIMARY KEY,delivered_at timestamptz,status text);
    CREATE TABLE public.catalog_items(id uuid PRIMARY KEY,site_id uuid,track_inventory boolean DEFAULT true);
    CREATE TABLE public.inventory_levels(id uuid DEFAULT gen_random_uuid(),site_id uuid,catalog_item_id uuid,
      location_id uuid,quantity numeric NOT NULL,updated_at timestamptz,UNIQUE(catalog_item_id,location_id));
    CREATE TABLE public.sale_order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid,
      sale_order_id uuid REFERENCES public.sale_orders,catalog_item_id uuid REFERENCES public.catalog_items,
      quantity numeric DEFAULT 1,status text DEFAULT 'draft',sent_at timestamptz,metadata jsonb DEFAULT '{}',
      parent_sale_order_item_id uuid REFERENCES public.sale_order_items,shipment_id uuid,created_at timestamptz DEFAULT now());
    CREATE TABLE public.stripe_sale_checkout_effects(stripe_session_id text PRIMARY KEY,sale_id uuid,order_id uuid,
      fulfillment_status text,fulfillment_claim_token uuid,inventory_completed_at timestamptz,updated_at timestamptz);`)
  for (const file of ['20260921143000_create_sale_order_item_units.sql', '20260921151500_secure_order_line_unit_mutations.sql',
    '20260921151600_add_order_line_unit_milestones.sql', '20260921153000_harden_order_line_workflow.sql',
    '20261022140000_pos_checkout_attempt_recovery.sql', '20261022201051_complete_pos_checkout_recovery.sql',
    ...selfServiceMigrations]) db(migration(file))
  db(`GRANT ALL ON public.sale_orders,public.sale_order_items,public.sale_order_item_units TO authenticated,service_role;
    SET request.jwt.claims='{"sub":"${ids.owner}","role":"service_role"}';
    UPDATE public.sales SET source='shop' WHERE id='${registerIds.sale}';
    INSERT INTO public.sale_orders(id,site_id,sale_id,origin_location_id,items)
      VALUES('${orderId}','${ids.site}','${registerIds.sale}','${registerIds.location}','${marked}');
    INSERT INTO public.catalog_items VALUES('${productId}','${ids.site}',true);
    INSERT INTO public.inventory_levels(site_id,catalog_item_id,location_id,quantity)
      VALUES('${ids.site}','${productId}','${registerIds.location}',20);
    INSERT INTO public.sale_order_items(id,site_id,sale_order_id,catalog_item_id,quantity)
      VALUES('${parentId}','${ids.site}','${orderId}','${productId}',2);
    INSERT INTO public.sale_order_items(id,site_id,sale_order_id,catalog_item_id,quantity,parent_sale_order_item_id)
      VALUES('${modifierId}','${ids.site}','${orderId}','${productId}',3,'${parentId}');`)
}