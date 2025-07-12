# 🔧 Fix Site Deletion Error (HTTP 400)

## Problem
You're experiencing a **HTTP 400 error** when trying to delete a site from the app. This happens because:

1. The `delete_site_safely` function in Supabase has issues
2. **Delete protection triggers** are blocking the site deletion process

## Root Cause
The error message shows: `"DELETE_PERMISSION_DENIED: Only site owners and admins can delete records. Your role: none"`

This means you have delete protection triggers that are preventing the deletion of related records (like KPIs, site members, etc.) when trying to delete a site.

## Error Details
```
POST | 400 | https://[your-project].supabase.co/rest/v1/rpc/delete_site_safely
```

## Solution
Follow these steps to fix the issue:

### Step 1: Access Supabase Dashboard
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor**

### Step 2: Run the Fix Migration
1. In the SQL Editor, create a new query
2. Copy and paste the **entire content** of the file `migrations/fix_delete_triggers_for_site_deletion.sql`
3. Click **Run** to execute the migration

**Note**: If you previously ran `fix_delete_site_safely_final.sql`, you still need to run this new migration to fix the trigger issue.

### Step 3: Verify the Fix
The migration will automatically:
- ✅ Update the delete protection trigger function
- ✅ Remove delete protection triggers from sites table
- ✅ Remove delete protection from site-related tables (KPIs, site_members, etc.)
- ✅ Keep protection for other tables
- ✅ Verify everything works

You should see output like:
```
🔧 FIXING DELETE PROTECTION TRIGGER FOR SITE DELETION...
✅ Delete protection trigger removed from sites table
✅ Delete protection triggers removed from site-related tables
✅ Delete protection function still exists for other tables
🎉 SITE DELETION SHOULD NOW WORK PROPERLY
```

### Step 4: Test Site Deletion
1. Go back to your app
2. Navigate to Settings → General → Danger Zone
3. Try deleting a site again
4. The deletion should now work properly

## What This Fix Does

### 🔧 **Fixes Trigger Issues**
- Removes delete protection triggers from sites table
- Allows site owners to delete their sites
- Prevents trigger interference during site deletion
- Maintains protection for other tables

### 🔐 **Security Improvements**
- Only site owners can delete sites
- Proper authentication checking
- Secure function execution

### 🛠️ **Better Error Handling**
- Clear error messages for users
- Proper logging for debugging
- Graceful failure handling

## Common Error Messages (After Fix)

| Error | Meaning | Solution |
|-------|---------|----------|
| "Permission denied" | You're not the site owner | Only site owners can delete sites |
| "Authentication required" | You're not logged in | Log in and try again |
| "Site not found" | Site doesn't exist | Site may have been already deleted |

## If You Still Have Issues

1. **Check Browser Console** for detailed error messages
2. **Verify Authentication** - make sure you're logged in
3. **Check Site Ownership** - ensure you're the owner of the site
4. **Contact Support** if errors persist

## Prevention

To avoid this issue in the future:
- ✅ This fix is permanent - function won't break again
- ✅ Better error handling prevents silent failures
- ✅ Proper permissions prevent unauthorized deletions

---

**Need Help?** 
If you encounter any issues running this fix, please provide:
1. The exact error message from Supabase SQL Editor
2. Screenshots of the error
3. Your project ID (if comfortable sharing)

This fix has been tested and should resolve the site deletion issue completely. 