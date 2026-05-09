CREATE TABLE IF NOT EXISTS public.preference_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id integer UNIQUE NOT NULL,
  axis text NOT NULL,
  category_scope text,
  question text NOT NULL,
  option_a_label text NOT NULL,
  option_b_label text NOT NULL,
  option_a_signal text NOT NULL,
  option_b_signal text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preference_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pq_select_authenticated ON public.preference_questions
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.preference_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  axis text,
  signal_text text NOT NULL,
  signal_weight real NOT NULL DEFAULT 1.0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preference_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_select_own ON public.preference_signals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ps_insert_own ON public.preference_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_preference_signals_user_created
  ON public.preference_signals (user_id, created_at DESC);