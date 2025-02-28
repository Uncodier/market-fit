-- Drop existing types if they exist
DROP TYPE IF EXISTS segment_language CASCADE;
DROP TYPE IF EXISTS segment_audience CASCADE;

-- Create enum type for languages
CREATE TYPE segment_language AS ENUM (
  'en',  -- English
  'zh',  -- Chinese (Mandarin)
  'hi',  -- Hindi
  'es',  -- Spanish
  'ar',  -- Arabic
  'bn',  -- Bengali
  'pt',  -- Portuguese
  'ru',  -- Russian
  'ja',  -- Japanese
  'de',  -- German
  'fr',  -- French
  'ur',  -- Urdu
  'id',  -- Indonesian
  'tr',  -- Turkish
  'it',  -- Italian
  'th',  -- Thai
  'vi',  -- Vietnamese
  'ko',  -- Korean
  'fa',  -- Persian
  'pl',  -- Polish
  'uk',  -- Ukrainian
  'ro',  -- Romanian
  'nl',  -- Dutch
  'el',  -- Greek
  'cs',  -- Czech
  'sv',  -- Swedish
  'hu',  -- Hungarian
  'da',  -- Danish
  'fi',  -- Finnish
  'no'   -- Norwegian
);

-- Create enum type for business audiences
CREATE TYPE segment_audience AS ENUM (
  'enterprise',          -- Large enterprises and corporations
  'smb',                -- Small and medium businesses
  'startup',            -- Startups and early-stage companies
  'b2b_saas',           -- B2B Software as a Service
  'e_commerce',         -- E-commerce businesses
  'tech',               -- Technology companies
  'finance',            -- Financial services
  'healthcare',         -- Healthcare and medical
  'education',          -- Educational institutions
  'manufacturing',      -- Manufacturing and industrial
  'retail',            -- Retail businesses
  'real_estate',       -- Real estate and property
  'hospitality',       -- Hotels, restaurants, tourism
  'automotive',        -- Automotive industry
  'media',             -- Media and entertainment
  'telecom',           -- Telecommunications
  'energy',            -- Energy and utilities
  'agriculture',       -- Agriculture and farming
  'construction',      -- Construction and engineering
  'logistics',         -- Logistics and transportation
  'professional',      -- Professional services
  'government',        -- Government and public sector
  'nonprofit',         -- Non-profit organizations
  'legal',             -- Legal services
  'pharma',            -- Pharmaceutical
  'insurance',         -- Insurance services
  'consulting',        -- Consulting services
  'research',          -- Research institutions
  'aerospace',         -- Aerospace and defense
  'gaming'             -- Gaming industry
);

-- Drop existing columns if they exist
ALTER TABLE segments 
DROP COLUMN IF EXISTS language;

-- Add language column to segments table with default value
ALTER TABLE segments 
ADD COLUMN language segment_language NOT NULL DEFAULT 'en';

-- Add audience column with enum type
ALTER TABLE segments
ALTER COLUMN audience TYPE segment_audience USING audience::segment_audience;

-- Add check constraints
ALTER TABLE segments
DROP CONSTRAINT IF EXISTS segments_language_check;

ALTER TABLE segments
ADD CONSTRAINT segments_language_check 
CHECK (language IN (
  'en', 'zh', 'hi', 'es', 'ar', 'bn', 'pt', 'ru', 'ja', 'de',
  'fr', 'ur', 'id', 'tr', 'it', 'th', 'vi', 'ko', 'fa', 'pl',
  'uk', 'ro', 'nl', 'el', 'cs', 'sv', 'hu', 'da', 'fi', 'no'
));

ALTER TABLE segments
DROP CONSTRAINT IF EXISTS segments_audience_check;

ALTER TABLE segments
ADD CONSTRAINT segments_audience_check 
CHECK (audience IN (
  'enterprise', 'smb', 'startup', 'b2b_saas', 'e_commerce',
  'tech', 'finance', 'healthcare', 'education', 'manufacturing',
  'retail', 'real_estate', 'hospitality', 'automotive', 'media',
  'telecom', 'energy', 'agriculture', 'construction', 'logistics',
  'professional', 'government', 'nonprofit', 'legal', 'pharma',
  'insurance', 'consulting', 'research', 'aerospace', 'gaming'
));

-- Update existing rows to have default values
UPDATE segments SET language = 'en' WHERE language IS NULL;
UPDATE segments SET audience = 'tech' WHERE audience IS NULL;

-- Add comments to document the columns
COMMENT ON COLUMN segments.language IS 'The primary language of the segment content and targeting';
COMMENT ON COLUMN segments.audience IS 'The primary business audience type for the segment';

-- Add language and audience constraints
ALTER TABLE segments
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE segments
DROP CONSTRAINT IF EXISTS segments_language_check;

ALTER TABLE segments
ADD CONSTRAINT segments_language_check 
CHECK (language IN (
  'en', 'zh', 'hi', 'es', 'ar', 'bn', 'pt', 'ru', 'ja', 'de',
  'fr', 'ur', 'id', 'tr', 'it', 'th', 'vi', 'ko', 'fa', 'pl',
  'uk', 'ro', 'nl', 'el', 'cs', 'sv', 'hu', 'da', 'fi', 'no'
));

ALTER TABLE segments
DROP CONSTRAINT IF EXISTS segments_audience_check;

ALTER TABLE segments
ADD CONSTRAINT segments_audience_check 
CHECK (audience IN (
  'enterprise', 'smb', 'startup', 'b2b_saas', 'e_commerce',
  'tech', 'finance', 'healthcare', 'education', 'manufacturing',
  'retail', 'real_estate', 'hospitality', 'automotive', 'media',
  'telecom', 'energy', 'agriculture', 'construction', 'logistics',
  'professional', 'government', 'nonprofit', 'legal', 'pharma',
  'insurance', 'consulting', 'research', 'aerospace', 'gaming'
)); 