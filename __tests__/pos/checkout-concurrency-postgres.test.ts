/** @jest-environment node */
import { persistCheckoutRecords } from '@/app/commerce/checkout-records'
import { ids, isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'

const describePg = postgresAvailable ? describe : describe.skip
const saleId = uuid(201), orderId = uuid(202), productId = uuid(203)
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`
const identifier = (key: string) => `"${key.replace(/"/g, '""')}"`

// Translate only the query-builder operations used by the existing-order writer.
// Each execution is a separate psql session/commit, as with separate REST requests.
function checkoutClient(db: (sql: string) => string, afterSaleCommit: () => void) {
  return { from(table: string) {
    const relation = identifier(table)
    const predicates: string[] = []
    let projection = '*'
    let patch: Record<string, unknown> | undefined
    const rows = () => {
      const where = predicates.join(' AND ')
      let sql = `SELECT ${projection} FROM ${relation} WHERE ${where}`
      if (patch) {
        const keys = Object.keys(patch).filter(key => patch![key] !== undefined).map(identifier).join(', ')
        const data = literal(JSON.stringify(patch))
        sql = `UPDATE ${relation} SET (${keys}) = (SELECT ${keys} FROM jsonb_populate_record(NULL::${relation}, ${data}))
          WHERE ${where} RETURNING ${projection}`
      }
      const result = JSON.parse(db(`WITH matched AS (${sql}) SELECT coalesce(json_agg(matched), '[]') FROM matched`))
      if (patch && table === 'sales' && result.length === 1) afterSaleCommit()
      return result
    }
    const query = {
      select(columns = '*') { projection = columns; return query },
      eq(key: string, value: string) { predicates.push(`${identifier(key)} = ${literal(value)}`); return query },
      update(data: Record<string, unknown>) { patch = data; return query },
      single() {
        const matches = rows()
        return matches.length === 1 ? { data: matches[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'Expected one row' } }
      },
      then(resolve: (result: { data: unknown[]; error: null }) => void) { resolve({ data: rows(), error: null }) },
    }
    return query
  } }
}

describePg('existing-order checkout concurrency diagnostic', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())

  it('currently leaves the sale repriced when a competing cancellation defeats POS Send', async () => {
    pg.db(`CREATE TABLE sales (id uuid PRIMARY KEY, site_id uuid, buyer_user_id uuid, owner_site_id uuid,
        lead_id uuid, title text, product_name text, amount numeric, amount_due numeric, currency text,
        sale_date date, source text, status text, payments jsonb);
      CREATE TABLE sale_orders (id uuid PRIMARY KEY, site_id uuid, sale_id uuid REFERENCES sales, status text,
        subtotal numeric, tax_total numeric, shipping_cost numeric, total numeric, currency text, notes text,
        updated_at timestamptz, items jsonb, promotion_id uuid, discount_total numeric, buyer_user_id uuid,
        origin_location_id uuid, fulfillment_method text, owner_site_id uuid, shipping_address jsonb,
        scheduled_for timestamptz, seller_user_id uuid, requested_by_lead_id uuid);
      CREATE TABLE sale_order_items (sale_order_id uuid REFERENCES sale_orders, catalog_item_id uuid, quantity numeric);
      INSERT INTO sales (id,site_id,amount,amount_due,currency,source,status,payments)
        VALUES ('${saleId}','${ids.site}',20,0,'USD','pos','completed','[{"method":"cash","amount":20}]');
      INSERT INTO sale_orders (id,site_id,sale_id,status,total,currency,items)
        VALUES ('${orderId}','${ids.site}','${saleId}','completed',20,'USD','[]');
      INSERT INTO sale_order_items VALUES ('${orderId}','${productId}',1)`)
    const readOrder = () => JSON.parse(pg.db(`SELECT to_json(o) FROM sale_orders o WHERE id='${orderId}'`))
    const originalOrder = readOrder()
    const client = checkoutClient(pg.db, () => {
      expect(pg.db(`UPDATE sale_orders SET status='cancelled' WHERE id='${orderId}' AND status='completed'
        RETURNING status`)).toBe('cancelled')
    })

    await expect(persistCheckoutRecords({
      supabase: client, supabaseAdmin: client, isAdmin: false, siteId: ids.site, source: 'pos', intent: 'send',
      effectiveExistingOrderId: orderId, quoteForAccept: null, fulfillment: 'pickup',
      processedLines: [{ site_id: ids.site, catalog_item_id: productId, name: 'Product', currency: 'USD',
        quantity: 2, unit_price: 20, subtotal: 40, is_reservation_dropin: false, isRoundRobinDropin: false,
        client_line_key: 'product-line', parent_client_line_key: null, modifier_group_id: null, parent_name: null }],
      orderSubtotal: 40, orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: 'USD',
    })).rejects.toThrow('Order changed during checkout. Reload it before retrying.')

    expect(readOrder()).toEqual({ ...originalOrder, status: 'cancelled' })
    // Characterization, not a contract: an atomic fix should leave this sale at 20 with nothing due.
    expect(JSON.parse(pg.db(`SELECT to_json(s) FROM sales s WHERE id='${saleId}'`))).toMatchObject({
      status: 'pending', amount: 40, amount_due: 20, payments: [{ method: 'cash', amount: 20 }],
    })
  })
})
