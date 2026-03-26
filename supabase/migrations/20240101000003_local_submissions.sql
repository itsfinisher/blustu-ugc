-- Local submissions table - admin approves before forwarding to MediaMaxxing
create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  campaign_id text not null,
  content_url text not null,
  platform text,
  external_username text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'forwarded')),
  admin_notes text,
  mediamaxxing_id text,
  views integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.submissions enable row level security;

-- Users can read their own submissions
create policy "Users can read own submissions"
  on public.submissions for select
  using (auth.uid() = user_id);

-- Users can insert their own submissions
create policy "Users can insert own submissions"
  on public.submissions for insert
  with check (auth.uid() = user_id);

-- Admins can read all submissions
create policy "Admins can read all submissions"
  on public.submissions for select
  using (public.is_admin());

-- Admins can update any submission
create policy "Admins can update submissions"
  on public.submissions for update
  using (public.is_admin());

-- Approved campaign members can see submissions for campaigns they're in
create policy "Members can see campaign submissions"
  on public.submissions for select
  using (
    exists (
      select 1 from public.campaign_memberships
      where campaign_memberships.user_id = auth.uid()
        and campaign_memberships.campaign_id = submissions.campaign_id
        and campaign_memberships.status = 'approved'
    )
  );
