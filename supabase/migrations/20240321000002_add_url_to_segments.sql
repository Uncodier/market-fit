-- Agregar columna url si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'segments' 
    AND column_name = 'url'
  ) THEN
    ALTER TABLE segments 
    ADD COLUMN url TEXT;
  END IF;
END $$;

-- Agregar un índice para búsquedas rápidas por URL
CREATE INDEX IF NOT EXISTS segments_url_idx ON segments (url);

-- Agregar comentario para documentar el propósito de la columna
COMMENT ON COLUMN segments.url IS 'URL del segmento para previsualización o acceso directo'; 