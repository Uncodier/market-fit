-- Update Task Types in Supabase Database
-- Este script actualiza los tipos de tareas para incluir los nuevos tipos agregados

-- =============================================================================
-- 1. VERIFICAR TIPOS ACTUALES
-- =============================================================================

-- Mostrar todos los tipos de tareas existentes
SELECT 
  type,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM tasks 
WHERE type IS NOT NULL
GROUP BY type 
ORDER BY count DESC;

-- =============================================================================
-- 2. DOCUMENTAR TIPOS VÁLIDOS
-- =============================================================================

-- Los siguientes son todos los tipos de tareas válidos después de la actualización:
/*
TIPOS ORIGINALES:
- website_visit: Website Visit
- demo: Product Demo  
- meeting: Meeting
- email: Email
- call: Call
- quote: Quote
- contract: Contract
- payment: Payment
- referral: Referral
- feedback: Feedback

NUEVOS TIPOS AGREGADOS:
- trial: Trial
- onboarding: Onboarding
- refund: Refund
- ticket: Support Ticket
- kyc: KYC/Verification
- training: Training
- consultation: Consultation
- follow_up: Follow Up
- survey: Survey
- review: Review
- support: Support
- billing: Billing
- documentation: Documentation
- integration: Integration
*/

-- =============================================================================
-- 3. VERIFICAR DATOS INCONSISTENTES
-- =============================================================================

-- Buscar tareas con tipos que no están en la lista válida
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

-- =============================================================================
-- 4. ACTUALIZAR REGISTROS SI ES NECESARIO
-- =============================================================================

-- Si encuentras tipos incorrectos, puedes usar estos comandos para actualizarlos:

-- Ejemplo: Actualizar 'soporte' a 'support'
-- UPDATE tasks SET type = 'support' WHERE type = 'soporte';

-- Ejemplo: Actualizar 'facturacion' a 'billing'  
-- UPDATE tasks SET type = 'billing' WHERE type = 'facturacion';

-- Ejemplo: Actualizar 'entrenamiento' a 'training'
-- UPDATE tasks SET type = 'training' WHERE type = 'entrenamiento';

-- Ejemplo: Actualizar tipos que pueden tener variaciones
-- UPDATE tasks SET type = 'follow_up' WHERE type IN ('followup', 'follow-up', 'seguimiento');
-- UPDATE tasks SET type = 'onboarding' WHERE type IN ('on-boarding', 'on_boarding');

-- =============================================================================
-- 5. VERIFICAR DESPUÉS DE ACTUALIZAR
-- =============================================================================

-- Ejecutar nuevamente para verificar que todo está correcto
SELECT 
  type,
  COUNT(*) as count
FROM tasks 
GROUP BY type 
ORDER BY type;

-- =============================================================================
-- 6. CREAR FUNCIÓN HELPER (OPCIONAL)
-- =============================================================================

-- Función para validar si un tipo de tarea es válido
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

-- Ejemplo de uso de la función:
-- SELECT id, title, type FROM tasks WHERE NOT is_valid_task_type(type);

-- =============================================================================
-- 7. AGREGAR CONSTRAINT OPCIONAL (RECOMENDADO)
-- =============================================================================

-- Si quieres agregar una constraint para validar tipos en la base de datos:
/*
ALTER TABLE tasks 
ADD CONSTRAINT valid_task_types 
CHECK (type IN (
  'website_visit', 'demo', 'meeting', 'email', 'call', 'quote', 'contract',
  'payment', 'referral', 'feedback', 'trial', 'onboarding', 'refund', 
  'ticket', 'kyc', 'training', 'consultation', 'follow_up', 'survey',
  'review', 'support', 'billing', 'documentation', 'integration'
));
*/

-- NOTA: Solo ejecuta el ALTER TABLE de arriba si estás seguro de que todos 
-- los registros existentes tienen tipos válidos.

-- =============================================================================
-- 8. LIMPIAR (OPCIONAL)
-- =============================================================================

-- Si quieres remover la función helper después:
-- DROP FUNCTION IF EXISTS is_valid_task_type(TEXT); 