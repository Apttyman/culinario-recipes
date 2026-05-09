
-- ensure recipes columns
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body jsonb,
  ADD COLUMN IF NOT EXISTS cooked_at timestamptz,
  ADD COLUMN IF NOT EXISTS cooked_for uuid[],
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_rating_range;
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));

-- storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-photos', 'session-photos', false)
ON CONFLICT (id) DO NOTHING;

-- storage policies (drop+recreate for idempotency)
DROP POLICY IF EXISTS "session_photos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "session_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "session_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "session_photos_delete_own" ON storage.objects;

CREATE POLICY "session_photos_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'session-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "session_photos_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'session-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "session_photos_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'session-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "session_photos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'session-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
