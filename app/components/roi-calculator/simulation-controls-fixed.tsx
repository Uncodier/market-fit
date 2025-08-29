/**
 * Fixed Simulation Controls Component
 * Compatible with existing ROI calculator hook and data structure
 */

"use client";

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Slider } from "@/app/components/ui/slider";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import { RotateCcw, TrendingUp, TrendingDown, Zap } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";

interface SimulationValues {
  revenueMultiplier: number;
  costMultiplier: number;
  conversionRateMultiplier: number;
  marketingBudgetMultiplier: number;
  cogsMultiplier: number;
  churnRateMultiplier: number;
  leadGenerationMultiplier: number;
  ltvMultiplier: number;
}

interface SimulationControlsProps {
  values: SimulationValues;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
  baseMetrics: any;
  simulatedMetrics: any;
}

interface SliderConfig {
  key: keyof SimulationValues;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  icon: string;
  color: string;
  formatValue?: (value: number) => string;
}

const SLIDER_CONFIGS: SliderConfig[] = [
  {
    key: 'leadGenerationMultiplier',
    label: 'Lead Generation',
    description: 'Adjust monthly lead volume',
    min: 0.1,
    max: 3.0,
    step: 0.1,
    icon: '📈',
    color: 'blue',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'conversionRateMultiplier',
    label: 'Conversion Rate',
    description: 'Optimize lead-to-customer conversion',
    min: 0.5,
    max: 2.5,
    step: 0.1,
    icon: '⚡',
    color: 'green',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'ltvMultiplier',
    label: 'Customer LTV',
    description: 'Increase customer lifetime value',
    min: 0.5,
    max: 2.0,
    step: 0.1,
    icon: '💰',
    color: 'purple',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'churnRateMultiplier',
    label: 'Churn Rate',
    description: 'Reduce customer churn',
    min: 0.3,
    max: 1.5,
    step: 0.1,
    icon: '📉',
    color: 'red',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'revenueMultiplier',
    label: 'Revenue Growth',
    description: 'Overall revenue multiplier',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    icon: '📈',
    color: 'emerald',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'marketingBudgetMultiplier',
    label: 'Marketing Budget',
    description: 'Adjust marketing spend',
    min: 0.5,
    max: 2.5,
    step: 0.1,
    icon: '📈',
    color: 'orange',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'costMultiplier',
    label: 'Operational Costs',
    description: 'Scale operational expenses',
    min: 0.5,
    max: 1.5,
    step: 0.05,
    icon: '📉',
    color: 'yellow',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'cogsMultiplier',
    label: 'COGS',
    description: 'Cost of goods sold efficiency',
    min: 0.3,
    max: 1.2,
    step: 0.05,
    icon: '📉',
    color: 'red',
    formatValue: (value) => `${(value * 100).toFixed(0)}%`,
  },
];

