import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export interface LeadAnalysisData {
  id?: string;
  company_name: string;
  industry: string;
  company_size: string;
  annual_revenue?: string;
  current_kpis: {
    monthlyRevenue: number;
    customerAcquisitionCost: number;
    customerLifetimeValue: number;
    conversionRate: number;
    averageOrderValue: number;
    monthlyLeads: number;
    salesCycleLength: number;
    churnRate?: number;
    marketingQualifiedLeads?: number;
    salesQualifiedLeads?: number;
  };
  current_costs: {
    marketingBudget: number;
    salesTeamCost: number;
    technologyCosts: number;
    operationalCosts: number;
    otherCosts: number;
    totalMonthlyCosts?: number;
  };
  sales_process: {
    leadSources: string[];
    qualificationProcess: string;
    followUpFrequency: string;
    closingTechniques: string[];
    painPoints: string[];
    salesTeamSize?: number;
    averageDealSize?: number;
    winRate?: number;
  };
  goals: {
    revenueTarget: number;
    timeframe: string;
    primaryObjectives: string[];
    growthChallenges: string[];
    marketingGoals?: string[];
    salesGoals?: string[];
  };
  contact_info?: {
    email?: string;
    phone?: string;
    name?: string;
    title?: string;
    preferredContactMethod?: string;
    bestTimeToCall?: string;
  };
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
}

// Calculate ROI metrics and projections
function calculateROIAnalysis(data: LeadAnalysisData) {
  const { current_kpis, current_costs, goals } = data;
  
  // Calculate total current costs
  const totalCurrentCosts = Object.values(current_costs).reduce((sum, cost) => sum + (cost || 0), 0);
  
  // Current ROI calculation
  const annualRevenue = current_kpis.monthlyRevenue * 12;
  const currentROI = totalCurrentCosts > 0 ? ((annualRevenue - totalCurrentCosts) / totalCurrentCosts) * 100 : 0;
  
  // Projected improvements with our solution
  const improvements = {
    conversionRateIncrease: 25, // 25% improvement
    leadQualityIncrease: 30, // 30% better lead quality
    salesCycleReduction: 20, // 20% faster sales cycle
    costReduction: 15, // 15% cost reduction
    crmEfficiency: 20, // 20% efficiency gain
    automationSavings: 25, // 25% time savings through automation
  };
  
  // Calculate projections
  const projectedRevenue = annualRevenue * (1 + improvements.conversionRateIncrease / 100);
  const projectedCosts = totalCurrentCosts * (1 - improvements.costReduction / 100);
  const projectedROI = projectedCosts > 0 ? ((projectedRevenue - projectedCosts) / projectedCosts) * 100 : 0;
  
  // ROI projections for different timeframes
  const roi_projections = {
    threeMonth: {
      revenue: annualRevenue * 0.25 * 1.1, // 10% improvement in 3 months
      costs: totalCurrentCosts * 0.25 * 0.95, // 5% cost reduction
      roi: 0
    },
    sixMonth: {
      revenue: annualRevenue * 0.5 * 1.18, // 18% improvement in 6 months
      costs: totalCurrentCosts * 0.5 * 0.9, // 10% cost reduction
      roi: 0
    },
    twelveMonth: {
      revenue: projectedRevenue,
      costs: projectedCosts,
      roi: projectedROI
    },
    twentyFourMonth: {
      revenue: projectedRevenue * 1.15, // Additional 15% growth
      costs: projectedCosts * 0.95, // Additional 5% cost optimization
      roi: 0
    }
  };
  
  // Calculate ROI for each timeframe
  Object.keys(roi_projections).forEach(key => {
    const projection = roi_projections[key as keyof typeof roi_projections];
    projection.roi = projection.costs > 0 ? ((projection.revenue - projection.costs) / projection.costs) * 100 : 0;
  });
  
  // Generate recommendations based on data
  const recommendations = [];
  
  if (current_kpis.conversionRate < 5) {
    recommendations.push({
      category: "Conversion Optimization",
      priority: "High",
      description: "Implement lead scoring and personalized nurturing to improve conversion rates",
      expectedImpact: "25-40% conversion improvement",
      timeline: "2-3 months"
    });
  }
  
  if (current_kpis.customerAcquisitionCost > current_kpis.customerLifetimeValue * 0.3) {
    recommendations.push({
      category: "CAC Optimization",
      priority: "High",
      description: "Optimize marketing spend and improve lead quality to reduce acquisition costs",
      expectedImpact: "20-30% CAC reduction",
      timeline: "1-2 months"
    });
  }
  
  if (current_kpis.salesCycleLength > 30) {
    recommendations.push({
      category: "Sales Acceleration",
      priority: "Medium",
      description: "Implement automated follow-up sequences and sales enablement tools",
      expectedImpact: "20-35% faster sales cycle",
      timeline: "2-4 months"
    });
  }
  
  // Opportunity cost calculation
  const opportunityCosts = (goals.revenueTarget - annualRevenue) * 0.7; // 70% of missed revenue opportunity
  
  return {
    currentROI,
    projectedROI,
    potentialIncrease: projectedROI - currentROI,
    projectedRevenue,
    projectedCosts,
    opportunityCosts,
    recommendations,
    riskFactors: [
      "Market conditions may affect projected growth",
      "Implementation timeline depends on team adoption",
      "Results may vary based on industry and market size"
    ],
    implementationPlan: {
      phase1: "Setup and integration (Month 1)",
      phase2: "Process optimization (Months 2-3)",
      phase3: "Advanced automation (Months 4-6)",
      phase4: "Scale and optimize (Months 7-12)"
    },
    expectedTimeline: "6-12 months for full implementation"
  };
}

