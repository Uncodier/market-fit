import { useState, useCallback, useEffect, useMemo } from 'react';
import { type LeadAnalysisFormData } from '@/app/roi-calculator/actions';
import { toast } from 'sonner';
import { 
  calculateROIMetrics, 
  validateSectionCompletion, 
  getSectionValidationErrors,
  calculateOpportunityCosts,
  generateFuzzyLogicRecommendations,
  generateNextStepsPlan,
  OpportunityCost,
  FuzzyLogicRecommendation,
  SalesActivities,
  ROIMetrics,
  NextStepsPlan
} from '@/app/roi-calculator/utils';

export interface ROICalculatorState extends LeadAnalysisFormData {
  // Additional UI state
  activeTab: string;
  isAnalyzing: boolean;
  analysisComplete: boolean;
  analysisId?: string;
  analysisResults?: any;
  opportunityCosts: OpportunityCost[];
  fuzzyRecommendations: FuzzyLogicRecommendation[];
  nextStepsPlan: NextStepsPlan | null;
  // Save state
  isSaving: boolean;
  isSaved: boolean;
  lastSavedAt?: Date;
}

const initialState: ROICalculatorState = {
  // Company Information
  company_name: "",
  industry: "",
  company_size: "",
  annual_revenue: "",
  
  // Current KPIs
  current_kpis: {
    monthlyRevenue: 0,
    customerAcquisitionCost: 0,
    customerLifetimeValue: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    monthlyLeads: 0,
    salesCycleLength: 0,
    convertedCustomers: 0,
    customerLifetimeSpan: 0,
    churnRate: 0,
  },
  
  // Current Costs
  current_costs: {
    marketingBudget: 0,
    salesTeamCost: 0,
    salesCommission: 0,
    technologyCosts: 0,
    operationalCosts: 0,
    cogs: 0,
    otherCosts: 0,
  },
  
  // Sales Process
  sales_process: {
    leadSources: [],
    qualificationProcess: {
      deepResearch: false,
      manualResearch: false,
      interviews: false,
      icpTargeting: false,
      behaviorAnalysis: false,
      leadScoring: false,
      demographicFiltering: false,
      companySize: false,
      budgetQualification: false,
      decisionMakerID: false,
      painPointAssessment: false,
      competitorAnalysis: false,
    },
    followUpFrequency: "",
    closingTechniques: [],
    painPoints: [],
    salesActivities: {
      coldCalls: false,
      personalizedFollowUp: false,
      videoCalls: false,
      transactionalEmails: false,
      socialSelling: false,
      contentMarketing: false,
      referralProgram: false,
      webinarsEvents: false,
      paidAds: false,
      seoContent: false,
      partnerships: false,
      directMail: false,
      tradeShows: false,
      influencerMarketing: false,
      retargeting: false,
      activations: false,
      physicalVisits: false,
      personalBrand: false,
    },
    availableTools: {
      // CRM & Sales Tools
      crmSystem: false,
      salesAutomation: false,
      leadScoringTool: false,
      pipelineManagement: false,
      
      // Communication Tools
      emailMarketing: false,
      videoConferencing: false,
      phoneSystem: false,
      liveChatSupport: false,
      whatsappBusiness: false,
      
      // Analytics & Tracking
      webAnalytics: false,
      heatmapTools: false,
      abtestingPlatform: false,
      conversionTracking: false,
      customerFeedback: false,
      
      // Content & Marketing
      contentManagement: false,
      socialMediaTools: false,
      seoTools: false,
      designSoftware: false,
      videoEditingSoftware: false,
      
      // Advertising & Paid Media
      googleAds: false,
      facebookAds: false,
      linkedinAds: false,
      displayAdvertising: false,
      retargetingPixels: false,
      
      // Automation & Integration
      marketingAutomation: false,
      zapierIntegrations: false,
      webhooks: false,
      apiIntegrations: false,
      workflowAutomation: false,
      
      // Project Management
      projectManagement: false,
      teamCollaboration: false,
      documentManagement: false,
      timeTracking: false,
      taskManagement: false,
    },
  },
  
  // Goals and Objectives
  goals: {
    revenueTarget: 0,
    timeframe: "",
    primaryObjectives: [],
    growthChallenges: [],
  },
  
  // Contact Information
  contact_info: {
    email: "",
    phone: "",
    name: "",
    title: "",
    preferredContactMethod: "",
    bestTimeToCall: "",
  },
  
  // UI State
  activeTab: "company-info",
  isAnalyzing: false,
  analysisComplete: false,
  opportunityCosts: [],
  fuzzyRecommendations: [],
  // Save state
  isSaving: false,
  isSaved: false,
  nextStepsPlan: null,
};

