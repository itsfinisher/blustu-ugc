-- Add approval status and role to profiles
alter table public.profiles
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists role text not null default 'creator'
    check (role in ('creator', 'admin')),
  add column if not exists content_links text[] default '{}',
  add column if not exists bio text;

-- Campaign memberships (creator applies to join a campaign)
create table if not exists public.campaign_memberships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  campaign_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, campaign_id)
);

alter table public.campaign_memberships enable row level security;

-- Users can see their own memberships
create policy "Users can read own memberships"
  on public.campaign_memberships for select
  using (auth.uid() = user_id);

-- Users can insert their own membership requests
create policy "Users can insert own memberships"
  on public.campaign_memberships for insert
  with check (auth.uid() = user_id);

-- Admins can read all memberships
create policy "Admins can read all memberships"
  on public.campaign_memberships for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update any membership
create policy "Admins can update memberships"
  on public.campaign_memberships for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Linked UGC accounts
create table if not exists public.linked_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  platform text not null check (platform in ('tiktok', 'instagram', 'youtube')),
  username text not null,
  url text not null,
  created_at timestamptz default now() not null,
  unique (user_id, platform)
);

alter table public.linked_accounts enable row level security;

create policy "Users can read own linked accounts"
  on public.linked_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own linked accounts"
  on public.linked_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own linked accounts"
  on public.linked_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own linked accounts"
  on public.linked_accounts for delete
  using (auth.uid() = user_id);

-- Update profiles RLS: admins can read all profiles
create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update any profile (for approving creators)
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
