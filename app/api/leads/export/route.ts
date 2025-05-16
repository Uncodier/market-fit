import { NextRequest, NextResponse } from 'next/server'
import { createServiceApiClient } from '@/lib/supabase/server-client'
import { Parser } from 'json2csv'

export async function GET(request: NextRequest) {
  try {
    // Get siteId from query params
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get('siteId')

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
    }

    // Create service client with elevated permissions
    const supabase = createServiceApiClient()
    
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
    
    if (error) {
      console.error('Error fetching leads:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }

    // Transform leads data for CSV
    const csvData = leads.map(lead => ({
      Name: lead.name,
      Email: lead.email,
      Phone: lead.phone || '',
      Company: lead.company?.name || '',
      Position: lead.position || '',
      Status: lead.status,
      Segment: lead.segments?.name || 'No Segment',
      Origin: lead.origin || '',
      Created: new Date(lead.created_at).toLocaleDateString(),
      Notes: lead.notes || ''
    }))

    // Convert to CSV
    const fields = ['Name', 'Email', 'Phone', 'Company', 'Position', 'Status', 'Segment', 'Origin', 'Created', 'Notes']
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
  }
} 