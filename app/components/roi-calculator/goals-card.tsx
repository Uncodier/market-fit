import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Button } from "@/app/components/ui/button";
import { TrendingUp, Save, ExternalLink } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { LeadAnalysisFormData } from "@/app/roi-calculator/actions";
import { formatInputNumber, parseFormattedNumber } from "@/app/lib/formatters";

interface GoalsCardProps {
  state: LeadAnalysisFormData;
  roiMetrics: any;
  updateSection: (section: keyof LeadAnalysisFormData, data: any) => void;
  getFormattedDisplayValue: (value: string | undefined) => string;
  onSave?: () => Promise<any>;
  isSaving?: boolean;
  isSaved?: boolean;
  analysisId?: string;
  onShareAnalysis?: (id: string) => void;
}

export function GoalsCard({ 
  state, 
  roiMetrics, 
  updateSection, 
  getFormattedDisplayValue, 
  onSave, 
  isSaving = false, 
  isSaved = false, 
  analysisId, 
  onShareAnalysis 
}: GoalsCardProps) {
  return (
    <div className="space-y-6" id="goals">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📈 Growth Goals & Objectives
          </CardTitle>
          <CardDescription>
            Define your growth targets and timeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="revenueTarget" className="cursor-help">Revenue Target *</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your annual revenue goal. You can set either a fixed dollar amount or a percentage growth target.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    id="revenueTarget"
                    type="text"
                    placeholder="e.g., $500,000"
                    value={getFormattedDisplayValue(state.goals.revenueTarget?.toString())}
                    onChange={(e) => {
                      const numericValue = parseFormattedNumber(e.target.value);
                      updateSection("goals", { revenueTarget: numericValue });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Fixed target ($)</p>
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder="50%"
                    value={state.current_kpis.monthlyRevenue && state.goals.revenueTarget ? 
                      `${(((state.goals.revenueTarget / 12) / state.current_kpis.monthlyRevenue - 1) * 100).toFixed(1)}` : ""}
                    onChange={(e) => {
                      const percentage = parseFloat(e.target.value) || 0;
                      const currentMonthlyRevenue = state.current_kpis.monthlyRevenue || roiMetrics.filledKpis.monthlyRevenue;
                      const targetMonthlyRevenue = currentMonthlyRevenue * (1 + percentage / 100);
                      const annualTarget = Math.round(targetMonthlyRevenue * 12);
                      updateSection("goals", { revenueTarget: annualTarget });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Or % growth</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Annual revenue goal for your business growth
              </p>
            </div>
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="timeframe" className="cursor-help">Timeframe *</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select the timeframe within which you want to achieve your revenue target.</p>
                </TooltipContent>
              </Tooltip>
              <Select
                value={state.goals.timeframe}
                onValueChange={(value) => updateSection("goals", { 
                  timeframe: value 
                })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3-months">3 months</SelectItem>
                  <SelectItem value="6-months">6 months</SelectItem>
                  <SelectItem value="12-months">12 months</SelectItem>
                  <SelectItem value="18-months">18 months</SelectItem>
                  <SelectItem value="24-months">24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        
        {/* Card Footer with Save/Share Actions */}
        <CardFooter className="px-8 py-6 bg-muted/30 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {isSaved ? (
                <span className="text-green-600">✓ Goals saved successfully</span>
              ) : (
                <span>Define your growth targets and timeline</span>
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
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-2" />
                      Save Goals
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
