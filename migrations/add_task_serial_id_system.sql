-- Migration: Add task serial_id system
-- This migration adds the missing serial_id column and related functions/triggers

-- 1. Add serial_id column to tasks table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tasks' 
        AND column_name = 'serial_id'
    ) THEN
        ALTER TABLE public.tasks ADD COLUMN serial_id text NOT NULL DEFAULT '';
    END IF;
END $$;

-- 2. Create generate_task_serial_id function
CREATE OR REPLACE FUNCTION public.generate_task_serial_id(site_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    site_prefix text;
    task_count integer;
    serial_id text;
BEGIN
    -- Get site name to create prefix (first 3 characters, uppercase)
    SELECT UPPER(LEFT(COALESCE(name, 'TSK'), 3))
    INTO site_prefix
    FROM public.sites
    WHERE id = site_uuid;
    
    -- If site not found, use default prefix
    IF site_prefix IS NULL THEN
        site_prefix := 'TSK';
    END IF;
    
    -- Get current task count for this site
    SELECT COUNT(*) + 1
    INTO task_count
    FROM public.tasks
    WHERE site_id = site_uuid;
    
    -- Generate serial_id with format: PREFIX-NNNN
    serial_id := site_prefix || '-' || LPAD(task_count::text, 4, '0');
    
    RETURN serial_id;
END;
$$;

-- 3. Create set_task_serial_id function
CREATE OR REPLACE FUNCTION public.set_task_serial_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Only set serial_id if it's empty or NULL
    IF NEW.serial_id IS NULL OR NEW.serial_id = '' THEN
        NEW.serial_id := public.generate_task_serial_id(NEW.site_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- 4. Create trigger for automatic serial_id generation
DROP TRIGGER IF EXISTS trigger_set_task_serial_id ON public.tasks;
CREATE TRIGGER trigger_set_task_serial_id
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_task_serial_id();

-- 5. Create indexes for serial_id
CREATE INDEX IF NOT EXISTS idx_tasks_serial_id ON public.tasks(serial_id);
CREATE INDEX IF NOT EXISTS idx_tasks_serial_id_site ON public.tasks(site_id, serial_id);

-- 6. Update existing tasks that don't have serial_id
UPDATE public.tasks 
SET serial_id = public.generate_task_serial_id(site_id)
WHERE serial_id IS NULL OR serial_id = '';

-- 7. Set serial_id column to NOT NULL
ALTER TABLE public.tasks ALTER COLUMN serial_id SET NOT NULL;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.generate_task_serial_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_serial_id() TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.generate_task_serial_id(uuid) IS 'Generates a unique serial ID for a task based on site prefix and task count';
COMMENT ON FUNCTION public.set_task_serial_id() IS 'Trigger function to automatically set serial_id for new tasks';
COMMENT ON COLUMN public.tasks.serial_id IS 'Unique human-readable identifier for the task (e.g., TSK-0001)'; 