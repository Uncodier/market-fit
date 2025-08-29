import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { DollarSign, Save, ExternalLink } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";
import { LeadAnalysisFormData } from "@/app/roi-calculator/actions";

interface CurrentCostsCardProps {
  state: LeadAnalysisFormData;
  roiMetrics: any;
  updateSection: (section: keyof LeadAnalysisFormData, data: any) => void;
  onSave?: () => Promise<any>;
  isSaving?: boolean;
  isSaved?: boolean;
  analysisId?: string;
  onShareAnalysis?: (id: string) => void;
}

export function CurrentCostsCard({ 
  state, 
  roiMetrics, 
  updateSection, 
  onSave, 
  isSaving = false, 
  isSaved = false, 
  analysisId, 
  onShareAnalysis 
}: CurrentCostsCardProps) {
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
    <div className="space-y-6" id="current-costs">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💰 Current Costs & Budget
          </CardTitle>
          <CardDescription>
            Current investment in growth and operations
          </CardDescription>

        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="marketingBudget" className="cursor-help">Monthly Marketing Budget *</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total monthly budget allocated to marketing activities including ads, content, and campaigns.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="marketingBudget"
                type="text"
                placeholder={`Estimated: ${formatCurrency(roiMetrics.filledCosts.marketingBudget)}`}
                value={formatNumberWithCommas(state.current_costs.marketingBudget)}
                onChange={(e) => handleNumberInput(e.target.value, "marketingBudget", "current_costs")}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="salesTeamCost" className="cursor-help">Monthly Sales Team Cost</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total monthly cost of your sales team including salaries, benefits, and commissions.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="salesTeamCost"
                type="text"
                placeholder="0"
                value={formatNumberWithCommas(state.current_costs.salesTeamCost)}
                onChange={(e) => handleNumberInput(e.target.value, "salesTeamCost", "current_costs")}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Sales Commission</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Commission payments to your sales team based on closed deals. Can be set as fixed amount or percentage of revenue.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="salesCommission"
                    type="text"
                    placeholder={`${formatCurrency(roiMetrics.filledCosts.salesCommission)}`}
                    value={formatNumberWithCommas(state.current_costs.salesCommission)}
                    onChange={(e) => handleNumberInput(e.target.value, "salesCommission", "current_costs")}
                  />
                  <p className="text-xs text-gray-500 mt-1">Fixed amount ($)</p>
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder="8%"
                    value={state.current_costs.salesCommission && state.current_kpis.monthlyRevenue ? 
                      `${((state.current_costs.salesCommission / state.current_kpis.monthlyRevenue) * 100).toFixed(1)}` : ""}
                    onChange={(e) => {
                      const percentage = parseFloat(e.target.value) || 0;
                      const revenue = state.current_kpis.monthlyRevenue || roiMetrics.filledKpis.monthlyRevenue;
                      const commissionAmount = Math.round(revenue * (percentage / 100));
                      updateSection("current_costs", { salesCommission: commissionAmount });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Or % of revenue</p>
                </div>
              </div>
              {roiMetrics.isUsingDefaults.salesCommission && (
                <p className="text-xs text-orange-600">
                  * Estimated as 8% of revenue (industry average)
                </p>
              )}
              <p className="text-xs text-gray-500">
                Commission paid to sales team based on closed deals
              </p>
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="technologyCosts" className="cursor-help">Monthly Technology & Tools</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Monthly costs for software, tools, and technology infrastructure used by your business.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="technologyCosts"
                type="text"
                placeholder="0"
                value={formatNumberWithCommas(state.current_costs.technologyCosts)}
                onChange={(e) => handleNumberInput(e.target.value, "technologyCosts", "current_costs")}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="operationalCosts" className="cursor-help">Monthly Operational Costs</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>General operational expenses including office rent, utilities, insurance, and other overhead costs.</p>
                </TooltipContent>
              </Tooltip>
              <Input
                id="operationalCosts"
                type="text"
                placeholder="0"
                value={formatNumberWithCommas(state.current_costs.operationalCosts)}
                onChange={(e) => handleNumberInput(e.target.value, "operationalCosts", "current_costs")}
              />
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Cost of Goods Sold - COGS</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Direct costs associated with producing or delivering your product/service. Can be set as fixed amount or percentage of revenue.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="cogs"
                    type="text"
                    placeholder={`${formatCurrency(roiMetrics.filledCosts.cogs)}`}
                    value={formatNumberWithCommas(state.current_costs.cogs)}
                    onChange={(e) => handleNumberInput(e.target.value, "cogs", "current_costs")}
                  />
                  <p className="text-xs text-gray-500 mt-1">Fixed amount ($)</p>
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder="35%"
                    value={state.current_costs.cogs && state.current_kpis.monthlyRevenue ? 
                      `${((state.current_costs.cogs / state.current_kpis.monthlyRevenue) * 100).toFixed(1)}` : ""}
                    onChange={(e) => {
                      const percentage = parseFloat(e.target.value) || 0;
                      const revenue = state.current_kpis.monthlyRevenue || roiMetrics.filledKpis.monthlyRevenue;
                      const cogsAmount = Math.round(revenue * (percentage / 100));
                      updateSection("current_costs", { cogs: cogsAmount });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Or % of revenue</p>
                </div>
              </div>
              {roiMetrics.isUsingDefaults.cogs && (
                <p className="text-xs text-orange-600">
                  * Estimated as 35% of revenue (industry average)
                </p>
              )}
              <p className="text-xs text-gray-500">
                Direct costs to produce your product/service (materials, labor, etc.)
              </p>
            </div>
          </div>
        </CardContent>
        
        {/* Card Footer with Save/Share Actions */}
        <CardFooter className="px-8 py-6 bg-muted/30 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {isSaved && (
                <span className="text-green-600">✓ Costs saved successfully</span>
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
                      Save Costs
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
