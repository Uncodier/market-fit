-- Crear extensión pgcrypto para generar UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extensión para búsqueda de texto completo
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-------------------------------------------
-- TABLAS DE AUTENTICACIÓN Y USUARIO
-------------------------------------------

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  auth0_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-------------------------------------------
-- TABLAS PRINCIPALES
-------------------------------------------

-- Tabla de sitios
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  logo_url TEXT,
  resource_urls JSONB DEFAULT '[]',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de segmentos
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  audience TEXT,
  size INTEGER,
  engagement INTEGER,
  is_active BOOLEAN DEFAULT true,
  keywords JSONB DEFAULT '{"facebook": [], "google": [], "linkedin": [], "twitter": []}',
  hot_topics JSONB DEFAULT '{"blog": [], "newsletter": []}',
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  position TEXT,
  segment_id UUID REFERENCES public.segments(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes TEXT,
  last_contact TIMESTAMPTZ,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de requisitos
CREATE TABLE IF NOT EXISTS public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL CHECK (status IN ('validated', 'in-progress', 'backlog')),
  completion_status TEXT NOT NULL CHECK (completion_status IN ('pending', 'completed', 'rejected')),
  source TEXT,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de relación entre requisitos y segmentos
CREATE TABLE IF NOT EXISTS public.requirement_segments (
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.segments(id) ON DELETE CASCADE,
  PRIMARY KEY (requirement_id, segment_id)
);

-- Tabla de agentes
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('sales', 'support', 'marketing')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'training')),
  prompt TEXT NOT NULL,
  conversations INTEGER DEFAULT 0,
  success_rate INTEGER DEFAULT 0,
  configuration JSONB DEFAULT '{}',
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de experimentos
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'draft')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  conversion DECIMAL,
  roi DECIMAL,
  preview_url TEXT,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hypothesis TEXT
);

-- Tabla de KPIs para el dashboard
CREATE TABLE IF NOT EXISTS public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  value DECIMAL NOT NULL,
  previous_value DECIMAL,
  unit TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('conversion', 'engagement', 'traffic', 'revenue', 'growth', 'custom')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  is_highlighted BOOLEAN DEFAULT false,
  target_value DECIMAL,
  metadata JSONB DEFAULT '{}',
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trend DECIMAL DEFAULT 0,
  benchmark DECIMAL
);

-- Tabla de relación entre experimentos y segmentos
CREATE TABLE IF NOT EXISTS public.experiment_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES public.experiments(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.segments(id) ON DELETE CASCADE,
  participants INTEGER DEFAULT 0,
  UNIQUE (experiment_id, segment_id)
);

-- Tabla de recursos digitales (assets)
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  metadata JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT CHECK (event_type IN ('lead_created', 'kpi_alert', 'experiment_result')),
  severity INTEGER
);

-- Tabla de eventos de visitantes
CREATE TABLE IF NOT EXISTS public.visitor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'click', 'form_submission', 'conversion', 'chat', 'search', 'custom')),
  page_url TEXT,
  referrer_url TEXT,
  visitor_id TEXT,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  duration_seconds INTEGER,
  custom_data JSONB DEFAULT '{}',
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  experiment_id UUID REFERENCES public.experiments(id) ON DELETE SET NULL,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location JSONB DEFAULT '{}',
  campaign_id UUID REFERENCES public.experiments(id)
);

