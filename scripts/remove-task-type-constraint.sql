-- Script para eliminar restricciones CHECK en el campo 'type' de la tabla tasks
-- Este script es necesario porque existe una restricción 'tasks_type_check' que impide valores personalizados

-- 1. Verificar restricciones existentes en el campo type
SELECT 
    cc.constraint_name,
    cc.check_clause,
    ccu.table_name,
    ccu.column_name
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'tasks' 
AND ccu.column_name = 'type'
ORDER BY cc.constraint_name;

-- 2. Eliminar la restricción CHECK específica del tipo
-- (Si existe la restricción tasks_type_check)
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Verificar si existe la restricción antes de intentar eliminarla
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'tasks_type_check' 
        AND table_name = 'tasks'
        AND constraint_type = 'CHECK'
    ) THEN
        -- Eliminar la restricción
        ALTER TABLE public.tasks DROP CONSTRAINT tasks_type_check;
        RAISE NOTICE 'Restricción tasks_type_check eliminada exitosamente.';
    ELSE
        RAISE NOTICE 'No se encontró la restricción tasks_type_check.';
    END IF;
    
    -- Verificar si existe alguna otra restricción con el patrón type_check
    FOR constraint_record IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'tasks' 
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%type%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.tasks DROP CONSTRAINT ' || constraint_record.constraint_name;
        RAISE NOTICE 'Restricción % eliminada.', constraint_record.constraint_name;
    END LOOP;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error al eliminar restricciones: %', SQLERRM;
END $$;

-- 3. Verificar que no queden restricciones CHECK en el campo type
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS: No hay restricciones CHECK en el campo type'
        ELSE 'WARNING: Aún existen ' || COUNT(*) || ' restricciones CHECK en el campo type'
    END as status
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'tasks' 
AND ccu.column_name = 'type';

-- 4. Añadir comentario para documentar que el campo acepta cualquier string
COMMENT ON COLUMN public.tasks.type IS 'Task type - accepts any custom string value. No restrictions.';

-- 5. Probar insertando una tarea con tipo personalizado (OPCIONAL - descomenta para probar)
/*
-- Crear una tarea de prueba con tipo personalizado
INSERT INTO public.tasks (
    title,
    description,
    status,
    type,  -- Tipo personalizado
    scheduled_date,
    site_id,
    user_id
) VALUES (
    'Test Custom Type',
    'Testing that custom types work after removing constraint',
    'pending',
    'mi_tipo_personalizado_test',  -- ✅ Esto debería funcionar ahora
    NOW(),
    (SELECT id FROM public.sites LIMIT 1),
    auth.uid()
);

-- Verificar que se insertó correctamente
SELECT id, title, type, status, created_at 
FROM public.tasks 
WHERE type = 'mi_tipo_personalizado_test' 
ORDER BY created_at DESC 
LIMIT 1;

-- Limpiar la tarea de prueba
DELETE FROM public.tasks 
WHERE type = 'mi_tipo_personalizado_test' 
AND title = 'Test Custom Type';
*/

-- 6. Mostrar la estructura actual de la columna type
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name = 'type'; 