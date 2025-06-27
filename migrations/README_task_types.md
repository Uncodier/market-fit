# Actualización de Tipos de Tareas

Este directorio contiene el script SQL para actualizar los tipos de tareas en Supabase.

## 🎯 Propósito

Agregar nuevos tipos de tareas al sistema sin romper la funcionalidad existente.

## 📋 Nuevos Tipos Agregados

- **trial**: Trial
- **onboarding**: Onboarding  
- **refund**: Refund
- **ticket**: Support Ticket
- **kyc**: KYC/Verification
- **training**: Training
- **consultation**: Consultation
- **follow_up**: Follow Up
- **survey**: Survey
- **review**: Review
- **support**: Support
- **billing**: Billing
- **documentation**: Documentation
- **integration**: Integration

## 🚀 Cómo usar el script

### 1. Conectar a Supabase

```bash
# En tu proyecto Supabase SQL Editor, o usando psql:
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

### 2. Ejecutar el script paso a paso

**IMPORTANTE**: No ejecutes todo el script de una vez. Hazlo sección por sección:

#### Paso 1: Verificar tipos actuales
```sql
-- Copia y pega solo esta parte:
SELECT 
  type,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM tasks 
WHERE type IS NOT NULL
GROUP BY type 
ORDER BY count DESC;
```

#### Paso 2: Buscar tipos inválidos
```sql
-- Verifica si hay tipos que necesitan corrección:
SELECT 
  id,
  title,
  type,
  created_at
FROM tasks 
WHERE type NOT IN (
  'website_visit', 'demo', 'meeting', 'email', 'call', 'quote', 'contract', 
  'payment', 'referral', 'feedback', 'trial', 'onboarding', 'refund', 
  'ticket', 'kyc', 'training', 'consultation', 'follow_up', 'survey', 
  'review', 'support', 'billing', 'documentation', 'integration'
)
ORDER BY created_at DESC;
```

#### Paso 3: Actualizar registros (solo si es necesario)
```sql
-- Solo ejecuta si encontraste tipos inválidos en el paso anterior
-- Ejemplos (descomenta y modifica según necesites):

-- UPDATE tasks SET type = 'support' WHERE type = 'soporte';
-- UPDATE tasks SET type = 'billing' WHERE type = 'facturacion';
-- UPDATE tasks SET type = 'follow_up' WHERE type IN ('followup', 'follow-up');
```

#### Paso 4: Crear función helper (opcional)
```sql
-- Crea una función para validar tipos:
CREATE OR REPLACE FUNCTION is_valid_task_type(task_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN task_type IN (
    'website_visit', 'demo', 'meeting', 'email', 'call', 'quote', 'contract',
    'payment', 'referral', 'feedback', 'trial', 'onboarding', 'refund',
    'ticket', 'kyc', 'training', 'consultation', 'follow_up', 'survey',
    'review', 'support', 'billing', 'documentation', 'integration'
  );
END;
$$ LANGUAGE plpgsql;
```

#### Paso 5: Agregar constraint (opcional pero recomendado)
```sql
-- SOLO ejecuta esto después de verificar que todos los tipos son válidos:
ALTER TABLE tasks 
ADD CONSTRAINT valid_task_types 
CHECK (type IN (
  'website_visit', 'demo', 'meeting', 'email', 'call', 'quote', 'contract',
  'payment', 'referral', 'feedback', 'trial', 'onboarding', 'refund', 
  'ticket', 'kyc', 'training', 'consultation', 'follow_up', 'survey',
  'review', 'support', 'billing', 'documentation', 'integration'
));
```

## ✅ Verificación Final

Después de ejecutar el script, verifica que todo funcione:

```sql
-- Verificar todos los tipos:
SELECT type, COUNT(*) as count
FROM tasks 
GROUP BY type 
ORDER BY type;

-- Verificar con la función helper:
SELECT id, title, type 
FROM tasks 
WHERE NOT is_valid_task_type(type);
```

## 🔧 Código actualizado

Los siguientes archivos ya han sido actualizados en el código:

- ✅ `app/leads/types.ts` - Interfaces y constantes
- ✅ `app/components/create-task-dialog.tsx` - Modal de creación
- ✅ `app/leads/tasks/actions.ts` - Validación Zod y tipos TypeScript

## ⚠️ Notas importantes

1. **Backup**: Siempre haz un backup antes de ejecutar scripts de actualización
2. **Staging primero**: Prueba en tu ambiente de staging antes de producción
3. **Validación**: Los nuevos tipos ya están disponibles en la UI, pero la DB puede tener datos antiguos
4. **Constraint**: El constraint final es opcional pero recomendado para mantener integridad de datos

## 🆘 Rollback

Si necesitas revertir cambios:

```sql
-- Remover constraint:
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_task_types;

-- Remover función:
DROP FUNCTION IF EXISTS is_valid_task_type(TEXT);
``` 