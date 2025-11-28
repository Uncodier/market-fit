import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { BarChart, Save, ExternalLink } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";
import { LeadAnalysisFormData } from "@/app/roi-calculator/actions";

interface CurrentKPIsCardProps {
  state: LeadAnalysisFormData;
  roiMetrics: any;
  updateSection: (section: keyof LeadAnalysisFormData, data: any) => void;
  onSave?: () => Promise<any>;
  isSaving?: boolean;
  isSaved?: boolean;
}

export function CurrentKPIsCard({ 
  state, 
  roiMetrics, 
  updateSection, 
  onSave, 
  isSaving = false, 
  isSaved = false
}: CurrentKPIsCardProps) {
  
  // Local state for cost per lead input to prevent interference while typing
  const [costPerLeadInput, setCostPerLeadInput] = useState("");
  
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

  return (
    <div className="space-y-6" id="current-kpis">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Current KPIs & Metrics
          </CardTitle>
          <CardDescription>
            Current performance metrics and baseline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="monthlyRevenue" className="cursor-help">Monthly Revenue *</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your total monthly revenue from all sources. This is used as the baseline for growth calculations.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="monthlyRevenue"
                type="text"
                placeholder={`Estimated: ${formatCurrency(roiMetrics.filledKpis.monthlyRevenue)}`}
                value={formatNumberWithCommas(state.current_kpis.monthlyRevenue)}
                onChange={(e) => handleNumberInput(e.target.value, "monthlyRevenue", "current_kpis")}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="cac" className="cursor-help">Customer Acquisition Cost *</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total cost to acquire a new customer, including marketing, sales, and onboarding costs.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="cac"
                type="text"
                placeholder={`Estimated: ${formatCurrency(roiMetrics.filledKpis.customerAcquisitionCost)}`}
                value={formatNumberWithCommas(state.current_kpis.customerAcquisitionCost)}
                onChange={(e) => handleNumberInput(e.target.value, "customerAcquisitionCost", "current_kpis")}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="ltv" className="cursor-help">Customer Lifetime Value</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total revenue expected from a customer over their entire relationship with your business.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="ltv"
                type="text"
                placeholder="0"
                value={formatNumberWithCommas(state.current_kpis.customerLifetimeValue)}
                onChange={(e) => handleNumberInput(e.target.value, "customerLifetimeValue", "current_kpis")}
              />
            </div>

            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="aov" className="cursor-help">Average Order Value</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average amount spent per transaction or order by your customers.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="aov"
                type="text"
                placeholder="0"
                value={formatNumberWithCommas(state.current_kpis.averageOrderValue)}
                onChange={(e) => handleNumberInput(e.target.value, "averageOrderValue", "current_kpis")}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Monthly Leads</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of potential customers you generate each month through marketing and sales efforts.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="monthlyLeads"
                    type="text"
                    placeholder={`${roiMetrics.filledKpis.monthlyLeads} leads`}
                    value={formatNumberWithCommas(state.current_kpis.monthlyLeads)}
                    onChange={(e) => handleNumberInput(e.target.value, "monthlyLeads", "current_kpis")}
                  />
                  <p className="text-xs text-gray-500 mt-1">Total leads</p>
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder="Cost per lead"
                    value={costPerLeadInput}
                    onChange={(e) => {
                      setCostPerLeadInput(e.target.value);
                    }}
                    onBlur={() => {
                      const costPerLead = parseNumberFromInput(costPerLeadInput);
                      // Get marketing budget from current state or defaults
                      const marketingBudget = state.current_costs.marketingBudget || roiMetrics.filledCosts.marketingBudget || 0;
                      
                      if (costPerLead > 0 && marketingBudget > 0) {
                        // Calculate leads = marketing budget / cost per lead
                        const calculatedLeads = Math.round(marketingBudget / costPerLead);
                        updateSection("current_kpis", { monthlyLeads: calculatedLeads });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur(); // Trigger onBlur when Enter is pressed
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Or cost per lead ($)</p>
                </div>
              </div>
              {roiMetrics.isUsingDefaults.monthlyLeads && (
                <p className="text-xs text-orange-600">
                  * Estimated based on industry standards
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Converted Customers (Monthly)</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of leads that become paying customers each month. This affects your conversion rate calculation.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="convertedCustomers"
                    type="text"
                    placeholder={`${roiMetrics.filledKpis.convertedCustomers} customers`}
                    value={formatNumberWithCommas(state.current_kpis.convertedCustomers)}
                    onChange={(e) => {
                      const customers = parseNumberFromInput(e.target.value);
                      const leads = state.current_kpis.monthlyLeads || roiMetrics.filledKpis.monthlyLeads;
                      const conversionRate = leads > 0 ? (customers / leads) * 100 : 0;
                      updateSection("current_kpis", { 
                        convertedCustomers: customers,
                        conversionRate: conversionRate
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of customers</p>
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder={`${roiMetrics.filledKpis.conversionRate.toFixed(1)}%`}
                    value={formatNumberWithCommas(state.current_kpis.conversionRate)}
                    onChange={(e) => {
                      const rate = parseNumberFromInput(e.target.value);
                      const leads = state.current_kpis.monthlyLeads || roiMetrics.filledKpis.monthlyLeads;
                      const customers = Math.round(leads * (rate / 100));
                      updateSection("current_kpis", { 
                        conversionRate: rate,
                        convertedCustomers: customers
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Or conversion rate (%)</p>
                </div>
              </div>
              {roiMetrics.isUsingDefaults.convertedCustomers && (
                <p className="text-xs text-orange-600">
                  * Estimated based on leads × conversion rate
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="salesCycleLength" className="cursor-help">Sales Cycle Length (days)</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average number of days from first contact to closing a deal with a new customer.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="salesCycleLength"
                type="number"
                placeholder="0"
                value={state.current_kpis.salesCycleLength || ""}
                onChange={(e) => updateSection("current_kpis", { 
                  salesCycleLength: parseFloat(e.target.value) || 0 
                })}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Customer Lifetime Span</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average duration of the customer relationship with your business, from first purchase to churn.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="customerLifetimeSpan"
                    type="text"
                    placeholder={`${roiMetrics.filledKpis.customerLifetimeSpan} months`}
                    value={formatNumberWithCommas(state.current_kpis.customerLifetimeSpan)}
                    onChange={(e) => handleNumberInput(e.target.value, "customerLifetimeSpan", "current_kpis")}
                  />
                  <p className="text-xs text-gray-500 mt-1">Months</p>
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder={`${(roiMetrics.filledKpis.customerLifetimeSpan / 12).toFixed(1)} years`}
                    value={state.current_kpis.customerLifetimeSpan ? (state.current_kpis.customerLifetimeSpan / 12).toFixed(1) : ""}
                    onChange={(e) => {
                      const years = parseFloat(e.target.value) || 0;
                      const months = Math.round(years * 12);
                      updateSection("current_kpis", { customerLifetimeSpan: months });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Or years</p>
                </div>
              </div>
              {roiMetrics.isUsingDefaults.customerLifetimeSpan && (
                <p className="text-xs text-orange-600">
                  * Estimated as 24 months (industry average)
                </p>
              )}
              <p className="text-xs text-gray-500">
                How long customers typically stay with your business
              </p>
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Churn Rate</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Percentage of customers who stop using your product/service each month. Lower is better.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="churnRate"
                    type="text"
                    placeholder={`${roiMetrics.filledKpis.churnRate.toFixed(1)}%`}
                    value={formatNumberWithCommas(state.current_kpis.churnRate)}
                    onChange={(e) => handleNumberInput(e.target.value, "churnRate", "current_kpis")}
                  />
                  <p className="text-xs text-gray-500 mt-1">Monthly % lost</p>
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder={`${(roiMetrics.filledKpis.churnRate * 12).toFixed(1)}%`}
                    value={state.current_kpis.churnRate ? (state.current_kpis.churnRate * 12).toFixed(1) : ""}
                    onChange={(e) => {
                      const annualChurn = parseFloat(e.target.value) || 0;
                      const monthlyChurn = annualChurn / 12;
                      updateSection("current_kpis", { churnRate: monthlyChurn });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Or annual % lost</p>
                </div>
              </div>
              {roiMetrics.isUsingDefaults.churnRate && (
                <p className="text-xs text-orange-600">
                  * Estimated as 5% monthly (industry average)
                </p>
              )}
              <p className="text-xs text-gray-500">
                Percentage of customers who stop using your service
              </p>
            </div>
          </div>
        </CardContent>
        
        {/* Card Footer with Save/Share Actions */}
        <CardFooter className="px-8 py-6 bg-muted/30 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {isSaved && (
                <span className="text-green-600">✓ KPIs saved successfully</span>
              )}
            </div>
            
            <div className="flex gap-2">
              {onSave && (
                <Button
                  onClick={onSave}
                  disabled={isSaving}
                  size="sm"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save KPIs
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
