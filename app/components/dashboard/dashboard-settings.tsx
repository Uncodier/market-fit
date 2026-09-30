"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { Settings } from "@/app/components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";

interface DashboardSettingsProps {
  onDemoDataChange: (useDemoData: boolean) => void;
  initialUseDemoData?: boolean;
}

export function DashboardSettings({ 
  onDemoDataChange, 
  initialUseDemoData = false 
}: DashboardSettingsProps) {
  const [useDemoData, setUseDemoData] = useState(initialUseDemoData);
  
  useEffect(() => {
    setUseDemoData(initialUseDemoData);
  }, [initialUseDemoData]);

  const handleDemoDataToggle = (checked: boolean) => {
    setUseDemoData(checked);
    onDemoDataChange(checked);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Dashboard settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-4">
          <h4 className="font-medium">Dashboard Settings</h4>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="use-demo-data" className="flex-1">
              Show demo data when no data is available
            </Label>
            <Switch
              id="use-demo-data"
              checked={useDemoData}
              onCheckedChange={handleDemoDataToggle}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 