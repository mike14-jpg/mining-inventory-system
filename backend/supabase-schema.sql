-- Run this in the Supabase SQL editor for prototype setup.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('admin', 'worker')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role text;
begin
  resolved_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'worker'));

  if resolved_role not in ('admin', 'worker') then
    resolved_role := 'worker';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, resolved_role)
  on conflict (id) do update
  set
    email = excluded.email,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles for select
      to authenticated
      using (auth.uid() = id);
  end if;
end $$;

create table if not exists public.inventory_items (
  id text primary key,
  name text not null,
  quantity integer not null check (quantity >= 0),
  category text not null check (category in ('Fuel', 'Tools', 'Spare Parts', 'Equipment')),
  date_added timestamptz not null default now()
);

alter table public.inventory_items enable row level security;
alter table public.inventory_items force row level security;

-- Reads the role from JWT metadata (set during sign-up).
create or replace function public.current_user_role()
returns text
language plpgsql
stable
as $$
declare
  profile_role text;
begin
  select lower(p.role)
  into profile_role
  from public.profiles as p
  where p.id = auth.uid();

  if profile_role in ('admin', 'worker') then
    return profile_role;
  end if;

  return coalesce(
    nullif(lower(auth.jwt() -> 'app_metadata' ->> 'role'), ''),
    nullif(lower(auth.jwt() -> 'user_metadata' ->> 'role'), ''),
    'worker'
  );
end;
$$;

do $$
begin
  drop policy if exists inventory_items_select_anon on public.inventory_items;
  drop policy if exists inventory_items_insert_anon on public.inventory_items;
  drop policy if exists inventory_items_update_anon on public.inventory_items;
  drop policy if exists inventory_items_delete_anon on public.inventory_items;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'inventory_items' and policyname = 'inventory_items_select_authenticated'
  ) then
    create policy inventory_items_select_authenticated
      on public.inventory_items for select
      to authenticated
      using (public.current_user_role() in ('admin', 'worker'));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'inventory_items' and policyname = 'inventory_items_insert_admin'
  ) then
    create policy inventory_items_insert_admin
      on public.inventory_items for insert
      to authenticated
      with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'inventory_items' and policyname = 'inventory_items_update_admin'
  ) then
    create policy inventory_items_update_admin
      on public.inventory_items for update
      to authenticated
      using (public.current_user_role() = 'admin')
      with check (public.current_user_role() = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'inventory_items' and policyname = 'inventory_items_delete_admin'
  ) then
    create policy inventory_items_delete_admin
      on public.inventory_items for delete
      to authenticated
      using (public.current_user_role() = 'admin');
  end if;
end $$;

insert into public.inventory_items (id, name, quantity, category, date_added)
values
  ('F001', 'Diesel Fuel', 180, 'Fuel', now()),
  ('T001', 'Hydraulic Wrench', 8, 'Tools', now()),
  ('S001', 'Filter Cartridge', 42, 'Spare Parts', now())
on conflict (id) do nothing;
