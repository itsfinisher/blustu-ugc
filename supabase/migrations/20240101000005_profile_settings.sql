-- Add profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Allow multiple accounts per platform (e.g. 2 TikTok accounts)
-- Drop the old unique constraint and replace with (user_id, platform, username)
ALTER TABLE public.linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_user_id_platform_key;
ALTER TABLE public.linked_accounts ADD CONSTRAINT linked_accounts_user_platform_username_key UNIQUE (user_id, platform, username);

-- Storage bucket for avatars (run manually in Supabase dashboard if this fails)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- Allow users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
