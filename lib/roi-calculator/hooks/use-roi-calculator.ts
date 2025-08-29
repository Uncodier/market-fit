/**
 * Optimized ROI Calculator Hook
 * Clean state management with performance optimizations
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { roiCalculatorEngine, type ROIInputs, type ROIOutputs } from '../core/calculator-engine';
import { type SimulationScenario, type MonthlyProjection } from '../core/simulation-engine';

export interface ROICalculatorState {
  // Form data
  inputs: ROIInputs;
  
  // UI state
  activeSection: string;
  isCalculating: boolean;
  isSaving: boolean;
  isSaved: boolean;
  lastSavedAt?: Date;
  
  // Analysis state
  analysisId?: string;
  analysisComplete: boolean;
  
  // Validation
  errors: Record<string, string[]>;
  completedSections: string[];
}

export interface ROICalculatorActions {
  // Input management
  updateCompanyInfo: (data: Partial<ROIInputs['companyInfo']>) => void;
  updateKPIs: (data: Partial<ROIInputs['kpis']>) => void;
  updateCosts: (data: Partial<ROIInputs['costs']>) => void;
  updateSalesProcess: (data: Partial<ROIInputs['salesProcess']>) => void;
  updateGoals: (data: Partial<ROIInputs['goals']>) => void;
  
  // Navigation
  setActiveSection: (section: string) => void;
  goToNextSection: () => void;
  goToPreviousSection: () => void;
  
  // Analysis
  calculateROI: () => Promise<ROIOutputs>;
  saveAnalysis: () => Promise<{ success: boolean; id?: string; error?: string }>;
  loadAnalysis: (id: string) => Promise<void>;
  
  // Simulation
  runSimulation: (multipliers: Record<string, number>) => ROIOutputs;
  generateProjections: (scenario?: 'current' | 'optimized' | 'simulated') => MonthlyProjection[];
  
  // Utilities
  validateSection: (section: string) => boolean;
  resetCalculator: () => void;
  exportResults: (format: 'json' | 'csv') => void;
}

const initialInputs: ROIInputs = {
  companyInfo: {
    name: '',
    industry: '',
    size: '',
    annualRevenue: undefined
  },
  kpis: {
    monthlyRevenue: 0,
    customerAcquisitionCost: 0,
    customerLifetimeValue: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    monthlyLeads: 0,
    salesCycleLength: 0,
    convertedCustomers: 0,
    customerLifetimeSpan: 0,
    churnRate: 0
  },
  costs: {
    marketingBudget: 0,
    salesTeamCost: 0,
    salesCommission: 0,
    technologyCosts: 0,
    operationalCosts: 0,
    cogs: 0,
    otherCosts: 0
  },
  salesProcess: {
    activities: {},
    tools: {},
    qualificationMethods: {}
  },
  goals: {
    revenueTarget: 0,
    timeframe: '',
    primaryObjectives: [],
    growthChallenges: []
  }
};

const initialState: ROICalculatorState = {
  inputs: initialInputs,
  activeSection: 'company-info',
  isCalculating: false,
  isSaving: false,
  isSaved: false,
  analysisComplete: false,
  errors: {},
  completedSections: []
};

export function useROICalculator() {
  const [state, setState] = useState<ROICalculatorState>(initialState);
  
  // Memoized calculations - only recalculate when inputs change
  const roiResults = useMemo(() => {
    if (!state.inputs.companyInfo.industry || !state.inputs.companyInfo.size) {
      return null;
    }
    
    try {
      return roiCalculatorEngine.calculate(state.inputs);
    } catch (error) {
      console.error('ROI calculation error:', error);
      return null;
    }
  }, [state.inputs]);

  // Memoized validation
  const validation = useMemo(() => {
    return {
      errors: validateAllSections(state.inputs),
      completedSections: getCompletedSections(state.inputs),
      progress: calculateProgress(state.inputs)
    };
  }, [state.inputs]);

  // Update state with validation results
  useEffect(() => {
    setState(prev => ({
      ...prev,
      errors: validation.errors,
      completedSections: validation.completedSections
    }));
  }, [validation]);

  // Actions
  const updateCompanyInfo = useCallback((data: Partial<ROIInputs['companyInfo']>) => {
    setState(prev => ({
      ...prev,
      inputs: {
        ...prev.inputs,
        companyInfo: { ...prev.inputs.companyInfo, ...data }
      },
      isSaved: false
    }));
  }, []);

  const updateKPIs = useCallback((data: Partial<ROIInputs['kpis']>) => {
    setState(prev => ({
      ...prev,
      inputs: {
        ...prev.inputs,
        kpis: { ...prev.inputs.kpis, ...data }
      },
      isSaved: false
    }));
  }, []);

  const updateCosts = useCallback((data: Partial<ROIInputs['costs']>) => {
    setState(prev => ({
      ...prev,
      inputs: {
        ...prev.inputs,
        costs: { ...prev.inputs.costs, ...data }
      },
      isSaved: false
    }));
  }, []);

  const updateSalesProcess = useCallback((data: Partial<ROIInputs['salesProcess']>) => {
    setState(prev => ({
      ...prev,
      inputs: {
        ...prev.inputs,
        salesProcess: { ...prev.inputs.salesProcess, ...data }
      },
      isSaved: false
    }));
  }, []);

  const updateGoals = useCallback((data: Partial<ROIInputs['goals']>) => {
    setState(prev => ({
      ...prev,
      inputs: {
        ...prev.inputs,
        goals: { ...prev.inputs.goals, ...data }
      },
      isSaved: false
    }));
  }, []);

  const setActiveSection = useCallback((section: string) => {
    setState(prev => ({ ...prev, activeSection: section }));
  }, []);

  const goToNextSection = useCallback(() => {
    const sections = ['company-info', 'current-kpis', 'current-costs', 'sales-process', 'goals', 'analysis'];
    const currentIndex = sections.indexOf(state.activeSection);
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1]);
    }
  }, [state.activeSection, setActiveSection]);

  const goToPreviousSection = useCallback(() => {
    const sections = ['company-info', 'current-kpis', 'current-costs', 'sales-process', 'goals', 'analysis'];
    const currentIndex = sections.indexOf(state.activeSection);
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1]);
    }
  }, [state.activeSection, setActiveSection]);

  const calculateROI = useCallback(async (): Promise<ROIOutputs> => {
    setState(prev => ({ ...prev, isCalculating: true }));
    
    try {
      // Simulate async calculation for UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const results = roiCalculatorEngine.calculate(state.inputs);
      
      setState(prev => ({
        ...prev,
        isCalculating: false,
        analysisComplete: true,
        activeSection: 'analysis'
      }));
      
      return results;
    } catch (error) {
      setState(prev => ({ ...prev, isCalculating: false }));
      const errorMessage = error instanceof Error ? error.message : 'Calculation failed';
      toast.error(errorMessage);
      throw error;
    }
  }, [state.inputs]);

  const saveAnalysis = useCallback(async () => {
    setState(prev => ({ ...prev, isSaving: true }));
    
    try {
      const method = state.analysisId ? 'PUT' : 'POST';
      const body = state.analysisId 
        ? JSON.stringify({ id: state.analysisId, ...convertInputsToLegacyFormat(state.inputs) })
        : JSON.stringify(convertInputsToLegacyFormat(state.inputs));

      const response = await fetch('/api/lead-analysis', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save analysis');
      }

      setState(prev => ({
        ...prev,
        isSaving: false,
        isSaved: true,
        analysisId: result.id || prev.analysisId,
        lastSavedAt: new Date()
      }));

      toast.success(state.analysisId ? 'Analysis updated!' : 'Analysis saved!');
      
      return { success: true, id: result.id || state.analysisId };
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }));
      const errorMessage = error instanceof Error ? error.message : 'Failed to save analysis';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [state.inputs, state.analysisId]);

  const loadAnalysis = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isCalculating: true }));
    
    try {
      const response = await fetch(`/api/lead-analysis?id=${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load analysis');
      }

      const loadedInputs = convertLegacyFormatToInputs(result.data);
      
      setState(prev => ({
        ...prev,
        inputs: loadedInputs,
        analysisId: id,
        analysisComplete: result.data.status === 'completed',
        isSaved: true,
        isCalculating: false
      }));

      toast.success('Analysis loaded successfully!');
    } catch (error) {
      setState(prev => ({ ...prev, isCalculating: false }));
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analysis';
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  const runSimulation = useCallback((multipliers: Record<string, number>) => {
    return roiCalculatorEngine.simulate(state.inputs, multipliers);
  }, [state.inputs]);

  const generateProjections = useCallback((scenario: 'current' | 'optimized' | 'simulated' = 'current') => {
    return roiCalculatorEngine.simulation.generateProjections(state.inputs, {}, scenario);
  }, [state.inputs]);

  const validateSection = useCallback((section: string) => {
    const sectionErrors = validation.errors[section] || [];
    return sectionErrors.length === 0;
  }, [validation.errors]);

  const resetCalculator = useCallback(() => {
    setState(initialState);
    roiCalculatorEngine.clearCache();
    toast.success('Calculator reset');
  }, []);

  const exportResults = useCallback((format: 'json' | 'csv') => {
    if (!roiResults) {
      toast.error('No results to export');
      return;
    }

    const data = {
      inputs: state.inputs,
      results: roiResults,
      timestamp: new Date().toISOString()
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roi-analysis-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV export implementation would go here
      toast.info('CSV export coming soon');
    }
  }, [state.inputs, roiResults]);

  // Return state and actions
  return {
    // State
    state,
    roiResults,
    validation,
    
    // Computed values
    progress: validation.progress,
    isValid: Object.keys(validation.errors).length === 0,
    canProceed: validateSection(state.activeSection),
    
    // Actions
    actions: {
      updateCompanyInfo,
      updateKPIs,
      updateCosts,
      updateSalesProcess,
      updateGoals,
      setActiveSection,
      goToNextSection,
      goToPreviousSection,
      calculateROI,
      saveAnalysis,
      loadAnalysis,
      runSimulation,
      generateProjections,
      validateSection,
      resetCalculator,
      exportResults
    } as ROICalculatorActions
  };
}

// Helper functions
function validateAllSections(inputs: ROIInputs): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  // Company info validation
  const companyErrors: string[] = [];
  if (!inputs.companyInfo.name) companyErrors.push('Company name is required');
  if (!inputs.companyInfo.industry) companyErrors.push('Industry is required');
  if (!inputs.companyInfo.size) companyErrors.push('Company size is required');
  if (companyErrors.length > 0) errors['company-info'] = companyErrors;

  // KPIs validation
  const kpiErrors: string[] = [];
  if (!inputs.kpis.monthlyRevenue || inputs.kpis.monthlyRevenue <= 0) {
    kpiErrors.push('Monthly revenue must be greater than 0');
  }
  if (!inputs.kpis.customerAcquisitionCost || inputs.kpis.customerAcquisitionCost <= 0) {
    kpiErrors.push('Customer acquisition cost must be greater than 0');
  }
  if (kpiErrors.length > 0) errors['current-kpis'] = kpiErrors;

  // Costs validation
  const costErrors: string[] = [];
  if (!inputs.costs.marketingBudget || inputs.costs.marketingBudget <= 0) {
    costErrors.push('Marketing budget must be greater than 0');
  }
  if (costErrors.length > 0) errors['current-costs'] = costErrors;

  // Goals validation
  const goalErrors: string[] = [];
  if (!inputs.goals.revenueTarget || inputs.goals.revenueTarget <= 0) {
    goalErrors.push('Revenue target must be greater than 0');
  }
  if (!inputs.goals.timeframe) goalErrors.push('Timeframe is required');
  if (goalErrors.length > 0) errors['goals'] = goalErrors;

  return errors;
}

function getCompletedSections(inputs: ROIInputs): string[] {
  const completed: string[] = [];
  
  if (inputs.companyInfo.name && inputs.companyInfo.industry && inputs.companyInfo.size) {
    completed.push('company-info');
  }
  
  if (inputs.kpis.monthlyRevenue > 0 && inputs.kpis.customerAcquisitionCost > 0) {
    completed.push('current-kpis');
  }
  
  if (inputs.costs.marketingBudget > 0) {
    completed.push('current-costs');
  }
  
  if (Object.values(inputs.salesProcess.activities).some(Boolean) || 
      Object.values(inputs.salesProcess.tools).some(Boolean)) {
    completed.push('sales-process');
  }
  
  if (inputs.goals.revenueTarget > 0 && inputs.goals.timeframe) {
    completed.push('goals');
  }
  
  return completed;
}

function calculateProgress(inputs: ROIInputs): number {
  const totalSections = 5;
  const completedSections = getCompletedSections(inputs);
  return (completedSections.length / totalSections) * 100;
}

// Legacy format conversion functions
function convertInputsToLegacyFormat(inputs: ROIInputs): any {
  return {
    company_name: inputs.companyInfo.name,
    industry: inputs.companyInfo.industry,
    company_size: inputs.companyInfo.size,
    annual_revenue: inputs.companyInfo.annualRevenue?.toString(),
    current_kpis: inputs.kpis,
    current_costs: inputs.costs,
    sales_process: {
      leadSources: [],
      qualificationProcess: inputs.salesProcess.qualificationMethods,
      followUpFrequency: '',
      closingTechniques: [],
      painPoints: [],
      salesActivities: inputs.salesProcess.activities,
      availableTools: inputs.salesProcess.tools
    },
    goals: inputs.goals,
    contact_info: {}
  };
}

function convertLegacyFormatToInputs(data: any): ROIInputs {
  return {
    companyInfo: {
      name: data.company_name || '',
      industry: data.industry || '',
      size: data.company_size || '',
      annualRevenue: data.annual_revenue ? parseInt(data.annual_revenue) : undefined
    },
    kpis: data.current_kpis || initialInputs.kpis,
    costs: data.current_costs || initialInputs.costs,
    salesProcess: {
      activities: data.sales_process?.salesActivities || {},
      tools: data.sales_process?.availableTools || {},
      qualificationMethods: data.sales_process?.qualificationProcess || {}
    },
    goals: data.goals || initialInputs.goals
  };
}
