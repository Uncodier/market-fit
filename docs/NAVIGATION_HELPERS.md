# Navigation Helpers

## Overview

This document describes the centralized navigation helper functions that ensure consistent breadcrumb behavior across the application.

## Why Use Navigation Helpers?

1. **Consistent breadcrumbs**: All navigations include entity names, avoiding generic "Details" labels
2. **Automatic UI tracking**: No need to manually call `markUINavigation()`
3. **Standardized URLs**: Consistent query parameter naming across the app
4. **Type safety**: TypeScript interfaces for all parameters
5. **Single source of truth**: One function per route type

## Available Functions

### `navigateToTask`

Navigate to a task detail page in the Control Center.

```typescript
import { navigateToTask } from '@/app/hooks/use-navigation-history'

navigateToTask({
  taskId: task.id,
  taskTitle: task.title,
  router
})
```

**Breadcrumb Result**: `Control Center > Process waitlist signup: Jorge...`

### `navigateToLead`

Navigate to a lead detail page.

```typescript
import { navigateToLead } from '@/app/hooks/use-navigation-history'

navigateToLead({
  leadId: lead.id,
  leadName: lead.name,
  router
})
```

**Breadcrumb Result**: `Leads > John Doe`

### `navigateToContent`

Navigate to a content detail page.

```typescript
import { navigateToContent } from '@/app/hooks/use-navigation-history'

navigateToContent({
  contentId: content.id,
  contentTitle: content.title,
  router
})
```

**Breadcrumb Result**: `Content > My Blog Post Title`

### `navigateToSegment`

Navigate to a segment detail page.

```typescript
import { navigateToSegment } from '@/app/hooks/use-navigation-history'

navigateToSegment({
  segmentId: segment.id,
  segmentName: segment.name,
  router
})
```

**Breadcrumb Result**: `Segments > Enterprise Customers`

### `navigateToCampaign`

Navigate to a campaign detail page.

```typescript
import { navigateToCampaign } from '@/app/hooks/use-navigation-history'

navigateToCampaign({
  campaignId: campaign.id,
  campaignName: campaign.name,
  router
})
```

**Breadcrumb Result**: `Campaigns > Summer Sale 2024`

### `navigateToAgent`

Navigate to an agent detail page.

```typescript
import { navigateToAgent } from '@/app/hooks/use-navigation-history'

navigateToAgent({
  agentId: agent.id,
  agentName: agent.name,
  router
})
```

**Breadcrumb Result**: `Agents > Sales Assistant`

### `navigateToRequirement`

Navigate to a requirement detail page.

```typescript
import { navigateToRequirement } from '@/app/hooks/use-navigation-history'

navigateToRequirement({
  requirementId: requirement.id,
  requirementTitle: requirement.title,
  router
})
```

**Breadcrumb Result**: `Requirements > API Integration`

### `navigateToExperiment`

Navigate to an experiment detail page.

```typescript
import { navigateToExperiment } from '@/app/hooks/use-navigation-history'

navigateToExperiment({
  experimentId: experiment.id,
  experimentName: experiment.name,
  router
})
```

**Breadcrumb Result**: `Experiments > A/B Test Homepage`

### `navigateToChat`

Navigate to a chat page with optional conversation and agent info.

```typescript
import { navigateToChat } from '@/app/hooks/use-navigation-history'

// With conversation
navigateToChat({
  conversationId: conversation.id,
  conversationTitle: conversation.title,
  router
})

// With agent
navigateToChat({
  agentId: agent.id,
  agentName: agent.name,
  router
})

// Both
navigateToChat({
  conversationId: conversation.id,
  agentId: agent.id,
  conversationTitle: conversation.title,
  agentName: agent.name,
  router
})
```

**Breadcrumb Result**: `Chat > Discussion with Sales...`

### `navigateToControlCenter`

Navigate to the Control Center root page (resets breadcrumb).

```typescript
import { navigateToControlCenter } from '@/app/hooks/use-navigation-history'

navigateToControlCenter({ router })
```

