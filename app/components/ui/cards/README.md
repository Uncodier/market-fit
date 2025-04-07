# Card Components

This directory contains standardized card components for consistent UI across the application.

## Available Components

### Base Card Components

```tsx
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from "@/app/components/ui/cards";
```

### Specialized Card Components

```tsx
import { EmptyCard, SkeletonCard } from "@/app/components/ui/cards";
```

### Styling Constants

```tsx
import { CARD_PADDING, CARD_CONTENT_PADDING } from "@/app/components/ui/cards";
```

## Card Padding Standards

To maintain consistent padding across all cards, use these standard padding values:

```tsx
// Default padding (recommended for most cards)
<CardHeader>
  <CardTitle>Card Title</CardTitle>
</CardHeader>
<CardContent>
  Content here
</CardContent>

// Small padding (for compact cards)
<CardHeader className={CARD_PADDING.SMALL}>
  <CardTitle>Card Title</CardTitle>
</CardHeader>
<CardContent className="p-4 pt-0">
  Content here
</CardContent>

// Large padding (for featured cards)
<CardHeader className={CARD_PADDING.LARGE}>
  <CardTitle>Card Title</CardTitle>
</CardHeader>
<CardContent className="p-8 pt-0">
  Content here
</CardContent>
```

## Using Empty Card States

The `EmptyCard` component standardizes empty states across the application:

```tsx
<EmptyCard 
  icon={<FileText className="h-10 w-10 text-muted-foreground" />}
  title="No documents found"
  description="There are no documents in this section yet."
  actionButton={<Button size="sm">Add Document</Button>}
/>
```

## Loading States

The `SkeletonCard` component provides consistent loading states:

```tsx
// Basic usage
<SkeletonCard />

// With customizations
<SkeletonCard 
  titleSize="lg"
  contentLines={5}
/>

// Content only (no header)
<SkeletonCard 
  showHeader={false}
  contentHeight="h-40"
/>
```

## Examples

See `examples.tsx` for complete code examples of different card patterns. 