-- Add branding column to settings table
-- This stores brand identity information including pyramid structure, colors, typography, voice, and assets

ALTER TABLE public.settings 
ADD COLUMN branding jsonb DEFAULT NULL;

-- Add comment to document the structure
COMMENT ON COLUMN public.settings.branding IS 'Brand identity information including: brand pyramid (essence, personality, benefits, attributes, values, promise), color palette, typography, voice/tone, communication style, brand assets, and guidelines';

-- Create an index for better performance on branding queries
CREATE INDEX idx_settings_branding ON public.settings USING gin (branding);

-- Example of branding structure:
-- {
--   "brand_essence": "Core brand essence - who we are",
--   "brand_personality": "Brand personality traits",
--   "brand_benefits": "Emotional and functional benefits",
--   "brand_attributes": "Product/service features",
--   "brand_values": "Company values",
--   "brand_promise": "Promise to customers",
--   "primary_color": "#000000",
--   "secondary_color": "#666666",
--   "accent_color": "#e0ff17",
--   "success_color": "#22c55e",
--   "warning_color": "#f59e0b",
--   "error_color": "#ef4444",
--   "background_color": "#ffffff",
--   "surface_color": "#f8fafc",
--   "primary_font": "Arial, sans-serif",
--   "secondary_font": "Georgia, serif",
--   "font_size_scale": "medium",
--   "communication_style": "friendly",
--   "personality_traits": ["innovative", "trustworthy"],
--   "forbidden_words": ["cheap", "basic"],
--   "preferred_phrases": ["premium quality", "customer-focused"],
--   "logo_variations": [
--     {
--       "name": "Primary Logo",
--       "url": "https://example.com/logo.png",
--       "usage": "Main brand applications"
--     }
--   ],
--   "do_list": ["Always be transparent"],
--   "dont_list": ["Never compromise on quality"],
--   "emotions_to_evoke": ["trust", "excitement"],
--   "brand_archetype": "hero"
-- } 