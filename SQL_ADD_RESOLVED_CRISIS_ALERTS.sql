-- SQL Migration: Add resolved tracking columns to crisis_alerts
-- Run this in your Supabase SQL Editor

ALTER TABLE public.crisis_alerts
ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Index for fast filtering of unresolved vs resolved alerts
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_resolved ON public.crisis_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_resolved_at ON public.crisis_alerts(resolved_at DESC);

-- Update any pre-existing rows to explicitly set resolved = false
UPDATE public.crisis_alerts SET resolved = FALSE WHERE resolved IS NULL;
