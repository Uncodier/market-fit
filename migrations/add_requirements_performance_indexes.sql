-- Migration: Add performance indexes for requirements table
-- Description: Adds critical indexes for requirements filtering performance
-- Date: 2025-01-30
-- Reason: Optimize requirements page performance when filtering by completion_status, status, and priority

-- Add index for completion_status filtering (most critical for "completed" tab performance)
CREATE INDEX IF NOT EXISTS idx_requirements_completion_status ON public.requirements(completion_status);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_requirements_status ON public.requirements(status);

-- Re-add priority index (was dropped in cleanup but still needed for sorting)
CREATE INDEX IF NOT EXISTS idx_requirements_priority ON public.requirements(priority);

-- Add composite index for site_id + completion_status (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_requirements_site_completion ON public.requirements(site_id, completion_status);

-- Add composite index for site_id + status (for status filtering)
CREATE INDEX IF NOT EXISTS idx_requirements_site_status ON public.requirements(site_id, status);

-- Add composite index for site_id + priority (for priority filtering and sorting)
CREATE INDEX IF NOT EXISTS idx_requirements_site_priority ON public.requirements(site_id, priority);

-- Add comments for documentation
COMMENT ON INDEX idx_requirements_completion_status IS 'Index for filtering by completion status (pending/completed/rejected)';
COMMENT ON INDEX idx_requirements_status IS 'Index for filtering by requirement status (backlog/in-progress/done/etc)';
COMMENT ON INDEX idx_requirements_priority IS 'Index for filtering and sorting by priority (high/medium/low)';
COMMENT ON INDEX idx_requirements_site_completion IS 'Composite index for site-specific completion status queries';
COMMENT ON INDEX idx_requirements_site_status IS 'Composite index for site-specific status queries';
COMMENT ON INDEX idx_requirements_site_priority IS 'Composite index for site-specific priority queries';





