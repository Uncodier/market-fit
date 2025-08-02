import { NextRequest, NextResponse } from 'next/server'
import { createServiceApiClient } from '@/lib/supabase/server-client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get('siteId')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    
    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      )
    }

    // Validate pagination parameters
    const validatedPage = Math.max(1, page)
    const validatedLimit = Math.min(Math.max(1, limit), 500) // Max 500 per page
    const offset = (validatedPage - 1) * validatedLimit

    console.log(`[CronStatusAPI] Fetching cron status for site: ${siteId}, page: ${validatedPage}, limit: ${validatedLimit}`)

    // Use service client with elevated permissions to bypass RLS restrictions
    const supabase = createServiceApiClient()

    // First, test general access to the table
    console.log('[CronStatusAPI] Testing general access to cron_status table...')
    const { data: testData, error: testError } = await supabase
      .from('cron_status')
      .select('id, site_id')
      .limit(5)

    console.log('[CronStatusAPI] Test query result:', { 
      testCount: testData?.length || 0,
      testError: testError?.message || null
    })

    if (testError) {
      console.error('[CronStatusAPI] Error accessing cron_status table:', testError)
      return NextResponse.json(
        { error: `Database access error: ${testError.message}` },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('cron_status')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)

    if (countError) {
      console.error('[CronStatusAPI] Error getting total count:', countError)
    }

    // Get available site_ids for debugging (limited sample)
    const { data: siteIds } = await supabase
      .from('cron_status')
      .select('site_id')
      .limit(20)

    console.log('[CronStatusAPI] Available site_ids:', siteIds?.map(s => s.site_id))

    // Main query for the specific site with pagination
    console.log(`[CronStatusAPI] Executing main query for site_id: ${siteId}`)
    const { data, error } = await supabase
      .from('cron_status')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .range(offset, offset + validatedLimit - 1)

    console.log('[CronStatusAPI] Main query result:', {
      count: data?.length || 0,
      error: error?.message || null,
      firstRecord: data?.[0] || null
    })

    if (error) {
      console.error('[CronStatusAPI] Error fetching cron status:', error)
      return NextResponse.json(
        { error: `Failed to fetch cron status: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`[CronStatusAPI] Successfully fetched ${data?.length || 0} cron status records`)

    const totalPages = totalCount ? Math.ceil(totalCount / validatedLimit) : 0

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalCount: totalCount || 0,
        pageSize: validatedLimit,
        hasNextPage: validatedPage < totalPages,
        hasPreviousPage: validatedPage > 1
      },
      meta: {
        count: data?.length || 0,
        siteId,
        availableSiteIds: siteIds?.map(s => s.site_id) || []
      }
    })

  } catch (error) {
    console.error('[CronStatusAPI] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}