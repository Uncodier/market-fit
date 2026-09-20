import { NextRequest, NextResponse } from 'next/server'
import { createServiceApiClient } from '@/lib/supabase/server-client'
import { Parser } from 'json2csv'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import {
  acquireSemaphore,
  hashRedisKeyPart,
  releaseSemaphore,
} from '@/lib/redis/control-plane'
import { isRedisConfigured } from '@/lib/redis/upstash-rest'

const MAX_EXPORT_ROWS = 10_000

export async function GET(request: NextRequest) {
  let semaphoreKey: string | null = null
  let semaphoreOwner: string | null = null
  try {
    // Get siteId from query params
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get('siteId')

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
    }

    const access = await requireSiteAccess(request, siteId)
    if (access.error) return access.error

    if (isRedisConfigured()) {
      semaphoreKey = `sem:v1:leads-export:${await hashRedisKeyPart(siteId)}`
      semaphoreOwner = crypto.randomUUID()
      const admitted = await acquireSemaphore(
        semaphoreKey,
        semaphoreOwner,
        1,
        120_000
      )
      if (!admitted) {
        return NextResponse.json(
          { error: 'An export is already running for this site' },
          { status: 429, headers: { 'Retry-After': '5' } }
        )
      }
    }

    const supabase = createServiceApiClient(siteId)
    
    // Get all leads for the site with segment name
    const { data: leads, error } = await supabase
      .from('leads')
      .select(`
        *,
        segments:segment_id (
          name
        )
      `)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(MAX_EXPORT_ROWS + 1)
    
    if (error) {
      console.error('Error fetching leads:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }
    if (leads.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: 'This export is too large. Narrow the result set and try again.' },
        { status: 413 }
      )
    }

    // Transform leads data for CSV
    const csvData = leads.map((lead: any) => ({
      Name: lead.name,
      Email: lead.email,
      Phone: lead.phone || '',
      Company: lead.company?.name || '',
      Position: lead.position || '',
      Status: lead.status,
      Segment: lead.segments?.name || 'No Segment',
      Origin: lead.origin || '',
      Created: new Date(lead.created_at).toLocaleDateString(),
      Notes: lead.notes || '',
      Birthday: lead.birthday || '',
      Language: lead.language || '',
      'Address - Street': lead.address?.street || '',
      'Address - City': lead.address?.city || '',
      'Address - State': lead.address?.state || '',
      'Address - ZIP Code': lead.address?.zipcode || '',
      'Address - Country': lead.address?.country || '',
      LinkedIn: lead.social_networks?.linkedin || '',
      Twitter: lead.social_networks?.twitter || '',
      Facebook: lead.social_networks?.facebook || '',
      Instagram: lead.social_networks?.instagram || '',
      TikTok: lead.social_networks?.tiktok || '',
      YouTube: lead.social_networks?.youtube || '',
      WhatsApp: lead.social_networks?.whatsapp || '',
      Pinterest: lead.social_networks?.pinterest || ''
    }))

    // Convert to CSV
    const fields = [
      'Name', 'Email', 'Phone', 'Company', 'Position', 'Status', 'Segment', 'Origin', 'Created', 'Notes',
      'Birthday', 'Language',
      'Address - Street', 'Address - City', 'Address - State', 'Address - ZIP Code', 'Address - Country',
      'LinkedIn', 'Twitter', 'Facebook', 'Instagram', 'TikTok', 'YouTube', 'WhatsApp', 'Pinterest'
    ]
    const parser = new Parser({ fields })
    const csv = parser.parse(csvData)
    
    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=leads-${new Date().toISOString().split('T')[0]}.csv`
      }
    })
  } catch (error) {
    console.error('Error in export leads API:', error)
    return NextResponse.json({ error: 'Failed to export leads' }, { status: 500 })
  } finally {
    if (semaphoreKey && semaphoreOwner) {
      await releaseSemaphore(semaphoreKey, semaphoreOwner)
    }
  }
} 