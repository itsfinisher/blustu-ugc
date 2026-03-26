-- Drop the recursive admin policies on profiles
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

-- Use a security definer function to check admin role without triggering RLS
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Recreate admin policies using the function (avoids recursion)
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

-- Also fix the campaign_memberships admin policies to use the function
drop policy if exists "Admins can read all memberships" on public.campaign_memberships;
drop policy if exists "Admins can update memberships" on public.campaign_memberships;

create policy "Admins can read all memberships"
  on public.campaign_memberships for select
  using (public.is_admin());

create policy "Admins can update memberships"
  on public.campaign_memberships for update
  using (public.is_admin());
