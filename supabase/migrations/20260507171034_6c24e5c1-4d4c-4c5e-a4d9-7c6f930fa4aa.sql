
-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  kitchen_voice text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- handle_new_user trigger to create profile row
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- kitchen_profiles
create table public.kitchen_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  appliances text[] not null default '{}',
  stove_type text,
  default_fat text,
  default_acid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kitchen_profiles enable row level security;
create policy "kp_select_own" on public.kitchen_profiles for select using (auth.uid() = user_id);
create policy "kp_insert_own" on public.kitchen_profiles for insert with check (auth.uid() = user_id);
create policy "kp_update_own" on public.kitchen_profiles for update using (auth.uid() = user_id);
create policy "kp_delete_own" on public.kitchen_profiles for delete using (auth.uid() = user_id);
create trigger kp_updated_at before update on public.kitchen_profiles for each row execute function public.set_updated_at();

-- pantry_items
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  category text not null,
  always_stocked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pantry_items enable row level security;
create policy "pi_select_own" on public.pantry_items for select using (auth.uid() = user_id);
create policy "pi_insert_own" on public.pantry_items for insert with check (auth.uid() = user_id);
create policy "pi_update_own" on public.pantry_items for update using (auth.uid() = user_id);
create policy "pi_delete_own" on public.pantry_items for delete using (auth.uid() = user_id);
create trigger pi_updated_at before update on public.pantry_items for each row execute function public.set_updated_at();

-- people
create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  relationship text,
  dietary_constraints text[] not null default '{}',
  dislikes text[] not null default '{}',
  comfort_food_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.people enable row level security;
create policy "people_select_own" on public.people for select using (auth.uid() = user_id);
create policy "people_insert_own" on public.people for insert with check (auth.uid() = user_id);
create policy "people_update_own" on public.people for update using (auth.uid() = user_id);
create policy "people_delete_own" on public.people for delete using (auth.uid() = user_id);
create trigger people_updated_at before update on public.people for each row execute function public.set_updated_at();

-- fridge_sessions (placeholder)
create table public.fridge_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  photo_urls text[] not null default '{}',
  detected_ingredients jsonb,
  created_at timestamptz not null default now()
);
alter table public.fridge_sessions enable row level security;
create policy "fs_select_own" on public.fridge_sessions for select using (auth.uid() = user_id);
create policy "fs_insert_own" on public.fridge_sessions for insert with check (auth.uid() = user_id);
create policy "fs_update_own" on public.fridge_sessions for update using (auth.uid() = user_id);
create policy "fs_delete_own" on public.fridge_sessions for delete using (auth.uid() = user_id);

-- recipes (placeholder)
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  session_id uuid references public.fridge_sessions on delete set null,
  title text,
  body jsonb,
  cooked_at timestamptz,
  cooked_for uuid[],
  rating integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipes enable row level security;
create policy "rec_select_own" on public.recipes for select using (auth.uid() = user_id);
create policy "rec_insert_own" on public.recipes for insert with check (auth.uid() = user_id);
create policy "rec_update_own" on public.recipes for update using (auth.uid() = user_id);
create policy "rec_delete_own" on public.recipes for delete using (auth.uid() = user_id);
create trigger rec_updated_at before update on public.recipes for each row execute function public.set_updated_at();
