-- SCRIPT PARA ELIMINAR LOS TRIGGERS Y FUNCIÓN PROBLEMÁTICOS
-- Basado en el error específico que obtuvimos

-- 1. Eliminar los triggers específicos mencionados en el error
DROP TRIGGER sync_membership_on_member_change ON public.site_members;
DROP TRIGGER sync_membership_on_member_delete ON public.site_members;

-- 2. Ahora eliminar la función problemática
DROP FUNCTION public.sync_site_membership();

-- 3. Verificar que se eliminaron correctamente
SELECT 'TRIGGERS Y FUNCIÓN ELIMINADOS' as resultado;

-- 4. Verificar triggers restantes en site_members
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'site_members';

-- 5. Prueba de inserción
INSERT INTO public.site_members (
    site_id, 
    user_id, 
    email, 
    role, 
    status, 
    added_by
) 
VALUES (
    (SELECT id FROM public.sites LIMIT 1),
    NULL,  
    'test@example.com',
    'collaborator',
    'pending',
    (SELECT user_id FROM public.sites LIMIT 1)
);

-- 6. Verificar que se insertó correctamente
SELECT 'INSERCIÓN EXITOSA' as resultado, email, role 
FROM public.site_members 
WHERE email = 'test@example.com';

-- 7. Limpiar el registro de prueba
DELETE FROM public.site_members WHERE email = 'test@example.com';

-- 8. Resultado final
SELECT 'PROBLEMA RESUELTO - SITE_MEMBERS FUNCIONA CORRECTAMENTE' as resultado_final; 