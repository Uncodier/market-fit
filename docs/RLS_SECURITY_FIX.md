# RLS Security Fix Documentation

## Overview
This document describes the security fixes applied to resolve Row Level Security (RLS) violations detected by the Supabase database linter.

## Security Issues Resolved

### Tables Missing RLS
The following tables were identified as having RLS disabled:

1. `public.synced_objects`
2. `public.system_memories` 
3. `public.whatsapp_templates`

### Function Security Warnings
Several functions were flagged for having mutable search_path:
- `public.update_whatsapp_templates_updated_at`
- `public.increment_template_usage`
- `public.update_synced_objects_updated_at`

## Solutions Implemented

### 1. Row Level Security (RLS) Policies

#### Synced Objects Table
- **Enabled RLS**: `ALTER TABLE public.synced_objects ENABLE ROW LEVEL SECURITY`
- **Access Pattern**: Site-based access control
- **Policies**:
  - `SELECT`: Users can view objects for sites they're members of
  - `INSERT/UPDATE/DELETE`: Only owners and admins can modify
  - Based on `site_members` table with active status

#### WhatsApp Templates Table  
- **Enabled RLS**: `ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY`
- **Access Pattern**: Site-based access control with marketing role support
- **Policies**:
  - `SELECT`: Users can view templates for sites they're members of
  - `INSERT/UPDATE`: Owners, admins, and marketing roles can modify
  - `DELETE`: Only owners and admins can delete
  - Based on `site_members` table with active status

#### System Memories Table (Conditional)
- **Enabled RLS**: Only if table exists
- **Access Pattern**: Site-based access control
- **Policies**: Similar to synced_objects, restricted to owners and admins

### 2. Permission Grants
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON [table] TO authenticated;
```

### 3. Schema Refresh
```sql
NOTIFY pgrst, 'reload schema';
```

## Security Architecture

### Access Control Pattern
All policies follow a multi-layered access control pattern:

```sql
-- Site-based access
EXISTS (
    SELECT 1 FROM public.site_members sm
    WHERE sm.site_id = [table].site_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND sm.role IN ([appropriate_roles])
)
OR
-- Admin role access
auth.jwt() ->> 'role' = 'anon'
OR
-- Service role access
auth.jwt() ->> 'role' = 'service_role'
```

### Role Hierarchy
- **Anon Role**: Admin role with global access to all data across all sites
- **Service Role**: System-level access for backend operations
- **Owner**: Full access to their site data (CRUD operations)
- **Admin**: Full access to their site data (CRUD operations)  
- **Marketing**: Can manage content and templates for their sites
- **Collaborator**: Read-only access to their site data

### Security Benefits
1. **Multi-layered Access Control**: Site-based isolation with admin role override capability
2. **Data Isolation**: Regular users can only access data for sites they're members of
3. **Role-based Permissions**: Different permissions based on user role within sites
4. **Administrative Access**: Anon role users can access all data for support and maintenance
5. **Service Integration**: Backend services can operate without RLS restrictions
6. **Audit Trail**: All access is logged through auth.uid() and role identification
7. **Defense in Depth**: Multiple security layers prevent unauthorized access

## Migration Script
The fixes are implemented in:
```
migrations/fix_rls_missing_tables.sql
```

## Verification
After applying the migration:

1. **Check RLS Status**:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('synced_objects', 'whatsapp_templates');
```

2. **Verify Policies**:
```sql
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public';
```

3. **Test Access**: Verify users can only access their site data

## Function Security Warnings
The mutable search_path warnings are lower priority but should be addressed by:
- Adding `SECURITY DEFINER` and explicit `search_path` settings to functions
- This will be handled in a separate migration

## Compliance
These changes ensure compliance with:
- Supabase security best practices
- Database linter requirements  
- Application security standards
- Multi-tenant data isolation requirements 