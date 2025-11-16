import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Button } from "@/app/components/ui/button";
import { Target, Save, ExternalLink } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { LeadAnalysisFormData } from "@/app/roi-calculator/actions";

interface SalesProcessCardProps {
  state: LeadAnalysisFormData;
  updateSection: (section: keyof LeadAnalysisFormData, data: any) => void;
  onSave?: () => Promise<any>;
  isSaving?: boolean;
  isSaved?: boolean;
  analysisId?: string;
  onShareAnalysis?: (id: string) => void;
}

export function SalesProcessCard({ 
  state, 
  updateSection, 
  onSave, 
  isSaving = false, 
  isSaved = false, 
  analysisId, 
  onShareAnalysis 
}: SalesProcessCardProps) {
  return (
    <div className="space-y-6" id="sales-process">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎯 Sales Process & Challenges
          </CardTitle>
          <CardDescription>
            Current sales process and main challenges
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="text-base font-medium cursor-help">Lead Qualification Methods *</Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select the methods you currently use to qualify and evaluate potential customers before engaging with them.</p>
                </TooltipContent>
              </Tooltip>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="deepResearch" className="text-sm font-medium">Deep Research</Label>
                    <p className="text-xs text-muted-foreground">Comprehensive prospect research and analysis</p>
                  </div>
                  <Switch
                    id="deepResearch"
                    checked={state.sales_process.qualificationProcess?.deepResearch || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        deepResearch: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="manualResearch" className="text-sm font-medium">Manual Research</Label>
                    <p className="text-xs text-muted-foreground">Manual investigation of prospects and companies</p>
                  </div>
                  <Switch
                    id="manualResearch"
                    checked={state.sales_process.qualificationProcess?.manualResearch || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        manualResearch: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="interviews" className="text-sm font-medium">Interviews</Label>
                    <p className="text-xs text-muted-foreground">Direct interviews with prospects and stakeholders</p>
                  </div>
                  <Switch
                    id="interviews"
                    checked={state.sales_process.qualificationProcess?.interviews || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        interviews: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="icpTargeting" className="text-sm font-medium">ICP Targeting</Label>
                    <p className="text-xs text-muted-foreground">Ideal Customer Profile matching and targeting</p>
                  </div>
                  <Switch
                    id="icpTargeting"
                    checked={state.sales_process.qualificationProcess?.icpTargeting || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        icpTargeting: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="behaviorAnalysis" className="text-sm font-medium">Behavior Analysis</Label>
                    <p className="text-xs text-muted-foreground">Analysis of prospect behavior and engagement patterns</p>
                  </div>
                  <Switch
                    id="behaviorAnalysis"
                    checked={state.sales_process.qualificationProcess?.behaviorAnalysis || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        behaviorAnalysis: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="leadScoring" className="text-sm font-medium">Lead Scoring</Label>
                    <p className="text-xs text-muted-foreground">Automated scoring system for lead qualification</p>
                  </div>
                  <Switch
                    id="leadScoring"
                    checked={state.sales_process.qualificationProcess?.leadScoring || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        leadScoring: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="demographicFiltering" className="text-sm font-medium">Demographic Filtering</Label>
                    <p className="text-xs text-muted-foreground">Filtering based on demographic criteria</p>
                  </div>
                  <Switch
                    id="demographicFiltering"
                    checked={state.sales_process.qualificationProcess?.demographicFiltering || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        demographicFiltering: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="companySize" className="text-sm font-medium">Company Size Filtering</Label>
                    <p className="text-xs text-muted-foreground">Qualification based on company size criteria</p>
                  </div>
                  <Switch
                    id="companySize"
                    checked={state.sales_process.qualificationProcess?.companySize || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        companySize: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="budgetQualification" className="text-sm font-medium">Budget Qualification</Label>
                    <p className="text-xs text-muted-foreground">Assessment of prospect's budget and purchasing power</p>
                  </div>
                  <Switch
                    id="budgetQualification"
                    checked={state.sales_process.qualificationProcess?.budgetQualification || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        budgetQualification: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="decisionMakerID" className="text-sm font-medium">Decision Maker ID</Label>
                    <p className="text-xs text-muted-foreground">Identification of key decision makers</p>
                  </div>
                  <Switch
                    id="decisionMakerID"
                    checked={state.sales_process.qualificationProcess?.decisionMakerID || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        decisionMakerID: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="painPointAssessment" className="text-sm font-medium">Pain Point Assessment</Label>
                    <p className="text-xs text-muted-foreground">Evaluation of prospect's pain points and needs</p>
                  </div>
                  <Switch
                    id="painPointAssessment"
                    checked={state.sales_process.qualificationProcess?.painPointAssessment || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        painPointAssessment: checked
                      }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="competitorAnalysis" className="text-sm font-medium">Competitor Analysis</Label>
                    <p className="text-xs text-muted-foreground">Analysis of prospect's current solutions and competitors</p>
                  </div>
                  <Switch
                    id="competitorAnalysis"
                    checked={state.sales_process.qualificationProcess?.competitorAnalysis || false}
                    onCheckedChange={(checked) => updateSection("sales_process", {
                      qualificationProcess: {
                        ...state.sales_process.qualificationProcess,
                        competitorAnalysis: checked
                      }
                    })}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="followUpFrequency">Follow-up Frequency</Label>
              <Select
                value={state.sales_process.followUpFrequency}
                onValueChange={(value) => updateSection("sales_process", { 
                  followUpFrequency: value 
                })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="How often do you follow up with leads?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="irregular">Irregular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sales Activities Section - Simplified for component size */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Sales Activities Currently Used</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'coldCalls', label: 'Cold Calls', desc: 'Outbound phone calls to prospects' },
                  { id: 'personalizedFollowUp', label: 'Personalized Follow-up', desc: 'Tailored outreach based on lead behavior' },
                  { id: 'videoCalls', label: 'Video Calls', desc: 'Virtual meetings and demos' },
                  { id: 'transactionalEmails', label: 'Transactional Emails', desc: 'Automated email sequences' },
                  { id: 'socialSelling', label: 'Social Selling', desc: 'LinkedIn and social media outreach' },
                  { id: 'contentMarketing', label: 'Content Marketing', desc: 'Educational content and nurturing' },
                  { id: 'referralProgram', label: 'Referral Program', desc: 'Customer and partner referrals' },
                  { id: 'webinarsEvents', label: 'Webinars & Events', desc: 'Educational events and demos' },
                  { id: 'paidAds', label: 'Paid Advertising', desc: 'Google Ads, Facebook Ads, LinkedIn Ads' },
                  { id: 'seoContent', label: 'SEO & Organic Content', desc: 'Search engine optimization and organic traffic' },
                  { id: 'partnerships', label: 'Strategic Partnerships', desc: 'Channel partners and strategic alliances' },
                  { id: 'directMail', label: 'Direct Mail', desc: 'Physical mail campaigns and packages' },
                ].map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor={activity.id} className="text-sm font-medium">{activity.label}</Label>
                      <p className="text-xs text-muted-foreground">{activity.desc}</p>
                    </div>
                    <Switch
                      id={activity.id}
                      checked={state.sales_process.salesActivities?.[activity.id as keyof typeof state.sales_process.salesActivities] || false}
                      onCheckedChange={(checked) => updateSection("sales_process", {
                        salesActivities: {
                          ...state.sales_process.salesActivities,
                          [activity.id]: checked
                        }
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Available Tools Section - Simplified */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Available Tools & Platforms</Label>
              <p className="text-sm text-muted-foreground">
                Select the tools and platforms you currently have access to. This helps us provide more accurate recommendations.
              </p>
              
              {/* CRM & Sales Tools */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-blue-600">CRM & Sales Tools</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'crmSystem', label: 'CRM System', desc: 'Salesforce, HubSpot, Pipedrive, etc.' },
                    { id: 'salesAutomation', label: 'Sales Automation', desc: 'Outreach, SalesLoft, Apollo, etc.' },
                    { id: 'leadScoringTool', label: 'Lead Scoring', desc: 'Automated lead qualification tools' },
                    { id: 'pipelineManagement', label: 'Pipeline Management', desc: 'Deal tracking and forecasting tools' },
                  ].map((tool) => (
                    <div key={tool.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor={tool.id} className="text-sm font-medium">{tool.label}</Label>
                        <p className="text-xs text-muted-foreground">{tool.desc}</p>
                      </div>
                      <Switch
                        id={tool.id}
                        checked={state.sales_process.availableTools?.[tool.id as keyof typeof state.sales_process.availableTools] || false}
                        onCheckedChange={(checked) => updateSection("sales_process", {
                          availableTools: {
                            ...state.sales_process.availableTools,
                            [tool.id]: checked
                          }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Communication Tools */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-green-600">Communication Tools</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'emailMarketing', label: 'Email Marketing', desc: 'Mailchimp, ConvertKit, ActiveCampaign' },
                    { id: 'videoConferencing', label: 'Video Conferencing', desc: 'Zoom, Teams, Google Meet' },
                    { id: 'phoneSystem', label: 'Phone System', desc: 'VoIP, call tracking, recording' },
                    { id: 'liveChatSupport', label: 'Live Chat', desc: 'Intercom, Drift, Zendesk Chat' },
                  ].map((tool) => (
                    <div key={tool.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor={tool.id} className="text-sm font-medium">{tool.label}</Label>
                        <p className="text-xs text-muted-foreground">{tool.desc}</p>
                      </div>
                      <Switch
                        id={tool.id}
                        checked={state.sales_process.availableTools?.[tool.id as keyof typeof state.sales_process.availableTools] || false}
                        onCheckedChange={(checked) => updateSection("sales_process", {
                          availableTools: {
                            ...state.sales_process.availableTools,
                            [tool.id]: checked
                          }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Analytics & Tracking */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-purple-600">Analytics & Tracking</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'webAnalytics', label: 'Web Analytics', desc: 'Google Analytics, Adobe Analytics' },
                    { id: 'heatmapTools', label: 'Heatmap Tools', desc: 'Hotjar, Crazy Egg, FullStory' },
                    { id: 'abtestingPlatform', label: 'A/B Testing', desc: 'Optimizely, VWO, Google Optimize' },
                    { id: 'conversionTracking', label: 'Conversion Tracking', desc: 'Pixel tracking, event monitoring' },
                  ].map((tool) => (
                    <div key={tool.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor={tool.id} className="text-sm font-medium">{tool.label}</Label>
                        <p className="text-xs text-muted-foreground">{tool.desc}</p>
                      </div>
                      <Switch
                        id={tool.id}
                        checked={state.sales_process.availableTools?.[tool.id as keyof typeof state.sales_process.availableTools] || false}
                        onCheckedChange={(checked) => updateSection("sales_process", {
                          availableTools: {
                            ...state.sales_process.availableTools,
                            [tool.id]: checked
                          }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Marketing Automation */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-orange-600">Marketing Automation</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'marketingAutomation', label: 'Marketing Automation', desc: 'Marketo, Pardot, ActiveCampaign' },
                    { id: 'zapierIntegrations', label: 'Zapier/Integrations', desc: 'Workflow automation tools' },
                    { id: 'googleAds', label: 'Google Ads', desc: 'Search, Display, YouTube advertising' },
                    { id: 'facebookAds', label: 'Meta Ads', desc: 'Facebook, Instagram advertising' },
                    { id: 'linkedinAds', label: 'LinkedIn Ads', desc: 'Professional network advertising' },
                    { id: 'seoTools', label: 'SEO Tools', desc: 'SEMrush, Ahrefs, Moz' },
                  ].map((tool) => (
                    <div key={tool.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor={tool.id} className="text-sm font-medium">{tool.label}</Label>
                        <p className="text-xs text-muted-foreground">{tool.desc}</p>
                      </div>
                      <Switch
                        id={tool.id}
                        checked={state.sales_process.availableTools?.[tool.id as keyof typeof state.sales_process.availableTools] || false}
                        onCheckedChange={(checked) => updateSection("sales_process", {
                          availableTools: {
                            ...state.sales_process.availableTools,
                            [tool.id]: checked
                          }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        
        {/* Card Footer with Save/Share Actions */}
        <CardFooter className="px-8 py-6 bg-muted/30 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {isSaved ? (
                <span className="text-green-600">✓ Sales process saved successfully</span>
              ) : (
                <span>Configure your sales process and methods</span>
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
                      Save Process
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
