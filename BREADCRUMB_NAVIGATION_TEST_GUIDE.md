# Navigation History Breadcrumb - Test Guide

## Implementation Summary

The navigation history breadcrumb system has been successfully implemented with the following features:

### ✅ Completed Components

1. **Navigation History Hook** (`app/hooks/use-navigation-history.ts`)
   - Tracks navigation history in localStorage
   - Automatically detects UI navigation vs direct browser navigation
   - Resets on root routes (no query params)
   - Maintains all items in memory, shows last 5 visibly

2. **Navigation Tracking System**
   - `NavigationLink` component wraps Next.js Link with UI navigation marking
   - `markUINavigation()` helper for programmatic navigation
   - All `router.push()` and `router.replace()` calls updated with navigation marking

3. **Updated Components**
   - ✅ `Breadcrumb.tsx` - Dynamic font sizing and 5-item limit
   - ✅ `TopBarTitle.tsx` - Integrated history system
   - ✅ `MenuItem.tsx` - Uses NavigationLink
   - ✅ `Sidebar.tsx` - All router calls marked as UI navigation
   - ✅ `ChatHeader.tsx` - Updated imports
   - ✅ `ChatMessages.tsx` - All router calls marked as UI navigation
   - ✅ `chat/page.tsx` - All router calls marked as UI navigation

### Dynamic Font Sizing

The breadcrumb items scale proportionally:
- **Current item (last)**: `text-2xl` (largest)
- **1 item back**: `text-xl`
- **2 items back**: `text-lg`
- **3 items back**: `text-base`
- **4+ items back**: `text-sm`

All transitions are smooth with CSS `transition-all duration-200`.

## Test Scenarios

### 1. Basic Navigation Flow ✓
**Steps:**
1. Navigate to `/chat?agentId=123&agentName=TestAgent`
2. Click on "Leads" in sidebar
3. Verify breadcrumb shows: Chat: TestAgent > Leads

**Expected Result:**
- Breadcrumb displays with "Leads" larger than "Chat: TestAgent"
- Both items are clickable except the current one

### 2. Navigate Back to Same Route ✓
**Steps:**
1. From scenario 1, have breadcrumb: Chat > Leads
2. Click on "Chat" in the breadcrumb
3. Verify it navigates back to the same chat

**Expected Result:**
- Returns to the exact same chat URL with all query params
- Breadcrumb removes "Leads" and only shows "Chat: TestAgent"

### 3. Navigate to Different Route ✓
**Steps:**
1. From breadcrumb: Chat A > Leads
2. Navigate to a different Chat B
3. Verify breadcrumb shows: Chat A > Leads > Chat B

**Expected Result:**
- New item is added to breadcrumb
- Font sizes adjust proportionally (Chat A smallest, Chat B largest)

### 4. Root Route Reset ✓
**Steps:**
1. Have breadcrumb with multiple items
2. Click on "Leads" in sidebar (without query params)
3. Verify breadcrumb resets

**Expected Result:**
- Breadcrumb is cleared/empty
- localStorage history is reset
- Only shows "Leads" title without breadcrumb

### 5. Page Refresh Reset ✓
**Steps:**
1. Build up a breadcrumb with 3+ items
2. Press browser refresh (Cmd+R or F5)
3. Verify breadcrumb resets

**Expected Result:**
- Breadcrumb is cleared on refresh
- History starts fresh
- No breadcrumb items displayed

### 6. Direct URL Navigation Reset ✓
**Steps:**
1. Have breadcrumb with items
2. Type a new URL directly in browser address bar
3. Press Enter
4. Verify breadcrumb resets

**Expected Result:**
- Breadcrumb is cleared
- Navigation is detected as direct (not UI-initiated)

### 7. Multiple Items (5+ visible limit) ✓
**Steps:**
1. Navigate through 7 different routes with query params
2. Verify only last 5 items are visible

**Expected Result:**
- Maximum 5 items shown in breadcrumb
- Can scroll or see ellipsis for older items
- Font sizes scale across visible items
- All items remain in localStorage

### 8. Font Size Scaling ✓
**Steps:**
1. Navigate to create breadcrumb with 2 items
2. Add a 3rd item
3. Add a 4th item
4. Add a 5th item
5. Observe font size changes

**Expected Result:**
- Last item always largest (text-2xl)
- Previous items get progressively smaller
- Smooth transitions between size changes
- All items remain readable