-- Tabla de recursos externos
CREATE TABLE IF NOT EXISTS public.external_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-------------------------------------------
-- ÍNDICES PARA OPTIMIZACIÓN
-------------------------------------------

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_segments_name ON public.segments USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_segments_site_id ON public.segments(site_id);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_name ON public.leads USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_site_id ON public.leads(site_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_segment_id ON public.leads(segment_id);

CREATE INDEX IF NOT EXISTS idx_requirements_site_id ON public.requirements(site_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON public.requirements(status);
CREATE INDEX IF NOT EXISTS idx_requirements_priority ON public.requirements(priority);
CREATE INDEX IF NOT EXISTS idx_requirements_title ON public.requirements USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_agents_site_id ON public.agents(site_id);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);

CREATE INDEX IF NOT EXISTS idx_experiments_site_id ON public.experiments(site_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON public.experiments(status);

-- Índices para assets
CREATE INDEX IF NOT EXISTS idx_assets_site_id ON public.assets(site_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_file_type ON public.assets(file_type);
CREATE INDEX IF NOT EXISTS idx_assets_name ON public.assets USING GIN (name gin_trgm_ops);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Índices para recursos externos
CREATE INDEX IF NOT EXISTS idx_external_resources_site_id ON public.external_resources(site_id);
CREATE INDEX IF NOT EXISTS idx_external_resources_user_id ON public.external_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_external_resources_key ON public.external_resources USING GIN (key gin_trgm_ops);

-- Índices para eventos de visitantes
CREATE INDEX IF NOT EXISTS idx_visitor_events_site_id ON public.visitor_events(site_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_event_type ON public.visitor_events(event_type);
CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at ON public.visitor_events(created_at);
CREATE INDEX IF NOT EXISTS idx_visitor_events_lead_id ON public.visitor_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_segment_id ON public.visitor_events(segment_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_experiment_id ON public.visitor_events(experiment_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_id ON public.visitor_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_page_url ON public.visitor_events USING GIN (page_url gin_trgm_ops);

-- Índices para KPIs
CREATE INDEX IF NOT EXISTS idx_kpis_site_id ON public.kpis(site_id);
CREATE INDEX IF NOT EXISTS idx_kpis_type ON public.kpis(type);
CREATE INDEX IF NOT EXISTS idx_kpis_period_end ON public.kpis(period_end);
CREATE INDEX IF NOT EXISTS idx_kpis_is_highlighted ON public.kpis(is_highlighted);
CREATE INDEX IF NOT EXISTS idx_kpis_name ON public.kpis USING GIN (name gin_trgm_ops);

-------------------------------------------
-- TRIGGERS Y FUNCIONES
-------------------------------------------

-- Función para actualizar la fecha de actualización automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar el trigger a todas las tablas
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at
BEFORE UPDATE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at
BEFORE UPDATE ON public.segments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requirements_updated_at
BEFORE UPDATE ON public.requirements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at
BEFORE UPDATE ON public.experiments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
BEFORE UPDATE ON public.assets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_resources_updated_at
BEFORE UPDATE ON public.external_resources
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitor_events_updated_at
BEFORE UPDATE ON public.visitor_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpis_updated_at
BEFORE UPDATE ON public.kpis
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-------------------------------------------
-- POLÍTICAS DE SEGURIDAD (RLS)
-------------------------------------------

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;

-- Políticas para perfiles
CREATE POLICY "Permitir a los usuarios leer cualquier perfil"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Permitir a los usuarios crear su propio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir a los usuarios actualizar su propio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Políticas para sitios
CREATE POLICY "Permitir a los usuarios leer sus propios sitios"
  ON public.sites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios sitios"
  ON public.sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios sitios"
  ON public.sites FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios sitios"
  ON public.sites FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para segmentos
CREATE POLICY "Permitir a los usuarios leer sus propios segmentos"
  ON public.segments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios segmentos"
  ON public.segments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios segmentos"
  ON public.segments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios segmentos"
  ON public.segments FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para leads
CREATE POLICY "Permitir a los usuarios leer sus propios leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios leads"
  ON public.leads FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para requisitos
CREATE POLICY "Permitir a los usuarios leer sus propios requisitos"
  ON public.requirements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios requisitos"
  ON public.requirements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios requisitos"
  ON public.requirements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios requisitos"
  ON public.requirements FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para relaciones entre requisitos y segmentos
CREATE POLICY "Permitir a los usuarios gestionar relaciones de requisitos-segmentos"
  ON public.requirement_segments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.requirements 
      WHERE id = requirement_id AND user_id = auth.uid()
    )
  );

-- Políticas para agentes
CREATE POLICY "Permitir a los usuarios leer sus propios agentes"
  ON public.agents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios agentes"
  ON public.agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios agentes"
  ON public.agents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios agentes"
  ON public.agents FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para experimentos
CREATE POLICY "Permitir a los usuarios leer sus propios experimentos"
  ON public.experiments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios experimentos"
  ON public.experiments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios experimentos"
  ON public.experiments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios experimentos"
  ON public.experiments FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para relaciones entre experimentos y segmentos
CREATE POLICY "Permitir a los usuarios gestionar relaciones de experimentos-segmentos"
  ON public.experiment_segments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.experiments 
      WHERE id = experiment_id AND user_id = auth.uid()
    )
  );

-- Políticas para assets (recursos digitales)
CREATE POLICY "Permitir a los usuarios leer sus propios assets"
  ON public.assets FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Permitir a los usuarios crear sus propios assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios assets"
  ON public.assets FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para notificaciones
CREATE POLICY "Permitir a los usuarios leer sus propias notificaciones"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear notificaciones"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propias notificaciones"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propias notificaciones"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para recursos externos
CREATE POLICY "Permitir a los usuarios leer sus propios recursos externos"
  ON public.external_resources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios recursos externos"
  ON public.external_resources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios recursos externos"
  ON public.external_resources FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios recursos externos"
  ON public.external_resources FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para eventos de visitantes
CREATE POLICY "Permitir a los usuarios leer sus propios eventos de visitantes"
  ON public.visitor_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear eventos de visitantes"
  ON public.visitor_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios eventos de visitantes"
  ON public.visitor_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios eventos de visitantes"
  ON public.visitor_events FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para KPIs
CREATE POLICY "Permitir a los usuarios leer sus propios KPIs"
  ON public.kpis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios crear sus propios KPIs"
  ON public.kpis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios actualizar sus propios KPIs"
  ON public.kpis FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir a los usuarios eliminar sus propios KPIs"
  ON public.kpis FOR DELETE
  USING (auth.uid() = user_id);

-------------------------------------------
-- FUNCIONES PARA TRIGGERS AUTOMATIZADOS
-------------------------------------------

-- Función para crear un perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Función para sincronizar usuario Auth0
CREATE OR REPLACE FUNCTION public.sync_auth0_user(
  auth0_id_param TEXT,
  email_param TEXT,
  name_param TEXT,
  picture_param TEXT
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Verificar si ya existe un perfil con este auth0_id
  SELECT id INTO user_id FROM public.profiles WHERE auth0_id = auth0_id_param;
  
  IF user_id IS NULL THEN
    -- No existe, crear un nuevo perfil
    user_id := gen_random_uuid();
    
    INSERT INTO public.profiles (id, email, name, avatar_url, auth0_id)
    VALUES (user_id, email_param, name_param, picture_param, auth0_id_param);
  ELSE
    -- Actualizar perfil existente
    UPDATE public.profiles
    SET 
      email = email_param,
      name = name_param,
      avatar_url = picture_param,
      updated_at = NOW()
    WHERE id = user_id;
  END IF;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar el contador de conversaciones de un agente
CREATE OR REPLACE FUNCTION public.increment_agent_conversations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.agents
  SET conversations = conversations + 1,
      last_active = NOW()
  WHERE id = NEW.agent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular KPIs basados en eventos de visitantes
CREATE OR REPLACE FUNCTION public.calculate_kpis_from_events(site_id_param UUID, kpi_type_param TEXT, period_start_param TIMESTAMPTZ, period_end_param TIMESTAMPTZ)
RETURNS TABLE (
  kpi_name TEXT,
  kpi_value DECIMAL,
  kpi_previous_value DECIMAL,
  segment_id UUID
) AS $$
DECLARE
  previous_period_start TIMESTAMPTZ;
  previous_period_end TIMESTAMPTZ;
  period_length_days INTEGER;
BEGIN
  -- Calcular período anterior basado en la duración del período actual
  period_length_days := EXTRACT(EPOCH FROM (period_end_param - period_start_param)) / 86400;
  previous_period_start := period_start_param - (period_end_param - period_start_param);
  previous_period_end := period_start_param;
  
  -- Devolver diferentes métricas según el tipo de KPI solicitado
  IF kpi_type_param = 'traffic' THEN
    -- KPI de tráfico: número de page_views
    RETURN QUERY
    WITH current_data AS (
      SELECT 
        s.id AS segment_id,
        COUNT(*) AS current_count
      FROM public.visitor_events ve
      LEFT JOIN public.segments s ON ve.segment_id = s.id
      WHERE ve.site_id = site_id_param
        AND ve.event_type = 'page_view'
        AND ve.created_at BETWEEN period_start_param AND period_end_param
      GROUP BY s.id
    ),
    previous_data AS (
      SELECT 
        s.id AS segment_id,
        COUNT(*) AS previous_count
      FROM public.visitor_events ve
      LEFT JOIN public.segments s ON ve.segment_id = s.id
      WHERE ve.site_id = site_id_param
        AND ve.event_type = 'page_view'
        AND ve.created_at BETWEEN previous_period_start AND previous_period_end
      GROUP BY s.id
    )
    SELECT 
      'Visitas de página' AS kpi_name,
      COALESCE(cd.current_count, 0)::DECIMAL AS kpi_value,
      COALESCE(pd.previous_count, 0)::DECIMAL AS kpi_previous_value,
      cd.segment_id
    FROM current_data cd
    LEFT JOIN previous_data pd ON cd.segment_id = pd.segment_id
    UNION ALL
    SELECT 
      'Visitas de página (sin segmento)' AS kpi_name,
      COUNT(*)::DECIMAL AS kpi_value,
      (SELECT COUNT(*)::DECIMAL FROM public.visitor_events 
       WHERE site_id = site_id_param
         AND event_type = 'page_view'
         AND segment_id IS NULL
         AND created_at BETWEEN previous_period_start AND previous_period_end) AS kpi_previous_value,
      NULL::UUID AS segment_id
    FROM public.visitor_events
    WHERE site_id = site_id_param
      AND event_type = 'page_view'
      AND segment_id IS NULL
      AND created_at BETWEEN period_start_param AND period_end_param;
    
  ELSIF kpi_type_param = 'conversion' THEN
    -- KPI de conversión
    RETURN QUERY
    WITH conversions AS (
      SELECT 
        s.id AS segment_id,
        COUNT(*) FILTER (WHERE ve.event_type = 'conversion') AS conv_count,
        COUNT(*) FILTER (WHERE ve.event_type = 'page_view') AS view_count,
        COUNT(*) FILTER (WHERE ve.event_type = 'conversion' AND ve.created_at BETWEEN previous_period_start AND previous_period_end) AS prev_conv_count,
        COUNT(*) FILTER (WHERE ve.event_type = 'page_view' AND ve.created_at BETWEEN previous_period_start AND previous_period_end) AS prev_view_count
      FROM public.visitor_events ve
      LEFT JOIN public.segments s ON ve.segment_id = s.id
      WHERE ve.site_id = site_id_param
        AND ve.created_at BETWEEN previous_period_start AND period_end_param
        AND (ve.event_type = 'conversion' OR ve.event_type = 'page_view')
      GROUP BY s.id
    )
    SELECT 
      'Tasa de conversión' AS kpi_name,
      CASE 
        WHEN view_count > 0 THEN (conv_count * 100.0 / view_count)::DECIMAL 
        ELSE 0::DECIMAL 
      END AS kpi_value,
      CASE 
        WHEN prev_view_count > 0 THEN (prev_conv_count * 100.0 / prev_view_count)::DECIMAL 
        ELSE 0::DECIMAL 
      END AS kpi_previous_value,
      segment_id
    FROM conversions;
    
  ELSIF kpi_type_param = 'engagement' THEN
    -- KPI de engagement (promedio de duración de sesión)
    RETURN QUERY
    WITH engagement AS (
      SELECT 
        s.id AS segment_id,
        AVG(ve.duration_seconds) FILTER (WHERE ve.created_at BETWEEN period_start_param AND period_end_param) AS avg_duration,
        AVG(ve.duration_seconds) FILTER (WHERE ve.created_at BETWEEN previous_period_start AND previous_period_end) AS prev_avg_duration
      FROM public.visitor_events ve
      LEFT JOIN public.segments s ON ve.segment_id = s.id
      WHERE ve.site_id = site_id_param
        AND ve.created_at BETWEEN previous_period_start AND period_end_param
        AND ve.duration_seconds IS NOT NULL
      GROUP BY s.id
    )
    SELECT 
      'Tiempo promedio en página' AS kpi_name,
      COALESCE(avg_duration, 0)::DECIMAL AS kpi_value,
      COALESCE(prev_avg_duration, 0)::DECIMAL AS kpi_previous_value,
      segment_id
    FROM engagement;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Función auxiliar para obtener el ID de usuario autenticado con Auth0
CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS UUID AS $$
DECLARE
  auth0_sub TEXT;
  user_id UUID;
BEGIN
  -- Intentar obtener el sub claim del token JWT
  BEGIN
    auth0_sub := current_setting('request.jwt.claims', true)::json->>'sub';
  EXCEPTION
    WHEN others THEN
      auth0_sub := NULL;
  END;
  
  -- Si no hay token o no tiene sub, intentar usar auth.uid() por compatibilidad
  IF auth0_sub IS NULL THEN
    RETURN auth.uid();
  END IF;
  
  -- Buscar el perfil correspondiente al ID de Auth0
  SELECT id INTO user_id FROM public.profiles WHERE auth0_id = auth0_sub;
  RETURN user_id;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 