import { NextRequest, NextResponse } from 'next/server'
import { Parser } from 'json2csv'
import { format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get('siteId')
    const segmentId = searchParams.get('segmentId') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Date range is required' }, { status: 400 })
    }

    // Convert dates to Date objects for consistent handling
    const startDateTime = new Date(startDate)
    const endDateTime = new Date(endDate)

    // Fetch data from all report endpoints
    const params = new URLSearchParams()
    params.append('siteId', siteId)
    params.append('segmentId', segmentId)
    if (userId) params.append('userId', userId)
    params.append('startDate', startDateTime.toISOString())
    params.append('endDate', endDateTime.toISOString())

    console.log('Fetching dashboard data with params:', Object.fromEntries(params.entries()))

    const [
      revenueResponse,
      activeUsersResponse,
      ltvResponse,
      roiResponse,
      cacResponse,
      cplResponse
    ] = await Promise.all([
      fetch(`${request.nextUrl.origin}/api/revenue?${params.toString()}`),
      fetch(`${request.nextUrl.origin}/api/active-users?${params.toString()}`),
      fetch(`${request.nextUrl.origin}/api/ltv?${params.toString()}`),
      fetch(`${request.nextUrl.origin}/api/roi?${params.toString()}`),
      fetch(`${request.nextUrl.origin}/api/cac?${params.toString()}`),
      fetch(`${request.nextUrl.origin}/api/cpl?${params.toString()}`)
    ])

    // Check if any request failed
    if (!revenueResponse.ok || !activeUsersResponse.ok || !ltvResponse.ok || 
        !roiResponse.ok || !cacResponse.ok || !cplResponse.ok) {
      console.error('One or more API requests failed:', {
        revenue: revenueResponse.status,
        activeUsers: activeUsersResponse.status,
        ltv: ltvResponse.status,
        roi: roiResponse.status,
        cac: cacResponse.status,
        cpl: cplResponse.status
      })
      return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
    }

    const [
      revenue,
      activeUsers,
      ltv,
      roi,
      cac,
      cpl
    ] = await Promise.all([
      revenueResponse.json(),
      activeUsersResponse.json(),
      ltvResponse.json(),
      roiResponse.json(),
      cacResponse.json(),
      cplResponse.json()
    ])

    console.log('API Responses:', {
      revenue,
      activeUsers,
      ltv,
      roi,
      cac,
      cpl
    })

    // Transform data for CSV
    const reportData = [{
      Date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      Period: `${format(startDateTime, 'yyyy-MM-dd')} to ${format(endDateTime, 'yyyy-MM-dd')}`,
      Segment: segmentId === 'all' ? 'All Segments' : segmentId,
      
      // Revenue metrics
      Revenue: revenue.actual || 0,
      PreviousRevenue: revenue.previous || 0,
      RevenueChange: revenue.percentChange || 0,
      
      // Active users metrics
      ActiveUsers: activeUsers.actual || activeUsers.activeUsers || 0,
      PreviousActiveUsers: activeUsers.previous || activeUsers.prevActiveUsers || 0,
      ActiveUsersChange: activeUsers.percentChange || 0,
      
      // LTV metrics
      LTV: ltv.actual || 0,
      PreviousLTV: ltv.previous || 0,
      LTVChange: ltv.percentChange || 0,
      
      // ROI metrics
      ROI: roi.actual || 0,
      PreviousROI: roi.previous || 0,
      ROIChange: roi.percentChange || 0,
      ROICampaignCount: roi.details?.campaignCount || 0,
      ROICampaignBudget: roi.details?.campaignBudget || 0,
      ROIConvertedLeads: roi.details?.convertedLeadsCount || 0,
      ROITotalRevenue: roi.details?.totalRevenue || 0,
      
      // CAC metrics
      CAC: cac.actual || cac.cac || 0,
      PreviousCAC: cac.previous || cac.prevCac || 0,
      CACChange: cac.percentChange || 0,
      
      // CPL metrics
      CPL: cpl.actual || cpl.cpl || 0,
      PreviousCPL: cpl.previous || cpl.prevCpl || 0,
      CPLChange: cpl.percentChange || 0,
      
      // Additional metrics
      TotalLeads: cpl.leadsCount || roi.details?.convertedLeadsCount || 0,
      TotalCosts: cpl.totalCosts || roi.details?.campaignBudget || 0,
      TotalTransactions: roi.details?.totalTransactions || 0
    }]

    // Convert to CSV
    const fields = [
      'Date',
      'Period',
      'Segment',
      'Revenue',
      'PreviousRevenue',
      'RevenueChange',
      'ActiveUsers',
      'PreviousActiveUsers',
      'ActiveUsersChange',
      'LTV',
      'PreviousLTV',
      'LTVChange',
      'ROI',
      'PreviousROI',
      'ROIChange',
      'ROICampaignCount',
      'ROICampaignBudget',
      'ROIConvertedLeads',
      'ROITotalRevenue',
      'CAC',
      'PreviousCAC',
      'CACChange',
      'CPL',
      'PreviousCPL',
      'CPLChange',
      'TotalLeads',
      'TotalCosts',
      'TotalTransactions'
    ]
    const parser = new Parser({ fields })
    const csv = parser.parse(reportData)
    
    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
      }
    })
  } catch (error) {
    console.error('Error in export dashboard API:', error)
    return NextResponse.json({ error: 'Failed to export dashboard data' }, { status: 500 })
  }
} 