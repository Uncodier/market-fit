import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";

export const ImportanceIndicator = ({ level }: { level: string }) => {
  const getColor = () => {
    if (level.toLowerCase().includes('very high') || level.toLowerCase().includes('critical')) {
      return 'bg-primary';
    } else if (level.toLowerCase().includes('high')) {
      return 'bg-blue-500';
    } else if (level.toLowerCase().includes('medium')) {
      return 'bg-yellow-500';
    } else {
      return 'bg-muted-foreground';
    }
  };

  const getTooltipText = () => {
    if (level.toLowerCase().includes('very high') || level.toLowerCase().includes('critical')) {
      return 'Critical - Highest importance';
    } else if (level.toLowerCase().includes('high')) {
      return 'High importance';
    } else if (level.toLowerCase().includes('medium')) {
      return 'Medium importance';
    } else {
      return 'Lower importance';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex space-x-1">
            <div className={`h-2 w-2 rounded-full ${getColor()}`}></div>
            <div className={`h-2 w-2 rounded-full ${
              level.toLowerCase().includes('very high') || level.toLowerCase().includes('high') ? getColor() : 'bg-muted'
            }`}></div>
            <div className={`h-2 w-2 rounded-full ${
              level.toLowerCase().includes('very high') ? getColor() : 'bg-muted'
            }`}></div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 