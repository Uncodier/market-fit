-- Fix ambiguous column reference in generate_task_serial_id function
-- This migration fixes the ambiguous reference to serial_id in the function

CREATE OR REPLACE FUNCTION public.generate_task_serial_id(site_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    site_prefix text;
    max_serial_num integer;
    new_serial_id text;
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
                WHEN t.serial_id ~ ('^' || site_prefix || '-[0-9]+$') 
                THEN CAST(SPLIT_PART(t.serial_id, '-', 2) AS INTEGER)
                ELSE 0
            END
        ), 0) + 1
        INTO max_serial_num
        FROM public.tasks t
        WHERE t.site_id = site_uuid
        AND t.serial_id LIKE (site_prefix || '-%');
        
        -- Generate serial_id with format: PREFIX-NNNN
        new_serial_id := site_prefix || '-' || LPAD(max_serial_num::text, 4, '0');
        
        -- Check if this serial_id already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.site_id = site_uuid 
            AND t.serial_id = new_serial_id
        ) THEN
            -- Serial ID is unique, we can use it
            RETURN new_serial_id;
        END IF;
        
        -- Increment attempt counter
        attempt_count := attempt_count + 1;
        
        -- If we've tried too many times, add a random suffix
        IF attempt_count >= max_attempts THEN
            new_serial_id := site_prefix || '-' || LPAD(max_serial_num::text, 4, '0') || '-' || EXTRACT(EPOCH FROM clock_timestamp())::bigint;
            RETURN new_serial_id;
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
                SELECT 1 FROM public.tasks t
                WHERE t.site_id = NEW.site_id 
                AND t.serial_id = generated_serial_id
                AND t.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.generate_task_serial_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_serial_id() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.generate_task_serial_id(uuid) IS 'Generates a unique serial ID for a task based on site prefix and handles race conditions - fixed ambiguous reference';
COMMENT ON FUNCTION public.set_task_serial_id() IS 'Trigger function to automatically set serial_id for new tasks with race condition protection - fixed ambiguous reference'; 