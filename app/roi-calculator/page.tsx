"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { Separator } from "@/app/components/ui/separator";
import { Slider } from "@/app/components/ui/slider";
import { Switch } from "@/app/components/ui/switch";
import { TrendingUp, Target, DollarSign, Users, BarChart, PieChart, ArrowRight, CheckCircle, AlertTriangle, Info, Phone, Mail, Calendar, PlayCircle, Zap, TrendingDown, ChevronUp, ChevronDown, ExternalLink } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";
import { formatInputNumber, parseFormattedNumber } from "@/app/lib/formatters";
import { useROICalculator } from "@/app/hooks/use-roi-calculator";
import { getIndustryRecommendations, getCompanySizeStrategies } from "@/app/roi-calculator/utils";
import { FinancialModel } from "@/app/components/roi-calculator/financial-model";
import { SimulationControlsFixed } from "@/app/components/roi-calculator/simulation-controls-fixed";
import { FinancialProjectionsFixed } from "@/app/components/roi-calculator/financial-projections-fixed";
import { CurrentKPIsCard } from "@/app/components/roi-calculator/current-kpis-card";
import { CurrentCostsCard } from "@/app/components/roi-calculator/current-costs-card";
import { SalesProcessCard } from "@/app/components/roi-calculator/sales-process-card";
import { GoalsCard } from "@/app/components/roi-calculator/goals-card";
import { CallToActionCard } from "@/app/components/roi-calculator/call-to-action-card";
import { LeadAnalysisFormData } from "@/app/roi-calculator/actions";
import { toast } from "sonner";

