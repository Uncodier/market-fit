const fs = require('fs');
const content = fs.readFileSync('lib/types/database.types.ts', 'utf8');

const newTypes = `
      catalog_items: {
        Row: {
          id: string
          site_id: string
          kind: 'product' | 'service'
          name: string
          description: string | null
          sku: string | null
          cost: number | null
          lowest_sale_price: number | null
          target_sale_price: number | null
          track_inventory: boolean
          availability_mode: 'manual' | 'inventory' | 'always'
          availability_status: 'available' | 'unavailable' | 'sold_out'
          status: 'active' | 'archived'
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      locations: {
        Row: {
          id: string
          site_id: string
          name: string
          code: string | null
          is_default: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      inventory_levels: {
        Row: {
          id: string
          site_id: string
          catalog_item_id: string
          location_id: string
          quantity: number
          updated_at: string
        }
        Insert: any
        Update: any
      }
      price_lists: {
        Row: {
          id: string
          site_id: string
          name: string
          code: string | null
          currency: string
          is_default: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      price_list_items: {
        Row: {
          id: string
          site_id: string
          price_list_id: string
          catalog_item_id: string
          unit_price: number
          updated_at: string
        }
        Insert: any
        Update: any
      }
      sale_order_items: {
        Row: {
          id: string
          sale_order_id: string
          site_id: string
          catalog_item_id: string | null
          location_id: string | null
          name: string
          description: string | null
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: any
        Update: any
      }
      shipments: {
        Row: {
          id: string
          site_id: string
          sale_order_id: string
          sale_id: string | null
          lead_id: string
          origin_location_id: string
          status: 'pending' | 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'failed'
          carrier: string | null
          tracking_number: string | null
          shipping_address: Json | null
          stock_decremented: boolean
          estimated_delivery_at: string | null
          shipped_at: string | null
          delivered_at: string | null
          notes: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      promotions: {
        Row: {
          id: string
          site_id: string
          campaign_id: string
          name: string
          description: string | null
          code: string | null
          discount_type: 'percent' | 'fixed'
          discount_value: number
          applies_to: 'all' | 'selected_items'
          min_order_amount: number | null
          usage_limit: number | null
          usage_count: number
          status: 'draft' | 'active' | 'paused' | 'expired'
          starts_at: string | null
          ends_at: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      promotion_catalog_items: {
        Row: {
          id: string
          promotion_id: string
          catalog_item_id: string
          site_id: string
        }
        Insert: any
        Update: any
      }
`;

const updated = content.replace('Tables: {', 'Tables: {' + newTypes);
fs.writeFileSync('lib/types/database.types.ts', updated);
