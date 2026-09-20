import { NextRequest, NextResponse } from 'next/server'
import { Parser } from 'json2csv'
import { format } from 'date-fns'
import {
  markAnalyticsRequestAuthorized,
  requireAnalyticsAccess,
} from '@/lib/auth/api-analytics-access'
import { GET as revenueHandler } from '@/app/api/revenue/route'
import { GET as activeUsersHandler } from '@/app/api/active-users/route'
import { GET as ltvHandler } from '@/app/api/ltv/route'
import { GET as roiHandler } from '@/app/api/roi/route'
import { GET as cacHandler } from '@/app/api/cac/route'
import { GET as cplHandler } from '@/app/api/cpl/route'

async function readHandler(
  handler: (request: NextRequest) => Promise<Response>,
  request: NextRequest,
  path: string,
  userId: string
) {
  const url = new URL(request.url)
  url.pathname = `/api/${path}`
  const childRequest = new NextRequest(url, { headers: request.headers })
  markAnalyticsRequestAuthorized(childRequest, userId)
  const response = await handler(childRequest)
  if (!response.ok) {
    throw new Error(`Dashboard dependency returned ${response.status}`)
  }
  return response.json()
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get('siteId')
    const segmentId = searchParams.get('segmentId') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Date range is required' }, { status: 400 })
    }

    const access = await requireAnalyticsAccess(request)
    if (access.error) return access.error

    // Convert dates to Date objects for consistent handling
    const startDateTime = new Date(startDate)
    const endDateTime = new Date(endDate)

    const [
      revenue,
      activeUsers,
      ltv,
      roi,
      cac,
      cpl
    ] = await Promise.all([
      readHandler(revenueHandler, request, 'revenue', access.userId),
      readHandler(activeUsersHandler, request, 'active-users', access.userId),
      readHandler(ltvHandler, request, 'ltv', access.userId),
      readHandler(roiHandler, request, 'roi', access.userId),
      readHandler(cacHandler, request, 'cac', access.userId),
      readHandler(cplHandler, request, 'cpl', access.userId),
    ])

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