export function SimulationControlsFixed({ 
  values, 
  onChange, 
  onReset, 
  baseMetrics, 
  simulatedMetrics 
}: SimulationControlsProps) {
  const [debouncedValues, setDebouncedValues] = useState(values);

  // Debounce slider changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValues(values);
    }, 150);

    return () => clearTimeout(timer);
  }, [values]);

  const handleSliderChange = useCallback((key: keyof SimulationValues, newValue: number[]) => {
    onChange(key, newValue[0]);
  }, [onChange]);

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const hasChanges = Object.keys(values).some(key => 
    values[key as keyof SimulationValues] !== 1.0
  );

  // Safe calculations with fallbacks and better debugging
  const getROIChange = () => {
    if (!simulatedMetrics || !baseMetrics) return 0;
    const simROI = simulatedMetrics.currentROI || 0;
    const baseROI = baseMetrics.currentROI || 0;
    return simROI - baseROI;
  };

  const getRevenueImpact = () => {
    if (!simulatedMetrics || !baseMetrics) return 0;
    const simRevenue = simulatedMetrics.filledKpis?.monthlyRevenue || 0;
    const baseRevenue = baseMetrics.filledKpis?.monthlyRevenue || 0;
    return simRevenue - baseRevenue;
  };

  const getLTVCACRatio = () => {
    if (!simulatedMetrics?.filledKpis) return 'N/A';
    const ltv = simulatedMetrics.filledKpis.customerLifetimeValue || 0;
    const cac = simulatedMetrics.filledKpis.customerAcquisitionCost || 0;
    if (cac === 0) return 'N/A';
    return (ltv / cac).toFixed(1);
  };

  const getMonthlyProfit = () => {
    if (!simulatedMetrics) return 0;
    const revenue = simulatedMetrics.filledKpis?.monthlyRevenue || 0;
    const costs = simulatedMetrics.totalCurrentCosts || 0;
    return revenue - costs; // Both revenue and costs are already monthly
  };

  // Debug function to show what's happening with lead generation
  const getLeadGenerationImpact = () => {
    if (!simulatedMetrics || !baseMetrics) return { leads: 0, customers: 0 };
    const simLeads = simulatedMetrics.filledKpis?.monthlyLeads || 0;
    const baseLeads = baseMetrics.filledKpis?.monthlyLeads || 0;
    const simCustomers = simulatedMetrics.filledKpis?.convertedCustomers || 0;
    const baseCustomers = baseMetrics.filledKpis?.convertedCustomers || 0;
    return {
      leads: simLeads - baseLeads,
      customers: simCustomers - baseCustomers
    };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              ⚡ Scenario Simulation
            </CardTitle>
            <CardDescription>
              Adjust parameters to model different business scenarios
            </CardDescription>
          </div>
          {hasChanges && (
            <Button 
              onClick={onReset} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
            >
              🔄 Reset
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Scenarios */}
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <h4 className="font-medium text-sm mb-3 cursor-help">Quick Scenarios</h4>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pre-configured scenarios to quickly test different business strategies and their impact on your ROI.</p>
            </TooltipContent>
          </Tooltip>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-start gap-3 p-3 h-auto w-full"
              onClick={() => {
                // Conservative growth scenario
                onChange('leadGenerationMultiplier', 1.2);
                onChange('conversionRateMultiplier', 1.1);
                onChange('ltvMultiplier', 1.1);
                onChange('churnRateMultiplier', 0.9);
              }}
            >
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                📈
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-sm">Conservative Growth</div>
                <div className="text-xs text-gray-500">+20% leads, +10% conversion</div>
              </div>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-start gap-3 p-3 h-auto w-full"
              onClick={() => {
                // Aggressive growth scenario
                onChange('leadGenerationMultiplier', 2.0);
                onChange('conversionRateMultiplier', 1.5);
                onChange('ltvMultiplier', 1.3);
                onChange('marketingBudgetMultiplier', 1.8);
              }}
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                ⚡
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-sm">Aggressive Growth</div>
                <div className="text-xs text-gray-500">2x leads, +50% conversion</div>
              </div>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-start gap-3 p-3 h-auto w-full"
              onClick={() => {
                // Efficiency focused scenario
                onChange('costMultiplier', 0.8);
                onChange('cogsMultiplier', 0.7);
                onChange('churnRateMultiplier', 0.6);
                onChange('conversionRateMultiplier', 1.3);
              }}
            >
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                📉
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-sm">Efficiency Focus</div>
                <div className="text-xs text-gray-500">-20% costs, -40% churn</div>
              </div>
            </Button>
          </div>
        </div>

        <Separator />

        {/* Slider Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SLIDER_CONFIGS.map((config) => {
            const currentValue = values[config.key];
            const isChanged = currentValue !== 1.0;
            
            return (
              <div key={config.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(config.color)}`}>
                      <span className="text-sm">{config.icon}</span>
                    </div>
                    <div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h4 className="font-medium text-sm cursor-help">{config.label}</h4>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{config.description}</p>
                        </TooltipContent>
                      </Tooltip>
                      <p className="text-xs text-gray-500">{config.description}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={isChanged ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {config.formatValue ? config.formatValue(currentValue) : currentValue.toFixed(1)}
                  </Badge>
                </div>
                
                <Slider
                  value={[currentValue]}
                  onValueChange={(value) => handleSliderChange(config.key, value)}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  className="w-full"
                />
                
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{config.formatValue ? config.formatValue(config.min) : config.min}</span>
                  <span>Baseline</span>
                  <span>{config.formatValue ? config.formatValue(config.max) : config.max}</span>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Impact Summary */}
        {simulatedMetrics && baseMetrics && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Simulation Impact</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">ROI Change</span>
                <div className="font-semibold text-lg">
                  {getROIChange() > 0 ? '+' : ''}
                  {getROIChange().toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600">Revenue Impact</span>
                <div className="font-semibold text-lg">
                  {formatCurrency(getRevenueImpact())}
                </div>
              </div>
              <div>
                <span className="text-gray-600">LTV:CAC Ratio</span>
                <div className="font-semibold text-lg">
                  {getLTVCACRatio()}:1
                </div>
              </div>
              <div>
                <span className="text-gray-600">Monthly Profit</span>
                <div className="font-semibold text-lg">
                  {formatCurrency(getMonthlyProfit())}
                </div>
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
