"use server";

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export interface LeadAnalysisFormData {
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
    convertedCustomers: number;
    customerLifetimeSpan: number;
    churnRate: number;
  };
  current_costs: {
    marketingBudget: number;
    salesTeamCost: number;
    salesCommission: number;
    technologyCosts: number;
    operationalCosts: number;
    cogs: number;
    otherCosts: number;
  };
  sales_process: {
    leadSources: string[];
    qualificationProcess: {
      deepResearch: boolean;
      manualResearch: boolean;
      interviews: boolean;
      icpTargeting: boolean;
      behaviorAnalysis: boolean;
      leadScoring: boolean;
      demographicFiltering: boolean;
      companySize: boolean;
      budgetQualification: boolean;
      decisionMakerID: boolean;
      painPointAssessment: boolean;
      competitorAnalysis: boolean;
    };
    followUpFrequency: string;
    closingTechniques: string[];
    painPoints: string[];
    salesActivities: {
      coldCalls: boolean;
      personalizedFollowUp: boolean;
      videoCalls: boolean;
      transactionalEmails: boolean;
      socialSelling: boolean;
      contentMarketing: boolean;
      referralProgram: boolean;
      webinarsEvents: boolean;
      paidAds: boolean;
      seoContent: boolean;
      partnerships: boolean;
      directMail: boolean;
      tradeShows: boolean;
      influencerMarketing: boolean;
      retargeting: boolean;
      activations: boolean;
      physicalVisits: boolean;
      personalBrand: boolean;
    };
    availableTools: {
      // CRM & Sales Tools
      crmSystem: boolean;
      salesAutomation: boolean;
      leadScoringTool: boolean;
      pipelineManagement: boolean;
      
      // Communication Tools
      emailMarketing: boolean;
      videoConferencing: boolean;
      phoneSystem: boolean;
      liveChatSupport: boolean;
      whatsappBusiness: boolean;
      
      // Analytics & Tracking
      webAnalytics: boolean;
      heatmapTools: boolean;
      abtestingPlatform: boolean;
      conversionTracking: boolean;
      customerFeedback: boolean;
      
      // Content & Marketing
      contentManagement: boolean;
      socialMediaTools: boolean;
      seoTools: boolean;
      designSoftware: boolean;
      videoEditingSoftware: boolean;
      
      // Advertising & Paid Media
      googleAds: boolean;
      facebookAds: boolean;
      linkedinAds: boolean;
      displayAdvertising: boolean;
      retargetingPixels: boolean;
      
      // Automation & Integration
      marketingAutomation: boolean;
      zapierIntegrations: boolean;
      webhooks: boolean;
      apiIntegrations: boolean;
      workflowAutomation: boolean;
      
      // Project Management
      projectManagement: boolean;
      teamCollaboration: boolean;
      documentManagement: boolean;
      timeTracking: boolean;
      taskManagement: boolean;
    };
  };
  goals: {
    revenueTarget: number;
    timeframe: string;
    primaryObjectives: string[];
    growthChallenges: string[];
  };
  contact_info?: {
    email?: string;
    phone?: string;
    name?: string;
    title?: string;
    preferredContactMethod?: string;
    bestTimeToCall?: string;
  };
}

export async function saveLeadAnalysis(formData: LeadAnalysisFormData) {
  try {
    const response = await fetch('/api/lead-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to save analysis');
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error saving lead analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function getLeadAnalysis(id: string) {
  try {
    const response = await fetch(`/api/lead-analysis?id=${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch analysis');
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('Error fetching lead analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function updateLeadAnalysis(id: string, updateData: Partial<LeadAnalysisFormData>) {
  try {
    const response = await fetch('/api/lead-analysis', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, ...updateData }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update analysis');
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('Error updating lead analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Server action to get lead analyses for admin dashboard
export async function getLeadAnalyses() {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('lead_analysis')
      .select(`
        id,
        company_name,
        industry,
        company_size,
        annual_revenue,
        status,
        completion_percentage,
        analysis_results,
        contact_info,
        created_at,
        updated_at,
        completed_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error('Error fetching lead analyses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      data: [],
    };
  }
}

// Server action to update lead status (for sales team)
export async function updateLeadStatus(id: string, status: 'draft' | 'completed' | 'reviewed' | 'contacted' | 'converted') {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('lead_analysis')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error updating lead status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}