**Breadcrumb Result**: Breadcrumb is reset (root route)

## Migration Guide

### Before (❌ Avoid)

```typescript
// Manual navigation without entity names
onClick={() => {
  router.push(`/leads/${lead.id}`)
}}

// Or with manual tracking
onClick={() => {
  markUINavigation()
  router.push(`/leads/${lead.id}?name=${encodeURIComponent(lead.name)}`)
}}
```

**Problem**: Breadcrumb shows "Lead Details" instead of actual name

### After (✅ Use this)

```typescript
onClick={() => {
  navigateToLead({
    leadId: lead.id,
    leadName: lead.name,
    router
  })
}}
```

**Result**: Breadcrumb shows "John Doe"

## Best Practices

### 1. Always use the router from the component

```typescript
const MyComponent = () => {
  const router = useRouter()
  
  const handleClick = () => {
    navigateToLead({
      leadId: '123',
      leadName: 'John Doe',
      router // ✅ Pass the router instance
    })
  }
}
```

### 2. Ensure entity names are available

```typescript
// ❌ Bad: Missing name
navigateToLead({
  leadId: lead.id,
  leadName: '', // Empty or missing
  router
})

// ✅ Good: Always provide the name
navigateToLead({
  leadId: lead.id,
  leadName: lead.name || 'Unknown Lead', // Fallback if needed
  router
})
```

### 3. Use NavigationLink for link components

For `<Link>` components, use `<NavigationLink>` instead:

```typescript
import { NavigationLink } from '@/app/components/navigation/NavigationLink'

// Include query parameters in href
<NavigationLink href={`/leads/${lead.id}?name=${encodeURIComponent(lead.name)}`}>
  View Lead
</NavigationLink>
```

### 4. Name truncation is automatic

Long names are automatically truncated to 40 characters:

```typescript
navigateToContent({
  contentId: '123',
  contentTitle: 'This is a very long content title that will be automatically truncated',
  router
})
// Breadcrumb: "This is a very long content title th..."
```

## Implementation Details

### URL Format

All navigation helpers follow this pattern:

```
/{route}/{id}?{type}={encoded_name}
```

Examples:
- `/leads/abc-123?name=John+Doe`
- `/content/def-456?title=My+Blog+Post`
- `/control-center/ghi-789?title=Task+Name`

### Automatic Features

1. **UI Navigation Tracking**: Automatically calls `markUINavigation()` before navigating
2. **URL Encoding**: Automatically encodes names/titles for URL safety
3. **Breadcrumb Integration**: The breadcrumb system reads these parameters automatically

## Files Updated

The following files have been migrated to use navigation helpers:

- ✅ `/app/control-center/page.tsx`
- ✅ `/app/control-center/[id]/components/TimelineTab.tsx`
- ✅ `/app/control-center/[id]/components/DetailsTab.tsx`
- ✅ `/app/control-center/components/TaskKanban.tsx`
- ✅ `/app/leads/page.tsx`
- ✅ `/app/content/page.tsx`
- ✅ `/app/requirements/page.tsx`
- ✅ `/app/segments/page.tsx`
- ✅ `/app/components/campaigns/kanban-card.tsx` - Requirements AND Campaigns
- ✅ `/app/components/campaigns/kanban-column.tsx`
- ✅ `/app/components/campaign-requirements.tsx`
- ✅ `/app/components/chat/ChatHeader.tsx`

## Troubleshooting

### Issue: Breadcrumb still shows "Details"

**Cause**: Navigation not using helper function or missing name parameter

**Solution**: 
1. Check if using navigation helper
2. Verify entity name is being passed
3. Check console for missing parameter warnings

### Issue: Navigation not being tracked as UI navigation

**Cause**: Using `router.push()` directly instead of helper

**Solution**: Use the appropriate navigation helper function

## Related Documentation

- [Breadcrumb Navigation System](./BREADCRUMB_NAVIGATION_TEST_GUIDE.md)
- [Navigation History Hook](../app/hooks/use-navigation-history.ts)
