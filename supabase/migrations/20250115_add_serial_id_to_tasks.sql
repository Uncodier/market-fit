-- Add serial_id column to tasks table
-- This will create a unique sequential identifier per site

-- First, add the column
ALTER TABLE public.tasks 
ADD COLUMN serial_id TEXT;

-- Create a function to generate the next serial_id for a site
CREATE OR REPLACE FUNCTION generate_task_serial_id(site_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    site_prefix TEXT;
BEGIN
    -- Get the next number for this site
    SELECT COALESCE(MAX(CAST(SUBSTRING(serial_id FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.tasks 
    WHERE site_id = site_uuid 
    AND serial_id IS NOT NULL 
    AND serial_id ~ '^[A-Z]+-[0-9]+$';
    
    -- Get site prefix (first 3 characters of site name, uppercase)
    SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 3))
    INTO site_prefix
    FROM public.sites 
    WHERE id = site_uuid;
    
    -- If no site found or name is empty, use 'TSK' as default
    IF site_prefix IS NULL OR site_prefix = '' THEN
        site_prefix := 'TSK';
    END IF;
    
    -- Ensure we have at least 3 characters, pad with 'X' if needed
    WHILE LENGTH(site_prefix) < 3 LOOP
        site_prefix := site_prefix || 'X';
    END LOOP;
    
    -- Return the formatted serial_id
    RETURN site_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to auto-generate serial_id on insert
CREATE OR REPLACE FUNCTION set_task_serial_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set serial_id if it's not already provided
    IF NEW.serial_id IS NULL THEN
        NEW.serial_id := generate_task_serial_id(NEW.site_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_set_task_serial_id
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_serial_id();

-- Update existing tasks to have serial_ids
DO $$
DECLARE
    task_record RECORD;
BEGIN
    -- Update existing tasks in order of creation
    FOR task_record IN 
        SELECT id, site_id 
        FROM public.tasks 
        WHERE serial_id IS NULL 
        ORDER BY site_id, created_at
    LOOP
        UPDATE public.tasks 
        SET serial_id = generate_task_serial_id(task_record.site_id)
        WHERE id = task_record.id;
    END LOOP;
END $$;

-- Make serial_id NOT NULL after populating existing records
ALTER TABLE public.tasks 
ALTER COLUMN serial_id SET NOT NULL;

-- Create unique index on serial_id per site
CREATE UNIQUE INDEX idx_tasks_serial_id_site 
ON public.tasks(site_id, serial_id);

-- Create index for faster lookups
CREATE INDEX idx_tasks_serial_id 
ON public.tasks(serial_id);

-- Add comment to explain the column
COMMENT ON COLUMN public.tasks.serial_id IS 'Unique sequential identifier per site in format: XXX-0001 where XXX is site prefix'; 