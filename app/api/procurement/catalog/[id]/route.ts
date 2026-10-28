import { NextResponse } from 'next/server'
import { catalogId, capabilitySchema, sourcingOfferSchema } from '@/app/catalog/procurement/schema'
import { privateHeaders, procurementError } from '../../http'
import { CatalogBodyError, catalogAccess, readCatalogBody } from '../access'

type Context = { params: Promise<{ id: string }> }
const offerColumns = 'id,supplier_id,purchase_unit,units_per_purchase_unit,minimum_quantity,lead_time_days,currency,unit_price_minor,valid_from,valid_until,terms,created_at'

async function getCatalog(request: Request, context: Context) {
  const access = await catalogAccess(request, 'select')
  if (access.error) return access.error
  const id = catalogId.safeParse((await context.params).id)
  const rawOffset = new URL(request.url).searchParams.get('offset') ?? '0'
  if (!id.success || !/^\d{1,7}$/.test(rawOffset)) return procurementError('Invalid item or offset', 400)
  const offset = Number(rawOffset)
  const { supabase, siteId } = access
  const item = await supabase.from('catalog_items').select('id,name,status,procurement_enabled')
    .eq('site_id', siteId).eq('id', id.data).maybeSingle()
  if (item.error) return procurementError('Unable to load procurement capability', 503)
  if (!item.data) return procurementError('Item not found', 404)
  const [offers, edit, add] = await Promise.all([
    supabase.from('catalog_item_suppliers').select(offerColumns, { count: 'exact' }).eq('site_id', siteId)
      .eq('catalog_item_id', id.data).order('created_at', { ascending: false }).order('id').range(offset, offset + 49),
    supabase.rpc('procurement_supplier_can', { p_site_id: siteId, p_command: 'update' }),
    supabase.rpc('procurement_supplier_can', { p_site_id: siteId, p_command: 'insert' }),
  ])
  if (offers.error || edit.error || add.error) return procurementError('Unable to load sourcing records', 503)
  const supplierIds = [...new Set((offers.data ?? []).map((row: { supplier_id: string }) => row.supplier_id))]
  const suppliers = supplierIds.length ? await supabase.from('suppliers').select('id,name,status')
    .eq('site_id', siteId).in('id', supplierIds) : { data: [], error: null }
  if (suppliers.error) return procurementError('Unable to load suppliers', 503)
  return NextResponse.json({ item: item.data, offers: offers.data, suppliers: suppliers.data,
    total: offers.count ?? 0, can_edit: edit.data === true, can_add_offer: add.data === true }, { headers: privateHeaders })
}

async function patchCatalog(request: Request, context: Context) {
  const access = await catalogAccess(request, 'update')
  if (access.error) return access.error
  const id = catalogId.safeParse((await context.params).id)
  let body
  try { body = capabilitySchema.safeParse(await readCatalogBody(request)) } catch (error) { return bodyError(error) }
  if (!id.success || !body.success) return procurementError('Invalid capability update', 400)
  const result = await access.supabase.from('catalog_items').update({ procurement_enabled: body.data.procurement_enabled })
    .eq('site_id', access.siteId).eq('id', id.data).eq('status', 'active')
    .eq('procurement_enabled', body.data.expected_enabled).select('id,procurement_enabled').maybeSingle()
  if (result.error) return procurementError('Unable to update procurement capability', 409)
  if (!result.data) return procurementError('Item changed or is unavailable. Reload before retrying.', 409)
  return NextResponse.json(result.data, { headers: privateHeaders })
}

async function postCatalog(request: Request, context: Context) {
  const access = await catalogAccess(request, 'insert')
  if (access.error) return access.error
  const id = catalogId.safeParse((await context.params).id)
  let body
  try { body = sourcingOfferSchema.safeParse(await readCatalogBody(request)) } catch (error) { return bodyError(error) }
  const submissionKey = catalogId.safeParse(request.headers.get('Idempotency-Key'))
  if (!id.success || !body.success || !submissionKey.success) return procurementError('Invalid supplier offer or submission key', 400)
  const result = await access.supabase.from('catalog_item_suppliers').insert({ ...body.data,
    site_id: access.siteId, catalog_item_id: id.data, created_by: access.userId,
    submission_key: submissionKey.data }).select(offerColumns).single()
  if (result.error?.code === '23505') return procurementError('This submission was already recorded. Refresh sourcing history before adding another offer.', 409)
  if (result.error) return procurementError('Unable to save offer. Check item capability and supplier approval.', 409)
  if (!result.data?.id) return procurementError('Unable to confirm the saved offer. Refresh before retrying.', 503)
  return NextResponse.json({ offer: result.data }, { status: 201, headers: privateHeaders })
}

function bodyError(error: unknown) {
  return error instanceof CatalogBodyError ? procurementError(error.message, error.status) : procurementError('Invalid request body', 400)
}

export async function GET(request: Request, context: Context) {
  try { return await getCatalog(request, context) } catch { return procurementError('Unable to load procurement', 503) }
}
export async function PATCH(request: Request, context: Context) {
  try { return await patchCatalog(request, context) } catch { return procurementError('Unable to update procurement', 503) }
}
export async function POST(request: Request, context: Context) {
  try { return await postCatalog(request, context) } catch { return procurementError('Unable to save supplier offer', 503) }
}