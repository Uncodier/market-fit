-- Fix KPI type constraint to make it a text field instead of enum
-- This allows for custom KPI types without limitations

-- First, drop the existing constraint
ALTER TABLE public.kpis DROP CONSTRAINT IF EXISTS kpis_type_check;

-- Then recreate it to accept any text value
ALTER TABLE public.kpis 
  ADD CONSTRAINT kpis_type_check CHECK (type IS NOT NULL);

-- Update related documentation
COMMENT ON COLUMN public.kpis.type IS 'KPI type (free text field, examples: conversion, engagement, traffic, revenue, growth, custom, segments, etc)'; 