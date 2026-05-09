-- taste_portraits
CREATE TABLE public.taste_portraits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  flavor_preferences JSONB NOT NULL DEFAULT '{"loves":[],"dislikes":[],"emerging":[]}'::jsonb,
  technique_preferences JSONB NOT NULL DEFAULT '{"loves":[],"dislikes":[],"emerging":[]}'::jsonb,
  cuisine_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  seasonal_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  people_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  surprise_tolerance INTEGER NOT NULL DEFAULT 25,
  notable_observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  synthesis_count INTEGER NOT NULL DEFAULT 0,
  last_synthesis_at TIMESTAMPTZ,
  next_synthesis_due_after_ratings INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.taste_portraits ENABLE ROW LEVEL SECURITY;

CREATE POLICY tp_select_own ON public.taste_portraits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tp_insert_own ON public.taste_portraits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tp_update_own ON public.taste_portraits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY tp_delete_own ON public.taste_portraits FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER taste_portraits_updated_at
BEFORE UPDATE ON public.taste_portraits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- portrait_corrections
CREATE TABLE public.portrait_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  correction_text TEXT NOT NULL,
  applied_to_field TEXT,
  observation_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portrait_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_select_own ON public.portrait_corrections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pc_insert_own ON public.portrait_corrections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pc_update_own ON public.portrait_corrections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pc_delete_own ON public.portrait_corrections FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX portrait_corrections_user_idx ON public.portrait_corrections(user_id, created_at DESC);

-- additional columns
ALTER TABLE public.fridge_sessions ADD COLUMN IF NOT EXISTS surprise_for_session INTEGER;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_wildcard BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS wildcard_rationale TEXT;

-- update handle_new_user to seed taste_portraits row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.taste_portraits (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$function$;

-- backfill taste_portraits for existing users
INSERT INTO public.taste_portraits (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;