"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { getCampaigns, enrichCampaigns, type EnrichedCampaign, type CampaignOverride } from "@/lib/api";
import { syncUserSubmissions, type LocalSubmission } from "@/lib/sync";
import { relativeTime, statusStyle, cn, daysRemaining, extractThumbnail, compactNumber } from "@/lib/utils";
import { PlatformIcon, platformColor } from "@/components/PlatformIcons";
import { toast } from "sonner";

type Tab = "overview" | "submissions" | "submit";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [campaign, setCampaign] = useState<EnrichedCampaign | null>(null);
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [mySubmissions, setMySubmissions] = useState<LocalSubmission[]>([]);
  const [membership, setMembership] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const [contentUrl, setContentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadSubmissions(uid: string) {
    const { data: allSubs } = await supabase
      .from("submissions")
      .select("*, profiles(username)")
      .eq("campaign_id", id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    setSubmissions(allSubs || []);

    const { data: mySubs } = await supabase
      .from("submissions")
      .select("*")
      .eq("campaign_id", id)
      .eq("user_id", uid)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    setMySubmissions(mySubs || []);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("username").eq("id", user.id).single();
      const uname = profile?.username || "creator";
      setUsername(uname);

      const { data: mem } = await supabase
        .from("campaign_memberships")
        .select("status")
        .eq("user_id", user.id)
        .eq("campaign_id", id)
        .single();
      setMembership(mem?.status || null);

      try {
        const [camps, overridesRes] = await Promise.all([
          getCampaigns(),
          supabase.from("campaign_overrides").select("*"),
        ]);
        const enriched = enrichCampaigns(camps, (overridesRes.data || []) as CampaignOverride[]);
        setCampaign(enriched.find((c) => c.id === id) || null);
      } catch (err) {
        console.error("Failed to load campaign:", err);
      }

      await loadSubmissions(user.id);
      setLoading(false);

      // Sync from MediaMaxxing in background, then refresh submissions
      syncUserSubmissions(supabase, user.id, uname).then(() => loadSubmissions(user.id));
    }
    load();
  }, [supabase, id]);

  const handleApply = async () => {
    setApplying(true);
    const { error } = await supabase.from("campaign_memberships").insert({
      user_id: userId, campaign_id: id, status: "pending",
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already applied" : error.message);
    } else {
      setMembership("pending");
      toast.success("Application submitted!");
    }
    setApplying(false);
  };

  const handleDelete = async (subId: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", subId);
    if (error) {
      toast.error(error.message || "Delete failed");
      return;
    }
    setMySubmissions((prev) => prev.filter((s) => s.id !== subId));
    setSubmissions((prev) => prev.filter((s) => s.id !== subId));
    toast.success("Submission deleted");
    setDeletingId(null);
  };

  const detectPlatform = (url: string): string | null => {
    if (url.includes("tiktok.com")) return "tiktok";
    if (url.includes("instagram.com")) return "instagram";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    return null;
  };

  const handleSubmit = async () => {
    if (!contentUrl.trim()) return;
    setSubmitting(true);
    try {
      const platform = detectPlatform(contentUrl.trim());
      const { error } = await supabase.from("submissions").insert({
        user_id: userId,
        campaign_id: id,
        content_url: contentUrl.trim(),
        platform,
        external_username: username,
        status: "pending",
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Content submitted! Pending admin review.");
        setContentUrl("");
        await loadSubmissions(userId);
      }
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner-dark" style={{ width: 28, height: 28, borderWidth: 3 }} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748b]">Campaign not found</p>
        <button onClick={() => router.push("/campaigns")} className="text-blu-400 text-sm mt-2 hover:underline">
          Back to campaigns
        </button>
      </div>
    );
  }

  const isApproved = membership === "approved";
  const days = daysRemaining(campaign.ends_at);
  const rpm = campaign.partner_rpm_usd || 0;
  const minViews = rpm > 0 ? Math.ceil((campaign.min_payout_usd / rpm) * 1000) : null;

  const tabs: { key: Tab; label: string; count?: number; disabled?: boolean }[] = [
    { key: "overview", label: "Overview" },
    { key: "submissions", label: "Submissions", count: submissions.length, disabled: !isApproved },
    { key: "submit", label: "Advanced Submit", disabled: !isApproved },
  ];

  return (
    <div>
      {/* Back */}
      <button onClick={() => router.push("/campaigns")}
        className="text-[13px] text-[#64748b] hover:text-[#94a3b8] mb-5 flex items-center gap-1.5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Campaigns
      </button>

      {/* Header */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden mb-6">
        {/* Banner */}
        {campaign.banner_image_url && (
          <div className="w-full h-44 relative overflow-hidden">
            <img src={campaign.banner_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            {campaign.logo_url && (
              <div className={cn(
                "w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-[#1e293b] bg-[#111827]",
                campaign.banner_image_url ? "-mt-10 relative" : ""
              )}>
                <img src={campaign.logo_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div>
            <h1 className="text-xl font-extrabold text-white font-display mb-2">{campaign.title}</h1>
            <div className="flex gap-1.5 flex-wrap">
              {campaign.allowed_platforms.map((p) => (
                <span key={p} className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: `${platformColor(p)}15`, color: platformColor(p), border: `1px solid ${platformColor(p)}25` }}>
                  <PlatformIcon platform={p} className="w-3 h-3 inline-block" /> {p}
                </span>
              ))}
              {days !== null && (
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                  days <= 3 ? "text-red-400 bg-red-500/10 border border-red-500/20" : "text-[#475569] bg-[#0a0f1e] border border-[#1e293b]"
                }`}>
                  {days === 0 ? "Ends today" : `${days}d left`}
                </span>
              )}
            </div>
            </div>
          </div>
          {campaign.partner_rpm_usd != null && (
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-extrabold text-blu-400 font-display">
                ${campaign.partner_rpm_usd.toFixed(2)}
              </div>
              <div className="text-[11px] text-[#475569]">per 1K views</div>
            </div>
          )}
        </div>

        {!membership && (
          <button onClick={handleApply} disabled={applying}
            className="mt-5 w-full sm:w-auto px-8 py-3 bg-blu-500 text-white rounded-xl text-[14px] font-bold font-display transition-all hover:bg-blu-600 hover:shadow-[0_4px_12px_rgba(47,149,232,0.25)] active:scale-[0.98] disabled:opacity-40">
            {applying ? "Applying..." : "Apply to Join Campaign"}
          </button>
        )}
        {membership === "pending" && (
          <div className="mt-5 px-5 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-[13px] font-medium">
            Your application is under review. You&apos;ll be able to submit content once approved.
          </div>
        )}
        {membership === "rejected" && (
          <div className="mt-5 px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[13px] font-medium">
            Your application for this campaign was not approved.
          </div>
        )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1e293b] pb-px">
        {tabs.map((t) => (
          <button key={t.key}
            onClick={() => !t.disabled && setTab(t.key)}
            disabled={t.disabled}
            className={cn(
              "px-4 py-2.5 text-[13px] font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              tab === t.key ? "text-blu-400 border-blu-400" :
              t.disabled ? "text-[#334155] border-transparent cursor-not-allowed" :
              "text-[#64748b] border-transparent hover:text-[#94a3b8]"
            )}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="text-[10px] bg-[#1e293b] px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatBox label="Pay Rate" value={rpm > 0 ? `$${rpm.toFixed(2)}/1K` : "\u2014"} />
            <StatBox label="Min Views" value={minViews != null ? minViews.toLocaleString() : "\u2014"} />
            <StatBox label="Max Payout (per post)" value={`$${campaign.max_payout_usd.toFixed(2)}`} />
            <StatBox label="Total Submissions" value={String(submissions.length)} accent />
          </div>

          {campaign.eligible_countries?.length > 0 && (
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
              <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">Eligible Countries</h3>
              <div className="flex gap-1.5 flex-wrap">
                {campaign.eligible_countries.map((c) => (
                  <span key={c} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#0a0f1e] text-[#94a3b8] border border-[#1e293b]">{c}</span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
            <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">Campaign Brief</h3>
            <p className="text-sm text-[#94a3b8] leading-relaxed">{campaign.description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campaign.submission_expiration_days > 0 && (
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">Submission Window</h3>
                <p className="text-sm text-[#94a3b8]">{campaign.submission_expiration_days} days to get views after submitting</p>
              </div>
            )}
            {campaign.has_blueprint && (
              <div className="bg-blu-500/5 border border-blu-500/20 rounded-xl p-5">
                <h3 className="text-[11px] font-bold text-blu-400/70 uppercase tracking-wider mb-3">Blueprint Available</h3>
                <p className="text-sm text-blu-300">This campaign has a content blueprint to follow</p>
              </div>
            )}
          </div>

          {campaign.tutorial_video_url && (
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
              <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">Tutorial</h3>
              <a href={campaign.tutorial_video_url} target="_blank" rel="noopener"
                className="text-sm text-blu-400 hover:underline break-all">{campaign.tutorial_video_url}</a>
            </div>
          )}

          {campaign.example_video_urls?.length > 0 && (
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
              <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">
                Example Videos ({campaign.example_video_urls.length})
              </h3>
              <div className="space-y-1.5">
                {campaign.example_video_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener"
                    className="block text-sm text-blu-400 hover:underline break-all">{url}</a>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const displayLinks = campaign.custom_links?.length ? campaign.custom_links : campaign.links;
            return displayLinks?.length > 0 ? (
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">Links</h3>
                <div className="space-y-1.5">
                  {displayLinks.map((l, i) => (
                    <a key={i} href={l} target="_blank" rel="noopener"
                      className="block text-sm text-blu-400 hover:underline break-all">{l}</a>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Submissions */}
      {tab === "submissions" && isApproved && (
        <div>
          {submissions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#64748b] text-sm">No submissions yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => {
                const sc = statusStyle(s.status);
                return (
                  <div key={s.id}
                    className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 flex items-center gap-4 flex-wrap">
                    <span className="w-8 text-center flex-shrink-0 flex items-center justify-center">
                      {s.platform ? <PlatformIcon platform={s.platform} className="w-5 h-5" /> : <span className="text-xl">📎</span>}
                    </span>
                    <div className="flex-1 min-w-[140px]">
                      <div className="text-sm font-semibold text-white mb-0.5">
                        @{s.profiles?.username || s.external_username}
                      </div>
                      <a href={s.content_url} target="_blank" rel="noopener"
                        className="text-xs text-blu-400 hover:underline break-all">
                        {s.content_url.length > 55 ? s.content_url.slice(0, 55) + "..." : s.content_url}
                      </a>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {(s.views ?? 0) > 0 && (
                        <div className="text-right">
                          <div className="text-sm font-bold text-white font-display">{s.views!.toLocaleString()}</div>
                          <div className="text-[10px] text-[#475569]">views</div>
                        </div>
                      )}
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize"
                        style={{ background: `${sc.text}15`, color: sc.text, border: `1px solid ${sc.text}25` }}>
                        {s.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#334155] w-full pl-12 -mt-1">{relativeTime(s.created_at)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Advanced Submit */}
      {tab === "submit" && isApproved && (
        <div className="max-w-lg space-y-6">
          {/* Submit form */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
            <h3 className="text-base font-bold text-white font-display mb-1">Submit Content</h3>
            <p className="text-[12px] text-[#475569] mb-5">
              Paste the URL of your video. You can submit multiple videos for this campaign.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Content URL</label>
                <input type="url" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@you/video/..."
                  className="w-full px-4 py-3 bg-[#0a0f1e] border border-[#1e293b] rounded-xl text-sm text-white placeholder:text-[#475569] outline-none transition-all focus:border-blu-500 focus:ring-[3px] focus:ring-blu-500/10" />
              </div>
              <button onClick={handleSubmit} disabled={submitting || !contentUrl.trim()}
                className="w-full py-3.5 bg-blu-500 text-white rounded-xl text-[14px] font-bold font-display transition-all hover:bg-blu-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-h-[48px]">
                {submitting ? <span className="spinner" /> : "Submit Content"}
              </button>
            </div>
          </div>

          {/* Past submissions */}
          {mySubmissions.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">
                Your Submissions ({mySubmissions.length})
              </h3>
              <div className="space-y-3">
                {mySubmissions.map((s) => {
                  const sc = statusStyle(s.status);
                  const thumb = extractThumbnail(s.content_url);
                  return (
                    <div key={s.id} className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
                      <div className="flex">
                        {/* Thumbnail */}
                        <a href={s.content_url} target="_blank" rel="noopener"
                          className="w-28 sm:w-36 flex-shrink-0 relative group block">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-full h-full object-cover min-h-[90px]" />
                          ) : (
                            <div className="w-full h-full min-h-[90px] flex items-center justify-center"
                              style={{ background: `linear-gradient(135deg, ${platformColor(s.platform || "")}20, ${platformColor(s.platform || "")}08)` }}>
                              {s.platform ? <PlatformIcon platform={s.platform} className="w-6 h-6 opacity-60" /> : <span className="text-2xl opacity-60">🎬</span>}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                          {s.platform && (
                            <span className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white capitalize backdrop-blur-sm">
                              {s.platform}
                            </span>
                          )}
                        </a>

                        {/* Content */}
                        <div className="flex-1 p-3 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <a href={s.content_url} target="_blank" rel="noopener"
                                className="text-[11px] text-blu-400 hover:underline break-all line-clamp-1">
                                {s.content_url}
                              </a>
                              <div className="text-[10px] text-[#334155] mt-0.5">{relativeTime(s.created_at)}</div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize"
                                style={{ background: `${sc.text}15`, color: sc.text, border: `1px solid ${sc.text}25` }}>
                                {s.status}
                              </span>
                              <button onClick={() => setDeletingId(deletingId === s.id ? null : s.id)}
                                className="px-2 py-0.5 bg-[#1e293b] border border-[#334155] text-[#94a3b8] rounded text-[9px] font-semibold hover:bg-[#334155] transition-all">
                                Delete
                              </button>
                            </div>
                          </div>

                          {/* Engagement */}
                          <div className="flex items-center gap-3 mt-2">
                            {(s.views ?? 0) > 0 && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <svg className="w-3 h-3 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                <span className="font-bold text-white">{compactNumber(s.views!)}</span>
                              </div>
                            )}
                            {(s.likes ?? 0) > 0 && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <svg className="w-3 h-3 text-red-400/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                <span className="font-bold text-white">{compactNumber(s.likes!)}</span>
                              </div>
                            )}
                            {(s.comments ?? 0) > 0 && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <svg className="w-3 h-3 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                <span className="font-bold text-white">{compactNumber(s.comments!)}</span>
                              </div>
                            )}
                          </div>

                          {s.status === "rejected" && s.admin_notes && (
                            <div className="text-[10px] text-red-400/80 mt-1.5 bg-red-500/5 border border-red-500/10 rounded px-2 py-1">
                              {s.admin_notes}
                            </div>
                          )}
                        </div>
                      </div>
                      {deletingId === s.id && (
                        <div className="px-3.5 pb-3 border-t border-[#1e293b] pt-3 flex gap-3 items-center">
                          <p className="text-[12px] text-[#94a3b8] flex-1">Delete this submission?</p>
                          <button onClick={() => handleDelete(s.id)}
                            className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-bold hover:bg-red-600 transition-all flex-shrink-0">
                            Yes, Delete
                          </button>
                          <button onClick={() => setDeletingId(null)}
                            className="px-3 py-1.5 text-[#475569] text-[12px] font-semibold hover:text-[#94a3b8] transition-all flex-shrink-0">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
      <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-extrabold font-display tracking-tight ${accent ? "text-blu-400" : "text-white"}`}>{value}</div>
    </div>
  );
}
