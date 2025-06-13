-- Fix sync trigger to avoid updating settings for deleted sites
-- This prevents foreign key violations when sites are being deleted

CREATE OR REPLACE FUNCTION sync_site_members_to_settings()
RETURNS TRIGGER AS $$
DECLARE
    affected_site_id UUID;
    team_members_json JSONB;
    site_exists BOOLEAN;
    deleting_site_id TEXT;
BEGIN
    -- Determinar qué site_id fue afectado
    IF TG_OP = 'DELETE' THEN
        affected_site_id := OLD.site_id;
    ELSE
        affected_site_id := NEW.site_id;
    END IF;
    
    -- Verificar si estamos eliminando este sitio completo
    deleting_site_id := current_setting('app.deleting_site', true);
    
    -- Si estamos eliminando este sitio, no intentar actualizar settings
    IF deleting_site_id = affected_site_id::text THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;
    
    -- Verificar si el sitio aún existe
    SELECT EXISTS(SELECT 1 FROM public.sites WHERE id = affected_site_id) INTO site_exists;
    
    -- Si el sitio no existe, no intentar actualizar settings
    IF NOT site_exists THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;
    
    -- Construir el JSON de team_members desde site_members
    SELECT jsonb_agg(
        jsonb_build_object(
            'email', sm.email,
            'role', CASE 
                WHEN sm.role = 'admin' THEN 'admin'
                WHEN sm.role = 'marketing' THEN 'create'
                WHEN sm.role = 'collaborator' THEN 'view'
                ELSE 'view'
            END,
            'name', COALESCE(sm.name, ''),
            'position', COALESCE(sm.position, '')
        )
    )
    INTO team_members_json
    FROM public.site_members sm
    WHERE sm.site_id = affected_site_id
      AND sm.status = 'active'
      AND sm.role != 'owner'; -- Excluir owners del team_members
    
    -- Si no hay miembros, usar array vacío
    team_members_json := COALESCE(team_members_json, '[]'::jsonb);
    
    -- Actualizar settings.team_members solo si el sitio existe
    UPDATE public.settings
    SET team_members = team_members_json,
        updated_at = now()
    WHERE site_id = affected_site_id;
    
    -- Si no existe un registro en settings, crearlo (solo si el sitio existe)
    IF NOT FOUND THEN
        -- Verificar nuevamente que el sitio existe antes de insertar
        SELECT EXISTS(SELECT 1 FROM public.sites WHERE id = affected_site_id) INTO site_exists;
        
        IF site_exists THEN
            INSERT INTO public.settings (site_id, team_members, created_at, updated_at)
            VALUES (affected_site_id, team_members_json, now(), now())
            ON CONFLICT (site_id) DO UPDATE 
            SET team_members = EXCLUDED.team_members,
                updated_at = EXCLUDED.updated_at;
        END IF;
    END IF;
    
    -- Retornar el registro apropiado
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger con la función arreglada
DROP TRIGGER IF EXISTS sync_members_to_settings ON public.site_members;
CREATE TRIGGER sync_members_to_settings
    AFTER INSERT OR UPDATE OR DELETE ON public.site_members
    FOR EACH ROW
    EXECUTE FUNCTION sync_site_members_to_settings(); 