export function useROICalculator() {
  const [state, setState] = useState<ROICalculatorState>(initialState);

  // Calculate completed sections using useMemo to avoid infinite loops
  const completedSections = useMemo(() => {
    const sections = ["company-info", "current-kpis", "current-costs", "sales-process", "goals"];
    return sections.filter(section => validateSectionCompletion(section, state));
  }, [state.company_name, state.industry, state.company_size, state.current_kpis, state.current_costs, state.sales_process, state.goals]);

  // Check if current section is complete
  const checkSectionCompletion = useCallback((section: string, currentState = state) => {
    return validateSectionCompletion(section, currentState);
  }, [state]);

  // Update a specific section of the analysis data
  const updateSection = useCallback((section: keyof LeadAnalysisFormData, data: any) => {
    setState(prev => ({
      ...prev,
      [section]: typeof prev[section] === 'object' && prev[section] !== null
        ? { ...prev[section], ...data }
        : data
    }));
  }, []);

  // Update a single field
  const updateField = useCallback((field: keyof ROICalculatorState, value: any) => {
    setState(prev => ({ ...prev, [field]: value }));
  }, []);

  // Calculate ROI metrics
  const calculateMetrics = useCallback(() => {
    return calculateROIMetrics(
      state.current_kpis, 
      state.current_costs, 
      state.goals,
      state.industry,
      state.company_size
    );
  }, [state.current_kpis, state.current_costs, state.goals, state.industry, state.company_size]);

  // Calculate opportunity costs
  const calculateOpportunities = useCallback(() => {
    if (!state.industry || !state.company_size) return [];
    
    return calculateOpportunityCosts(
      state.sales_process.salesActivities as SalesActivities,
      state.current_kpis,
      state.current_costs,
      state.industry,
      state.company_size,
      state.sales_process.availableTools
    );
  }, [state.sales_process.salesActivities, state.current_kpis, state.current_costs, state.industry, state.company_size, state.sales_process.availableTools]);

  // Generate fuzzy logic recommendations
  const generateRecommendations = useCallback(() => {
    if (!state.industry || !state.company_size) return [];
    
    return generateFuzzyLogicRecommendations(
      state.sales_process.salesActivities as SalesActivities,
      state.current_kpis,
      state.current_costs,
      state.industry,
      state.company_size
    );
  }, [state.sales_process.salesActivities, state.current_kpis, state.current_costs, state.industry, state.company_size]);

  // Generate next steps plan
  const generateNextSteps = useCallback(() => {
    if (!state.industry || !state.company_size || !state.current_kpis.monthlyRevenue) return null;
    
    return generateNextStepsPlan(
      state.sales_process.salesActivities as SalesActivities,
      state.current_kpis,
      state.current_costs,
      state.industry,
      state.company_size,
      state.fuzzyRecommendations,
      state.opportunityCosts,
      state.sales_process.availableTools
    );
  }, [state.sales_process.salesActivities, state.current_kpis, state.current_costs, state.industry, state.company_size, state.fuzzyRecommendations, state.opportunityCosts, state.sales_process.availableTools]);

  // Update opportunity costs, recommendations, and next steps when relevant data changes
  useEffect(() => {
    if (state.industry && state.company_size && state.current_kpis.monthlyRevenue > 0) {
      const opportunities = calculateOpportunities();
      const recommendations = generateRecommendations();
      const nextSteps = generateNextStepsPlan(
        state.sales_process.salesActivities as SalesActivities,
        state.current_kpis,
        state.current_costs,
        state.industry,
        state.company_size,
        recommendations,
        opportunities,
        state.sales_process.availableTools
      );
      
      setState(prev => ({
        ...prev,
        opportunityCosts: opportunities,
        fuzzyRecommendations: recommendations,
        nextStepsPlan: nextSteps
      }));
    }
  }, [calculateOpportunities, generateRecommendations]);

  // Calculate completion progress
  const getProgress = useCallback(() => {
    const totalSections = 5;
    return (completedSections.length / totalSections) * 100;
  }, [completedSections]);

  // Generate analysis
  const generateAnalysis = useCallback(async () => {
    setState(prev => ({ ...prev, isAnalyzing: true }));
    
    try {
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Save to database and get analysis results
      const result = await saveLeadAnalysis({
        company_name: state.company_name,
        industry: state.industry,
        company_size: state.company_size,
        annual_revenue: state.annual_revenue,
        current_kpis: state.current_kpis,
        current_costs: state.current_costs,
        sales_process: state.sales_process,
        goals: state.goals,
        contact_info: state.contact_info,
      });
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          analysisComplete: true,
          analysisId: result.data.id,
          analysisResults: result.data.analysis,
          activeTab: "analysis"
        }));
        return { success: true, data: result.data };
      } else {
        setState(prev => ({ ...prev, isAnalyzing: false }));
        return { success: false, error: result.error };
      }
    } catch (error) {
      setState(prev => ({ ...prev, isAnalyzing: false }));
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }, [state]);

  // Navigate to next section
  const goToNextSection = useCallback(() => {
    const sections = ["company-info", "current-kpis", "current-costs", "sales-process", "goals"];
    const currentIndex = sections.indexOf(state.activeTab);
    if (currentIndex < sections.length - 1) {
      setState(prev => ({ ...prev, activeTab: sections[currentIndex + 1] }));
    }
  }, [state.activeTab]);

  // Navigate to previous section
  const goToPreviousSection = useCallback(() => {
    const sections = ["company-info", "current-kpis", "current-costs", "sales-process", "goals"];
    const currentIndex = sections.indexOf(state.activeTab);
    if (currentIndex > 0) {
      setState(prev => ({ ...prev, activeTab: sections[currentIndex - 1] }));
    }
  }, [state.activeTab]);

  // Reset calculator
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Load saved analysis
  const loadAnalysis = useCallback((analysisData: any) => {
    setState(prev => ({
      ...prev,
      company_name: analysisData.company_name || "",
      industry: analysisData.industry || "",
      company_size: analysisData.company_size || "",
      annual_revenue: analysisData.annual_revenue || "",
      current_kpis: { ...initialState.current_kpis, ...analysisData.current_kpis },
      current_costs: { ...initialState.current_costs, ...analysisData.current_costs },
      sales_process: { ...initialState.sales_process, ...analysisData.sales_process },
      goals: { ...initialState.goals, ...analysisData.goals },
      contact_info: { ...initialState.contact_info, ...analysisData.contact_info },
      analysisResults: analysisData.analysis_results,
      analysisComplete: analysisData.status === 'completed',
      analysisId: analysisData.id,
      isSaved: true,
    }));
  }, []);

  // Load analysis by ID from API
  const loadAnalysisById = useCallback(async (id: string) => {
    console.log('🚀 loadAnalysisById called with ID:', id);
    setState(prev => ({ ...prev, isAnalyzing: true }));
    
    try {
      const url = `/api/lead-analysis?id=${id}`;
      console.log('📡 Fetching from:', url);
      
      const response = await fetch(url);
      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Analysis not found (${response.status})`);
      }
      
      const result = await response.json();
      console.log('📊 API Result:', result);
      
      if (result.success && result.data) {
        console.log('✅ Loading analysis data into state');
        loadAnalysis(result.data);
        toast.success('Analysis loaded successfully!');
      } else {
        throw new Error('Failed to load analysis - no data returned');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analysis';
      console.error('❌ Error loading analysis:', error);
      toast.error(errorMessage);
    } finally {
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [loadAnalysis]);

  // Validate current section
  const validateCurrentSection = useCallback(() => {
    return checkSectionCompletion(state.activeTab);
  }, [state.activeTab, checkSectionCompletion]);

  // Get section validation errors
  const getSectionErrors = useCallback((section: string) => {
    return getSectionValidationErrors(section, state);
  }, [state]);

  return {
    // State
    state: {
      ...state,
      completedSections, // Use the computed completedSections
    },
    
    // Computed values
    progress: getProgress(),
    roiMetrics: calculateMetrics(),
    opportunityCosts: state.opportunityCosts,
    fuzzyRecommendations: state.fuzzyRecommendations,
    nextStepsPlan: state.nextStepsPlan,
    isCurrentSectionValid: validateCurrentSection(),
    currentSectionErrors: getSectionErrors(state.activeTab),
    
    // Actions
    updateSection,
    updateField,
    generateAnalysis,
    goToNextSection,
    goToPreviousSection,
    reset,
    loadAnalysis,
    loadAnalysisById,
    calculateOpportunities,
    generateRecommendations,
    generateNextSteps,
    
    // Save and share functions
    saveAnalysis: useCallback(async () => {
      setState(prev => ({ ...prev, isSaving: true }));
      
      try {
        const isUpdate = !!state.analysisId;
        const method = isUpdate ? 'PUT' : 'POST';
        const body = isUpdate 
          ? JSON.stringify({ id: state.analysisId, ...state })
          : JSON.stringify(state);

        // Debug logging
        console.log('🔍 SaveAnalysis Debug:', {
          isUpdate,
          method,
          analysisId: state.analysisId,
          current_costs: state.current_costs,
          bodyPreview: JSON.parse(body)
        });

        const response = await fetch('/api/lead-analysis', {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `Failed to ${isUpdate ? 'update' : 'save'} analysis`);
        }
        
        setState(prev => ({ 
          ...prev, 
          isSaving: false, 
          isSaved: true, 
          analysisId: result.id || state.analysisId,
          lastSavedAt: new Date()
        }));
        
        const successMessage = isUpdate ? 'Analysis updated successfully!' : 'Analysis saved successfully!';
        toast.success(successMessage);
        
        return {
          success: true,
          data: result,
          id: result.id || state.analysisId
        };
      } catch (error) {
        setState(prev => ({ ...prev, isSaving: false }));
        const errorMessage = error instanceof Error ? error.message : 'Failed to save analysis';
        toast.error(errorMessage);
        throw error;
      }
    }, [state]),

    shareAnalysis: useCallback((analysisId: string) => {
      const shareUrl = `${window.location.origin}/roi-analysis/${analysisId}`;
      
      if (navigator.share) {
        navigator.share({
          title: 'ROI Analysis Results',
          text: `Check out my ROI analysis results for ${state.company_name}`,
          url: shareUrl,
        });
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
          toast.success('Analysis URL copied to clipboard!');
        }).catch(() => {
          toast.error('Failed to copy URL to clipboard');
        });
      }
    }, [state.company_name]),
    
    // Utilities
    checkSectionCompletion,
    getSectionErrors,
  };
}
