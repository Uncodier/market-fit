-- Script para confirmar que el campo 'type' en la tabla tasks acepta cualquier string
-- y añadir documentación sobre esta flexibilidad

-- 1. Verificar el estado actual del campo type en la tabla tasks
DO $$
BEGIN
    -- Verificar si existe alguna restricción CHECK en el campo type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_name = 'tasks' 
        AND ccu.column_name = 'type'
        AND cc.constraint_name LIKE '%type%'
    ) THEN
        RAISE NOTICE 'WARNING: Found CHECK constraint on type field. This may restrict values.';
    ELSE
        RAISE NOTICE 'SUCCESS: No CHECK constraints found on type field. Field accepts any string.';
    END IF;
END $$;

-- 2. Añadir comentario a la columna para documentar que acepta cualquier string
COMMENT ON COLUMN public.tasks.type IS 'Task type - accepts any custom string value (e.g., "website_visit", "demo", "custom_task", etc.)';

-- 3. Verificar la estructura actual de la columna
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name = 'type';

-- 4. Mostrar algunas tareas existentes para verificar los tipos actuales
SELECT 
    type,
    COUNT(*) as count
FROM public.tasks 
GROUP BY type 
ORDER BY count DESC
LIMIT 10;

-- 5. Script de verificación opcional: insertar una tarea de prueba con tipo personalizado
-- (Descomenta las siguientes líneas para probar)
/*
INSERT INTO public.tasks (
    title,
    description,
    status,
    type,
    scheduled_date,
    site_id,
    user_id
) VALUES (
    'Test Custom Type Task',
    'Testing that custom types work',
    'pending',
    'custom_test_type',  -- Tipo personalizado
    NOW(),
    (SELECT id FROM public.sites LIMIT 1),  -- Usar el primer site disponible
    auth.uid()
);

-- Verificar que se insertó correctamente
SELECT * FROM public.tasks WHERE type = 'custom_test_type';

-- Limpiar la tarea de prueba
DELETE FROM public.tasks WHERE type = 'custom_test_type' AND title = 'Test Custom Type Task';
*/

-- 6. Información adicional sobre el schema
SELECT 
    t.table_name,
    t.column_name,
    t.data_type,
    t.is_nullable,
    cc.constraint_name,
    cc.check_clause
FROM information_schema.columns t
LEFT JOIN information_schema.constraint_column_usage ccu ON t.table_name = ccu.table_name AND t.column_name = ccu.column_name
LEFT JOIN information_schema.check_constraints cc ON ccu.constraint_name = cc.constraint_name
WHERE t.table_name = 'tasks'
AND t.column_name IN ('type', 'status', 'stage')
ORDER BY t.column_name; 