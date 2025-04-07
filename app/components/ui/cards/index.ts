/**
 * Card Components
 * 
 * This file exports all card-related components for easy imports.
 * Use these components for consistent card styling across the application.
 */

// Export base card components
export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from "@/app/components/ui/card";

// Export specialized card components
export { EmptyCard } from "@/app/components/ui/empty-card";
export { SkeletonCard } from "@/app/components/ui/skeleton-card";

// Card style constants
export const CARD_PADDING = {
  DEFAULT: "p-6",
  SMALL: "p-4",
  LARGE: "p-8"
};

export const CARD_CONTENT_PADDING = {
  DEFAULT: "p-6 pt-0",
  SMALL: "p-4 pt-0",
  LARGE: "p-8 pt-0"
}; 