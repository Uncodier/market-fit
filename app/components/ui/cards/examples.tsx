'use client';

import React from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  EmptyCard,
  SkeletonCard,
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
  SectionCardFooter,
} from "./index";
import { Button } from "@/app/components/ui/button";
import { FileText, BarChart } from "@/app/components/ui/icons";

/**
 * StandardCard Component
 * 
 * Demonstrates the proper usage of Card components with consistent padding and styling.
 */
export function StandardCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>This is a standard card with description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the main content of the card.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          You can add any content here.
        </p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  );
}

/**
 * SettingsSectionCard Component
 *
 * Use SectionCard for settings pages and detail form sections.
 */
export function SettingsSectionCard() {
  return (
    <SectionCard>
      <SectionCardHeader
        title="Annual Goals"
        description="What do you want to achieve this year?"
      />
      <SectionCardContent>
        <p className="text-sm text-muted-foreground">Form fields go here.</p>
      </SectionCardContent>
      <SectionCardFooter dirty saving={false} onSave={() => undefined} saveLabel="Save" />
    </SectionCard>
  );
}

/**
 * EmptyCardExample Component
 * 
 * Demonstrates how to use the EmptyCard component.
 */
export function EmptyCardExample() {
  return (
    <EmptyCard 
      icon={<FileText className="h-10 w-10 text-muted-foreground" />}
      title="No documents found"
      description="There are no documents in this section yet."
      actionButton={<Button size="sm">Add Document</Button>}
    />
  );
}

/**
 * SkeletonCardExample Component
 * 
 * Demonstrates how to use the SkeletonCard component.
 */
export function SkeletonCardExample() {
  return (
    <SkeletonCard 
      titleSize="md"
      contentLines={3}
    />
  );
}

/**
 * CardWithSmallTitle Component
 * 
 * Demonstrates a card with smaller title styling.
 */
export function CardWithSmallTitle() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Smaller Title Card</CardTitle>
        <CardDescription>Card with a smaller title size</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Standard content for the card.</p>
      </CardContent>
    </Card>
  );
}

/**
 * MetricCard Component
 * 
 * Demonstrates a metric display card layout.
 */
export function MetricCard({ 
  title = "Visitors", 
  value = "1,234", 
  change = "+12.3%",
  icon = <BarChart className="h-4 w-4" />
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="p-2 rounded-full bg-muted/60">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          <span className={change.startsWith('+') ? "text-green-500" : "text-red-500"}>
            {change}
          </span> from last month
        </p>
      </CardContent>
    </Card>
  );
} 