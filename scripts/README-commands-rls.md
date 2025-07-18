# Diagnóstico y Solución de Permisos RLS para Commands

## Problema

Los comandos solo son visibles para el `site_owner`, pero deberían ser visibles para todos los miembros del sitio (`site_members`).

## Scripts Disponibles

### 1. 🔍 `quick-rls-check.sql` - Diagnóstico Rápido

**Uso:** Ejecutar en Supabase SQL Editor para obtener un diagnóstico rápido.

```sql
-- Copia y pega el contenido de scripts/quick-rls-check.sql
```

**Qué hace:**
- ✅ Verifica si RLS está habilitado
- 📊 Cuenta las políticas activas
- 🔍 Identifica el tipo de política actual
- 💡 Proporciona recomendaciones

**Resultado esperado:**
```
🔍 DIAGNOSIS: ⚠️ USER-ONLY POLICY - Only command creators can see their commands
Recommendation: PROBLEM FOUND: Run fix-commands-rls.sql to allow site members access
```

### 2. 🛠️ `fix-commands-rls.sql` - Solución

**Uso:** Ejecutar SOLO si el diagnóstico encuentra el problema.

```sql
-- Copia y pega el contenido de scripts/fix-commands-rls.sql
```

**Qué hace:**
- 🗑️ Elimina políticas conflictivas
- ✨ Crea nueva política optimizada
- 🚀 Añade índices para performance
- ✅ Verifica que el fix funciona

**Política nueva:**
- ✅ Site owners pueden ver comandos de sus sitios
- ✅ Site members activos pueden ver comandos de sus sitios  
- ✅ Usuarios siempre pueden ver sus propios comandos

### 3. 📋 `diagnose-commands-rls.sql` - Diagnóstico Completo

**Uso:** Para análisis detallado (opcional).

**Incluye:**
- 📊 Análisis completo de políticas
- 🧪 Tests de acceso automatizados
- 📝 Reporte detallado del problema
- 💾 Función de verificación

## Pasos para Resolver el Problema

### Paso 1: Diagnóstico
```bash
# 1. Ve a Supabase Dashboard > SQL Editor
# 2. Copia el contenido de scripts/quick-rls-check.sql
# 3. Ejecuta el script
# 4. Revisa los resultados
```

### Paso 2: Aplicar Solución (si es necesario)
```bash
# Solo si el diagnóstico muestra "USER-ONLY POLICY"
# 1. En Supabase Dashboard > SQL Editor  
# 2. Copia el contenido de scripts/fix-commands-rls.sql
# 3. Ejecuta el script
# 4. Verifica que muestra "✅ RLS FIX APPLIED SUCCESSFULLY"
```

### Paso 3: Verificación
```bash
# 1. Prueba con diferentes usuarios en la UI
# 2. Verifica que site_members pueden ver comandos
# 3. Verifica que usuarios externos NO pueden ver comandos
```

## Síntomas del Problema

- ❌ Solo el `site_owner` ve comandos en el panel Commands
- ❌ `site_members` no ven ningún comando
- ❌ El CommandsPanel está vacío para miembros del equipo

## Después del Fix

- ✅ Todos los miembros del sitio ven comandos del sitio
- ✅ Los comandos se muestran correctamente en el UI
- ✅ Performance optimizada con índices
- ✅ Seguridad mantenida (solo miembros autorizados)

## Políticas RLS Resultantes

### Antes (Problema):
```sql
-- Solo el creador puede ver sus comandos
USING (user_id = auth.uid())
```

### Después (Solución):
```sql
-- Miembros del sitio + creador pueden ver comandos
USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = commands.site_id AND (
      s.user_id = auth.uid() OR  -- Site owner
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'  -- Site members
      )
    )
  ) OR 
  commands.user_id = auth.uid()  -- Command creator
)
```

## Soporte

Si después de aplicar el fix el problema persiste:

1. Ejecuta `quick-rls-check.sql` nuevamente
2. Verifica que no hay políticas múltiples
3. Revisa los logs de Supabase
4. Verifica que los usuarios son `site_members` activos

## Archivos Relacionados

- `scripts/quick-rls-check.sql` - Diagnóstico rápido
- `scripts/fix-commands-rls.sql` - Solución
- `scripts/diagnose-commands-rls.sql` - Diagnóstico detallado
- `supabase/RLS_POLICIES_README.md` - Documentación general de RLS 