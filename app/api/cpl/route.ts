import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const userId = searchParams.get('userId');
    const segmentId = searchParams.get('segmentId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    // Parse dates
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam ? new Date(startDateParam) : subDays(endDate, 30);

    // Calculate previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousPeriodEnd = new Date(startDate.getTime() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodLength);

    // Initialize Supabase client
    const supabase = await createClient();

    // Calculate period type
    let periodType = "custom";
    const daysDiff = Math.floor(periodLength / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) periodType = "daily";
    else if (daysDiff <= 7) periodType = "weekly";
    else if (daysDiff <= 31) periodType = "monthly";
    else if (daysDiff <= 92) periodType = "quarterly";
    else periodType = "yearly";

    // Get transactions for current period
    let transactionQuery = supabase
      .from('transactions')
      .select('id, amount, campaign_id')
      .eq('site_id', siteId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    // Apply segment filter if provided
    if (segmentId && segmentId !== 'all') {
      // Necesitamos obtener primero las campañas del segmento
      const { data: segmentCampaigns } = await supabase
        .from('campaign_segments')
        .select('campaign_id')
        .eq('segment_id', segmentId);
      
      if (segmentCampaigns && segmentCampaigns.length > 0) {
        const campaignIds = segmentCampaigns.map(sc => sc.campaign_id);
        transactionQuery = transactionQuery.in('campaign_id', campaignIds);
      }
    }
    
    const { data: transactions, error: transactionsError } = await transactionQuery;
    
    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch transaction data' },
        { status: 500 }
      );
    }
    
    // Sum all transaction amounts
    const totalCosts = transactions?.reduce((sum, transaction) => {
      const amount = typeof transaction.amount === 'number' 
        ? transaction.amount 
        : parseFloat(transaction.amount?.toString() || '0');
      return sum + amount;
    }, 0) || 0;
    
    // Get previous period transactions
    let prevTransactionQuery = supabase
      .from('transactions')
      .select('id, amount, campaign_id')
      .eq('site_id', siteId)
      .gte('created_at', previousPeriodStart.toISOString())
      .lte('created_at', previousPeriodEnd.toISOString());
    
    // Apply segment filter if provided
    if (segmentId && segmentId !== 'all') {
      // Usar los mismos IDs de campañas del segmento
      const { data: segmentCampaigns } = await supabase
        .from('campaign_segments')
        .select('campaign_id')
        .eq('segment_id', segmentId);
      
      if (segmentCampaigns && segmentCampaigns.length > 0) {
        const campaignIds = segmentCampaigns.map(sc => sc.campaign_id);
        prevTransactionQuery = prevTransactionQuery.in('campaign_id', campaignIds);
      }
    }
    
    const { data: prevTransactions, error: prevTransactionsError } = await prevTransactionQuery;
    
    if (prevTransactionsError) {
      console.error('Error fetching previous transactions:', prevTransactionsError);
    }
    
    // Sum previous transaction amounts
    const prevTotalCosts = prevTransactions?.reduce((sum, transaction) => {
      const amount = typeof transaction.amount === 'number' 
        ? transaction.amount 
        : parseFloat(transaction.amount?.toString() || '0');
      return sum + amount;
    }, 0) || 0;

    // Get leads count for current period
    let leadsQuery = supabase
      .from('leads')
      .select('id, created_at, segment_id')
      .eq('site_id', siteId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Apply segment filter if provided
    if (segmentId && segmentId !== 'all') {
      leadsQuery = leadsQuery.eq('segment_id', segmentId);
    }

    const { data: leadsData, error: leadsError } = await leadsQuery;

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return NextResponse.json(
        { error: 'Failed to fetch leads data' },
        { status: 500 }
      );
    }

    // Get leads count for previous period
    let prevLeadsQuery = supabase
      .from('leads')
      .select('id, created_at, segment_id')
      .eq('site_id', siteId)
      .gte('created_at', previousPeriodStart.toISOString())
      .lte('created_at', previousPeriodEnd.toISOString());

    // Apply same segment filter to previous period
    if (segmentId && segmentId !== 'all') {
      prevLeadsQuery = prevLeadsQuery.eq('segment_id', segmentId);
    }

    const { data: prevLeadsData, error: prevLeadsError } = await prevLeadsQuery;

    if (prevLeadsError) {
      console.error('Error fetching previous leads:', prevLeadsError);
    }

    // Count leads
    const leadsCount = leadsData?.length || 0;
    const prevLeadsCount = prevLeadsData?.length || 0;

    // Calculate CPL - Cost per Lead (using transaction costs instead of campaign budgets)
    const cpl = leadsCount > 0 ? totalCosts / leadsCount : 0;
    const prevCpl = prevLeadsCount > 0 ? prevTotalCosts / prevLeadsCount : 0;

    // Calculate percent change
    let percentChange = 0;
    if (prevCpl > 0 && cpl > 0) {
      percentChange = parseFloat((((cpl - prevCpl) / prevCpl) * 100).toFixed(1));
    }

    console.log("CPL calculation complete:", {
      cpl,
      prevCpl,
      percentChange,
      leadsCount,
      totalCosts
    });

    return NextResponse.json({
      actual: cpl,
      previous: prevCpl,
      percentChange,
      periodType,
      metadata: {
        leadsCount,
        prevLeadsCount,
        totalCosts,
        prevTotalCosts,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        prevStartDate: previousPeriodStart.toISOString(),
        prevEndDate: previousPeriodEnd.toISOString(),
        segmentId: segmentId || 'all',
      }
    });
  } catch (error) {
    console.error('Error in CPL API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 