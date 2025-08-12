-- Migration: Convert instance_plans.results to instance_plans.steps
-- Date: 2024-12-19
-- Description: Migrates data from the complex results.phases.steps structure to the new simplified steps array

BEGIN;

-- First, add the new steps column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'instance_plans' 
        AND column_name = 'steps'
    ) THEN
        ALTER TABLE public.instance_plans 
        ADD COLUMN steps jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Migrate existing data from results to steps
UPDATE public.instance_plans 
SET steps = (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', plan_id || '-' || (step_index - 1)::text,
                'title', COALESCE(step_item->>'title', 'Step ' || step_index::text),
                'description', step_item->>'description',
                'status', COALESCE(step_item->>'status', 'pending'),
                'order', step_index,
                'tools_required', COALESCE(step_item->'tools_required', '[]'::jsonb),
                'estimated_duration_minutes', (step_item->>'estimated_duration_minutes')::integer,
                'error_message', step_item->>'error_message'
            )
        ),
        '[]'::jsonb
    )
    FROM (
        SELECT 
            instance_plans.id as plan_id,
            step_item,
            ROW_NUMBER() OVER (ORDER BY phase_index, step_index_in_phase) as step_index
        FROM instance_plans,
        LATERAL (
            SELECT 
                phase_item,
                ROW_NUMBER() OVER () as phase_index
            FROM jsonb_array_elements(COALESCE(results->'phases', '[]'::jsonb)) as phase_item
        ) as phases,
        LATERAL (
            SELECT 
                step_item,
                ROW_NUMBER() OVER () as step_index_in_phase
            FROM jsonb_array_elements(COALESCE(phase_item->'steps', '[]'::jsonb)) as step_item
        ) as steps
        WHERE instance_plans.id = public.instance_plans.id
    ) converted_steps
)
WHERE results IS NOT NULL 
AND results != '{}'::jsonb 
AND steps = '[]'::jsonb;

-- For plans that don't have complex results structure, create a single step from the plan itself
UPDATE public.instance_plans 
SET steps = jsonb_build_array(
    jsonb_build_object(
        'id', id::text,
        'title', title,
        'description', description,
        'status', CASE 
            WHEN status = 'in_progress' THEN 'in_progress'
            WHEN status = 'completed' THEN 'completed' 
            WHEN status = 'failed' THEN 'failed'
            ELSE 'pending'
        END,
        'order', 1
    )
)
WHERE steps = '[]'::jsonb;

-- Add comment to document the change
COMMENT ON COLUMN public.instance_plans.steps IS 'Array of step objects with id, title, description, status - replaces the complex results.phases.steps structure';

-- Update the default for future records
ALTER TABLE public.instance_plans 
ALTER COLUMN steps SET DEFAULT '[]'::jsonb;

COMMIT;

-- Verification query (uncomment to run manually)
/*
SELECT 
    id,
    title,
    jsonb_array_length(COALESCE(steps, '[]'::jsonb)) as steps_count,
    steps->>0 as first_step_title,
    CASE 
        WHEN results IS NOT NULL AND results != '{}'::jsonb THEN 'had_results'
        ELSE 'no_results'
    END as migration_source
FROM public.instance_plans 
WHERE steps != '[]'::jsonb
LIMIT 10;
*/
