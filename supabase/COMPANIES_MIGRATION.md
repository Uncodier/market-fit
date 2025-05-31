# Companies Migration Guide

Este documento explica la migración de la información de companies desde el campo `company` embebido en la tabla `leads` hacia una nueva tabla independiente `companies`, incluyendo campos legales y fiscales.

## Objetivo

Crear una colección `companies` separada que permita:
- Gestionar información de empresas de forma centralizada
- Reutilizar companies entre múltiples leads
- Facilitar la búsqueda y filtrado por company
- Almacenar información legal, fiscal y corporativa completa
- Preparar el terreno para funcionalidades futuras como company profiles, company-level insights, etc.

## Migración SQL

### 1. Ejecutar las migraciones

```sql
-- 1. Aplicar la migración base:
-- supabase/migrations/20250120_create_companies_table.sql

-- 2. Aplicar la migración de campos legales:
-- supabase/migrations/20250120_add_legal_fields_to_companies.sql
```

### 2. Estructura completa de la tabla Companies

```sql
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Información básica
  name TEXT NOT NULL,
  legal_name TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  description TEXT,
  
  -- Información corporativa
  industry TEXT CHECK (industry IN (
    'technology', 'finance', 'healthcare', 'education', 'retail', 
    'manufacturing', 'services', 'hospitality', 'media', 'real_estate', 
    'logistics', 'nonprofit', 'other'
  )),
  size TEXT CHECK (size IN (
    '1-10', '11-50', '51-200', '201-500', '501-1000', 
    '1001-5000', '5001-10000', '10001+'
  )),
  employees_count INTEGER,
  annual_revenue TEXT CHECK (annual_revenue IN (
    '<1M', '1M-10M', '10M-50M', '50M-100M', '100M-500M', 
    '500M-1B', '>1B'
  )),
  founded TEXT,
  
  -- Información legal y fiscal
  tax_id TEXT,
  tax_country TEXT,
  registration_number TEXT,
  vat_number TEXT,
  legal_structure TEXT CHECK (legal_structure IN (
    'sole_proprietorship', 'partnership', 'llc', 'corporation', 
    'nonprofit', 'cooperative', 's_corp', 'c_corp', 'lp', 'llp',
    'sa', 'srl', 'gmbh', 'ltd', 'plc', 'bv', 'nv', 'other'
  )),
  
  -- Información de empresa pública
  is_public BOOLEAN DEFAULT false,
  stock_symbol TEXT,
  
  -- Jerarquía corporativa
  parent_company_id UUID REFERENCES public.companies(id),
  
  -- Dirección
  address JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3. Nuevos campos agregados

#### Información Legal
- **legal_name**: Nombre legal oficial de la empresa
- **legal_structure**: Estructura legal (LLC, Corporation, SA, SRL, etc.)
- **registration_number**: Número de registro comercial
- **parent_company_id**: Referencia a empresa matriz (subsidiarias)

#### Información Fiscal
- **tax_id**: Número de identificación fiscal (EIN, RFC, etc.)
- **tax_country**: País de residencia fiscal (código de 2 letras)
- **vat_number**: Número de IVA/GST

#### Información de Contacto
- **email**: Email principal de la empresa
- **phone**: Teléfono principal
- **linkedin_url**: URL del perfil de LinkedIn

#### Información Corporativa Avanzada
- **employees_count**: Número exacto de empleados
- **is_public**: Si la empresa cotiza en bolsa
- **stock_symbol**: Símbolo bursátil

### 4. Características clave

- **Sin RLS**: La tabla companies no tiene Row Level Security habilitado por diseño
- **Normalización**: Evita duplicación de información de companies
- **Flexibilidad**: Permite expandir la información de companies sin afectar leads
- **Compatibilidad**: Mantiene el campo `company` en leads durante la transición
- **Validación**: CHECK constraints para valores válidos
- **Búsqueda optimizada**: Índices para búsquedas por nombre, tax_id, etc.

## Cambios en el Código

### 1. Nuevos archivos creados

- `app/companies/types.ts` - Tipos TypeScript expandidos para Company
- `app/companies/actions.ts` - Acciones CRUD con validación de nuevos campos
- `app/leads/components/CompanySelector.tsx` - Componente para seleccionar/crear companies
- `app/leads/components/CompanyLegalTab.tsx` - **NUEVO** - Tab para información legal y fiscal
- Actualización de `app/leads/components/CompanyTab.tsx` - Uso de tabs organizadas

### 2. Actualizaciones en archivos existentes

- `app/leads/types.ts` - Agregado `company_id` al tipo Lead
- `app/leads/actions.ts` - Soporte para `company_id` en operaciones CRUD
- `app/leads/[id]/page.tsx` - Manejo de la nueva estructura

### 3. Funcionalidades nuevas

- **Búsqueda inteligente**: Buscar companies por nombre o nombre legal
- **Creación automática**: Crear nueva company si no existe
- **Edición en vivo**: Actualizar información directamente desde el lead
- **Tabs organizadas**: Información separada en General, Address, Legal & Tax
- **Validación avanzada**: Validación de URLs, emails, códigos de país
- **Compatibilidad hacia atrás**: Mantiene funcionamiento con company object embebido

## Interface de Usuario

### 1. Tabs de Company Information

La información de la company ahora está organizada en 3 tabs:

1. **General**: Información básica (website, industry, size, revenue, etc.)
2. **Address**: Dirección física de la empresa
3. **Legal & Tax**: Información legal, fiscal y corporativa

### 2. Campos de la Tab Legal & Tax

#### Información Legal
- Legal Name
- Legal Structure (Dropdown con opciones internacionales)

#### Información Fiscal
- Tax ID (EIN, RFC, etc.)
- Tax Country (Código de 2 letras)
- Registration Number
- VAT Number

#### Información de Contacto
- Company Email
- Company Phone
- LinkedIn URL

#### Información Corporativa
- Publicly Traded (Checkbox)
- Stock Symbol (Solo si es pública)
- Exact Employee Count

## Pasos de Implementación

### 1. Ejecutar migraciones en Supabase

```bash
# Aplicar las migraciones
supabase db reset --linked  # O ejecutar los SQLs manualmente
```

### 2. Verificar datos migrados

```sql
-- Verificar que las companies se crearon correctamente
SELECT COUNT(*) FROM companies;