### 9. Sidebar Navigation ✓
**Steps:**
1. Click through sidebar items with query params
2. Verify all navigation is tracked
3. Click sidebar items without query params
4. Verify breadcrumb resets

**Expected Result:**
- Sidebar clicks with params add to history
- Sidebar clicks to root routes reset history
- All transitions work smoothly

### 10. Chat Navigation Patterns ✓
**Steps:**
1. Navigate to Chat page with agentId
2. Navigate to Leads page
3. Navigate to Agents page
4. Click breadcrumb to go back to Chat
5. Navigate to different Chat
6. Verify breadcrumb shows correct history

**Expected Result:**
- Chat conversations are tracked with agent names
- Breadcrumb labels show meaningful names
- Navigation back works correctly
- New chats are added to history

## Manual Testing Checklist

- [ ] Test scenario 1: Basic navigation flow
- [ ] Test scenario 2: Navigate back to same route
- [ ] Test scenario 3: Navigate to different route
- [ ] Test scenario 4: Root route reset
- [ ] Test scenario 5: Page refresh reset
- [ ] Test scenario 6: Direct URL navigation reset
- [ ] Test scenario 7: Multiple items visibility
- [ ] Test scenario 8: Font size scaling
- [ ] Test scenario 9: Sidebar navigation
- [ ] Test scenario 10: Chat navigation patterns

## Technical Details

### localStorage Key
- `navigationHistory`: Stores history items with path, label, and timestamp

### sessionStorage Key
- `isUINavigation`: Temporary flag to distinguish UI vs direct navigation

### Root Route Detection
A route is considered "root" and resets breadcrumb if:
1. Has no query parameters (e.g., `/leads` not `/leads?id=123`)
2. Is `/dashboard` or `/`

### Navigation Marking
All UI-initiated navigation is marked with `markUINavigation()`:
- `NavigationLink` component (wraps Link)
- All `router.push()` calls
- All `router.replace()` calls
- Sidebar navigation handlers

## Browser Developer Tools Testing

### Check localStorage:
```javascript
// Open browser console (F12)
localStorage.getItem('navigationHistory')
```

### Clear history manually:
```javascript
localStorage.removeItem('navigationHistory')
```

### Check sessionStorage (should be cleared after each navigation):
```javascript
sessionStorage.getItem('isUINavigation')
```

## Known Behaviors

1. **Breadcrumb Hidden on Chat Page**: The breadcrumb is hidden on the main `/chat` route in the TopBar component (line 201 of TopBar.tsx). This is intentional for the chat UI.

2. **First Navigation After Refresh**: First navigation after page refresh/direct URL will not show in breadcrumb (as it's the starting point).

3. **Back Button**: Browser back button is not tracked as UI navigation (resets breadcrumb).

## Troubleshooting

### Breadcrumb not appearing:
- Check if route has query parameters
- Verify not on a root route
- Check TopBar component breadcrumb prop is passed
- Verify TopBarTitle is using the history hook

### Navigation not tracked:
- Ensure using `NavigationLink` or `markUINavigation()` before `router.push()`
- Check console for any errors
- Verify sessionStorage is working

### Font sizes not changing:
- Check browser CSS caching (hard refresh with Cmd+Shift+R)
- Verify Tailwind classes are applied
- Check for conflicting CSS

### History not persisting:
- Check localStorage is enabled in browser
- Verify no browser extensions blocking storage
- Check for localStorage size limits

## Files Modified

- `app/hooks/use-navigation-history.ts` (NEW)
- `app/components/navigation/NavigationLink.tsx` (NEW)
- `app/components/navigation/Breadcrumb.tsx` (UPDATED)
- `app/components/navigation/TopBarTitle.tsx` (UPDATED)
- `app/components/navigation/MenuItem.tsx` (UPDATED)
- `app/components/navigation/Sidebar.tsx` (UPDATED)
- `app/components/chat/ChatHeader.tsx` (UPDATED)
- `app/components/chat/ChatMessages.tsx` (UPDATED)
- `app/chat/page.tsx` (UPDATED)

## Next Steps

1. Run the development server (already running in terminal 1)
2. Navigate to http://localhost:3000
3. Go through the test scenarios above
4. Report any issues or unexpected behaviors
5. Test in different browsers (Chrome, Firefox, Safari)
6. Test responsive behavior on mobile screens
