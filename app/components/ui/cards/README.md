# Card Components

## Section cards (settings and details)

Use `SectionCard` for settings pages and detail form sections. Do not use the base `Card` for those surfaces.

```tsx
import {
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/cards";

<SectionCard id="company-profile">
  <SectionCardHeader
    title="Company Profile"
    description="Tell customers who you are."
  />
  <SectionCardContent>
    {/* fields */}
  </SectionCardContent>
  <SectionCardFooter
    dirty={dirty}
    saving={saving}
    onSave={handleSave}
    saveLabel="Save"
  />
</SectionCard>
```

- Shell matches list tables: `rounded-xl border border-border/70`, no hover shadow.
- Title is `text-lg`; description is `text-sm`.
- Save is an outline `sm` button, disabled until dirty.

`ActionFooter` is an alias of `SectionCardFooter` for existing detail pages.

## Base Card (metrics, kanban, listings)

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/app/components/ui/cards";
```

Keep `Card` for dashboard KPIs, kanban cards, and listing cards.

## Empty and loading states

```tsx
import { EmptyCard, SkeletonCard } from "@/app/components/ui/cards";
```

See `examples.tsx` for complete patterns.