-- Verificar que los leads tienen company_id asignado
SELECT COUNT(*) FROM leads WHERE company_id IS NOT NULL;

-- Verificar relaciones y nuevos campos
SELECT 
  l.name as lead_name,
  l.email,
  c.name as company_name,
  c.legal_name,
  c.tax_id,
  c.legal_structure,
  c.industry
FROM leads l
LEFT JOIN companies c ON l.company_id = c.id
LIMIT 10;
```

### 3. Funciones principales disponibles

#### Companies (actualizadas)
- `getCompanies(search?)` - Busca en name y legal_name
- `getCompanyById(id)` - Obtener company con todos los campos
- `createCompany(input)` - Crear con validación de nuevos campos
- `updateCompany(input)` - Actualizar con validación
- `deleteCompany(id)` - Eliminar company
- `findOrCreateCompany(name)` - Buscar o crear company por nombre
- `getSubsidiaries(parentId)` - **NUEVO** - Obtener subsidiarias

#### Validaciones incluidas
- URLs válidas para website y linkedin_url
- Emails válidos
- Stock symbol requerido si is_public = true
- Tax country debe ser código de 2 letras
- Parent company ID debe ser UUID válido

## Flujo de Usuario Actualizado

### 1. Crear nuevo lead con company

1. Usuario ingresa información del lead
2. Al escribir nombre de company, se buscan companies existentes (name y legal_name)
3. Si existe, se selecciona automáticamente
4. Si no existe, se puede crear nueva company
5. Lead se guarda con `company_id` referenciando la company

### 2. Editar company desde lead

1. Usuario navega a la tab "Company" del lead
2. Puede editar información en 3 tabs organizadas:
   - **General**: Info básica y comercial
   - **Address**: Dirección física
   - **Legal & Tax**: Info legal, fiscal y corporativa
3. Cambios se guardan directamente en la tabla companies
4. Cambios se reflejan inmediatamente en todos los leads de esa company

### 3. Gestión de información legal

1. En la tab "Legal & Tax" se puede agregar:
   - Nombre legal oficial
   - Estructura legal (LLC, SA, etc.)
   - Tax ID, VAT number
   - Si es empresa pública y su símbolo bursátil
   - Información de contacto corporativo

## Migración de Datos Existentes

La migración automáticamente:

1. **Extrae companies únicas** desde `leads.company->>'name'` (corrige manejo de JSON)
2. **Crea registros** en la tabla companies
3. **Actualiza leads** con el `company_id` correspondiente
4. **Mantiene el campo company** para compatibilidad
5. **Agrega nuevos campos** con valores NULL por defecto

## Consideraciones Futuras

### Próximos pasos recomendados

1. **Monitorear la transición** - Asegurar que todos los leads funcionan correctamente
2. **Poblado de datos** - Migrar información adicional del JSON original a nuevos campos
3. **Fase de limpieza** - Después de confirmar estabilidad, remover el campo `company` de leads
4. **Expansión de funcionalidades**:
   - Company profiles dedicados
   - Company-level analytics
   - Bulk operations en companies
   - API de validación de tax IDs
   - Integración con servicios de información corporativa

### Opcional: Remover campo company (futuro)

```sql
-- SOLO ejecutar después de confirmar que todo funciona correctamente
-- ALTER TABLE public.leads DROP COLUMN company;
```

## Troubleshooting

### Problema: Error JSON en migración

```sql
-- El error "invalid input syntax for type json" indica que el campo company es JSONB
-- La migración corregida extrae el name usando company->>'name'
```

### Problema: Leads sin company_id después de migración

```sql
-- Verificar leads que no fueron migrados
SELECT id, name, email, company->>'name' as company_name 
FROM leads 
WHERE company_id IS NULL AND company->>'name' IS NOT NULL;

-- Re-ejecutar migración manual si es necesario
UPDATE leads 
SET company_id = (
  SELECT id FROM companies 
  WHERE companies.name = leads.company->>'name'
)
WHERE company_id IS NULL 
  AND company IS NOT NULL 
  AND company->>'name' IS NOT NULL
  AND company->>'name' != '';
```

### Problema: Validación de nuevos campos

```sql
-- Verificar companies con datos inválidos
SELECT name, email, website, linkedin_url, tax_country 
FROM companies 
WHERE (email IS NOT NULL AND email !~ '^[^@]+@[^@]+\.[^@]+$')
   OR (website IS NOT NULL AND website !~ '^https?://')
   OR (tax_country IS NOT NULL AND LENGTH(tax_country) != 2);
```

La migración está diseñada para ser segura, mantener compatibilidad durante la transición, y proporcionar una base sólida para gestión completa de información corporativa. 