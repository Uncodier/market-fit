import type { QueryResult } from '../_shared/query-result';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subDays, subMonths, format, subQuarters, subYears } from 'date-fns';
import { createServiceApiClient } from '@/lib/supabase/server-client';
import { requireAnalyticsAccess } from '@/lib/auth/api-analytics-access';
import { calculateTrend, standardizePeriodDates, findOrCreateKpi } from './kpi';

type ExperimentSegment = { experiment_id: string };
type Experiment = {
  id: string; name: string; status: string; site_id: string;
  experiment_segments: { segment_id: string }[];
};

export async function GET(request: NextRequest) {
  
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  const segmentId = searchParams.get('segmentId');
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  const accessUrl = new URL(request.url);
  if (!startDateStr) accessUrl.searchParams.set('startDate', subDays(new Date(), 30).toISOString());
  if (!endDateStr) accessUrl.searchParams.set('endDate', new Date().toISOString());
  const access = await requireAnalyticsAccess(new Request(accessUrl, { headers: request.headers }));
  if (access.error) return access.error;
  const userId = searchParams.has('userId') ? access.userId : null;
  const supabase = createServiceApiClient(siteId);

  
  console.log('[ActiveExperimentsAPI] Request for site ID:', siteId, segmentId ? `with segment ID: ${segmentId}` : '');
  
  try {
    // Calculate period dates
    let periodStart = startDateStr ? new Date(startDateStr) : subDays(new Date(), 30);
    let periodEnd = endDateStr ? new Date(endDateStr) : new Date();
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
    
    // Standardize dates for consistency
    const { periodStart: standardizedStart, periodEnd: standardizedEnd, periodType } = 
      standardizePeriodDates(periodStart, periodEnd);
    
    // Calculate previous period dates based on current period length
    let standardizedPrevStart: Date;
    let standardizedPrevEnd: Date;
    
    if (periodType === "daily") {
      standardizedPrevStart = subDays(standardizedStart, 1);
      standardizedPrevEnd = subDays(standardizedEnd, 1);
    } else if (periodType === "weekly") {
      standardizedPrevStart = subDays(standardizedStart, 7);
      standardizedPrevEnd = subDays(standardizedEnd, 7);
    } else if (periodType === "monthly") {
      standardizedPrevStart = subMonths(standardizedStart, 1);
      standardizedPrevEnd = subMonths(standardizedEnd, 1);
    } else if (periodType === "quarterly") {
      standardizedPrevStart = subQuarters(standardizedStart, 1);
      standardizedPrevEnd = subQuarters(standardizedEnd, 1);
    } else {
      standardizedPrevStart = subYears(standardizedStart, 1);
      standardizedPrevEnd = subYears(standardizedEnd, 1);
    }
    
    // Get ALL experiments for the site
    let query = supabase
      .from('experiments')
      .select('id, name, status, site_id, experiment_segments(segment_id)')
      .eq('site_id', siteId);
    
    // If we have a segment ID, filter to experiments with that segment
    if (segmentId) {
      // Get experiments that have this segment associated
      const { data: experimentIdsForSegment, error: segmentError }: QueryResult<ExperimentSegment[]> = await supabase
        .from('experiment_segments')
        .select('experiment_id')
        .eq('segment_id', segmentId);
      
      if (segmentError) {
        console.error('[ActiveExperimentsAPI] Error fetching experiments for segment:', segmentError);
        return NextResponse.json({
          error: 'Failed to fetch experiments for segment',
          details: segmentError
        }, { status: 500 });
      }
      
      if (experimentIdsForSegment && experimentIdsForSegment.length > 0) {
        const experimentIds = experimentIdsForSegment.map(item => item.experiment_id);
        query = query.in('id', experimentIds);
      } else {
        // No experiments for this segment
        console.log('[ActiveExperimentsAPI] No experiments found for segment:', segmentId);
        return NextResponse.json({
          actual: 0,
          percentChange: 0,
          periodType,
          debugInfo: {
            allExperiments: [],
            activeExperiments: []
          }
        });
      }
    }
    
    const { data: allExperiments, error: allExperimentsError }: QueryResult<Experiment[]> = await query;
    
    console.log('[ActiveExperimentsAPI] All experiments found:', allExperiments?.length || 0);
    
    if (allExperimentsError) {
      console.error('[ActiveExperimentsAPI] Error fetching all experiments:', allExperimentsError);
    }
    
    // Filter to only ACTIVE experiments
    const activeExperiments = allExperiments?.filter(exp => exp.status === 'active') || [];
    
    console.log('[ActiveExperimentsAPI] Found active experiments:', activeExperiments.length);
    
    // Get the current count of active experiments
    const activeExperimentsCount = activeExperiments.length;
    
    // Now we need to get the previous period active experiments count
    // Try to get from existing KPI first, then fall back to direct query
    let previousValue = 0;
    let percentChange = 0;
    
    // Create a Supabase admin client for writing to the KPIs table
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    if (userId && !skipKpiCreation) {
      // First try to find existing KPI for previous period
      const { kpi: prevKpi } = await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId, // Now we pass the segment ID if available
          periodStart: standardizedPrevStart,
          periodEnd: standardizedPrevEnd,
          type: "experiments",
          name: "Active Experiments",
          value: 0, // Will be updated if needed
          previousValue: undefined
        }
      );
      
      if (prevKpi) {
        // If we found an existing KPI, use its value
        previousValue = prevKpi.value;
        console.log(`[ActiveExperimentsAPI] Found previous KPI with value: ${previousValue}`);
      } else {
        // Query the previous period experiments data directly
        // Since this requires segment filtering, the query gets more complex
        let prevQuery = supabase
          .from('experiments')
          .select('id, name')
          .eq('site_id', siteId)
          .eq('status', 'active')
          .lt('created_at', standardizedStart.toISOString());
        
        if (segmentId) {
          // Get previous period experiment IDs for this segment
          const { data: prevExperimentIdsForSegment }: QueryResult<ExperimentSegment[]> = await supabase
            .from('experiment_segments')
            .select('experiment_id')
            .eq('segment_id', segmentId);
          
          if (prevExperimentIdsForSegment && prevExperimentIdsForSegment.length > 0) {
            const experimentIds = prevExperimentIdsForSegment.map(item => item.experiment_id);
            prevQuery = prevQuery.in('id', experimentIds);
          } else {
            // No previous experiments for this segment
            previousValue = 0;
          }
        }
        
        const { data: prevActiveExperiments, error: prevExperimentsError }: QueryResult<Pick<Experiment, 'id' | 'name'>[]> = await prevQuery;
        
        if (!prevExperimentsError && prevActiveExperiments) {
          previousValue = prevActiveExperiments.length;
          console.log(`[ActiveExperimentsAPI] Queried previous active experiments count: ${previousValue}`);
          
          // Create KPI for previous period with the calculated value
          await findOrCreateKpi(
            supabase,
            supabaseAdmin,
            {
              siteId,
              userId,
              segmentId,
              periodStart: standardizedPrevStart,
              periodEnd: standardizedPrevEnd,
              type: "experiments",
              name: "Active Experiments",
              value: previousValue,
              previousValue: undefined
            }
          );
        }
      }
      
      // Create or update the current period KPI
      if (activeExperimentsCount > 0 || previousValue > 0) {
        const { kpi: currentKpi } = await findOrCreateKpi(
          supabase,
          supabaseAdmin,
          {
            siteId,
            userId,
            segmentId,
            periodStart: standardizedStart,
            periodEnd: standardizedEnd,
            type: "experiments",
            name: "Active Experiments",
            value: activeExperimentsCount,
            previousValue
          }
        );
        
        if (currentKpi) {
          // Use the stored trend value if available
          percentChange = currentKpi.trend;
        } else {
          // Calculate trend if KPI creation failed
          percentChange = calculateTrend(activeExperimentsCount, previousValue);
        }
      } else {
        // No experiments data available
        percentChange = 0;
      }
    } else {
      // If no userId or skipping KPI creation, just calculate the change
      // Query the previous period experiments directly
      let prevQuery = supabase
        .from('experiments')
        .select('id, name')
        .eq('site_id', siteId)
        .eq('status', 'active')
        .lt('created_at', standardizedStart.toISOString());
      
      if (segmentId) {
        // Get previous period experiment IDs for this segment
        const { data: prevExperimentIdsForSegment }: QueryResult<ExperimentSegment[]> = await supabase
          .from('experiment_segments')
          .select('experiment_id')
          .eq('segment_id', segmentId);
        
        if (prevExperimentIdsForSegment && prevExperimentIdsForSegment.length > 0) {
          const experimentIds = prevExperimentIdsForSegment.map(item => item.experiment_id);
          prevQuery = prevQuery.in('id', experimentIds);
        }
      }
      
      const { data: prevActiveExperiments, error: prevExperimentsError }: QueryResult<Pick<Experiment, 'id' | 'name'>[]> = await prevQuery;
      
      if (!prevExperimentsError && prevActiveExperiments) {
        previousValue = prevActiveExperiments.length;
      }
      
      // Calculate trend without storing KPI
      percentChange = calculateTrend(activeExperimentsCount, previousValue);
    }
    
    const responseData = {
      actual: activeExperimentsCount,
      percentChange,
      periodType,
      debugInfo: {
        allExperiments,
        activeExperiments,
        segmentFiltered: !!segmentId
      }
    };
    
    console.log('[ActiveExperimentsAPI] Response data:', responseData);
    
    // Return the active experiments data
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[ActiveExperimentsAPI] Error fetching active experiments:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch active experiments data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 