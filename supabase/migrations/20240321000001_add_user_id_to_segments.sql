-- Agregar columna user_id si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'segments' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE segments 
    ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id);
  END IF;
END $$;

-- Asegurar que la columna user_id tenga la referencia correcta
ALTER TABLE segments 
DROP CONSTRAINT IF EXISTS segments_user_id_fkey;

ALTER TABLE segments
ADD CONSTRAINT segments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id)
ON DELETE CASCADE;