-- Spellcraft: initial schema.
-- Run once in the Supabase SQL editor (or with the Supabase CLI).
-- Every table uses row level security so people only ever see their own data.

-- Profiles: one row per account, created automatically on sign-up/invite.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  accepted_disclaimer_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Custom sets (code, name, symbol) and cards. Card contents are stored as JSON
-- so the card format can grow without database changes.
create table if not exists public.card_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null,
  name text not null default '',
  symbol_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id uuid references public.card_sets (id) on delete set null,
  name text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_owner_idx on public.cards (owner_id, updated_at desc);
create index if not exists card_sets_owner_idx on public.card_sets (owner_id);

alter table public.card_sets enable row level security;
alter table public.cards enable row level security;

create policy "Own sets" on public.card_sets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Own cards" on public.cards
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Private storage for uploaded art and set symbols. Files live under a folder
-- named after the owner's user id: <user id>/<file>.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;

create policy "Read own images" on storage.objects
  for select using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Upload own images" on storage.objects
  for insert with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Update own images" on storage.objects
  for update using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Delete own images" on storage.objects
  for delete using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
