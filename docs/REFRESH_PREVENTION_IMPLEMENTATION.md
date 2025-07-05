# Refresh Prevention Implementation

## Problem Solved

The settings screen (and other create/edit screens) were automatically reloading when the window regained focus, causing users to lose their work. This implementation prevents auto-reload on create/edit screens while allowing it on read-only screens.

## Solution Overview

The solution uses a combination of:
1. **Route classification** - Categorizing routes as CREATE/EDIT or READ-ONLY
2. **SessionStorage tracking** - Storing prevention state across the app
3. **Safe reload utilities** - Replacing direct `window.location.reload()` calls
4. **Automatic prevention** - Hook-based prevention that activates based on current route

## Files Created/Modified

### Core Implementation Files

#### `app/hooks/use-prevent-refresh.ts`
- **Purpose**: Main hook for route-based refresh prevention
- **Key Functions**:
  - `usePreventRefresh()` - Determines if current route should prevent refresh
  - `usePageRefreshPrevention()` - Sets up prevention state in sessionStorage
  - `shouldPreventAutoRefresh()` - Utility to check prevention state
  - `getAutoRefreshPreventionReason()` - Get reason for prevention

#### `app/utils/safe-reload.ts`
- **Purpose**: Safe reload utilities that respect prevention state
- **Key Functions**:
  - `safeReload(force, reason)` - Safe replacement for `window.location.reload()`
  - `safeDataRefresh(refreshFunction, fallbackToReload, reason)` - Data-only refresh
  - `createSafeReloadHandler(force, reason)` - Event handler factory

### Modified Files

#### `app/layout-client.tsx`
- Added `usePageRefreshPrevention()` hook call
- Enables automatic prevention based on current route

#### `app/components/debug/StripeDebugger.tsx`
- Replaced `window.location.reload()` with `safeReload()`
- Added import for safe reload utility

#### `app/auth/team-invitation/page.tsx`
- Replaced `window.location.reload()` with `safeReload()`
- Added import for safe reload utility

## Route Classification

### CREATE/EDIT Routes (Prevention Enabled)
These routes prevent auto-reload to protect user work:

- `/settings` - Site settings page
- `/site/create` - Site creation page
- `/campaigns/[id]` - Campaign detail/edit pages
- `/experiments/[id]` - Experiment detail/edit pages
- `/leads/[id]` - Lead detail/edit pages
- `/content/[id]` - Content detail/edit pages
- `/segments/[id]` - Segment detail/edit pages
- `/requirements/[id]` - Requirements detail/edit pages
- `/control-center/[id]` - Control center detail/edit pages
- `/agents/[id]/[commandId]` - Agent command detail pages

### READ-ONLY Routes (Auto-reload Allowed)
These routes allow auto-reload for fresh data:

- `/dashboard` - Main dashboard
- `/campaigns` - Campaign list
- `/experiments` - Experiment list
- `/leads` - Lead list
- `/content` - Content list
- `/segments` - Segment list
- `/requirements` - Requirements list
- `/assets` - Assets list
- `/chat` - Chat interface
- `/agents` - Agents list
- `/control-center` - Control center list
- `/costs` - Costs page
- `/sales` - Sales page
- `/notifications` - Notifications
- `/profile` - Profile page
- `/security` - Security settings
- `/billing` - Billing page
- `/auth` - Authentication pages
- `/outsource` - Outsource pages

## How It Works

### 1. Route Detection
```typescript
// The hook automatically detects the current route
const { shouldPreventRefresh, isCreateEditRoute } = usePreventRefresh()
```

### 2. SessionStorage State Management
```typescript
// Prevention state is stored in sessionStorage
sessionStorage.setItem('preventAutoRefresh', 'true')
sessionStorage.setItem('preventAutoRefreshReason', 'create-edit-page')
```

### 3. Safe Reload Usage
```typescript
// Instead of window.location.reload()
safeReload(false, "User clicked refresh button")

// Force reload if necessary
safeReload(true, "Critical error recovery")
```

### 4. Data-Only Refresh (Preferred)
```typescript
// Refresh data without full page reload
await safeDataRefresh(
  () => refetchData(),
  true, // fallback to page reload if data refresh fails
  "User requested data refresh"
)
```

## Console Logging

The system provides comprehensive logging:

### Prevention Active
```
🚫 Auto-refresh prevention enabled for: /settings
🚫 Page reload prevented to protect user work
   Reason: create-edit-page
   Attempted reload reason: User clicked refresh button
   Use safeReload(true) to force reload if necessary
```

### Prevention Inactive
```
✅ Auto-refresh allowed for: /dashboard
🔄 Performing page reload: User clicked refresh button
```

### Force Reload
```
🔄 Performing page reload: Critical error recovery
   Forced reload despite prevention (reason: create-edit-page)
```

## Testing

A test file `test-refresh-prevention.html` has been created to verify the functionality:

1. **Enable/Disable Prevention** - Simulate different route types
2. **Test Safe Reload** - Verify prevention works
3. **Test Force Reload** - Verify override works
4. **Real-time Status** - See current prevention state

## Usage Guidelines

### For Developers

1. **Use `safeReload()` instead of `window.location.reload()`**
   ```typescript
   // ❌ Don't do this
   window.location.reload()
   
   // ✅ Do this
   safeReload(false, "Reason for reload")
   ```

2. **Prefer data refresh over page reload**
   ```typescript
   // ✅ Better approach
   await safeDataRefresh(() => refetchData())
   ```

3. **Add new create/edit routes to the classification**
   ```typescript
   // In use-prevent-refresh.ts
   const CREATE_EDIT_ROUTES = [
     // ... existing routes
     '/new-feature/[id]', // Add new routes here
   ]
   ```

### For New Features

1. **Determine route type** - Is it a create/edit page or read-only?
2. **Add to appropriate array** - Update `CREATE_EDIT_ROUTES` or `READ_ONLY_ROUTES`
3. **Use safe reload utilities** - Replace any direct reload calls
4. **Test the behavior** - Verify prevention works as expected

## Benefits

1. **Prevents data loss** - Users won't lose work on create/edit screens
2. **Maintains fresh data** - Read-only screens still get automatic updates
3. **Comprehensive logging** - Easy to debug and monitor
4. **Flexible override** - Force reload available when needed
5. **Automatic classification** - Routes are automatically handled based on patterns
6. **Backward compatible** - Existing functionality preserved

## Future Enhancements

1. **User notification** - Show toast when reload is prevented
2. **Auto-save integration** - Combine with auto-save for better UX
3. **Granular control** - Per-component prevention settings
4. **Analytics** - Track prevention events for optimization
5. **Recovery mechanisms** - Smart recovery from failed states

## Maintenance

- **Adding new routes**: Update the route arrays in `use-prevent-refresh.ts`
- **Debugging**: Check console logs for prevention events
- **Testing**: Use the test HTML file to verify functionality
- **Monitoring**: Watch for any remaining `window.location.reload()` calls

This implementation successfully solves the auto-reload issue while maintaining a clean, maintainable, and extensible architecture. 