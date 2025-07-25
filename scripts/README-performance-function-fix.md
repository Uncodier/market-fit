# Fix: Error "relation commands does not exist"

## Problema

Estás recibiendo este error en los logs de tu base de datos:

```json
{
  "event_message": "relation \"commands\" does not exist",
  "context": "PL/pgSQL function public.get_performance_status(uuid) line 3 at RETURN QUERY"
}
```

## ¿Qué está pasando?

La función PL/pgSQL `get_performance_status` está intentando consultar la tabla `commands` pero no puede encontrarla. Esto ocurre porque:

1. **Problema de `search_path`**: La función no tiene configurado el `search_path` correcto
2. **Esquema incorrecto**: La función está buscando `commands` sin especificar el esquema `public`
3. **Configuración de seguridad**: Las funciones PL/pgSQL necesitan `search_path` explícito por seguridad

## Solución Rápida

### Paso 1: Diagnóstico
```sql
-- En el SQL Editor de Supabase, ejecuta:
\i scripts/check-performance-function-status.sql
```

### Paso 2: Aplicar Fix (si es necesario)
```sql
-- Solo si el diagnóstico muestra problemas:
\i scripts/fix-get-performance-status-function.sql
```

## Scripts Disponibles

### 🔍 `check-performance-function-status.sql`
- **Uso**: Diagnóstico rápido del problema
- **Qué hace**: Verifica si la función y tabla existen y funcionan
- **Cuándo usar**: Siempre ejecutar primero

### 🛠️ `fix-get-performance-status-function.sql`
- **Uso**: Solución completa del problema
- **Qué hace**: 
  - Recrea la función con `search_path` correcto
  - Añade funciones de soporte (`set_like`, `set_dislike`, `toggle_flag`)
  - Configura permisos apropiados
  - Prueba que todo funcione
- **Cuándo usar**: Solo si el diagnóstico muestra problemas

## ¿Qué hace la función arreglada?

La función `get_performance_status` convierte el campo `performance` (bitmask) en flags individuales:

```sql
-- Entrada: command_id (uuid)
-- Salida: 
{
  "has_like": true/false,     -- Bit 0 (valor 1)
  "has_dislike": true/false,  -- Bit 1 (valor 2) 
  "has_flag": true/false      -- Bit 2 (valor 4)
}
```

## Funciones Relacionadas Incluidas

- `set_like(command_id)` - Marca comando como "liked"
- `set_dislike(command_id)` - Marca comando como "disliked" 
- `toggle_flag(command_id)` - Activa/desactiva flag en comando

## Verificación Post-Fix

Después de aplicar el fix, no deberías ver más estos errores:
- ✅ Error "relation commands does not exist" debe desaparecer
- ✅ Los botones de like/dislike en el chat deben funcionar
- ✅ La funcionalidad de performance rating debe operar normalmente

## ¿Por qué pasó esto?

Este tipo de error es común cuando:

1. **Migraciones incompletas**: Scripts de migración que no configuraron `search_path`
2. **Actualizaciones de seguridad**: PostgreSQL requiere `search_path` explícito en funciones
3. **Cambios en PostgREST**: Diferentes versiones manejan el contexto de esquemas diferente

## Prevención Futura

Para evitar este problema en nuevas funciones:

```sql
-- ✅ CORRECTO: Siempre incluir SET search_path
CREATE OR REPLACE FUNCTION public.mi_funcion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- ← Importante
AS $$
BEGIN
    -- Usar nombres de tabla completamente calificados
    SELECT * FROM public.mi_tabla;
END;
$$;
```

```sql
-- ❌ INCORRECTO: Sin search_path
CREATE OR REPLACE FUNCTION public.mi_funcion()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT * FROM mi_tabla;  -- ← Puede fallar
END;
$$;
``` 