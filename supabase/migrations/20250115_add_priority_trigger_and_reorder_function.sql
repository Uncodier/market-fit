-- Trigger to automatically set priority based on serial_id number
CREATE OR REPLACE FUNCTION set_task_priority_from_serial()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract numeric part from serial_id and set as priority
    IF NEW.serial_id IS NOT NULL THEN
        NEW.priority := CAST(SUBSTRING(NEW.serial_id FROM '-(\d+)$') AS INTEGER);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_task_priority ON public.tasks;

-- Create trigger for new tasks
CREATE TRIGGER trigger_set_task_priority
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_priority_from_serial();

-- Update existing tasks to set priority from serial_id
UPDATE public.tasks 
SET priority = CAST(SUBSTRING(serial_id FROM '-(\d+)$') AS INTEGER)
WHERE serial_id IS NOT NULL;

-- Drop existing function if it exists (in case of parameter changes)
DROP FUNCTION IF EXISTS reorder_task_priorities(UUID, INTEGER, TEXT, UUID);

-- Function to reorder priorities when moving a task
CREATE OR REPLACE FUNCTION reorder_task_priorities(
    p_task_id UUID,
    p_new_position INTEGER, -- The position where we want to place the task (1-based)
    p_status TEXT,
    p_site_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_old_priority INTEGER;
    v_old_status TEXT;
    v_old_position INTEGER;
    v_current_priority INTEGER;
    v_task_record RECORD;
    v_position_counter INTEGER := 1;
BEGIN
    -- Get current priority and status of the task being moved
    SELECT priority, status INTO v_old_priority, v_old_status
    FROM public.tasks
    WHERE id = p_task_id;

    -- Get the current position of the task in its column
    SELECT COUNT(*) + 1 INTO v_old_position
    FROM public.tasks
    WHERE site_id = p_site_id 
        AND status = v_old_status 
        AND priority > v_old_priority;

    -- If moving within the same status column
    IF v_old_status = p_status THEN
        -- Reorder all tasks in the column
        FOR v_task_record IN 
            SELECT id, priority
            FROM public.tasks
            WHERE site_id = p_site_id 
                AND status = p_status
                AND id != p_task_id
            ORDER BY priority DESC
        LOOP
            -- Skip the position where we want to insert our task
            IF v_position_counter = p_new_position THEN
                v_position_counter := v_position_counter + 1;
            END IF;
            
            -- Update priority based on new position
            UPDATE public.tasks
            SET priority = 1000 - (v_position_counter * 10)
            WHERE id = v_task_record.id;
            
            v_position_counter := v_position_counter + 1;
        END LOOP;
    ELSE
        -- Moving to different status column
        -- First, reorder the source column (fill the gap)
        v_position_counter := 1;
        FOR v_task_record IN 
            SELECT id
            FROM public.tasks
            WHERE site_id = p_site_id 
                AND status = v_old_status
                AND id != p_task_id
            ORDER BY priority DESC
        LOOP
            UPDATE public.tasks
            SET priority = 1000 - (v_position_counter * 10)
            WHERE id = v_task_record.id;
            
            v_position_counter := v_position_counter + 1;
        END LOOP;
        
        -- Then, reorder the destination column (make space)
        v_position_counter := 1;
        FOR v_task_record IN 
            SELECT id
            FROM public.tasks
            WHERE site_id = p_site_id 
                AND status = p_status
            ORDER BY priority DESC
        LOOP
            -- Skip the position where we want to insert our task
            IF v_position_counter = p_new_position THEN
                v_position_counter := v_position_counter + 1;
            END IF;
            
            UPDATE public.tasks
            SET priority = 1000 - (v_position_counter * 10)
            WHERE id = v_task_record.id;
            
            v_position_counter := v_position_counter + 1;
        END LOOP;
    END IF;

    -- Finally, update the moved task with its new position
    UPDATE public.tasks
    SET priority = 1000 - (p_new_position * 10),
        status = p_status
    WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Create index for better performance on priority operations
CREATE INDEX IF NOT EXISTS idx_tasks_site_status_priority 
ON public.tasks(site_id, status, priority); 