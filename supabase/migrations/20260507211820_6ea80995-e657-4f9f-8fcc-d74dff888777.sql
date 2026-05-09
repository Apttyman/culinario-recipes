
CREATE TABLE public.chef_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chef_slug TEXT,
  chef_name TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chef_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chef_select_own" ON public.chef_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chef_insert_own" ON public.chef_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chef_update_own" ON public.chef_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "chef_delete_own" ON public.chef_preferences FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_chef_pref_user ON public.chef_preferences(user_id);

CREATE TABLE public.cuisine_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cuisine_slug TEXT,
  cuisine_name TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cuisine_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cuisine_select_own" ON public.cuisine_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cuisine_insert_own" ON public.cuisine_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cuisine_update_own" ON public.cuisine_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cuisine_delete_own" ON public.cuisine_preferences FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_cuisine_pref_user ON public.cuisine_preferences(user_id);
