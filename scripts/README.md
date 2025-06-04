# Task Type Flexibility Scripts

Este directorio contiene scripts para hacer que el campo `type` de las tareas acepte cualquier string en lugar de estar limitado a valores predefinidos.

## 🗂️ Archivos

### JavaScript Scripts
- `allow-flexible-task-types.js` - Script principal para modificar las validaciones del código
- `revert-task-types.js` - Script para revertir los cambios

### SQL Scripts  
- `remove-task-type-constraint.sql` - **Script PRINCIPAL** para eliminar restricciones CHECK en la BD
- `update-task-type-flexibility.sql` - Script completo de verificación para Supabase
- `simple-task-type-update.sql` - Script simple solo para documentación

## 🚀 Uso CORRECTO

### ⚠️ IMPORTANTE: Orden de ejecución

**Primero ejecuta el script SQL** (para eliminar restricciones de BD), **luego el JavaScript** (para el código):

### 1. **EJECUTAR PRIMERO** - Script SQL en Supabase
```sql
-- Copia y pega el contenido de remove-task-type-constraint.sql en Supabase
-- Este script elimina la restricción CHECK 'tasks_type_check' que causa el error
```

### 2. **EJECUTAR SEGUNDO** - Script JavaScript
```bash
node scripts/allow-flexible-task-types.js
```

### 3. Revertir cambios (si es necesario)
```bash
node scripts/revert-task-types.js
```

## 🐛 Problema identificado

El error `"new row for relation 'tasks' violates check constraint 'tasks_type_check'"` indica que existe una restricción CHECK en la base de datos que limita los valores del campo `type`.

### Causa:
- ✅ **Código**: Las validaciones Zod permiten tipos personalizados (después del script JS)
- ❌ **Base de datos**: Existe restricción CHECK `tasks_type_check` que rechaza valores no predefinidos

### Solución:
1. **Eliminar restricción CHECK** con `remove-task-type-constraint.sql`
2. **Actualizar validaciones del código** con `allow-flexible-task-types.js`

## 📋 Archivos modificados

### Base de datos:
- Elimina restricción `tasks_type_check` 
- Añade comentario documentando flexibilidad

### Código:
- `app/leads/tasks/actions.ts` - Validaciones del servidor
- `app/tasks/types.ts` - Interfaces TypeScript

## ⚠️ Consideraciones importantes

### Antes de ejecutar:
1. **Hacer backup** de tu base de datos
2. **Revisar** que no hay tareas críticas en producción
3. **Probar** en desarrollo primero
4. **Ejecutar scripts en orden correcto** (SQL primero, JS después)

### Después de ejecutar:
1. **Verificar** que las validaciones funcionan correctamente
2. **Probar** la creación de tareas con tipos customizados
3. **Actualizar** componentes de UI que usen tipos hardcodeados

### Archivos que pueden necesitar actualización manual:
- `app/components/create-task-dialog.tsx`
- `app/leads/components/AddTaskDialog.tsx` 
- `app/leads/components/EditTaskDialog.tsx`
- Cualquier componente que use `TASK_TYPES` de forma estricta

## 🔧 Estado actual vs futuro

### Estado actual (restringido):

**Base de datos:**
```sql
-- Restricción CHECK que rechaza valores personalizados
CONSTRAINT tasks_type_check CHECK (type IN ('website_visit', 'demo', 'meeting', ...))
```

**Código:**
```typescript
type: z.enum([
  "website_visit", 
  "demo", 
  "meeting", 
  // ... otros valores predefinidos
])
```

### Estado futuro (flexible):

**Base de datos:**
```sql
-- Sin restricciones CHECK - acepta cualquier string
type TEXT
```

**Código:**
```typescript
type: z.string().min(1, "Type is required")
```

## 🧪 Testing

Para probar que funciona:

1. **Ejecutar ambos scripts** (SQL + JS)
2. **Crear una tarea con tipo personalizado:**
```javascript
await createTask({
  title: "Test Task",
  type: "mi_tipo_personalizado", // ✅ Esto debería funcionar ahora
  // ... otros campos
})
```

3. **Verificar en la base de datos:**
```sql
SELECT type, COUNT(*) FROM tasks GROUP BY type;
```

## 🔄 Rollback

Si necesitas volver atrás:

### Para el código:
```bash
node scripts/revert-task-types.js
```

### Para la base de datos:
```sql
-- Recrear la restricción CHECK (ajusta los valores según necesites)
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_type_check 
CHECK (type IN ('website_visit', 'demo', 'meeting', 'email', 'call', 'quote', 'contract', 'payment', 'referral', 'feedback'));
```

## 📞 Soporte

Si encuentras problemas:

1. **Verifica el orden de ejecución**: SQL primero, JS después
2. **Revisa los logs** de ambos scripts
3. **Verifica que la restricción se eliminó** ejecutando:
   ```sql
   SELECT constraint_name FROM information_schema.table_constraints 
   WHERE table_name = 'tasks' AND constraint_type = 'CHECK';
   ```
4. **Restaura desde backups** si es necesario

## 🎯 Resumen de la solución

El problema era **doble**:
- ❌ Restricción CHECK en BD: `tasks_type_check`
- ❌ Validación enum en código: `z.enum([...])`

La solución es **doble**:
- ✅ Eliminar restricción: `remove-task-type-constraint.sql`
- ✅ Flexibilizar validación: `allow-flexible-task-types.js` 