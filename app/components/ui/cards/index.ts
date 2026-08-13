/**
 * Card Components
 *
 * Use SectionCard for settings and detail form sections.
 * Use Card for metrics, kanban, and listing cards.
 */

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/app/components/ui/card"

export {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
  sectionCardShellClassName,
  isSectionDirty,
  snapshotsDiffer,
} from "@/app/components/ui/section-card"

export { ActionFooter } from "@/app/components/ui/card-footer"
export { EmptyCard } from "@/app/components/ui/empty-card"
export { SkeletonCard } from "@/app/components/ui/skeleton-card"

export const CARD_PADDING = {
  DEFAULT: "p-6",
  SMALL: "p-4",
  LARGE: "p-8",
}

export const CARD_CONTENT_PADDING = {
  DEFAULT: "p-6 pt-0",
  SMALL: "p-4 pt-0",
  LARGE: "p-8 pt-0",
}
