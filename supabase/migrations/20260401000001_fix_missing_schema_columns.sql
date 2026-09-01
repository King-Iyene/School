/*
  # Fix Missing Schema Columns from Legacy Environment
  
  ## Summary
  The frontend explicitly queries `class_id` on `sections` and `payment_method`
  on `fees_collections`. These columns were manually injected into the legacy
  dashboard by the previous developer but never correctly tracked in the 
  migration scripts. This restores them cleanly.
*/

ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.fees_collections ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';

-- Force a PostgREST schema cache reload to instantly expose these newly hot-patched columns
NOTIFY pgrst, 'reload schema';
