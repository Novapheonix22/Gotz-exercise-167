# Spellcraft setup: prompt for Claude in Chrome

Copy everything below the line into Claude in your browser while the Supabase dashboard is open on the Spellcraft project.

---

Please set up my Supabase project "Spellcraft" for a small private web app. I'm signed in and the project is open in this tab. Do each step, confirm it worked, and tell me if anything fails instead of working around it. Don't change any other settings, and don't show or copy the service_role key or the database password anywhere.

**Step 1: Run the database setup.**
Open **SQL Editor** → **New query**. Paste the SQL below exactly, then click **Run**. It should finish with "Success. No rows returned." If Supabase warns that the query contains destructive operations (because of `drop trigger if exists`), confirm and run it anyway: it only removes that trigger if it already exists so it can be recreated.

```sql
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
```

**Step 2: Check the setup.**
Open **Table Editor** and confirm the tables `profiles`, `card_sets` and `cards` exist and each shows that RLS (row level security) is enabled. Open **Storage** and confirm a private bucket named `card-images` exists.

**Step 3: Make sign-up invite-only.**
Go to **Authentication** → **Sign In / Providers** (on some dashboards: **Authentication → Providers** or **Authentication → Settings**). Turn **off** "Allow new users to sign up". Leave the **Email** provider turned on. Save.

**Step 4: Get the connection details.**
Go to **Project Settings** → **Data API** (or **API**). Tell me:
- the **Project URL** (looks like `https://xxxx.supabase.co`)
- the **anon public** key (a long string; on newer dashboards it may be called the **publishable** key)

Only those two. Do not copy the service_role / secret key.

**Step 5: Report back.**
Summarize what you did, and paste the Project URL and anon key so I can put them into Vercel.

---

# Part 2: Vercel (paste after Part 1 is done)

Open https://vercel.com/new in a tab first, signed in to Vercel. Replace the two placeholders with the values from Part 1, then paste this into Claude in your browser:

---

Please deploy my web app "Spellcraft" on Vercel. I'm signed in and vercel.com/new is open. Tell me if anything fails instead of working around it.

1. Under **Import Git Repository**, import the GitHub repository **Gotz-exercise-167** (if GitHub isn't connected, ask me before connecting it).
2. On the configure screen:
   - **Project Name:** `spellcraft`
   - **Root Directory:** click Edit and choose `web`
   - **Framework Preset:** Vite (leave the build and output settings as detected)
   - **Environment Variables**, add these two:
     - `VITE_SUPABASE_URL` = `PASTE_PROJECT_URL_HERE`
     - `VITE_SUPABASE_ANON_KEY` = `PASTE_ANON_KEY_HERE`
3. Click **Deploy** and wait for it to finish (a couple of minutes). If the build fails, copy the last 30 lines of the build log and tell me.
4. Go to the project's **Settings → Git**, set **Production Branch** to `ios-card-maker-plan`, save, then go to **Deployments** and redeploy the latest `ios-card-maker-plan` deployment to production.
5. Tell me the production address (like `https://spellcraft-xxxx.vercel.app`).

Then in the Supabase tab for the Spellcraft project:

6. **Authentication → URL Configuration**: set **Site URL** to the production address, and add the same address under **Redirect URLs**. Save.
7. **Authentication → Users → Add user → Send invitation** to my email (ask me which email to use).
8. Summarize everything you did and give me the site address.
