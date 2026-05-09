
ALTER TABLE public.fridge_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploading',
  ADD COLUMN IF NOT EXISTS clarified_ingredients jsonb,
  ADD COLUMN IF NOT EXISTS modifier text,
  ADD COLUMN IF NOT EXISTS cooked_for uuid[],
  ADD COLUMN IF NOT EXISTS time_budget text;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS position integer,
  ADD COLUMN IF NOT EXISTS chef_inspiration text,
  ADD COLUMN IF NOT EXISTS cuisine text,
  ADD COLUMN IF NOT EXISTS time_estimate_minutes integer,
  ADD COLUMN IF NOT EXISTS difficulty text;

CREATE TABLE IF NOT EXISTS public.recipe_voice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  voice_character text NOT NULL,
  intro_line text,
  success_line text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_voice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY rvl_select_own ON public.recipe_voice_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY rvl_insert_own ON public.recipe_voice_lines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY rvl_update_own ON public.recipe_voice_lines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY rvl_delete_own ON public.recipe_voice_lines FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));

INSERT INTO storage.buckets (id, name, public)
  VALUES ('fridge_photos', 'fridge_photos', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY fp_select_own ON storage.objects FOR SELECT
  USING (bucket_id = 'fridge_photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY fp_insert_own ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fridge_photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY fp_update_own ON storage.objects FOR UPDATE
  USING (bucket_id = 'fridge_photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY fp_delete_own ON storage.objects FOR DELETE
  USING (bucket_id = 'fridge_photos' AND auth.uid()::text = (storage.foldername(name))[1]);
