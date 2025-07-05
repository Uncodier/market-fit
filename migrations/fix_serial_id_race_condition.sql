-- Fix serial_id race condition in task creation
-- This migration fixes the race condition issue in generate_task_serial_id function

-- Drop existing constraint if it exists
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_serial_id_site_unique;

-- Create a more robust serial_id generation function
CREATE OR REPLACE FUNCTION public.generate_task_serial_id(site_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    site_prefix text;
    max_serial_num integer;
    serial_id text;
    attempt_count integer := 0;
    max_attempts integer := 10;
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
    
    -- Loop to handle race conditions
    LOOP
        -- Get the maximum serial number for this site prefix
        SELECT COALESCE(MAX(
            CASE 
                WHEN serial_id ~ ('^' || site_prefix || '-[0-9]+$') 
                THEN CAST(SPLIT_PART(serial_id, '-', 2) AS INTEGER)
                ELSE 0
            END
        ), 0) + 1
        INTO max_serial_num
        FROM public.tasks
        WHERE site_id = site_uuid
        AND serial_id LIKE (site_prefix || '-%');
        
        -- Generate serial_id with format: PREFIX-NNNN
        serial_id := site_prefix || '-' || LPAD(max_serial_num::text, 4, '0');
        
        -- Check if this serial_id already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE site_id = site_uuid 
            AND serial_id = serial_id
        ) THEN
            -- Serial ID is unique, we can use it
            RETURN serial_id;
        END IF;
        
        -- Increment attempt counter
        attempt_count := attempt_count + 1;
        
        -- If we've tried too many times, add a random suffix
        IF attempt_count >= max_attempts THEN
            serial_id := site_prefix || '-' || LPAD(max_serial_num::text, 4, '0') || '-' || EXTRACT(EPOCH FROM clock_timestamp())::bigint;
            RETURN serial_id;
        END IF;
        
        -- Small delay to reduce contention
        PERFORM pg_sleep(0.001 * attempt_count);
    END LOOP;
END;
$$;

-- Update the trigger function to handle potential duplicates
CREATE OR REPLACE FUNCTION public.set_task_serial_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    attempt_count integer := 0;
    max_attempts integer := 5;
    generated_serial_id text;
BEGIN
    -- Only set serial_id if it's empty or NULL
    IF NEW.serial_id IS NULL OR NEW.serial_id = '' THEN
        LOOP
            -- Generate a new serial_id
            generated_serial_id := public.generate_task_serial_id(NEW.site_id);
            
            -- Check if this serial_id is unique
            IF NOT EXISTS (
                SELECT 1 FROM public.tasks 
                WHERE site_id = NEW.site_id 
                AND serial_id = generated_serial_id
                AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) THEN
                NEW.serial_id := generated_serial_id;
                EXIT;
            END IF;
            
            -- Increment attempt counter
            attempt_count := attempt_count + 1;
            
            -- If we've tried too many times, add timestamp suffix
            IF attempt_count >= max_attempts THEN
                NEW.serial_id := generated_serial_id || '-' || EXTRACT(EPOCH FROM clock_timestamp())::bigint;
                EXIT;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_set_task_serial_id ON public.tasks;
CREATE TRIGGER trigger_set_task_serial_id
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_task_serial_id();

-- Add unique constraint that handles the race condition better
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_serial_id_site_unique 
ON public.tasks(site_id, serial_id);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.generate_task_serial_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_serial_id() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.generate_task_serial_id(uuid) IS 'Generates a unique serial ID for a task based on site prefix and handles race conditions';
COMMENT ON FUNCTION public.set_task_serial_id() IS 'Trigger function to automatically set serial_id for new tasks with race condition protection'; 