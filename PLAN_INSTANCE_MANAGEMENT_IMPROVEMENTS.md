# Plan Instance Management Improvements

## Overview
Improved the plan instance ID management system to correctly handle multiple plans per conversation/robot instance without overwriting errors. The system now properly distinguishes between active, pending, and historical plans.

## Problem Statement
Previously, the system would load all plans for an instance without properly categorizing them by status, which could lead to:
- Overwriting active plans when creating new ones
- Confusion about which plan is currently active
- Poor tracking of plan lifecycle (pending → in_progress → completed/failed/cancelled)
- Multiple plans marked as `in_progress` simultaneously

## Solution

### 1. Enhanced Plan Status Management

The `loadInstancePlans` function now properly categorizes plans into:

- **Active Plans**: Plans that are actively being worked on or ready to start
  - `in_progress` (only ONE should exist at a time)
  - `pending` (can have multiple)
  - `blocked` (waiting for dependencies)

- **Historical Plans**: Plans that are no longer active
  - `completed` (successfully finished)
  - `failed` (encountered errors)
  - `cancelled` (manually stopped)

### 2. Plan ID Tracking

Added `planId` field to the `PlanStep` interface to track which plan each step belongs to:

```typescript
interface PlanStep {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  order: number
  planId?: string // NEW: Track which plan this step belongs to
}
```

### 3. Improved Step ID Generation

Steps now use the plan ID as a prefix to ensure uniqueness across multiple plans:

```typescript
stepId = `${plan.id}_step_${stepIndex}_${randomString}`
```

This prevents ID collisions when:
- Multiple plans exist for the same instance
- Plans are created and completed over time
- Real-time updates arrive

### 4. Real-Time Plan Transitions

The real-time subscription handler now properly handles plan status transitions:

- When a plan transitions to `completed`, `failed`, or `cancelled`:
  - Removes it from active plans
  - Adds it to historical plans
  - Removes associated steps from the UI

- When a plan is updated but remains active:
  - Updates the plan in the active list
  - Rebuilds steps only for active plans

### 5. Enhanced Logging

Added comprehensive logging to help debug plan management:

```javascript
console.log('📊 Plan Status Distribution:', {
  in_progress: inProgressPlans.length,
  pending: pendingPlans.length,
  failed: failedPlans.length,
  cancelled: cancelledPlans.length,
  blocked: blockedPlans.length,
  completed: completedPlansData.length
})
```

Warns when multiple plans are in_progress (should only be one):

```javascript
if (inProgressPlans.length > 1) {
  console.warn('⚠️ Multiple plans in progress detected!')
}
```

## Benefits

1. **No Overwriting**: Each plan has unique IDs and is properly tracked
2. **Clear Lifecycle**: Plans move through states correctly (pending → in_progress → completed/failed)
3. **Better History**: Completed/failed plans are preserved for context
4. **Easier Debugging**: Comprehensive logging helps identify issues
5. **Scalability**: Supports multiple plans per instance without conflicts

## Usage Example

### Scenario: Creating a New Plan

When a new plan is needed for a conversation/robot instance:

1. Check if there's an active plan (`status = in_progress`)
2. If yes, complete/fail it before creating a new one:
   ```sql
   UPDATE instance_plans 
   SET status = 'completed', completed_at = NOW() 
   WHERE instance_id = <id> AND status = 'in_progress'
   ```
3. Create the new plan:
   ```sql
   INSERT INTO instance_plans (instance_id, title, status, ...)
   VALUES (<id>, 'New Plan', 'in_progress', ...)
   ```

### Scenario: Multiple Plans for One Instance

An instance can have:
- 1 plan `in_progress` (currently executing)
- Multiple plans `pending` (queued for future execution)
- Multiple plans `completed` (historical context)
- Multiple plans `failed` (for analysis/retry)

The UI will:
- Show only active plans in the main steps view
- Keep historical plans available for context
- Track which steps belong to which plan via `planId`

## Database Considerations

### Schema
The `instance_plans` table already supports this model:

```sql
CREATE TABLE instance_plans (
  id uuid PRIMARY KEY,
  instance_id uuid NOT NULL,  -- Links to remote_instances
  status text CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'blocked')),
  command_id uuid,            -- Links to commands (for conversation context)
  -- ... other fields
)
```

### Best Practices

1. **One In-Progress Rule**: Only one plan per instance should have `status = 'in_progress'`
2. **Atomic Transitions**: When changing plan status, use transactions
3. **Historical Preservation**: Never delete plans; mark as completed/failed/cancelled
4. **Command Linking**: Use `command_id` to link plans to conversations

## Testing

To verify the improvements work correctly:

1. Create multiple plans for the same instance
2. Verify only one shows as `in_progress`
3. Complete a plan and create a new one
4. Check that the completed plan moves to historical
5. Verify steps are correctly associated with their plans

## Future Improvements

1. Add UI to view historical plans
2. Implement plan retry mechanism for failed plans
3. Add plan dependencies tracking
4. Create plan templates for common workflows
5. Add plan metrics (duration, success rate, etc.)

## Related Files

- `app/components/simple-messages-view.tsx` - Main component handling plan display
- `supabase/database.md` - Database schema documentation
- `migrations/create_remote_automation_tables.sql` - Plan table creation

## Date
October 5, 2025
