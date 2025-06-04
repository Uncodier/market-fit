-- Script simple para documentar que el campo 'type' acepta cualquier string
-- Este script es seguro de ejecutar ya que no modifica la estructura, solo añade documentación

-- Añadir comentario descriptivo a la columna type
COMMENT ON COLUMN public.tasks.type IS 'Task type - accepts any custom string value. Common values: website_visit, demo, meeting, email, call, quote, contract, payment, referral, feedback, or any custom type.';

-- Verificar que el comentario se añadió correctamente
SELECT 
    col_description(pgc.oid, a.attnum) as column_comment,
    a.attname as column_name,
    t.typname as data_type
FROM pg_class pgc
JOIN pg_attribute a ON pgc.oid = a.attrelid
JOIN pg_type t ON a.atttypid = t.oid
WHERE pgc.relname = 'tasks' 
AND a.attname = 'type'
AND a.attnum > 0; 