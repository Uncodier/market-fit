import React from 'react';
import { Card, CardContent } from "@/app/components/ui/card";

interface CampaignDetailTabsProps {
  campaign: any;
  children: React.ReactNode;
}

export function CampaignDetailTabs({ campaign, children }: CampaignDetailTabsProps) {
  return (
    <Card>
      <CardContent className="p-6">
        {children}
      </CardContent>
    </Card>
  );
} 