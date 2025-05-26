-- Add priority and address columns to tasks table
-- priority: numeric field for ordering tasks within kanban columns
-- address: JSONB field for future address functionality

-- Add priority column (numeric, default 0)
ALTER TABLE public.tasks 
ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

-- Add address column (JSONB, nullable for future use)
ALTER TABLE public.tasks 
ADD COLUMN address JSONB DEFAULT NULL;

-- Create index on priority for better sorting performance
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);

-- Create index on address for potential future queries
CREATE INDEX IF NOT EXISTS idx_tasks_address ON public.tasks USING GIN (address);

-- Add comments to explain the columns
COMMENT ON COLUMN public.tasks.priority IS 'Numeric priority for ordering tasks within kanban columns (higher number = higher priority)';
COMMENT ON COLUMN public.tasks.address IS 'JSONB field for storing address information (for future use)'; 