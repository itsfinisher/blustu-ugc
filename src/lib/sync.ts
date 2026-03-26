import { getSubmissions } from "./api";

export interface LocalSubmission {
  id: string;
  user_id: string;
  campaign_id: string;
  content_url: string;
  platform: string | null;
  external_username: string;
  status: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  mediamaxxing_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { username: string };
}

/**
 * Sync engagement metrics (views, likes, comments) from MediaMaxxing
 * for submissions that already exist locally.
 *
 * IMPORTANT: This function NEVER creates new local records from MM data.
 * BluStu is the source of truth for submissions — only submissions created
 * on BluStu and approved by admin get forwarded to MM. The sync only pulls
 * updated metrics back for those approved+linked records.
 */
export async function syncUserSubmissions(
  supabase: any,
  userId: string,
  username: string
): Promise<void> {
  let mmSubmissions;
  try {
    const res = await getSubmissions(username, { limit: 200 });
    mmSubmissions = res.data;
  } catch {
    return; // MM API unavailable
  }
  if (!mmSubmissions?.length) return;

  // Load ALL local records (including soft-deleted) so we never re-import them
  const { data: localSubs } = await supabase
    .from("submissions")
    .select("id, content_url, campaign_id, mediamaxxing_id")
    .eq("user_id", userId);

  const byMmId = new Map<string, { id: string }>();
  const byUrlCampaign = new Map<string, { id: string }>();
  for (const s of localSubs || []) {
    if (s.mediamaxxing_id) byMmId.set(s.mediamaxxing_id, s);
    byUrlCampaign.set(`${s.content_url}|${s.campaign_id}`, s);
  }

  for (const mm of mmSubmissions) {
    const existing =
      byMmId.get(mm.id) ||
      byUrlCampaign.get(`${mm.content_url}|${mm.campaign_id}`);

    if (existing) {
      // Update engagement metrics only. Never change status — admin decides that.
      // Try full update with likes/comments; if columns don't exist yet, fall back to core fields.
      const coreFields = {
        views: mm.views ?? 0,
        mediamaxxing_id: mm.id,
        platform: mm.platform || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("submissions")
        .update({ ...coreFields, likes: mm.likes ?? 0, comments: mm.comments ?? 0 })
        .eq("id", existing.id);
      if (error) {
        // Fallback: update without likes/comments (columns may not exist yet)
        await supabase.from("submissions").update(coreFields).eq("id", existing.id);
      }
    }
    // No else branch — if a MM submission has no local record, we skip it.
    // Submissions must originate on BluStu. MM is not the authority.
  }
}

/**
 * Admin: sync engagement metrics for ALL users from MediaMaxxing.
 */
export async function syncAllSubmissions(supabase: any): Promise<void> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username");
  if (!profiles?.length) return;

  for (const p of profiles) {
    if (!p.username) continue;
    await syncUserSubmissions(supabase, p.id, p.username);
  }
}
