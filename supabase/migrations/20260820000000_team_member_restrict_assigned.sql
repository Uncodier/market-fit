-- 1. Add column to site_members
ALTER TABLE site_members ADD COLUMN IF NOT EXISTS restrict_to_assigned_only BOOLEAN DEFAULT false;

-- 2. Update RLS policies to respect restrict_to_assigned_only

-- Leads
DROP POLICY IF EXISTS "leads_unified" ON leads;
CREATE POLICY "leads_unified" ON leads
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = leads.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR leads.user_id = auth.uid()
          OR leads.assignee_id = auth.uid()
        )
      )
    )
  )
);

-- Deals
DROP POLICY IF EXISTS "deals_unified" ON deals;
CREATE POLICY "deals_unified" ON deals
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = deals.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR EXISTS (
            SELECT 1 FROM deal_owners d_o
            WHERE d_o.deal_id = deals.id AND d_o.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Sale Orders
DROP POLICY IF EXISTS "sale_orders_unified" ON sale_orders;
CREATE POLICY "sale_orders_unified" ON sale_orders
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = sale_orders.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR sale_orders.user_id = auth.uid()
        )
      )
    )
  )
);

-- Sales
DROP POLICY IF EXISTS "sales_unified" ON sales;
CREATE POLICY "sales_unified" ON sales
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = sales.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR sales.user_id = auth.uid()
        )
      )
    )
  )
);

-- Shipments
DROP POLICY IF EXISTS "shipments_unified" ON shipments;
CREATE POLICY "shipments_unified" ON shipments
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = shipments.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR shipments.user_id = auth.uid()
          OR shipments.assigned_to = auth.uid()
        )
      )
    )
  )
);

-- Tasks
DROP POLICY IF EXISTS "tasks_unified" ON tasks;
CREATE POLICY "tasks_unified" ON tasks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = tasks.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR tasks.user_id = auth.uid()
          OR tasks.assignee = auth.uid()
        )
      )
    )
  )
);

-- Reservations
DROP POLICY IF EXISTS "reservations_unified" ON reservations;
CREATE POLICY "reservations_unified" ON reservations
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = reservations.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR reservations.assignee_user_id = auth.uid()
        )
      )
    )
  )
);

-- Conversations
DROP POLICY IF EXISTS "conversations_unified_access_policy" ON conversations;
CREATE POLICY "conversations_unified_access_policy" ON conversations
FOR ALL
USING (
  auth.uid() IS NULL
  OR auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = conversations.site_id
      AND (
        s.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM site_ownership so
          WHERE so.site_id = s.id AND so.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
          AND (
            sm.restrict_to_assigned_only = false
            OR conversations.user_id = auth.uid()
            OR conversations.agent_id = auth.uid()
            OR conversations.delegate_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM leads l
              WHERE l.id = conversations.lead_id
              AND (l.user_id = auth.uid() OR l.assignee_id = auth.uid())
            )
          )
        )
      )
    )
    OR user_id = auth.uid()
    OR visitor_id = auth.uid()
  )
);

-- Messages
DROP POLICY IF EXISTS "messages_unified_access_policy" ON messages;
CREATE POLICY "messages_unified_access_policy" ON messages
FOR ALL
USING (
  auth.uid() IS NULL
  OR auth.uid() IS NOT NULL AND (
    user_id = auth.uid()
    OR visitor_id = auth.uid()
    OR agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversations c
      JOIN sites s ON s.id = c.site_id
      WHERE c.id = messages.conversation_id
      AND (
        s.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM site_ownership so
          WHERE so.site_id = s.id AND so.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
          AND (
            sm.restrict_to_assigned_only = false
            OR c.user_id = auth.uid()
            OR c.agent_id = auth.uid()
            OR c.delegate_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM leads l
              WHERE l.id = c.lead_id
              AND (l.user_id = auth.uid() OR l.assignee_id = auth.uid())
            )
          )
        )
      )
    )
  )
);

-- Records
DROP POLICY IF EXISTS "records_unified" ON records;
CREATE POLICY "records_unified" ON records
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = records.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR records.relations::text LIKE '%' || auth.uid()::text || '%'
        )
      )
    )
  )
);

-- Content
DROP POLICY IF EXISTS "content_unified_access_policy" ON content;
CREATE POLICY "content_unified_access_policy" ON content
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = content.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR content.user_id = auth.uid()
          OR content.author_id = auth.uid()
        )
      )
    )
  )
  OR user_id = auth.uid()
  OR author_id = auth.uid()
);

-- Campaigns
DROP POLICY IF EXISTS "campaigns_unified" ON campaigns;
CREATE POLICY "campaigns_unified" ON campaigns
FOR ALL
USING (
  app_auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = campaigns.site_id
      AND (
        s.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM site_ownership so
          WHERE so.site_id = s.id AND so.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
          AND (
            sm.restrict_to_assigned_only = false
            OR campaigns.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Experiments
DROP POLICY IF EXISTS "experiments_unified" ON experiments;
CREATE POLICY "experiments_unified" ON experiments
FOR ALL
USING (
  app_auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = experiments.site_id
      AND (
        s.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM site_ownership so
          WHERE so.site_id = s.id AND so.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
          AND (
            sm.restrict_to_assigned_only = false
            OR experiments.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Segments
DROP POLICY IF EXISTS "segments_unified" ON segments;
CREATE POLICY "segments_unified" ON segments
FOR ALL
USING (
  app_auth.is_service_role_or_user_condition(
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = segments.site_id
      AND (
        s.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM site_ownership so
          WHERE so.site_id = s.id AND so.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
          AND (
            sm.restrict_to_assigned_only = false
            OR segments.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Audiences
DROP POLICY IF EXISTS "audiences_site_access" ON audiences;
CREATE POLICY "audiences_site_access" ON audiences
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = audiences.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR audiences.user_id = auth.uid()
        )
      )
    )
  )
);

-- Requirements
DROP POLICY IF EXISTS "requirements_optimized_policy" ON requirements;
CREATE POLICY "requirements_optimized_policy" ON requirements
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = requirements.site_id
    AND (
      s.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
        AND (
          sm.restrict_to_assigned_only = false
          OR requirements.user_id = auth.uid()
        )
      )
    )
  )
);
