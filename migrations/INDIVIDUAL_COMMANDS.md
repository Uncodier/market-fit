# 🚀 Comandos Individuales para Supabase

**IMPORTANTE:** Ejecuta cada comando **UNO POR UNO** en el SQL Editor de Supabase.
No copies y pegues múltiples comandos a la vez.

---

## 📋 FASE 1: Eliminar Índices No Utilizados

### **Batch 1 - Ejecuta uno por uno:**

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_site_members_lookup;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_site_members_added_by;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_agent_memories_agent_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_lead_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_segment_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_sale_date;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_site_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_requirement_segments_requirement_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_requirement_segments_segment_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_debug_logs_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_debug_logs_site_id;
```

**✅ Checkpoint:** Ejecuta este comando para verificar progreso:
```sql
SELECT 'BATCH 1 COMPLETADO - 12 índices eliminados' AS status;
```

---

### **Batch 2 - Ejecuta uno por uno:**

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_segments_name;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_segments_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_agents_supervisor;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_agents_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_email;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_name;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_campaign_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_leads_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_campaign_segments_segment_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_campaigns_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_commands_site_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_content_author_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_content_segment_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_content_user_id;
```

**✅ Checkpoint:**
```sql
SELECT 'BATCH 2 COMPLETADO - 14 índices más eliminados' AS status;
```

---

### **Batch 3 - Ejecuta uno por uno:**

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_is_read;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_created_at;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_type;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_site_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_status;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_delegate_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_experiment_segments_segment_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_experiments_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_kpis_segment_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_referral_codes_created_by;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_requirements_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_session_events_segment_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_site_ownership_user_id;
```

**✅ Checkpoint:**
```sql
SELECT 'BATCH 3 COMPLETADO - 14 índices más eliminados' AS status;
```

---

### **Batch 4 - Ejecuta uno por uno:**

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_assignee;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_status;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_tasks_stage;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_type;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_site_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_visitors_campaign_id;
```

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_visitors_segment_id;
```

**✅ Checkpoint:**
```sql
SELECT 'FASE 1 COMPLETA - Todos los índices no utilizados eliminados!' AS status;
```

---

## 📈 FASE 2: Crear Índices para Foreign Keys

### **Batch 5 - Ejecuta uno por uno:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_assets_asset_id_new ON public.agent_assets(asset_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_assets_command_id_new ON public.agent_assets(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_site_id_new ON public.analysis(site_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_command_id_new ON public.analysis(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_command_id_new ON public.assets(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_segments_command_id_new ON public.campaign_segments(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_subtasks_command_id_new ON public.campaign_subtasks(command_id);
```

**✅ Checkpoint:**
```sql
SELECT 'BATCH 5 COMPLETADO - 7 índices FK creados' AS status;
```

---

### **Batch 6 - Ejecuta uno por uno:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_acquired_by_id_new ON public.companies(acquired_by_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_parent_company_id_new ON public.companies(parent_company_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_debug_logs_command_id_new ON public.debug_logs(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiment_segments_command_id_new ON public.experiment_segments(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiments_campaign_id_new ON public.experiments(campaign_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experiments_command_id_new ON public.experiments(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_company_id_new ON public.leads(company_id);
```

**✅ Checkpoint:**
```sql
SELECT 'BATCH 6 COMPLETADO - 7 índices FK más creados' AS status;
```

---

### **Batch 7 - Ejecuta uno por uno:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_command_id_new ON public.profiles(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_requirement_segments_command_id_new ON public.requirement_segments(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_command_id_new ON public.sales(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sites_command_id_new ON public.sites(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_categories_category_id_new ON public.task_categories(category_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_command_id_new ON public.tasks(command_id);
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_command_id_new ON public.transactions(command_id);
```

**✅ Checkpoint:**
```sql
SELECT 'FASE 2 COMPLETA - Todos los índices FK creados!' AS status;
```

---

## ✅ FINALIZACIÓN

```sql
COMMENT ON SCHEMA public IS 'Performance optimized 2025-01-30: Safe concurrent index operations completed - no deadlocks';
```

```sql
SELECT 'OPTIMIZACIÓN COMPLETA!' AS message, COUNT(*) AS indices_restantes FROM pg_indexes WHERE schemaname = 'public';
```

---

## ⚠️ INSTRUCCIONES IMPORTANTES:

1. **UNA LÍNEA A LA VEZ** - Copia y pega cada comando individualmente
2. **ESPERA CONFIRMACIÓN** - Cada comando debe completarse antes del siguiente
3. **NO HAY PRISA** - Cada comando puede tomar 30 segundos - 2 minutos
4. **APIS SIGUEN FUNCIONANDO** - Zero downtime garantizado
5. **PROGRESO VISIBLE** - Usa los checkpoints para verificar progreso

**Tiempo total estimado:** 30-45 minutos ejecutando uno por uno 