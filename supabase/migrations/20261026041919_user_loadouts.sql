-- Private per-user equipment and named loadouts. Only public client keys belong
-- in the static frontend; database access is enforced by these policies.
begin;

create table public.loadout_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  equipment jsonb not null default '{"CT":{},"T":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint equipment_is_object check (jsonb_typeof(equipment) = 'object')
);

create table public.loadout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  team text not null check (team in ('CT', 'T')),
  equipment jsonb not null check (jsonb_typeof(equipment) = 'object'),
  created_at timestamptz not null default now()
);
create index loadout_sets_owner_created on public.loadout_sets (user_id, created_at desc);

alter table public.loadout_profiles enable row level security;
alter table public.loadout_sets enable row level security;

revoke all on public.loadout_profiles, public.loadout_sets from anon;
grant select, insert, update, delete on public.loadout_profiles, public.loadout_sets to authenticated;

create policy "Read own equipment" on public.loadout_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own equipment" on public.loadout_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own equipment" on public.loadout_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own equipment" on public.loadout_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Read own sets" on public.loadout_sets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own sets" on public.loadout_sets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own sets" on public.loadout_sets for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own sets" on public.loadout_sets for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