function ROICalculatorPageContent() {
  const searchParams = useSearchParams();
  
  const {
    state,
    progress,
    roiMetrics,
    opportunityCosts,
    fuzzyRecommendations,
    nextStepsPlan,
    isCurrentSectionValid,
    currentSectionErrors,
    updateSection,
    updateField,
    generateAnalysis,
    goToNextSection,
    goToPreviousSection,
    checkSectionCompletion,
    saveAnalysis,
    shareAnalysis,
    loadAnalysisById,
  } = useROICalculator();

  // Helper function to handle formatted number input
  const handleFormattedNumberChange = (field: keyof LeadAnalysisFormData, value: string) => {
    const formattedValue = formatInputNumber(value);
    updateSection(field, formattedValue);
  };

  // Helper function to get display value for formatted inputs
  const getFormattedDisplayValue = (value: string | undefined): string => {
    if (!value) return '';
    // If value is already formatted, return as is
    if (value.includes(',')) return value;
    // If it's a plain number, format it
    const numValue = parseFloat(value);
    return isNaN(numValue) ? value : formatInputNumber(numValue.toString());
  };

  // Simulation state for interactive widgets
  const [simulationValues, setSimulationValues] = useState({
    revenueMultiplier: 1.0,
    costMultiplier: 1.0,
    conversionRateMultiplier: 1.0,
    marketingBudgetMultiplier: 1.0,
    cogsMultiplier: 1.0,
    churnRateMultiplier: 1.0,
    leadGenerationMultiplier: 1.0,
    ltvMultiplier: 1.0,
  });

  // Active section tracking for navigation
  const [activeSection, setActiveSection] = useState('current-kpis');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedOpportunities, setExpandedOpportunities] = useState<Set<string>>(new Set());

  // Toggle opportunity expansion
  const toggleOpportunityExpansion = (activityKey: string) => {
    setExpandedOpportunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityKey)) {
        newSet.delete(activityKey);
      } else {
        newSet.add(activityKey);
      }
      return newSet;
    });
  };

  // Load analysis from query parameter
  useEffect(() => {
    console.log('🔍 Checking for analysis ID in URL...');
    const analysisId = searchParams.get('id');
    const queryString = searchParams.toString();
    
    console.log('📋 Query params:', { analysisId, queryString });
    
    // Support both ?id=xxx and ?xxx formats
    let targetId = analysisId || queryString;
    
    // Clean up the target ID (remove trailing = and other URL artifacts)
    if (targetId) {
      targetId = targetId.replace(/[=&]/g, '').trim();
    }
    
    console.log('🎯 Cleaned Target ID:', targetId);
    
    if (targetId && targetId.length > 10) {
      // Check if it looks like a UUID (contains hyphens and is long enough)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidRegex.test(targetId)) {
        console.log('✅ Valid UUID detected, loading analysis:', targetId);
        loadAnalysisById(targetId);
      } else {
        console.log('❌ Invalid UUID format:', targetId);
      }
    } else {
      console.log('ℹ️ No analysis ID found in URL');
    }
  }, [searchParams, loadAnalysisById]);

  // Intersection Observer for active section tracking
  useEffect(() => {
    const sections = ['current-kpis', 'current-costs', 'sales-process', 'goals', 'analysis', 'financial-model', 'opportunity-analysis', 'next-steps-plan'];
    const observers = new Map();
    let currentActiveSection = 'current-kpis';

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry: IntersectionObserverEntry) => {
        const sectionId = entry.target.id;
        if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
          currentActiveSection = sectionId;
          setActiveSection(sectionId);
        }
      });
    };

    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -60% 0px',
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
    };

    sections.forEach(sectionId => {
      const element = document.getElementById(sectionId);
      if (element) {
        const observer = new IntersectionObserver(observerCallback, observerOptions);
        observer.observe(element);
        observers.set(sectionId, observer);
      }
    });

    // Fallback: check scroll position manually
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3;
      
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = rect.top + window.scrollY;
          const elementBottom = elementTop + rect.height;
          
          if (scrollPosition >= elementTop && scrollPosition < elementBottom) {
            if (currentActiveSection !== sectionId) {
              currentActiveSection = sectionId;
              setActiveSection(sectionId);
            }
            break;
          }
        }
      }
    };

    // Add scroll listener as backup
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observers.forEach(observer => observer.disconnect());
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Opportunity cost timeframe selector
  const [opportunityTimeframe, setOpportunityTimeframe] = useState("12");

  // Calculate opportunity cost for selected timeframe
  const calculateOpportunityCostForTimeframe = useCallback((opportunity: any, months: number) => {
    const monthlyValuePerCustomer = roiMetrics.filledKpis.customerLifetimeValue / roiMetrics.filledKpis.customerLifetimeSpan;
    const monthlyRevenueFromConvertedCustomers = roiMetrics.filledKpis.convertedCustomers * monthlyValuePerCustomer;
    const monthlyRevenueLoss = monthlyRevenueFromConvertedCustomers * (opportunity.estimatedROI / 100);
    return monthlyRevenueLoss * months;
  }, [roiMetrics.filledKpis.convertedCustomers, roiMetrics.filledKpis.customerLifetimeValue, roiMetrics.filledKpis.customerLifetimeSpan]);

  // Calculate monthly opportunity cost
  const calculateMonthlyOpportunityCost = useCallback((opportunity: any) => {
    const monthlyValuePerCustomer = roiMetrics.filledKpis.customerLifetimeValue / roiMetrics.filledKpis.customerLifetimeSpan;
    const monthlyRevenueFromConvertedCustomers = roiMetrics.filledKpis.convertedCustomers * monthlyValuePerCustomer;
    return monthlyRevenueFromConvertedCustomers * (opportunity.estimatedROI / 100);
  }, [roiMetrics.filledKpis.convertedCustomers, roiMetrics.filledKpis.customerLifetimeValue, roiMetrics.filledKpis.customerLifetimeSpan]);

  // Calculate simulated ROI metrics with improved logic
  const simulatedMetrics = useMemo(() => {
    if (!roiMetrics?.filledKpis || !roiMetrics?.filledCosts) {
      return roiMetrics;
    }

    // STEP 1: Apply multipliers to base KPIs with safe defaults
    const baseLeads = roiMetrics.filledKpis.monthlyLeads || 100;
    const baseConversionRate = roiMetrics.filledKpis.conversionRate || 2.5;
    const baseChurnRate = roiMetrics.filledKpis.churnRate || 5;
    const baseLTV = roiMetrics.filledKpis.customerLifetimeValue || 1800;

    const simulatedKpis = {
      ...roiMetrics.filledKpis,
      monthlyLeads: Math.round(baseLeads * simulationValues.leadGenerationMultiplier),
      conversionRate: baseConversionRate * simulationValues.conversionRateMultiplier,
      churnRate: baseChurnRate * simulationValues.churnRateMultiplier,
      customerLifetimeValue: baseLTV * simulationValues.ltvMultiplier,
    };

    // Recalculate dependent metrics
    simulatedKpis.convertedCustomers = Math.round((simulatedKpis.monthlyLeads * simulatedKpis.conversionRate) / 100);
    
    // Update customer lifetime span based on churn rate
    if (simulatedKpis.churnRate > 0) {
      simulatedKpis.customerLifetimeSpan = Math.round(100 / simulatedKpis.churnRate);
    }

    // STEP 2: Apply multipliers to costs
    const simulatedCosts = {
      ...roiMetrics.filledCosts,
      marketingBudget: (roiMetrics.filledCosts.marketingBudget || 0) * simulationValues.marketingBudgetMultiplier,
      salesTeamCost: (roiMetrics.filledCosts.salesTeamCost || 0) * simulationValues.costMultiplier,
      technologyCosts: (roiMetrics.filledCosts.technologyCosts || 0) * simulationValues.costMultiplier,
      operationalCosts: (roiMetrics.filledCosts.operationalCosts || 0) * simulationValues.costMultiplier,
      otherCosts: (roiMetrics.filledCosts.otherCosts || 0) * simulationValues.costMultiplier,
      cogs: (roiMetrics.filledCosts.cogs || 0) * simulationValues.cogsMultiplier,
      salesCommission: (roiMetrics.filledCosts.salesCommission || 0) * simulationValues.costMultiplier,
    };

    const totalSimulatedCosts = Object.values(simulatedCosts).reduce((sum, cost) => sum + (cost || 0), 0);
    
    // STEP 3: Calculate revenue - simple approach
    let avgOrderValue = simulatedKpis.averageOrderValue || (roiMetrics.filledKpis.averageOrderValue) || 
                        (simulatedKpis.customerLifetimeValue / (simulatedKpis.customerLifetimeSpan || 24)) || 200;
    
    // Apply revenue multiplier to average order value
    if (simulationValues.revenueMultiplier !== 1) {
      avgOrderValue = avgOrderValue * simulationValues.revenueMultiplier;
    }
    
    // Previous monthly revenue (what we have in DB)
    const previousMonthlyRevenue = roiMetrics.filledKpis.monthlyRevenue || 10000;
    
    // Calculate revenue from new customers with adjusted AOV
    const revenueFromNewCustomers = simulatedKpis.convertedCustomers * avgOrderValue;
    
    // Total revenue = previous monthly revenue + revenue from new customers
    let finalMonthlyRevenue = previousMonthlyRevenue + revenueFromNewCustomers;
    
    // STEP 4: Apply churn rate impact (inverse relationship)
    if (simulationValues.churnRateMultiplier !== 1) {
      const churnImpact = 2 - simulationValues.churnRateMultiplier; // Lower churn = higher retention
      finalMonthlyRevenue = finalMonthlyRevenue * churnImpact;
    }
    
    // Update final KPIs
    simulatedKpis.monthlyRevenue = finalMonthlyRevenue;
    simulatedKpis.averageOrderValue = avgOrderValue;
    
    // Recalculate CAC based on new marketing budget and customers
    if (simulatedKpis.convertedCustomers > 0) {
      simulatedKpis.customerAcquisitionCost = simulatedCosts.marketingBudget / simulatedKpis.convertedCustomers;
    }
    
    // STEP 5: Calculate ROI
    const simulatedAnnualRevenue = finalMonthlyRevenue * 12;
    const simulatedROI = totalSimulatedCosts > 0 ? ((simulatedAnnualRevenue - totalSimulatedCosts) / totalSimulatedCosts) * 100 : 0;

    // Check for changes
    const hasSimulationChanges = Object.keys(simulationValues).some(key => 
      simulationValues[key as keyof typeof simulationValues] !== 1.0
    );

    // Calculate projections - fix the cost calculation to be annual
    const projectedRevenue = hasSimulationChanges ? simulatedAnnualRevenue * 1.25 : simulatedAnnualRevenue;
    const projectedCosts = hasSimulationChanges ? (totalSimulatedCosts * 12) * 0.85 : totalSimulatedCosts * 12;
    const projectedROI = projectedCosts > 0 ? ((projectedRevenue - projectedCosts) / projectedCosts) * 100 : 0;

    return {
      ...roiMetrics,
      currentROI: simulatedROI,
      filledKpis: simulatedKpis,
      filledCosts: simulatedCosts,
      totalCurrentCosts: totalSimulatedCosts,
      projectedRevenue,
      projectedCosts,
      projectedROI,
      previousMonthlyRevenue, // Add previous revenue for reference
    };
  }, [roiMetrics, simulationValues]);

  // Generate analysis sentiment
  const getAnalysisSentiment = (currentROI: number, projectedROI: number) => {
    const improvement = projectedROI - currentROI;
    if (improvement > 50) return { type: 'positive', icon: TrendingUp, color: 'text-green-600' };
    if (improvement > 20) return { type: 'neutral', icon: BarChart, color: 'text-blue-600' };
    return { type: 'negative', icon: TrendingDown, color: 'text-red-600' };
  };

  const sentiment = getAnalysisSentiment(simulatedMetrics.currentROI, simulatedMetrics.projectedROI);

  const handleGenerateAnalysis = async () => {
    const result = await generateAnalysis();
      toast.success("Analysis completed successfully!");
  };

  const resetSimulation = () => {
    setSimulationValues({
      revenueMultiplier: 1.0,
      costMultiplier: 1.0,
      conversionRateMultiplier: 1.0,
      marketingBudgetMultiplier: 1.0,
      cogsMultiplier: 1.0,
      churnRateMultiplier: 1.0,
      leadGenerationMultiplier: 1.0,
      ltvMultiplier: 1.0,
    });
  };

  const updateSimulationValue = (key: string, value: number) => {
    setSimulationValues(prev => ({ ...prev, [key]: value }));
  };

  // Number formatting functions
  const formatNumberWithCommas = (num: number | string) => {
    if (!num || num === 0) return "";
    return Number(num).toLocaleString();
  };

  const parseNumberFromInput = (value: string) => {
    // Remove commas and parse as float
    return parseFloat(value.replace(/,/g, '')) || 0;
  };

  const handleNumberInput = (value: string, field: string, section: keyof LeadAnalysisFormData) => {
    const numericValue = parseNumberFromInput(value);
    updateSection(section, { [field]: numericValue });
  };

  // Slide management functions
  const getSlideNames = () => ["company-info", "current-kpis", "current-costs", "sales-process", "goals", "analysis", "financial-model"];
  
  const getSlideTitle = (slideName: string) => {
    const titles = {
      "company-info": "Company Information",
      "current-kpis": "Current KPIs & Metrics", 
      "current-costs": "Current Costs",
      "sales-process": "Sales Process",
      "goals": "Goals & Objectives",
      "analysis": "ROI Analysis & Simulation",
      "financial-model": "Financial Model & Projections"
    };
    return titles[slideName as keyof typeof titles] || slideName;
  };

  const getCurrentSlideNumber = () => {
    const slides = getSlideNames();
    return slides.indexOf(state.activeTab) + 1;
  };

  const goToSlide = (slideName: string) => {
    updateField('activeTab', slideName);
    // Smooth scroll to section
    const element = document.getElementById(slideName);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToNextSlide = () => {
    const slides = getSlideNames();
    const currentIndex = slides.indexOf(state.activeTab);
    if (currentIndex < slides.length - 1) {
      updateField('activeTab', slides[currentIndex + 1]);
    }
  };

  const goToPreviousSlide = () => {
    const slides = getSlideNames();
    const currentIndex = slides.indexOf(state.activeTab);
    if (currentIndex > 0) {
      updateField('activeTab', slides[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Banner with Company Info */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="mx-auto px-4 py-12 max-w-7xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              ROI Growth Calculator
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Get a comprehensive analysis of your business potential and discover how our solutions can accelerate your growth
            </p>
          </div>
          
          {/* Company Information in Banner */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20" style={{ maxWidth: '896px' }}>
              <h2 className="text-2xl font-semibold mb-6 text-center">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="companyName" className="text-white cursor-help">Company Name</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enter your company's official name as it appears in business documents</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Your Company Name"
                    value={state.company_name}
                    onChange={(e) => updateSection("company_name", e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder-white/70 focus:bg-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="industry" className="text-white cursor-help">Industry</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select the industry that best describes your business to get more accurate recommendations</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select value={state.industry} onValueChange={(value) => updateSection("industry", value)}>
                    <SelectTrigger className="bg-white/20 border-white/30 text-white focus:bg-white/30 h-12">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="services">Professional Services</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="real-estate">Real Estate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="companySize" className="text-white cursor-help">Company Size</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select your company size to get tailored recommendations for your business stage</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select value={state.company_size} onValueChange={(value) => updateSection("company_size", value)}>
                    <SelectTrigger className="bg-white/20 border-white/30 text-white focus:bg-white/30 h-12">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-500">201-500 employees</SelectItem>
                      <SelectItem value="500+">500+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-6">
                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="annualRevenue" className="text-white cursor-help">Annual Revenue (Optional)</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Your total annual revenue helps us provide more accurate financial projections and recommendations</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="annualRevenue"
                    type="text"
                    placeholder="e.g., $1,000,000"
                    value={getFormattedDisplayValue(state.annual_revenue)}
                    onChange={(e) => handleFormattedNumberChange("annual_revenue", e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder-white/70 focus:bg-white/30"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 py-8">
        <div className="flex gap-8 justify-center">
          {/* Left Spacer - maintains center alignment */}
          <div className="hidden lg:block w-64 flex-shrink-0"></div>

          {/* Main Content - stays centered */}
          <div className="flex-1 max-w-4xl">
        {/* All Content Visible - No Pagination */}
            <div className="space-y-8">

          {/* Current KPIs */}
          <CurrentKPIsCard 
            state={state}
            roiMetrics={roiMetrics}
            updateSection={updateSection}
            onSave={saveAnalysis}
            isSaving={state.isSaving}
            isSaved={state.isSaved}
          />

          {/* Current Costs */}
          <CurrentCostsCard 
            state={state}
            roiMetrics={roiMetrics}
            updateSection={updateSection}
            onSave={saveAnalysis}
            isSaving={state.isSaving}
            isSaved={state.isSaved}
          />

          {/* Sales Process */}
          <SalesProcessCard 
            state={state}
            updateSection={updateSection}
            onSave={saveAnalysis}
            isSaving={state.isSaving}
            isSaved={state.isSaved}
          />

          {/* Goals */}
          <GoalsCard 
            state={state}
            roiMetrics={roiMetrics}
            updateSection={updateSection}
            getFormattedDisplayValue={getFormattedDisplayValue}
            onSave={saveAnalysis}
            isSaving={state.isSaving}
            isSaved={state.isSaved}
          />

          {/* ROI Analysis & Simulation Slide */}
          <div className="space-y-6" id="analysis">
            {/* Fixed Simulation Controls */}
            <SimulationControlsFixed
              values={simulationValues}
              onChange={updateSimulationValue}
              onReset={resetSimulation}
              baseMetrics={roiMetrics}
              simulatedMetrics={simulatedMetrics}
            />
          </div>

          {/* Revenue & Cost Breakdown */}
          <div className="space-y-6" id="breakdown">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📊 Revenue & Cost Breakdown - Clear Projection
                </CardTitle>
                <CardDescription>
                  Simple breakdown of your current situation vs. simulated scenario
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Current Scenario */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                      📊 Current Scenario (Monthly)
                    </h3>
                    <div className="space-y-3">
                      <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border-2 border-gray-200">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">💰 Revenue Sources</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Monthly Leads:</span>
                            <span className="font-medium">
                              {(roiMetrics.filledKpis.monthlyLeads || 0).toLocaleString()}
                              {roiMetrics.isUsingDefaults.monthlyLeads && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Conversion Rate:</span>
                            <span className="font-medium">
                              {(roiMetrics.filledKpis.conversionRate || 0).toFixed(1)}%
                              {roiMetrics.isUsingDefaults.conversionRate && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Converted Customers:</span>
                            <span className="font-medium">
                              {(roiMetrics.filledKpis.convertedCustomers || 0).toLocaleString()}
                              {roiMetrics.isUsingDefaults.convertedCustomers && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Average Order Value:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledKpis.averageOrderValue || 0)}
                              {roiMetrics.isUsingDefaults.averageOrderValue && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Customer Lifetime Value:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledKpis.customerLifetimeValue || 0)}
                              {roiMetrics.isUsingDefaults.customerLifetimeValue && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Churn Rate:</span>
                            <span className="font-medium">
                              {(roiMetrics.filledKpis.churnRate || 0).toFixed(1)}%
                              {roiMetrics.isUsingDefaults.churnRate && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between text-gray-600 dark:text-gray-400">
                              <span>Previous Monthly Revenue:</span>
                              <span className="font-medium">
                                {formatCurrency(roiMetrics.filledKpis.monthlyRevenue || 0)}
                                {roiMetrics.isUsingDefaults.monthlyRevenue && <span className="text-orange-500 ml-1">*</span>}
                              </span>
                            </div>
                            <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-300 mt-1">
                              <span>Total Monthly Revenue:</span>
                              <span>
                                {formatCurrency(roiMetrics.filledKpis.monthlyRevenue || 0)}
                                {roiMetrics.isUsingDefaults.monthlyRevenue && <span className="text-orange-500 ml-1">*</span>}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/20 p-4 rounded-lg border-2 border-slate-200">
                        <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-3">💸 Monthly Costs</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Marketing Budget:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledCosts.marketingBudget || 0)}
                              {roiMetrics.isUsingDefaults.marketingBudget && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sales Team:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledCosts.salesTeamCost || 0)}
                              {roiMetrics.isUsingDefaults.salesTeamCost && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sales Commission:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledCosts.salesCommission || 0)}
                              {roiMetrics.isUsingDefaults.salesCommission && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Technology:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledCosts.technologyCosts || 0)}
                              {roiMetrics.isUsingDefaults.technologyCosts && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Operations:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledCosts.operationalCosts || 0)}
                              {roiMetrics.isUsingDefaults.operationalCosts && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>COGS:</span>
                            <span className="font-medium">
                              {formatCurrency(roiMetrics.filledCosts.cogs || 0)}
                              {roiMetrics.isUsingDefaults.cogs && <span className="text-orange-500 ml-1">*</span>}
                            </span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                              <span>Total Monthly Costs:</span>
                              <span>{formatCurrency(roiMetrics.totalCurrentCosts || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-50 dark:bg-zinc-900/20 p-4 rounded-lg border-2 border-zinc-200">
                        <h4 className="font-medium text-zinc-800 dark:text-zinc-200 mb-3">📈 Current Performance</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Monthly Profit:</span>
                            <span className={`font-medium ${(roiMetrics.filledKpis.monthlyRevenue || 0) - (roiMetrics.totalCurrentCosts || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency((roiMetrics.filledKpis.monthlyRevenue || 0) - (roiMetrics.totalCurrentCosts || 0))}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Annual Revenue:</span>
                            <span className="font-medium">{formatCurrency((roiMetrics.filledKpis.monthlyRevenue || 0) * 12)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Annual Profit:</span>
                            <span className={`font-medium ${((roiMetrics.filledKpis.monthlyRevenue || 0) - (roiMetrics.totalCurrentCosts || 0)) * 12 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(((roiMetrics.filledKpis.monthlyRevenue || 0) - (roiMetrics.totalCurrentCosts || 0)) * 12)}
                            </span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between font-semibold text-zinc-700 dark:text-zinc-300">
                              <span>Current ROI:</span>
                              <span>{(roiMetrics.currentROI || 0).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Simulated Scenario */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                      🎯 Simulated Scenario (Monthly)
                    </h3>
                    <div className="space-y-3">
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-2 border-purple-200">
                        <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-3">💰 Simulated Revenue</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Monthly Leads:</span>
                            <span className="font-medium">{Math.round((simulatedMetrics.filledKpis.monthlyLeads || 0)).toLocaleString()}</span>
                            <span className="text-xs text-purple-600">
                              {simulationValues.leadGenerationMultiplier !== 1 ? 
                                `${simulationValues.leadGenerationMultiplier > 1 ? '+' : ''}${((simulationValues.leadGenerationMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Conversion Rate:</span>
                            <span className="font-medium">{(simulatedMetrics.filledKpis.conversionRate || 0).toFixed(1)}%</span>
                            <span className="text-xs text-purple-600">
                              {simulationValues.conversionRateMultiplier !== 1 ? 
                                `${simulationValues.conversionRateMultiplier > 1 ? '+' : ''}${((simulationValues.conversionRateMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Converted Customers:</span>
                            <span className="font-medium">{Math.round((simulatedMetrics.filledKpis.monthlyLeads || 0) * (simulatedMetrics.filledKpis.conversionRate || 0) / 100).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Average Order Value:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledKpis.averageOrderValue || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Customer Lifetime Value:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledKpis.customerLifetimeValue || 0)}</span>
                            <span className="text-xs text-purple-600">
                              {simulationValues.ltvMultiplier !== 1 ? 
                                `${simulationValues.ltvMultiplier > 1 ? '+' : ''}${((simulationValues.ltvMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Churn Rate:</span>
                            <span className="font-medium">{(simulatedMetrics.filledKpis.churnRate || 0).toFixed(1)}%</span>
                            <span className="text-xs text-purple-600">
                              {simulationValues.churnRateMultiplier !== 1 ? 
                                `${simulationValues.churnRateMultiplier < 1 ? '-' : '+'}${(Math.abs(simulationValues.churnRateMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between text-purple-600 dark:text-purple-400">
                              <span>Previous Monthly Revenue:</span>
                              <span className="font-medium">{formatCurrency(roiMetrics.filledKpis.monthlyRevenue || 0)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-purple-700 dark:text-purple-300 mt-1">
                              <span>Simulated Monthly Revenue:</span>
                              <span>{formatCurrency(simulatedMetrics.filledKpis.monthlyRevenue || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-2 border-orange-200">
                        <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-3">💸 Simulated Costs</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Marketing Budget:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledCosts.marketingBudget || 0)}</span>
                            <span className="text-xs text-orange-600">
                              {simulationValues.marketingBudgetMultiplier !== 1 ? 
                                `${simulationValues.marketingBudgetMultiplier > 1 ? '+' : ''}${((simulationValues.marketingBudgetMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sales Team:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledCosts.salesTeamCost || 0)}</span>
                            <span className="text-xs text-orange-600">
                              {simulationValues.costMultiplier !== 1 ? 
                                `${simulationValues.costMultiplier > 1 ? '+' : ''}${((simulationValues.costMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sales Commission:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledCosts.salesCommission || 0)}</span>
                            <span className="text-xs text-gray-500">No change</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Technology:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledCosts.technologyCosts || 0)}</span>
                            <span className="text-xs text-orange-600">
                              {simulationValues.costMultiplier !== 1 ? 
                                `${simulationValues.costMultiplier > 1 ? '+' : ''}${((simulationValues.costMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Operations:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledCosts.operationalCosts || 0)}</span>
                            <span className="text-xs text-orange-600">
                              {simulationValues.costMultiplier !== 1 ? 
                                `${simulationValues.costMultiplier > 1 ? '+' : ''}${((simulationValues.costMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>COGS:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.filledCosts.cogs || 0)}</span>
                            <span className="text-xs text-orange-600">
                              {simulationValues.cogsMultiplier !== 1 ? 
                                `${simulationValues.cogsMultiplier > 1 ? '+' : ''}${((simulationValues.cogsMultiplier - 1) * 100).toFixed(0)}%` : 
                                '0%'
                              }
                            </span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between font-semibold text-orange-700 dark:text-orange-300">
                              <span>Simulated Monthly Costs:</span>
                              <span>{formatCurrency(simulatedMetrics.totalCurrentCosts || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border-2 border-emerald-200">
                        <h4 className="font-medium text-emerald-800 dark:text-emerald-200 mb-3">📈 Simulated Performance</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Monthly Profit:</span>
                            <span className={`font-medium ${((simulatedMetrics.filledKpis.monthlyRevenue || 0) - (simulatedMetrics.totalCurrentCosts || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency((simulatedMetrics.filledKpis.monthlyRevenue || 0) - (simulatedMetrics.totalCurrentCosts || 0))}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Annual Revenue:</span>
                            <span className="font-medium">{formatCurrency(simulatedMetrics.projectedRevenue || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Annual Profit:</span>
                            <span className="font-medium text-emerald-600">
                              {formatCurrency(((simulatedMetrics.filledKpis.monthlyRevenue || 0) - (simulatedMetrics.totalCurrentCosts || 0)) * 12)}
                            </span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300">
                              <span>Simulated ROI:</span>
                              <span>{(simulatedMetrics.projectedROI || 0).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Comparison */}
                <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border">
                  <h3 className="text-lg font-semibold mb-4 text-center">🎯 Bottom Line Impact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {(() => {
                          const projectedAnnualRevenue = simulatedMetrics.projectedRevenue || 0;
                          const currentAnnualRevenue = (roiMetrics.filledKpis.monthlyRevenue || 0) * 12;
                          const additionalRevenue = projectedAnnualRevenue - currentAnnualRevenue;
                          
                          // Debug logging
                          console.log('🔍 Additional Revenue Debug:', {
                            projectedAnnualRevenue,
                            currentAnnualRevenue,
                            monthlyRevenue: roiMetrics.filledKpis.monthlyRevenue,
                            additionalRevenue,
                            simulatedMetrics: simulatedMetrics
                          });
                          
                          return formatCurrency(Math.max(0, additionalRevenue));
                        })()}
                      </div>
                      <div className="text-sm text-gray-600">Additional Annual Revenue</div>
                    </div>
                    <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {(() => {
                          const improvement = ((simulatedMetrics.projectedROI || 0) - (simulatedMetrics.currentROI || 0)) || 0;
                          
                          // Debug logging
                          console.log('🔍 ROI Improvement Debug:', {
                            currentROI: simulatedMetrics.currentROI,
                            projectedROI: simulatedMetrics.projectedROI,
                            improvement
                          });
                          
                          return improvement >= 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`;
                        })()}
                      </div>
                      <div className="text-sm text-gray-600">ROI Improvement</div>
                    </div>
                    <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {(() => {
                          const projectedProfit = (simulatedMetrics.projectedRevenue || 0) - (simulatedMetrics.projectedCosts || 0);
                          const currentProfit = ((roiMetrics.filledKpis.monthlyRevenue || 0) * 12) - (roiMetrics.totalCurrentCosts || 0);
                          const additionalProfit = projectedProfit - currentProfit;
                          
                          // Debug logging
                          console.log('🔍 Additional Profit Debug:', {
                            projectedRevenue: simulatedMetrics.projectedRevenue,
                            projectedCosts: simulatedMetrics.projectedCosts,
                            projectedProfit,
                            currentAnnualRevenue: (roiMetrics.filledKpis.monthlyRevenue || 0) * 12,
                            totalCurrentCosts: roiMetrics.totalCurrentCosts,
                            currentProfit,
                            additionalProfit
                          });
                          
                          return formatCurrency(Math.max(0, additionalProfit));
                        })()}
                      </div>
                      <div className="text-sm text-gray-600">Additional Annual Profit</div>
                    </div>
                  </div>
                </div>

                {/* Data Source Legend */}
                <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-200">
                    <Info className="h-4 w-4" />
                    <span className="font-medium">Data Sources:</span>
                    <span>Values with <span className="text-orange-500 font-bold">*</span> are estimated based on your industry and company size. Fill in the form above to use your actual data.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Projections Slide */}
          <div className="space-y-6" id="financial-model">
            <FinancialProjectionsFixed
              baseMetrics={roiMetrics}
              simulatedMetrics={simulatedMetrics}
              timeframe={12}
              state={state}
            />
          </div>

          {/* Opportunity Cost Analysis */}
          <div className="space-y-6" id="opportunity-analysis">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  ⚠️ Opportunity Cost Analysis
                </CardTitle>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="timeframe-selector" className="text-sm font-medium text-muted-foreground">
                    Show opportunity cost for:
                  </Label>
                  <Select
                    value={opportunityTimeframe}
                    onValueChange={setOpportunityTimeframe}
                  >
                      <SelectTrigger className="w-32 h-8">
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                      <SelectItem value="24">24 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                </div>
                <CardDescription>
                  Identify what you're missing by not implementing these high-impact activities
                </CardDescription>
                
                {/* Opportunity Cost Explanation */}
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    What is Opportunity Cost?
                  </h4>
                  <div className="text-sm text-orange-700 space-y-2">
                    <p>
                      <strong>Opportunity Cost</strong> is the potential revenue you're losing by NOT implementing a specific sales activity.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <div className="bg-white p-3 rounded border border-orange-200">
                        <div className="font-medium text-orange-800 mb-1">📊 How it's calculated:</div>
                        <div className="text-xs text-orange-600">
                          Monthly Revenue × Expected ROI% ÷ 12 × Time Period
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border border-orange-200">
                        <div className="font-medium text-orange-800 mb-1">💡 What it means:</div>
                        <div className="text-xs text-orange-600">
                          Revenue you could be earning if you implemented this activity
                        </div>
                      </div>
                    </div>
                    
                    {/* ROI Methodology */}
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="font-medium text-yellow-800 mb-2 text-sm flex items-center gap-2">
                        ⚠️ ROI Estimates Disclaimer
                      </div>
                      <div className="text-xs text-yellow-700 space-y-1">
                        <div><strong>Base ROI:</strong> Estimated values based on general industry knowledge</div>
                        <div><strong>Industry Adjustment:</strong> Approximate multipliers (not from specific studies)</div>
                        <div><strong>Company Size:</strong> Estimated adjustments for different company sizes</div>
                        <div className="pt-2 border-t border-yellow-200 mt-2 bg-yellow-100 p-2 rounded">
                          <strong>⚠️ Important:</strong> These are <em>estimates for planning purposes</em>. Actual ROI will vary significantly based on execution, market conditions, and your specific situation. Always validate with your own data and testing.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </CardHeader>
              <CardContent>
                {opportunityCosts.length > 0 ? (
                  <div className="space-y-8">
                    {(() => {
                      // Group opportunities by phase
                      const opportunitiesByPhase = opportunityCosts.slice(0, 5).reduce((acc, opportunity) => {
                        const aiRecommendation = fuzzyRecommendations.find(rec => rec.activityKey === opportunity.activityKey);
                        // Always normalize phases to 1-4 based on timeToImplement
                        const phase = (() => {
                          // Map timeToImplement to clear phase structure:
                          // Phase 1: 0-1 months (30 days)
                          // Phase 2: 1-3 months (90 days) 
                          // Phase 3: 3-12 months (12 months)
                          // Phase 4: 12+ months
                          if (opportunity.timeToImplement <= 1) return 1;
                          if (opportunity.timeToImplement <= 3) return 2;
                          if (opportunity.timeToImplement <= 12) return 3;
                          return 4;
                        })();
                        
                        if (!acc[phase]) {
                          acc[phase] = [];
                        }
                        acc[phase].push(opportunity);
                        return acc;
                      }, {} as Record<number, typeof opportunityCosts>);

                      // Sort phases
                      const sortedPhases = Object.keys(opportunitiesByPhase).sort((a, b) => Number(a) - Number(b));

                      return sortedPhases.map(phaseKey => {
                        const phase = Number(phaseKey);
                        const opportunities = opportunitiesByPhase[phase];
                        const phaseColors = {
                          1: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-800' },
                          2: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-800' },
                          3: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-800' },
                          4: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800' }
                        };
                        const colors = phaseColors[phase as keyof typeof phaseColors] || phaseColors[4];

                        return (
                          <div key={phase} className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border}`}>
                            <div className="flex items-center gap-3 mb-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${colors.badge}`}>
                                PHASE {phase}
                              </span>
                              <h4 className={`font-semibold text-lg ${colors.text}`}>
                                                                 {phase === 1 ? 'Quick Wins (30 days)' :
                                  phase === 2 ? 'Short-term Growth (90 days)' :
                                  phase === 3 ? 'Medium-term Strategy (12 months)' :
                                  'Long-term Investment (12+ months)'}
                              </h4>
                              <span className="text-sm text-gray-600">
                                {opportunities.length} opportunit{opportunities.length === 1 ? 'y' : 'ies'}
                              </span>
                            </div>
                            
                                              <div className="space-y-6">
                              {opportunities.map((opportunity, index) => (
                      <div key={opportunity.activityKey} className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-lg">{opportunity.activity}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                opportunity.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                                opportunity.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {opportunity.riskLevel.toUpperCase()} RISK
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{opportunity.reasoning}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Priority</div>
                            <div className="text-lg font-bold text-blue-600">{(opportunity.priority || 0).toFixed(1)}/10</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-sm text-green-600 font-medium">Estimated ROI</div>
                            <div className="text-xl font-bold text-green-700">{(opportunity.estimatedROI || 0).toFixed(0)}%</div>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-sm text-blue-600 font-medium">Setup Cost</div>
                            <div className="text-xl font-bold text-blue-700">{formatCurrency(opportunity.implementationCost)}</div>
                            <div className="text-xs text-blue-500 mt-1">One-time setup</div>
                          </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-sm text-purple-600 font-medium">Time to Implement</div>
                            <div className="text-xl font-bold text-purple-700">{opportunity.timeToImplement} months</div>
                          </div>
                          <div className="text-center p-3 bg-orange-50 rounded-lg">
                            <div className="text-sm text-orange-600 font-medium">
                              Opportunity Cost ({opportunityTimeframe} months)
                            </div>
                            <div className="text-xl font-bold text-orange-700">
                              {formatCurrency(calculateOpportunityCostForTimeframe(opportunity, parseInt(opportunityTimeframe)))}
                            </div>
                            <div className="text-xs text-orange-500 mt-1">
                              Revenue you're missing
                            </div>
                          </div>
                        </div>

                        {/* Expand/Collapse Button */}
                        <div className="mt-4 flex justify-center">
                          <button
                            onClick={() => toggleOpportunityExpansion(opportunity.activityKey)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            {expandedOpportunities.has(opportunity.activityKey) ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Show Details
                              </>
                            )}
                          </button>
                        </div>

                        {/* Collapsible Content */}
                        {expandedOpportunities.has(opportunity.activityKey) && (
                          <div className="mt-4 space-y-4">
                        {/* Opportunity Cost Breakdown by Timeframe */}
                            {/* Cost Breakdown */}
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h5 className="font-medium mb-3 text-blue-700">💰 Cost Structure</h5>
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-blue-600">Setup Costs (One-time)</div>
                              <div className="text-blue-800">{formatCurrency(opportunity.implementationCost)}</div>
                              <div className="text-xs text-blue-500 mt-1">Initial setup, training, configuration</div>
                            </div>
                            <div>
                              <div className="font-medium text-blue-600">Monthly Costs</div>
                              <div className="text-blue-800">
                                {(() => {
                                  // Calculate estimated monthly costs based on activity type
                                  const monthlyCostEstimate = {
                                    'paidAds': Math.round(opportunity.implementationCost * 0.3),
                                    'contentMarketing': Math.round(opportunity.implementationCost * 0.15),
                                    'seoContent': Math.round(opportunity.implementationCost * 0.1),
                                    'socialSelling': Math.round(opportunity.implementationCost * 0.05),
                                    'transactionalEmails': Math.round(opportunity.implementationCost * 0.08),
                                    'webinarsEvents': Math.round(opportunity.implementationCost * 0.2),
                                    'influencerMarketing': Math.round(opportunity.implementationCost * 0.25),
                                    'retargeting': Math.round(opportunity.implementationCost * 0.2)
                                  };
                                  const monthlyCost = monthlyCostEstimate[opportunity.activityKey as keyof typeof monthlyCostEstimate] || 0;
                                  return monthlyCost > 0 ? formatCurrency(monthlyCost) : 'Minimal';
                                })()}
                              </div>
                              <div className="text-xs text-blue-500 mt-1">Ongoing operational costs</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h5 className="font-medium mb-3 text-gray-700">💸 Revenue Loss Timeline</h5>
                          <div className="mb-4 p-3 bg-white rounded border border-gray-200">
                            <div className="text-sm text-gray-600 mb-2">
                              <strong>Calculation Breakdown for "{opportunity.activity}":</strong>
                            </div>
                            <div className="grid md:grid-cols-3 gap-3 text-xs text-gray-500">
                              <div>
                                <span className="font-medium">Monthly Value from Converted Customers:</span><br/>
                                {formatCurrency((roiMetrics.filledKpis.convertedCustomers || 0) * ((roiMetrics.filledKpis.customerLifetimeValue || 0) / (roiMetrics.filledKpis.customerLifetimeSpan || 1)))}
                                <div className="text-xs text-gray-400 mt-1">
                                  {(roiMetrics.filledKpis.convertedCustomers || 0).toLocaleString()} customers × ${((roiMetrics.filledKpis.customerLifetimeValue || 0) / (roiMetrics.filledKpis.customerLifetimeSpan || 1)).toLocaleString()} monthly value
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Expected ROI:</span><br/>
                                {(opportunity.estimatedROI || 0).toFixed(0)}%
                                <div className="text-xs text-yellow-500 mt-1 cursor-help" title="Estimated ROI - not from specific studies">
                                  ⚠️ Estimated
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Monthly Potential:</span><br/>
                                {formatCurrency(calculateMonthlyOpportunityCost(opportunity))}
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                              <strong>Formula:</strong> (Converted Customers × (LTV ÷ Life Span)) × ROI% × Time Period = Opportunity Cost
                              <div className="mt-1 text-xs text-gray-500">
                                <strong>Step by step:</strong><br/>
                                1. Monthly Value per Customer: ${(roiMetrics.filledKpis.customerLifetimeValue || 0).toLocaleString()} LTV ÷ {(roiMetrics.filledKpis.customerLifetimeSpan || 1)} months = ${((roiMetrics.filledKpis.customerLifetimeValue || 0) / (roiMetrics.filledKpis.customerLifetimeSpan || 1)).toLocaleString()}<br/>
                                2. Monthly Base Revenue: {(roiMetrics.filledKpis.convertedCustomers || 0).toLocaleString()} customers × ${((roiMetrics.filledKpis.customerLifetimeValue || 0) / (roiMetrics.filledKpis.customerLifetimeSpan || 1)).toLocaleString()} = {formatCurrency((roiMetrics.filledKpis.convertedCustomers || 0) * ((roiMetrics.filledKpis.customerLifetimeValue || 0) / (roiMetrics.filledKpis.customerLifetimeSpan || 1)))}<br/>
                                3. Monthly Impact with ROI: {formatCurrency((roiMetrics.filledKpis.convertedCustomers || 0) * ((roiMetrics.filledKpis.customerLifetimeValue || 0) / (roiMetrics.filledKpis.customerLifetimeSpan || 1)))} × {(opportunity.estimatedROI || 0).toFixed(0)}% = {formatCurrency(calculateMonthlyOpportunityCost(opportunity))} per month
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            {[1, 3, 6, 12, 24].map(months => {
                              const cost = calculateOpportunityCostForTimeframe(opportunity, months);
                              const isSelected = parseInt(opportunityTimeframe) === months;
                              return (
                                <div 
                                  key={months} 
                                  className={`text-center p-2 rounded ${
                                    isSelected 
                                      ? 'bg-orange-100 border-2 border-orange-300' 
                                      : 'bg-white border border-gray-200'
                                  }`}
                                >
                                  <div className="text-xs text-gray-600">{months} month{months > 1 ? 's' : ''}</div>
                                  <div className={`font-bold ${isSelected ? 'text-orange-700' : 'text-gray-700'}`}>
                                    {formatCurrency(cost)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="text-xs text-gray-500">
                              💡 This shows how much revenue you're missing by NOT implementing this activity
                            </div>
                            <div className="text-xs font-medium text-orange-600">
                              📅 Monthly loss: {formatCurrency(calculateMonthlyOpportunityCost(opportunity))} per month
                            </div>
                          </div>
                        </div>
                        
                                                {/* AI Analysis Integration */}
                        <div className="mt-6 pt-4 border-t border-gray-100">
                        {(() => {
                          const aiRecommendation = fuzzyRecommendations.find(rec => rec.activityKey === opportunity.activityKey);
                          
                          // Create a basic recommendation if AI recommendation doesn't exist
                          const recommendation = aiRecommendation || {
                            implementationPlan: {
                              phase: Math.min(4, Math.ceil(opportunity.timeToImplement / 3)),
                              timeframe: opportunity.timeToImplement <= 2 ? 'Short-term (1-2 months)' : 
                                        opportunity.timeToImplement <= 6 ? 'Medium-term (3-6 months)' : 
                                        'Long-term (6+ months)',
                              expectedROI: opportunity.estimatedROI,
                              resources: [
                                'Implementation team',
                                'Training resources'
                              ]
                            },
                            score: Math.max(20, Math.min(80, opportunity.estimatedROI / 5)),
                            confidence: Math.max(30, Math.min(70, opportunity.priority * 10)),
                            reasoning: [
                              `High ROI potential of ${opportunity.estimatedROI.toFixed(0)}%`,
                              `Fits well with ${opportunity.riskLevel} risk tolerance`
                            ],
                            prerequisites: [
                              'Team training required',
                              'Budget allocation needed'
                            ]
                          };
                          
                          return (
                            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                  PHASE {recommendation.implementationPlan.phase}
                          </span>
                                {!aiRecommendation && (
                                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                                    Basic Analysis
                          </span>
                                )}
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">AI Score:</span>
                                    <span className="text-sm font-bold text-blue-600">{(recommendation.score || 0).toFixed(0)}/100</span>
                        </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">Confidence:</span>
                                    <span className="text-sm font-bold text-green-600">{(recommendation.confidence || 0).toFixed(0)}%</span>
                      </div>
                                </div>
                              </div>
                              
                              <div className="grid md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <h6 className="font-medium mb-2 text-green-700">✅ Why This Makes Sense</h6>
                                  <ul className="space-y-1">
                                    {recommendation.reasoning.slice(0, 2).map((reason, idx) => (
                                      <li key={idx} className="flex items-start gap-1 text-xs">
                                        <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                        {reason}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                
                                <div>
                                  <h6 className="font-medium mb-2 text-blue-700">📋 Prerequisites</h6>
                                  <ul className="space-y-1">
                                    {recommendation.prerequisites.slice(0, 2).map((prereq, idx) => (
                                      <li key={idx} className="flex items-start gap-1 text-xs">
                                        <Info className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                        {prereq}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                
                                <div>
                                  <h6 className="font-medium mb-2 text-purple-700">🛠️ Required Resources</h6>
                                  <ul className="space-y-1">
                                    {recommendation.implementationPlan.resources.slice(0, 2).map((resource, idx) => (
                                      <li key={idx} className="flex items-start gap-1 text-xs">
                                        <Users className="h-3 w-3 text-purple-500 mt-0.5 flex-shrink-0" />
                                        {resource}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              
                              <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between items-center text-xs">
                                <div>
                                  <span className="text-muted-foreground">Timeline: </span>
                                  <span className="font-medium">{recommendation.implementationPlan.timeframe}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Expected ROI: </span>
                                  <span className="font-bold text-green-600">{recommendation.implementationPlan.expectedROI.toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        </div>

                        {/* Tool Requirements Validation */}
                        <div className="mt-6 pt-4 border-t border-gray-100">
                        {opportunity.toolValidation && opportunity.toolValidation.missingTools.length > 0 && (
                          <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              <h6 className="font-medium text-orange-800">Missing Tools & Requirements</h6>
                              {!opportunity.toolValidation.hasAllRequiredTools && (
                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                                  Required Tools Missing
                          </span>
                              )}
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <h6 className="font-medium mb-2 text-orange-700">🛠️ Missing Tools</h6>
                                <div className="space-y-2">
                                  {opportunity.toolValidation.missingTools.map((tool, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-white rounded border">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${tool.isRequired ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                                        <span className="font-medium">{tool.name}</span>
                                        {tool.isRequired && <span className="text-xs text-red-600">(Required)</span>}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        {tool.setupCost > 0 && <div>Setup: {formatCurrency(tool.setupCost)}</div>}
                                        {tool.monthlyCost > 0 && <div>Monthly: {formatCurrency(tool.monthlyCost)}</div>}
                        </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div>
                                <h6 className="font-medium mb-2 text-orange-700">💰 Additional Costs</h6>
                                <div className="space-y-2">
                                  <div className="p-2 bg-white rounded border">
                                    <div className="flex justify-between">
                                      <span>Additional Setup Cost:</span>
                                      <span className="font-bold text-orange-600">
                                        {formatCurrency(opportunity.toolValidation.totalSetupCost)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-2 bg-white rounded border">
                                    <div className="flex justify-between">
                                      <span>Additional Monthly Cost:</span>
                                      <span className="font-bold text-orange-600">
                                        {formatCurrency(opportunity.toolValidation.totalMonthlyCost)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-2 bg-orange-100 rounded border border-orange-300">
                                    <div className="flex justify-between">
                                      <span className="font-medium">Total Implementation Cost:</span>
                                      <span className="font-bold text-orange-700">
                                        {formatCurrency(opportunity.implementationCost)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-orange-600 mt-1">
                                      Includes base cost + missing tools
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-orange-200">
                              <div className="text-xs text-orange-700">
                                💡 <strong>Recommendation:</strong> Consider acquiring missing tools before implementation to ensure success. 
                                {!opportunity.toolValidation.hasAllRequiredTools && (
                                  <span className="text-red-700"> Required tools are essential for this activity to work effectively.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        </div>
                          </div>
                        )}

                      </div>
                              ))}
                              
                              {/* Phase Summary */}
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="grid md:grid-cols-4 gap-4 text-sm">
                                  <div className="text-center">
                                    <div className="font-medium text-gray-600">Total Setup Cost</div>
                                    <div className="text-lg font-bold text-blue-600">
                                      {formatCurrency(opportunities.reduce((sum, opp) => sum + opp.implementationCost, 0))}
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-gray-600">Average ROI</div>
                                    <div className="text-lg font-bold text-green-600">
                                      {Math.round(opportunities.reduce((sum, opp) => sum + opp.estimatedROI, 0) / opportunities.length)}%
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-gray-600">Monthly Impact</div>
                                    <div className="text-lg font-bold text-purple-600">
                                      {formatCurrency(opportunities.reduce((sum, opp) => sum + calculateMonthlyOpportunityCost(opp), 0))}
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-gray-600">Risk Level</div>
                                    <div className="text-lg font-bold text-orange-600">
                                      {(() => {
                                        const riskCounts = opportunities.reduce((acc, opp) => {
                                          acc[opp.riskLevel] = (acc[opp.riskLevel] || 0) + 1;
                                          return acc;
                                        }, {} as Record<string, number>);
                                        const dominantRisk = Object.entries(riskCounts).sort(([,a], [,b]) => b - a)[0][0];
                                        return dominantRisk.charAt(0).toUpperCase() + dominantRisk.slice(1);
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Total Opportunity Cost Summary */}
                    <div className="mt-6 p-6 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg">
                      <h4 className="font-bold text-lg text-orange-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Total Opportunity Cost Summary
                      </h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-sm text-orange-600 font-medium">Total Monthly Loss</div>
                          <div className="text-2xl font-bold text-orange-700">
                            {formatCurrency(
                              opportunityCosts.slice(0, 5).reduce((total, opp) => 
                                total + calculateMonthlyOpportunityCost(opp), 0
                              )
                            )}
                          </div>
                          <div className="text-xs text-orange-600">per month</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-orange-600 font-medium">
                            Total Loss ({opportunityTimeframe} months)
                          </div>
                          <div className="text-2xl font-bold text-orange-700">
                            {formatCurrency(
                              opportunityCosts.slice(0, 5).reduce((total, opp) => 
                                total + calculateOpportunityCostForTimeframe(opp, parseInt(opportunityTimeframe)), 0
                              )
                            )}
                          </div>
                          <div className="text-xs text-orange-600">total potential loss</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-orange-600 font-medium">Annual Impact</div>
                          <div className="text-2xl font-bold text-orange-700">
                            {formatCurrency(
                              opportunityCosts.slice(0, 5).reduce((total, opp) => 
                                total + calculateOpportunityCostForTimeframe(opp, 12), 0
                              )
                            )}
                          </div>
                          <div className="text-xs text-orange-600">per year</div>
                        </div>
                      </div>
                      <div className="mt-4 text-center text-sm text-orange-700">
                        ⚠️ This represents the revenue you're potentially missing by not implementing the top 5 recommended activities
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Complete your company information and KPIs to see opportunity cost analysis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>



          {/* Next Steps Action Plan - Separate Card */}
          <div className="space-y-6" id="next-steps-plan">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ✅ Next Steps Action Plan
                </CardTitle>
                <CardDescription>
                  Your personalized roadmap to maximize ROI and achieve sustainable growth
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nextStepsPlan ? (
                  <div className="space-y-6">
                    {/* Company Profile Summary */}
                    <div className="grid md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                      <div className="text-center">
                        <div className="text-sm text-blue-600 font-medium">Company Stage</div>
                        <div className="text-lg font-bold text-blue-700 capitalize">{nextStepsPlan.companyProfile.stage}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-green-600 font-medium">Market Fit Score</div>
                        <div className="text-lg font-bold text-green-700">{nextStepsPlan.companyProfile.marketFitScore.toFixed(1)}/10</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-purple-600 font-medium">Digital Maturity</div>
                        <div className="text-lg font-bold text-purple-700">{nextStepsPlan.companyProfile.digitalMaturity}/10</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-orange-600 font-medium">Readiness Level</div>
                        <div className="text-lg font-bold text-orange-700 capitalize">{nextStepsPlan.companyProfile.readinessLevel}</div>
                      </div>
                    </div>

                    {/* Immediate Actions */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                        🚨 Immediate Actions (Next 30 Days)
                      </h3>
                      <div className="grid gap-4">
                        {nextStepsPlan.immediateActions.map((task, index) => (
                          <div key={task.id} className="border-l-4 border-red-500 pl-4 py-3 bg-red-50 rounded-r-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-red-800">{task.title}</h4>
                                <p className="text-sm text-red-700 mt-1">{task.description}</p>
                                <p className="text-xs text-red-600 mt-2 italic">{task.reasoning}</p>
                              </div>
                              <div className="text-right ml-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  task.priority === 'critical' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {task.priority.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-red-600">
                              <div className="flex items-center gap-4">
                                <span>⏱️ {task.estimatedTime}</span>
                                <span>📈 +{task.roiImpact}% ROI</span>
                                <span>🎯 Market Fit: {task.marketFitAlignment}/10</span>
                              </div>
                              {task.actionUrl && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => window.open(task.actionUrl, '_blank')}
                                  className="text-red-600 border-red-300 hover:bg-red-100"
                                >
                                  Take Action
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                            </div>
                            <div className="mt-2">
                              <div className="text-xs text-red-600 font-medium">Required Resources:</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {task.resources.map((resource, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                    {resource}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Short Term Goals */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-orange-700 flex items-center gap-2">
                        🎯 Short-Term Goals (Next 90 Days)
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {nextStepsPlan.shortTermGoals.map((task, index) => (
                          <div key={task.id} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-orange-800">{task.title}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {task.priority.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-orange-700 mb-2">{task.description}</p>
                            <p className="text-xs text-orange-600 italic mb-3">{task.reasoning}</p>
                            <div className="flex items-center justify-between text-xs text-orange-600 mb-2">
                              <span>⏱️ {task.estimatedTime}</span>
                              <span>📈 +{task.roiImpact}% ROI</span>
                            </div>
                            <div className="text-xs text-orange-600">
                              <div className="font-medium">Resources needed:</div>
                              <div className="text-orange-500">{task.resources.join(', ')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Long Term Strategy */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                        🚀 Long-Term Strategy (Next 6-12 Months)
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {nextStepsPlan.longTermStrategy.map((task, index) => (
                          <div key={task.id} className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-blue-800">{task.title}</h4>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {task.category.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-blue-700 mb-2">{task.description}</p>
                            <p className="text-xs text-blue-600 italic mb-3">{task.reasoning}</p>
                            <div className="flex items-center justify-between text-xs text-blue-600 mb-2">
                              <span>⏱️ {task.estimatedTime}</span>
                              <span>📈 +{task.roiImpact}% ROI</span>
                            </div>
                            <div className="text-xs text-blue-600">
                              <div className="font-medium">Resources needed:</div>
                              <div className="text-blue-500">{task.resources.join(', ')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Plan Summary */}
                    <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg">
                      <h4 className="font-bold text-lg text-green-800 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Implementation Summary
                      </h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-sm text-green-600 font-medium">Total Estimated Time</div>
                          <div className="text-2xl font-bold text-green-700">{nextStepsPlan.totalEstimatedTime}</div>
                          <div className="text-xs text-green-600">to complete all tasks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-green-600 font-medium">Expected ROI Increase</div>
                          <div className="text-2xl font-bold text-green-700">+{nextStepsPlan.expectedROIIncrease.toFixed(0)}%</div>
                          <div className="text-xs text-green-600">average improvement</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-green-600 font-medium">Critical Path Tasks</div>
                          <div className="text-2xl font-bold text-green-700">{nextStepsPlan.criticalPath.length}</div>
                          <div className="text-xs text-green-600">high-priority items</div>
                        </div>
                      </div>
                      <div className="mt-4 text-center text-sm text-green-700">
                        🎯 This roadmap is personalized for your {nextStepsPlan.companyProfile.stage} stage company in the {state.industry} industry
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Complete your business profile to receive your personalized action plan</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

            </div>

            {/* Call to Action */}
            <CallToActionCard 
              simulationValues={simulationValues}
              simulatedMetrics={simulatedMetrics}
              handleGenerateAnalysis={handleGenerateAnalysis}
            />
          </div>

          {/* Navigation Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-8 p-4">
              <h3 className="font-semibold text-sm text-gray-900 mb-4">Navigation</h3>
              <nav className="space-y-1">
                                  {[
                    { 
                      id: 'current-kpis', 
                      icon: '📊', 
                      title: 'Current KPIs & Metrics', 
                      completed: checkSectionCompletion('current-kpis')
                    },
                    { 
                      id: 'current-costs', 
                      icon: '💰', 
                      title: 'Current Costs', 
                      completed: checkSectionCompletion('current-costs')
                    },
                    { 
                      id: 'sales-process', 
                      icon: '🎯', 
                      title: 'Sales Process', 
                      completed: checkSectionCompletion('sales-process')
                    },
                    { 
                      id: 'goals', 
                      icon: '📈', 
                      title: 'Goals & Objectives', 
                      completed: checkSectionCompletion('goals')
                    },
                    { 
                      id: 'analysis', 
                      icon: '🔍', 
                      title: 'ROI Analysis', 
                      completed: state.analysisComplete
                    },
                    { 
                      id: 'financial-model', 
                      icon: '📊', 
                      title: 'Financial Model', 
                      completed: state.analysisComplete
                    },
                    { 
                      id: 'opportunity-analysis', 
                      icon: '⚠️', 
                      title: 'Opportunity Cost', 
                      completed: state.analysisComplete
                    },
                    { 
                      id: 'next-steps-plan', 
                      icon: '✅', 
                      title: 'Next Steps Plan', 
                      completed: state.analysisComplete
                    }
                  ].map((section) => (
                    <a 
                    key={section.id}
                      href={`#${section.id}`} 
                      className={`block px-3 py-2 text-sm rounded-md transition-colors relative ${
                        activeSection === section.id 
                          ? 'text-blue-600 bg-blue-50 font-medium' 
                          : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{section.icon} {section.title}</span>
                        {section.completed && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {activeSection === section.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-600 rounded-r"></div>
                      )}
                  </a>
                ))}
              </nav>

              {/* Progress Indicator */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Progress</span>
                  <span className="text-xs font-medium text-gray-900">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {state.completedSections.length} of 5 sections completed
                </p>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-500 mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full justify-start text-xs"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    ⬆️ Back to Top
                  </Button>
                  
                  {/* Share Analysis Button */}
                  {state.isSaved && state.analysisId && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full justify-start text-xs"
                      onClick={() => shareAnalysis(state.analysisId!)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Share Analysis
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div className="lg:hidden">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
            <div 
              className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-lg text-gray-900">Navigation</h3>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                                <nav className="space-y-2">
                  {[
                    { 
                      id: 'current-kpis', 
                      icon: '📊', 
                      title: 'Current KPIs & Metrics', 
                      completed: checkSectionCompletion('current-kpis')
                    },
                    { 
                      id: 'current-costs', 
                      icon: '💰', 
                      title: 'Current Costs', 
                      completed: checkSectionCompletion('current-costs')
                    },
                    { 
                      id: 'sales-process', 
                      icon: '🎯', 
                      title: 'Sales Process', 
                      completed: checkSectionCompletion('sales-process')
                    },
                    { 
                      id: 'goals', 
                      icon: '📈', 
                      title: 'Goals & Objectives', 
                      completed: checkSectionCompletion('goals')
                    },
                    { 
                      id: 'analysis', 
                      icon: '🔍', 
                      title: 'ROI Analysis', 
                      completed: state.analysisComplete
                    },
                    { 
                      id: 'financial-model', 
                      icon: '📊', 
                      title: 'Financial Model', 
                      completed: state.analysisComplete
                    },
                    { 
                      id: 'opportunity-analysis', 
                      icon: '⚠️', 
                      title: 'Opportunity Cost', 
                      completed: state.analysisComplete
                    },
                    { 
                      id: 'next-steps-plan', 
                      icon: '✅', 
                      title: 'Next Steps Plan', 
                      completed: state.analysisComplete
                    }
                  ].map((section) => (
                      <a 
                      key={section.id}
                        href={`#${section.id}`} 
                        className={`block px-4 py-3 text-sm rounded-lg transition-colors relative ${
                          activeSection === section.id 
                            ? 'text-blue-600 bg-blue-50 font-medium' 
                            : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                          setMobileMenuOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{section.icon} {section.title}</span>
                          {section.completed && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        {activeSection === section.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>
                        )}
                    </a>
                  ))}
                </nav>

                {/* Progress Indicator */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500">Progress</span>
                    <span className="text-sm font-medium text-gray-900">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    {state.completedSections.length} of 5 sections completed
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-500 mb-4">Quick Actions</h4>
                  <div className="space-y-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setMobileMenuOpen(false);
                      }}
                    >
                      ⬆️ Back to Top
                    </Button>
                    
                    {/* Share Analysis Button */}
                    {state.isSaved && state.analysisId && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          shareAnalysis(state.analysisId!);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Share Analysis
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ROICalculatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading ROI Calculator...</p>
        </div>
      </div>
    }>
      <ROICalculatorPageContent />
    </Suspense>
  );
}
