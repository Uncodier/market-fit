# 🚀 Performance Optimization for Supabase

Este conjunto de scripts resuelve las **67 recomendaciones de performance** identificadas por el linter de Supabase:
- **22 foreign keys sin índices** (mejora JOINs)
- **45 índices no utilizados** (mejora escrituras y reduce almacenamiento)

## ✅ Ejecución Segura

Todos los scripts usan `CONCURRENTLY` para:
- **Zero downtime** - Las APIs siguen funcionando
- **No deadlocks** - No bloquean consultas existentes  
- **No transacciones** - Cada comando se ejecuta independientemente

---

## 📋 Orden de Ejecución

### **Fase 1: Eliminar Índices No Utilizados**

Ejecuta estos scripts **EN ORDEN** en el SQL Editor de Supabase:

#### 1️⃣ `01_drop_unused_indexes_batch1.sql`
- Site members, Sales, Requirements, Debug logs
- **~12 índices eliminados**

#### 2️⃣ `02_drop_unused_indexes_batch2.sql`  
- Segments, Agents, Leads, Campaigns, Content
- **~15 índices eliminados**

#### 3️⃣ `03_drop_unused_indexes_batch3.sql`
- Notifications, Conversations, Experiments, KPIs
- **~15 índices eliminados**

#### 4️⃣ `04_drop_unused_indexes_batch4.sql`
- Tasks, Transactions, Visitors (FINAL)
- **~9 índices eliminados**

---

### **Fase 2: Crear Índices para Foreign Keys**

Continúa con estos scripts después de completar la Fase 1:

#### 5️⃣ `05_create_foreign_key_indexes_batch1.sql`
- Agent assets, Analysis, Assets, Campaign segments
- **~7 índices creados**

#### 6️⃣ `06_create_foreign_key_indexes_batch2.sql`
- Companies, Debug logs, Experiments, Leads  
- **~7 índices creados**

#### 7️⃣ `07_create_foreign_key_indexes_batch3.sql`
- Profiles, Sales, Sites, Tasks, Transactions (FINAL)
- **~8 índices creados**

---

### **Fase 3: Finalización**

#### 8️⃣ `08_finalize_optimization.sql`
- Agrega metadatos de la optimización
- Verifica que todo se completó correctamente
- Muestra recomendaciones post-migración

---

## ⏱️ Tiempo Estimado

- **Cada script:** 1-3 minutos
- **Total:** 15-25 minutos
- **Impacto en APIs:** CERO (operaciones concurrentes)

---

## 🎯 Resultados Esperados

Después de ejecutar todos los scripts:

### **Performance Mejorada:**
- ✅ **JOINs más rápidos** - foreign keys indexadas
- ✅ **Escrituras más rápidas** - menos índices innecesarios
- ✅ **Menos almacenamiento** - índices no utilizados eliminados
- ✅ **Queries optimizadas** - mejor plan de ejecución

### **Linter de Supabase:**
- ✅ **0 foreign keys sin índices**
- ✅ **0 índices no utilizados**
- ✅ **Warnings de performance resueltas**

---

## ⚠️ Notas Importantes

1. **Ejecutar EN ORDEN** - no saltes pasos
2. **Verificar cada script** - espera el mensaje de "COMPLETED"
3. **Sin prisa** - cada script puede tomar unos minutos
4. **APIs funcionando** - los usuarios no se verán afectados
5. **Rollback posible** - los índices se pueden recrear si es necesario

---

## 🔍 Monitoreo Post-Migración

Después de completar todos los scripts:

1. **Monitorea logs** de tu aplicación (24-48 horas)
2. **Verifica performance** de queries críticas
3. **Ejecuta ANALYZE** en tablas pesadas si es necesario:
   ```sql
   ANALYZE public.sales;
   ANALYZE public.leads;
   ANALYZE public.campaigns;
   ```
4. **Re-ejecuta linter** de Supabase para confirmar mejoras

---

## 🆘 En Caso de Problemas

- **Si un script falla:** Continúa con el siguiente, el error se reportará
- **Si necesitas rollback:** Los índices eliminados se pueden recrear individualmente
- **Performance issues:** Contacta para análisis específico

---

**¡Preparado para optimizar tu base de datos! 🚀** 