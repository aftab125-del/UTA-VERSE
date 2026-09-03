create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public read: any visitor (authenticated or anonymous) can see display names and
-- avatars across the app — this is simpler than per-user visibility and matches the
-- expected product behaviour (usernames are not private).
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

-- Owner write: only the profile owner can update their own row.
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Owner insert: the owner can also insert their own profile row (used by the
-- on-signup trigger, which runs with definer rights, but this covers edge cases
-- where client code might insert directly).
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Automatically create a profiles row when a new auth.users row is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
