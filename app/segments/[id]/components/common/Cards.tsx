import React, { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { cn } from "@/app/lib/utils";

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "plain" | "default";
}

interface AttributeCardProps {
  title: string;
  value: ReactNode;
  className?: string;
}

export const SectionTitle = ({ children, icon }: { children: React.ReactNode, icon?: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-4">
    {icon && <div className="shrink-0">{icon}</div>}
    <h3 className="text-lg font-semibold tracking-tight">{children}</h3>
  </div>
);

export const AttributeCard = ({ title, value, className }: AttributeCardProps) => {
  return (
    <div className={cn("bg-muted/20 p-4 rounded-md overflow-hidden", className)}>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">{title}</h4>
      <div>{value}</div>
    </div>
  );
};

export const SectionCard = ({ title, icon, children, className, variant = "default" }: SectionCardProps) => {
  return (
    <Card className={cn("shadow-sm overflow-hidden", className)}>
      <CardHeader className={cn("py-4 px-5 flex flex-row items-center justify-between space-y-0", {
        "bg-background": variant === "plain"
      })}>
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          <CardTitle className="text-md font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}; 