// Generate strategies based on analysis
function generateStrategies(data: LeadAnalysisData, analysis: any) {
  const strategies = {
    leadOptimization: [
      "Implement AI-powered lead scoring system",
      "Create targeted landing pages for different segments",
      "Optimize lead capture forms and CTAs",
      "Develop lead magnets for each buyer persona"
    ],
    conversionImprovement: [
      "Set up automated email nurturing sequences",
      "Implement behavioral tracking and triggers",
      "Create personalized content recommendations",
      "Optimize sales funnel touchpoints"
    ],
    costReduction: [
      "Automate repetitive marketing tasks",
      "Consolidate marketing technology stack",
      "Optimize ad spend through better targeting",
      "Implement self-service customer support"
    ],
    revenueGrowth: [
      "Develop upselling and cross-selling programs",
      "Create customer referral incentives",
      "Implement dynamic pricing strategies",
      "Expand into new market segments"
    ],
    processAutomation: [
      "Automate lead qualification and routing",
      "Set up CRM workflow automation",
      "Implement chatbot for initial customer support",
      "Create automated reporting dashboards"
    ],
    technologyUpgrades: [
      "Integrate CRM with marketing automation",
      "Implement advanced analytics and reporting",
      "Set up customer data platform (CDP)",
      "Deploy AI-powered sales insights"
    ]
  };
  
  return strategies;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const data: LeadAnalysisData = await request.json();
    
    // Get client IP and user agent for tracking
    const ip = request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const userAgent = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';
    
    // Calculate analysis results
    const analysis_results = calculateROIAnalysis(data);
    const strategies = generateStrategies(data, analysis_results);
    
    // Calculate ROI projections
    const roi_projections = {
      threeMonth: analysis_results.projectedRevenue * 0.25,
      sixMonth: analysis_results.projectedRevenue * 0.5,
      twelveMonth: analysis_results.projectedRevenue,
      twentyFourMonth: analysis_results.projectedRevenue * 1.15
    };
    
    // Calculate completion percentage
    let completionScore = 0;
    if (data.company_name) completionScore += 20;
    if (data.industry) completionScore += 15;
    if (data.current_kpis.monthlyRevenue > 0) completionScore += 25;
    if (data.current_costs.marketingBudget > 0) completionScore += 20;
    if (data.sales_process.qualificationProcess) completionScore += 10;
    if (data.goals.revenueTarget > 0) completionScore += 10;
    
    // Prepare data for database
    const leadAnalysisRecord = {
      company_name: data.company_name,
      industry: data.industry || null,
      company_size: data.company_size || null,
      annual_revenue: data.annual_revenue || null,
      current_kpis: data.current_kpis,
      current_costs: {
        ...data.current_costs,
        totalMonthlyCosts: Object.values(data.current_costs).reduce((sum, cost) => sum + (cost || 0), 0)
      },
      sales_process: data.sales_process,
      goals: data.goals,
      analysis_results,
      roi_projections,
      strategies,
      contact_info: data.contact_info || {},
      status: completionScore >= 80 ? 'completed' : 'draft',
      completion_percentage: completionScore,
      source: 'roi-calculator',
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      referrer: referrer,
      ip_address: ip,
      user_agent: userAgent,
      completed_at: completionScore >= 80 ? new Date().toISOString() : null
    };
    
    // Insert into database
    const { data: insertedData, error } = await supabase
      .from('lead_analysis')
      .insert([leadAnalysisRecord])
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save analysis', details: error.message },
        { status: 500 }
      );
    }
    
    // Return the analysis results
    return NextResponse.json({
      success: true,
      id: insertedData.id,
      analysis: {
        ...analysis_results,
        roi_projections,
        strategies,
        completion_percentage: completionScore
      }
    });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      // Get specific analysis
      const { data, error } = await supabase
        .from('lead_analysis')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        return NextResponse.json(
          { error: 'Analysis not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ success: true, data });
    } else {
      // Get all analyses (admin only)
      const { data, error } = await supabase
        .from('lead_analysis')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch analyses' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ success: true, data });
    }
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { id, ...updateData } = await request.json();
    
    // Debug logging
    console.log('🔍 PUT API Debug:', {
      id,
      current_costs: updateData.current_costs,
      updateDataKeys: Object.keys(updateData)
    });
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required for updates' },
        { status: 400 }
      );
    }
    
    // Recalculate analysis if core data changed
    // Temporarily commented out to isolate the issue
    // if (updateData.current_kpis || updateData.current_costs || updateData.goals) {
    //   const analysis_results = calculateROIAnalysis(updateData);
    //   const strategies = generateStrategies(updateData, analysis_results);
    //   updateData.analysis_results = analysis_results;
    //   updateData.strategies = strategies;
    // }
    
    // Clean the payload - remove fields that don't belong in the database
    const {
      activeTab,
      isAnalyzing,
      analysisComplete,
      opportunityCosts,
      fuzzyRecommendations,
      isSaving,
      isSaved,
      nextStepsPlan,
      analysisResults,
      analysisId,
      lastSavedAt,
      completedSections,
      ...cleanUpdateData
    } = updateData;

    // Log what we're about to update
    const updatePayload = {
      ...cleanUpdateData,
      updated_at: new Date().toISOString()
    };
    
    console.log('🔍 Supabase Update Payload:', {
      id,
      current_costs: updatePayload.current_costs,
      payloadKeys: Object.keys(updatePayload)
    });

    const { data, error } = await supabase
      .from('lead_analysis')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('🚨 Supabase Update Error:', error);
      return NextResponse.json(
        { error: 'Failed to update analysis', details: error.message, code: error.code },
        { status: 500 }
      );
    }
    
    console.log('✅ Supabase Update Success:', { id, updatedData: data });
    
    return NextResponse.json({ success: true, data });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
