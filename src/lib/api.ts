import { createClient } from "./supabase-browser";

const supabase = createClient();

async function invoke<T>(fnName: string, options?: { body?: unknown; params?: Record<string, string> }): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fnName}`);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: options?.body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[api] error response:", data);
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ─── Campaign Types ───
export interface Campaign {
  id: string;
  title: string;
  description: string;
  payout_rpm_usd: number;
  partner_rpm_usd: number | null;
  allowed_platforms: string[];
  min_payout_usd: number;
  max_payout_usd: number;
  status: string;
  ends_at: string | null;
  submission_expiration_days: number;
  eligible_countries: string[];
  is_elite_only: boolean;
  has_blueprint: boolean;
  example_video_urls: string[];
  tutorial_video_url: string | null;
  links: string[];
}

export interface Submission {
  id: string;
  campaign_id: string;
  content_url: string;
  platform: string;
  external_id: string;
  status: "pending" | "approved" | "rejected" | "forwarded";
  views: number | null;
  likes: number | null;
  comments: number | null;
  external_username: string;
  created_at: string;
  tracked_at: string | null;
}

// ─── Campaign Overrides (local BluStu presentation layer) ───
export interface CampaignOverride {
  campaign_id: string;
  banner_image_url: string | null;
  logo_url: string | null;
  updated_at?: string;
}

export type EnrichedCampaign = Campaign & {
  banner_image_url: string | null;
  logo_url: string | null;
};

/** Merge MM campaign data with local BluStu overrides. */
export function enrichCampaigns(campaigns: Campaign[], overrides: CampaignOverride[]): EnrichedCampaign[] {
  const map = new Map<string, CampaignOverride>();
  overrides.forEach((o) => map.set(o.campaign_id, o));
  return campaigns.map((c) => {
    const o = map.get(c.id);
    return { ...c, banner_image_url: o?.banner_image_url || null, logo_url: o?.logo_url || null };
  });
}

// ─── API Calls ───
export async function getCampaigns(): Promise<Campaign[]> {
  const res = await invoke<{ data: Campaign[] }>("get-campaigns");
  return res.data;
}

export async function submitContent(campaign_id: string, content_url: string, external_username: string) {
  return invoke<{ data: Submission }>("submit-content", {
    body: { campaign_id, content_url, external_username },
  });
}

export async function getSubmissions(
  external_username: string,
  opts?: { campaign_id?: string; status?: string; limit?: number; offset?: number }
): Promise<{ data: Submission[]; pagination: { total: number; limit: number; offset: number } }> {
  const params: Record<string, string> = { external_username };
  if (opts?.campaign_id) params.campaign_id = opts.campaign_id;
  if (opts?.status) params.status = opts.status;
  if (opts?.limit) params.limit = String(opts.limit);
  if (opts?.offset) params.offset = String(opts.offset);

  return invoke("get-submissions", { params });
}
