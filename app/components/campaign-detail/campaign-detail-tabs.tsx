import React from 'react';
import { Card, CardContent } from "@/app/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { BarChart } from "@/app/components/ui/icons";
import { useRouter } from "next/navigation";

interface CampaignDetailTabsProps {
  campaign: any;
  children: React.ReactNode;
}

export function CampaignDetailTabs({ campaign, children }: CampaignDetailTabsProps) {
  const router = useRouter();
  
  // If campaign is completed, just render the children without tabs
  if (campaign.status === "completed") {
    return (
      <Card>
        <CardContent className="p-6">
          {children}
        </CardContent>
      </Card>
    );
  }

  // Check if budget is 0 or undefined/null
  const hasBudget = campaign.budget?.allocated && campaign.budget.allocated > 0;
  
  // If no budget, render only Details without tabs
  if (!hasBudget) {
    return (
      <Card>
        <CardContent className="p-6">
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Tabs defaultValue="outsource" className="w-full">
          <div className="border-b px-6 py-2 flex justify-center">
            <TabsList className="grid grid-cols-2 w-full max-w-[360px]">
              <TabsTrigger value="outsource">Outsource</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="outsource" className="p-0 m-0">
            <div className="p-6">
              <ScrollArea className="pr-4">
                <div className="space-y-6">
                  <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                      Outsource Instructions
                    </h3>
                    
                    <div className="space-y-4 max-w-full">
                      {/* Budget highlighted section */}
                      <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                        <Label className="text-sm font-semibold text-primary flex items-center gap-2 mb-2">
                          <BarChart className="h-4 w-4" />
                          Budget
                        </Label>
                        <div className="text-lg font-bold text-center py-1">
                          {campaign.budget?.allocated ? `$${campaign.budget.allocated.toLocaleString()}` : "No budget specified"}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Instructions for Outsourcing</Label>
                        <div className="min-h-[150px] w-full resize-none text-sm bg-muted/20 p-3 rounded-md border">
                          {campaign.outsourceInstructions || 
                            "Implement this campaign according to the project specifications and timeline. Follow best practices for execution and reporting."}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Timeline</Label>
                        <div className="text-muted-foreground text-sm break-words bg-muted/40 p-2 rounded">
                          Please complete this campaign within the specified timeframe.
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Deliverables</Label>
                        <div className="text-muted-foreground text-sm bg-muted/40 p-2 rounded">
                          <ul className="list-disc pl-4 space-y-1 break-words">
                            <li>Complete implementation of the campaign strategy</li>
                            <li>Performance metrics and analytics</li>
                            <li>Final report with insights and recommendations</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Communication</Label>
                        <div className="text-muted-foreground text-sm break-words bg-muted/40 p-2 rounded">
                          Please provide regular updates on progress and any questions via the project management system.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <div className="mt-6">
                <Button className="w-full" onClick={() => router.push(`/outsource/checkout?campaignId=${campaign.id}`)}>
                  Outsource Campaign
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="p-6">
            {children}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 