-- Campaign overrides: local BluStu presentation layer for MM campaigns
CREATE TABLE IF NOT EXISTS public.campaign_overrides (
  campaign_id TEXT PRIMARY KEY,
  banner_image_url TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.campaign_overrides ENABLE ROW LEVEL SECURITY;

-- Everyone can read (needed for campaign cards on all pages)
CREATE POLICY "Anyone can read campaign overrides"
  ON public.campaign_overrides FOR SELECT
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert campaign overrides"
  ON public.campaign_overrides FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update campaign overrides"
  ON public.campaign_overrides FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete campaign overrides"
  ON public.campaign_overrides FOR DELETE
  USING (public.is_admin());
