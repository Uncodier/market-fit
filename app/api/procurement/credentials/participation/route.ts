import { NextResponse } from 'next/server'
import { privateHeaders, procurementError } from '../../http'
import { credentialAccess, credentialDatabaseError } from '../access'

export async function GET(request: Request) {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
    const result = await access.supabase.rpc('my_procurement_participation_details')
    if (result.error) return credentialDatabaseError(result.error.code)
    return NextResponse.json({ opportunities: result.data }, { headers: privateHeaders })
  } catch { return procurementError('Unable to load participation', 503) }
}