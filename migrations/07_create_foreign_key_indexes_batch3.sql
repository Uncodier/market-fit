-- BATCH 7: Create missing foreign key indexes (Final batch)
-- Execute this in Supabase SQL Editor after Batch 6
-- These indexes will improve JOIN performance for foreign keys

-- Profiles foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_command_id_new ON public.profiles(command_id);

-- Requirement segments foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requirement_segments_command_id_new ON public.requirement_segments(command_id);

-- Sales foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_command_id_new ON public.sales(command_id);

-- Sites foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sites_command_id_new ON public.sites(command_id);

-- Task categories foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_categories_category_id_new ON public.task_categories(category_id);

-- Tasks foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_command_id_new ON public.tasks(command_id);

-- Transactions foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_command_id_new ON public.transactions(command_id);

SELECT 'BATCH 7 COMPLETED: All foreign key indexes have been created!' AS status,
       'All performance optimizations complete!' AS final_status; 