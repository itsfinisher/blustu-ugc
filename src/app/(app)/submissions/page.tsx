"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { getCampaigns, type Campaign } from "@/lib/api";
import { syncUserSubmissions, type LocalSubmission } from "@/lib/sync";
import { relativeTime, platformIcon, platformColor, statusStyle, cn, extractThumbnail, compactNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function SubmissionsPage() {
  const supabase = createClient();
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [campaigns, setCampaigns] = useState<Map<string, Campaign>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles").select("username").eq("id", user.id).single();
      const uname = profile?.username || "creator";

      const [subsRes, campData] = await Promise.all([
        supabase.from("submissions").select("*").eq("user_id", user.id).neq("status", "deleted").order("created_at", { ascending: false }),
        getCampaigns().catch(() => [] as Campaign[]),
      ]);

      setSubmissions(subsRes.data || []);
      const campMap = new Map<string, Campaign>();
      (campData as Campaign[]).forEach((c) => campMap.set(c.id, c));
      setCampaigns(campMap);
      setLoading(false);

      syncUserSubmissions(supabase, user.id, uname).then(async () => {
        const { data: refreshed } = await supabase
          .from("submissions")
          .select("*")
          .eq("user_id", user.id)
          .neq("status", "deleted")
          .order("created_at", { ascending: false });
        if (refreshed) setSubmissions(refreshed);
      });
    }
    load();
  }, [supabase]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message || "Delete failed");
      return;
    }
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
    toast.success("Submission deleted");
  };

  const filtered = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);
  const totalViews = submissions.reduce((a, s) => a + (s.views || 0), 0);
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-white font-display tracking-tight">My Submissions</h1>
        <p className="text-sm text-[#64748b] mt-1">Track your content performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">Submissions</div>
          <div className="text-2xl font-extrabold text-white font-display">{loading ? "\u2014" : submissions.length}</div>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">Total Views</div>
          <div className="text-2xl font-extrabold text-white font-display">{loading ? "\u2014" : totalViews.toLocaleString()}</div>
        </div>
        <div className="bg-[#111827] border border-emerald-500/20 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-1">Approved</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-display">{loading ? "\u2014" : approvedCount}</div>
        </div>
        <div className="bg-[#111827] border border-amber-500/20 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-amber-400/70 uppercase tracking-wider mb-1">Pending</div>
          <div className="text-2xl font-extrabold text-amber-400 font-display">{loading ? "\u2014" : pendingCount}</div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-4 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition-all border capitalize",
              filter === s
                ? "bg-blu-500/10 text-blu-400 border-blu-500/20"
                : "bg-[#111827] text-[#475569] border-[#1e293b] hover:border-[#334155]"
            )}>
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-dark h-32 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#475569] text-sm">No {filter !== "all" ? `${filter} ` : ""}submissions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const sc = statusStyle(s.status);
            const camp = campaigns.get(s.campaign_id);
            const rpm = camp?.partner_rpm_usd || 0;
            const earnings = s.views && rpm ? (s.views! / 1000) * rpm : null;
            const thumb = extractThumbnail(s.content_url);

            return (
              <div key={s.id} className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
                <div className="flex">
                  {/* Thumbnail / Video Preview */}
                  <a href={s.content_url} target="_blank" rel="noopener"
                    className="w-36 sm:w-44 flex-shrink-0 relative group block">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover min-h-[100px]" />
                    ) : (
                      <div className="w-full h-full min-h-[100px] flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${platformColor(s.platform || "")}20, ${platformColor(s.platform || "")}08)` }}>
                        <span className="text-3xl opacity-60">{s.platform ? platformIcon(s.platform) : "\uD83C\uDFA5"}</span>
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    {/* Platform badge */}
                    {s.platform && (
                      <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white capitalize backdrop-blur-sm">
                        {s.platform}
                      </span>
                    )}
                  </a>

                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white font-display mb-0.5 truncate">
                          {camp?.title || "Campaign"}
                        </div>
                        <a href={s.content_url} target="_blank" rel="noopener"
                          className="text-[11px] text-blu-400 hover:underline break-all line-clamp-1">
                          {s.content_url}
                        </a>
                        <div className="text-[10px] text-[#334155] mt-0.5">{relativeTime(s.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize"
                          style={{ background: `${sc.text}15`, color: sc.text, border: `1px solid ${sc.text}25` }}>
                          {s.status}
                        </span>
                        <button onClick={() => setDeletingId(deletingId === s.id ? null : s.id)}
                          className="px-2.5 py-1 bg-[#1e293b] border border-[#334155] text-[#94a3b8] rounded-lg text-[10px] font-semibold hover:bg-[#334155] transition-all">
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Engagement metrics */}
                    <div className="flex items-center gap-4 mt-3">
                      {(s.views ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <svg className="w-3.5 h-3.5 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          <span className="font-bold text-white font-display">{compactNumber(s.views!)}</span>
                          <span className="text-[#475569]">views</span>
                        </div>
                      )}
                      {(s.likes ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <svg className="w-3.5 h-3.5 text-red-400/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                          <span className="font-bold text-white font-display">{compactNumber(s.likes!)}</span>
                        </div>
                      )}
                      {(s.comments ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <svg className="w-3.5 h-3.5 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                          <span className="font-bold text-white font-display">{compactNumber(s.comments!)}</span>
                        </div>
                      )}
                      {earnings != null && (
                        <div className="flex items-center gap-1.5 text-[12px] ml-auto">
                          <span className={cn(
                            "font-bold font-display",
                            s.status === "approved" ? "text-emerald-400" : "text-amber-400/70"
                          )}>
                            ${earnings.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-[#475569]">
                            {s.status === "approved" ? "earned" : "pending"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Rejection note */}
                    {s.status === "rejected" && s.admin_notes && (
                      <div className="text-[11px] text-red-400/80 mt-2 bg-red-500/5 border border-red-500/10 rounded-lg px-2.5 py-1.5">
                        {s.admin_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete confirmation */}
                {deletingId === s.id && (
                  <div className="px-4 pb-3 border-t border-[#1e293b] pt-3 flex gap-3 items-center">
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
      )}
    </div>
  );
}
