"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { syncAllSubmissions, type LocalSubmission } from "@/lib/sync";
import { getCampaigns, type Campaign, type CampaignOverride } from "@/lib/api";
import { cn, relativeTime, extractThumbnail, compactNumber } from "@/lib/utils";
import { PlatformIcon, platformColor } from "@/components/PlatformIcons";
import { toast } from "sonner";

type AdminTab = "creators" | "campaigns" | "submissions" | "campaign-settings" | "announcements";
type SubFilter = "all" | "pending" | "approved" | "rejected";

interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  author_id: string;
  created_at: string;
}

interface Creator {
  id: string;
  username: string;
  status: string;
  role: string;
  content_links: string[];
  created_at: string;
}

interface CampaignMembership {
  id: string;
  user_id: string;
  campaign_id: string;
  status: string;
  created_at: string;
  profiles?: { username: string };
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("submissions");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [memberships, setMemberships] = useState<CampaignMembership[]>([]);
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [subFilter, setSubFilter] = useState<SubFilter>("all");

  // Reject note state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Expanded creator in creators tab
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);

  // Campaign settings state
  const [mmCampaigns, setMmCampaigns] = useState<Campaign[]>([]);
  const [overrides, setOverrides] = useState<Map<string, CampaignOverride>>(new Map());
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [editBanner, setEditBanner] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editLinks, setEditLinks] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annCategory, setAnnCategory] = useState("update");
  const [annPinned, setAnnPinned] = useState(false);
  const [annEditing, setAnnEditing] = useState<string | null>(null);
  const [annSaving, setAnnSaving] = useState(false);
  const [annDeleting, setAnnDeleting] = useState<string | null>(null);

  async function loadAnnouncements() {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
  }

  async function loadSubmissions() {
    const { data } = await supabase
      .from("submissions")
      .select("*, profiles(username)")
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    setSubmissions(data || []);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();

      if (profile?.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);

      const [creatorsRes, membershipsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("campaign_memberships").select("*, profiles(username)").order("created_at", { ascending: false }),
      ]);

      setCreators(creatorsRes.data || []);
      setMemberships(membershipsRes.data || []);
      await loadSubmissions();

      // Load campaigns + overrides
      const [campData, overridesRes] = await Promise.all([
        getCampaigns().catch(() => [] as Campaign[]),
        supabase.from("campaign_overrides").select("*"),
      ]);
      setMmCampaigns(campData);
      const oMap = new Map<string, CampaignOverride>();
      (overridesRes.data || []).forEach((o: CampaignOverride) => oMap.set(o.campaign_id, o));
      setOverrides(oMap);

      await loadAnnouncements();

      setLoading(false);

      // Auto-sync from MediaMaxxing in background, then refresh submissions
      syncAllSubmissions(supabase).then(() => loadSubmissions());
    }
    load();
  }, [supabase, router]);

  // ─── Sync ───
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await syncAllSubmissions(supabase);
      await loadSubmissions();
      toast.success("Synced views from MediaMaxxing");
    } catch {
      toast.error("Sync failed");
    }
    setSyncing(false);
  };

  // ─── Creator actions ───
  const updateCreatorStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setCreators((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    toast.success(`Creator ${status}`);
  };

  // ─── Membership actions ───
  const updateMembershipStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("campaign_memberships").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMemberships((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    toast.success(`Membership ${status}`);
  };

  // ─── Submission: Approve (forwards to MediaMaxxing) ───
  const handleApprove = async (submissionId: string) => {
    setProcessingIds((prev) => new Set(prev).add(submissionId));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/forward-submission`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ submission_id: submissionId, action: "approve" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Approve failed");
        return;
      }

      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: "approved" } : s))
      );
      toast.success(`Submission approved${data.note ? ` — ${data.note}` : ""}`);
    } catch (err: any) {
      toast.error(err.message || "Approve failed");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
    }
  };

  // ─── Submission: Reject (local, with admin note) ───
  const handleReject = async (submissionId: string) => {
    const note = rejectNote.trim() || "This submission is not allowed.";
    setProcessingIds((prev) => new Set(prev).add(submissionId));
    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          status: "rejected",
          admin_notes: note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) { toast.error(error.message); return; }

      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: "rejected", admin_notes: note } : s))
      );
      setRejectingId(null);
      setRejectNote("");
      toast.success("Submission rejected");
    } catch (err: any) {
      toast.error(err.message || "Reject failed");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
    }
  };

  // ─── Submission: Delete (soft delete — keeps row so sync won't re-import) ───
  const handleDelete = async (submissionId: string) => {
    setProcessingIds((prev) => new Set(prev).add(submissionId));
    try {
      const { error } = await supabase
        .from("submissions")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("id", submissionId);

      if (error) { toast.error(error.message); return; }

      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      setDeletingId(null);
      toast.success("Submission deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
    }
  };

  // ─── Campaign override: save ───
  const handleSaveOverride = async (campaignId: string) => {
    setSavingOverride(true);
    const linksArr = editLinks.trim() ? editLinks.split("\n").map((l) => l.trim()).filter(Boolean) : null;
    const payload = {
      campaign_id: campaignId,
      banner_image_url: editBanner.trim() || null,
      logo_url: editLogo.trim() || null,
      custom_links: linksArr,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("campaign_overrides").upsert(payload, { onConflict: "campaign_id" });
    if (error) { toast.error(error.message); setSavingOverride(false); return; }
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(campaignId, payload);
      return next;
    });
    setEditingCampaign(null);
    setSavingOverride(false);
    toast.success("Campaign visuals saved");
  };

  if (!isAdmin) return null;

  const pendingCreators = creators.filter((c) => c.status === "pending");
  const pendingMemberships = memberships.filter((m) => m.status === "pending");
  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const filteredSubmissions = subFilter === "all" ? submissions : submissions.filter((s) => s.status === subFilter);

  // Build a map of creator id → their submissions
  const creatorSubsMap = new Map<string, LocalSubmission[]>();
  submissions.forEach((s) => {
    const arr = creatorSubsMap.get(s.user_id) || [];
    arr.push(s);
    creatorSubsMap.set(s.user_id, arr);
  });

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-white font-display tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-[#64748b] mt-1">Manage creators, campaigns, and content submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">Total Creators</div>
          <div className="text-2xl font-extrabold text-white font-display">{creators.length}</div>
        </div>
        <div className="bg-[#111827] border border-amber-500/20 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-amber-400/70 uppercase tracking-wider mb-1">Pending Creators</div>
          <div className="text-2xl font-extrabold text-amber-400 font-display">{pendingCreators.length}</div>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">Campaign Apps</div>
          <div className="text-2xl font-extrabold text-white font-display">{memberships.length}</div>
        </div>
        <div className="bg-[#111827] border border-amber-500/20 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-amber-400/70 uppercase tracking-wider mb-1">Pending Apps</div>
          <div className="text-2xl font-extrabold text-amber-400 font-display">{pendingMemberships.length}</div>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">Submissions</div>
          <div className="text-2xl font-extrabold text-white font-display">{submissions.length}</div>
        </div>
        <div className="bg-[#111827] border border-amber-500/20 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-amber-400/70 uppercase tracking-wider mb-1">Pending Content</div>
          <div className="text-2xl font-extrabold text-amber-400 font-display">{pendingSubmissions.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1e293b] pb-px">
        {[
          { key: "submissions" as AdminTab, label: `Content Moderation (${pendingSubmissions.length})` },
          { key: "creators" as AdminTab, label: `Creators (${creators.length})` },
          { key: "campaigns" as AdminTab, label: `Campaign Apps (${pendingMemberships.length})` },
          { key: "campaign-settings" as AdminTab, label: `Campaign Visuals (${mmCampaigns.length})` },
          { key: "announcements" as AdminTab, label: `Announcements (${announcements.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-[13px] font-semibold transition-all border-b-2 -mb-px",
              tab === t.key ? "text-blu-400 border-blu-400" : "text-[#64748b] border-transparent hover:text-[#94a3b8]"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-dark h-16 rounded-xl" />)}
        </div>

      /* ════════════════════════════════════════════
         CONTENT MODERATION TAB
         ════════════════════════════════════════════ */
      ) : tab === "submissions" ? (
        <div>
          {/* Top bar: filters + sync */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              {(["all", "pending", "approved", "rejected"] as SubFilter[]).map((f) => (
                <button key={f} onClick={() => setSubFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all border capitalize",
                    subFilter === f
                      ? "bg-blu-500/10 text-blu-400 border-blu-500/20"
                      : "bg-[#111827] text-[#475569] border-[#1e293b] hover:border-[#334155]"
                  )}>
                  {f} {f === "pending" ? `(${pendingSubmissions.length})` : ""}
                </button>
              ))}
            </div>
            <button onClick={handleSyncAll} disabled={syncing}
              className="px-4 py-1.5 bg-blu-500/10 border border-blu-500/20 text-blu-400 rounded-full text-[12px] font-semibold hover:bg-blu-500/20 transition-all disabled:opacity-40 flex items-center gap-2">
              {syncing ? (
                <>
                  <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                  Syncing...
                </>
              ) : (
                "Sync Views from MediaMaxxing"
              )}
            </button>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#475569] text-sm mb-2">No {subFilter !== "all" ? subFilter + " " : ""}submissions</p>
              {submissions.length === 0 && (
                <p className="text-[#334155] text-xs">Submissions will appear here when creators submit content on BluStu</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((s) => {
                const isProcessing = processingIds.has(s.id);
                const isRejecting = rejectingId === s.id;
                const isDeleting = deletingId === s.id;
                const thumb = extractThumbnail(s.content_url);

                return (
                  <div key={s.id} className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
                    <div className="flex">
                      {/* Thumbnail */}
                      <a href={s.content_url} target="_blank" rel="noopener"
                        className="w-36 sm:w-44 flex-shrink-0 relative group block">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover min-h-[110px]" />
                        ) : (
                          <div className="w-full h-full min-h-[110px] flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${platformColor(s.platform || "")}20, ${platformColor(s.platform || "")}08)` }}>
                            {s.platform ? <PlatformIcon platform={s.platform} className="w-8 h-8 opacity-60" /> : <span className="text-3xl opacity-60">🎬</span>}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                        {s.platform && (
                          <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white capitalize backdrop-blur-sm">
                            {s.platform}
                          </span>
                        )}
                      </a>

                      {/* Content */}
                      <div className="flex-1 p-4 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">@{s.profiles?.username || s.external_username}</div>
                            <a href={s.content_url} target="_blank" rel="noopener"
                              className="text-[11px] text-blu-400 hover:underline break-all line-clamp-1">
                              {s.content_url}
                            </a>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex-shrink-0 ${
                            s.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
                            s.status === "rejected" ? "text-red-400 bg-red-500/10 border border-red-500/20" :
                            "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                          }`}>
                            {s.status}
                          </span>
                        </div>

                        {/* Engagement metrics */}
                        <div className="flex items-center gap-4 mt-2 mb-2">
                          {(s.views ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <svg className="w-3.5 h-3.5 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                              <span className="font-bold text-white">{compactNumber(s.views!)}</span>
                            </div>
                          )}
                          {(s.likes ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <svg className="w-3.5 h-3.5 text-red-400/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                              <span className="font-bold text-white">{compactNumber(s.likes!)}</span>
                            </div>
                          )}
                          {(s.comments ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <svg className="w-3.5 h-3.5 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                              <span className="font-bold text-white">{compactNumber(s.comments!)}</span>
                            </div>
                          )}
                          {s.mediamaxxing_id && <span className="text-[10px] text-emerald-500/60 ml-auto">MM linked</span>}
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-[#334155]">
                          <span>Campaign: {s.campaign_id.slice(0, 8)}...</span>
                          <span>{relativeTime(s.created_at)}</span>
                        </div>

                        {s.status === "rejected" && s.admin_notes && (
                          <div className="text-[11px] text-red-400/80 mt-1.5 bg-red-500/5 border border-red-500/10 rounded-lg px-2.5 py-1.5">
                            Reason: {s.admin_notes}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          {s.status === "pending" && (
                            <button onClick={() => handleApprove(s.id)} disabled={isProcessing}
                              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[11px] font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-40">
                              {isProcessing ? "..." : "Approve"}
                            </button>
                          )}
                          {(s.status === "pending" || s.status === "approved") && (
                            <button onClick={() => { setRejectingId(isRejecting ? null : s.id); setRejectNote(""); setDeletingId(null); }}
                              disabled={isProcessing}
                              className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[11px] font-semibold hover:bg-red-500/20 transition-all disabled:opacity-40">
                              Reject
                            </button>
                          )}
                          <button onClick={() => { setDeletingId(isDeleting ? null : s.id); setRejectingId(null); }}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-[#1e293b] border border-[#334155] text-[#94a3b8] rounded-lg text-[11px] font-semibold hover:bg-[#334155] transition-all disabled:opacity-40">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Reject note input */}
                    {isRejecting && (
                      <div className="px-4 pb-4 border-t border-[#1e293b] pt-3 flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">Rejection reason (shown to creator)</label>
                          <input type="text" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="This submission is not allowed."
                            className="w-full px-3 py-2 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-sm text-white placeholder:text-[#475569] outline-none focus:border-red-500/40" />
                        </div>
                        <button onClick={() => handleReject(s.id)} disabled={isProcessing}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-[12px] font-bold hover:bg-red-600 transition-all disabled:opacity-40 flex-shrink-0">
                          {isProcessing ? "..." : "Confirm Reject"}
                        </button>
                        <button onClick={() => setRejectingId(null)}
                          className="px-3 py-2 text-[#475569] text-[12px] font-semibold hover:text-[#94a3b8] transition-all flex-shrink-0">
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Delete confirmation */}
                    {isDeleting && (
                      <div className="px-4 pb-4 border-t border-[#1e293b] pt-3 flex gap-3 items-center">
                        <p className="text-[12px] text-[#94a3b8] flex-1">Permanently delete this submission? This cannot be undone.</p>
                        <button onClick={() => handleDelete(s.id)} disabled={isProcessing}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-[12px] font-bold hover:bg-red-600 transition-all disabled:opacity-40 flex-shrink-0">
                          {isProcessing ? "..." : "Yes, Delete"}
                        </button>
                        <button onClick={() => setDeletingId(null)}
                          className="px-3 py-2 text-[#475569] text-[12px] font-semibold hover:text-[#94a3b8] transition-all flex-shrink-0">
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

      /* ════════════════════════════════════════════
         CREATORS TAB — click to expand submissions
         ════════════════════════════════════════════ */
      ) : tab === "creators" ? (
        <div className="space-y-2">
          {creators.length === 0 ? (
            <p className="text-[#475569] text-sm py-10 text-center">No creators yet</p>
          ) : creators.map((c) => {
            const creatorSubs = creatorSubsMap.get(c.id) || [];
            const subCount = creatorSubs.length;
            const pendingCount = creatorSubs.filter((s) => s.status === "pending").length;
            const approvedCount = creatorSubs.filter((s) => s.status === "approved").length;
            const totalViews = creatorSubs.reduce((a, s) => a + (s.views || 0), 0);
            const isExpanded = expandedCreator === c.id;

            return (
              <div key={c.id} className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
                {/* Creator header — clickable */}
                <button
                  onClick={() => setExpandedCreator(isExpanded ? null : c.id)}
                  className="w-full p-4 flex items-center gap-4 flex-wrap text-left hover:bg-[#0f1629] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blu-500/10 border border-blu-500/20 flex items-center justify-center text-[13px] font-bold text-blu-400 flex-shrink-0">
                    {c.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">@{c.username}</span>
                      {c.role === "admin" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blu-500/10 text-blu-400 border border-blu-500/20 uppercase">admin</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[#475569]">
                      <span>{subCount} submission{subCount !== 1 ? "s" : ""}</span>
                      {pendingCount > 0 && <span className="text-amber-400">{pendingCount} pending</span>}
                      {approvedCount > 0 && <span className="text-emerald-400">{approvedCount} approved</span>}
                      {totalViews > 0 && <span>{totalViews.toLocaleString()} views</span>}
                    </div>
                    {c.content_links?.length > 0 && (
                      <div className="flex gap-2 mt-1">
                        {c.content_links.map((link, i) => (
                          <a key={i} href={link} target="_blank" rel="noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-blu-400 hover:underline truncate max-w-[200px]">
                            Portfolio {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      c.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
                      c.status === "rejected" ? "text-red-400 bg-red-500/10 border border-red-500/20" :
                      "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                    }`}>
                      {c.status}
                    </span>
                    {c.status === "pending" && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); updateCreatorStatus(c.id, "approved"); }}
                          className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[11px] font-semibold hover:bg-emerald-500/20 transition-all">
                          Approve
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); updateCreatorStatus(c.id, "rejected"); }}
                          className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[11px] font-semibold hover:bg-red-500/20 transition-all">
                          Reject
                        </button>
                      </>
                    )}
                    {/* Expand chevron */}
                    <svg className={cn("w-4 h-4 text-[#475569] transition-transform", isExpanded && "rotate-180")}
                      fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded: creator's submissions */}
                {isExpanded && (
                  <div className="border-t border-[#1e293b] bg-[#0a0f1e]/50">
                    {creatorSubs.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-[#475569] text-[12px]">No submissions from this creator yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#1e293b]/50">
                        {creatorSubs.map((s) => (
                          <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                            <span className="text-sm flex-shrink-0 w-6 text-center">
                              {s.platform === "tiktok" ? "\u266A" : s.platform === "instagram" ? "\u25CE" : s.platform === "youtube" ? "\u25B6" : "\uD83D\uDCCE"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <a href={s.content_url} target="_blank" rel="noopener"
                                className="text-[12px] text-blu-400 hover:underline break-all line-clamp-1">
                                {s.content_url}
                              </a>
                              <div className="flex items-center gap-3 text-[10px] text-[#334155] mt-0.5">
                                <span>Campaign: {s.campaign_id.slice(0, 8)}...</span>
                                {(s.views ?? 0) > 0 && <span className="text-[#475569]">{s.views!.toLocaleString()} views</span>}
                                <span>{relativeTime(s.created_at)}</span>
                              </div>
                              {s.status === "rejected" && s.admin_notes && (
                                <div className="text-[10px] text-red-400/80 mt-0.5">Reason: {s.admin_notes}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                s.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
                                s.status === "rejected" ? "text-red-400 bg-red-500/10 border border-red-500/20" :
                                "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                              }`}>
                                {s.status}
                              </span>
                              {/* Quick actions from creator view */}
                              {s.status === "pending" && (
                                <button onClick={() => handleApprove(s.id)} disabled={processingIds.has(s.id)}
                                  className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px] font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-40">
                                  {processingIds.has(s.id) ? "..." : "Approve"}
                                </button>
                              )}
                              {(s.status === "pending" || s.status === "approved") && (
                                <button onClick={() => { setRejectingId(s.id); setRejectNote(""); setDeletingId(null); setTab("submissions"); setSubFilter("all"); }}
                                  className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[10px] font-semibold hover:bg-red-500/20 transition-all">
                                  Reject
                                </button>
                              )}
                              <button onClick={() => { setDeletingId(s.id); setRejectingId(null); setTab("submissions"); setSubFilter("all"); }}
                                className="px-2 py-1 bg-[#1e293b] border border-[#334155] text-[#94a3b8] rounded text-[10px] font-semibold hover:bg-[#334155] transition-all">
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      /* ════════════════════════════════════════════
         CAMPAIGN APPLICATIONS TAB
         ════════════════════════════════════════════ */
      ) : tab === "campaigns" ? (
        <div className="space-y-2">
          {memberships.length === 0 ? (
            <p className="text-[#475569] text-sm py-10 text-center">No campaign applications yet</p>
          ) : memberships.map((m) => (
            <div key={m.id} className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <div className="text-sm font-semibold text-white">@{m.profiles?.username || "unknown"}</div>
                <div className="text-[11px] text-[#475569]">Campaign: {m.campaign_id.slice(0, 8)}...</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                  m.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
                  m.status === "rejected" ? "text-red-400 bg-red-500/10 border border-red-500/20" :
                  "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                }`}>
                  {m.status}
                </span>
                {m.status === "pending" && (
                  <>
                    <button onClick={() => updateMembershipStatus(m.id, "approved")}
                      className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[11px] font-semibold hover:bg-emerald-500/20 transition-all">
                      Approve
                    </button>
                    <button onClick={() => updateMembershipStatus(m.id, "rejected")}
                      className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[11px] font-semibold hover:bg-red-500/20 transition-all">
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

      /* ════════════════════════════════════════════
         CAMPAIGN VISUALS TAB
         ════════════════════════════════════════════ */
      ) : tab === "campaign-settings" ? (
        <div>
          <p className="text-[12px] text-[#475569] mb-4">
            Add banner images and logos for each campaign. These appear on the campaigns page and detail pages for creators.
          </p>
          {mmCampaigns.length === 0 ? (
            <p className="text-[#475569] text-sm py-10 text-center">No campaigns loaded from API</p>
          ) : (
            <div className="space-y-3">
              {mmCampaigns.map((c) => {
                const o = overrides.get(c.id);
                const isEditing = editingCampaign === c.id;

                return (
                  <div key={c.id} className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
                    {/* Preview row */}
                    <div className="flex items-center gap-4 p-4">
                      {/* Logo preview */}
                      <div className="w-10 h-10 rounded-lg bg-[#0a0f1e] border border-[#1e293b] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {o?.logo_url ? (
                          <img src={o.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#334155] text-lg">?</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white font-display">{c.title}</div>
                        <div className="text-[10px] text-[#475569] mt-0.5">
                          {c.allowed_platforms.map((p, i) => (
                            <span key={p} className="inline-flex items-center gap-0.5">
                              {i > 0 && " · "}<PlatformIcon platform={p} className="w-3 h-3 inline-block" /> {p}
                            </span>
                          ))}
                          {c.partner_rpm_usd != null && ` \u00B7 $${c.partner_rpm_usd.toFixed(2)}/1K`}
                        </div>
                      </div>

                      {/* Banner thumbnail */}
                      {o?.banner_image_url && (
                        <div className="w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-[#1e293b]">
                          <img src={o.banner_image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {o?.banner_image_url || o?.logo_url || o?.custom_links?.length ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Customized
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#475569] bg-[#0a0f1e] px-2 py-0.5 rounded-full border border-[#1e293b]">
                            No visuals
                          </span>
                        )}
                        <button
                          onClick={() => {
                            if (isEditing) { setEditingCampaign(null); return; }
                            setEditingCampaign(c.id);
                            setEditBanner(o?.banner_image_url || "");
                            setEditLogo(o?.logo_url || "");
                            setEditLinks(o?.custom_links?.join("\n") || "");
                          }}
                          className="px-3 py-1.5 bg-blu-500/10 border border-blu-500/20 text-blu-400 rounded-lg text-[11px] font-semibold hover:bg-blu-500/20 transition-all">
                          {isEditing ? "Cancel" : "Edit"}
                        </button>
                      </div>
                    </div>

                    {/* Edit form */}
                    {isEditing && (
                      <div className="px-4 pb-4 border-t border-[#1e293b] pt-4 space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">Banner Image URL</label>
                          <input type="text" value={editBanner} onChange={(e) => setEditBanner(e.target.value)}
                            placeholder="https://example.com/campaign-banner.jpg"
                            className="w-full px-3 py-2 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-sm text-white placeholder:text-[#334155] outline-none focus:border-blu-500/40" />
                          {editBanner.trim() && (
                            <div className="mt-2 w-full h-32 rounded-lg overflow-hidden border border-[#1e293b]">
                              <img src={editBanner.trim()} alt="Preview" className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">Logo / Emblem URL</label>
                          <input type="text" value={editLogo} onChange={(e) => setEditLogo(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="w-full px-3 py-2 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-sm text-white placeholder:text-[#334155] outline-none focus:border-blu-500/40" />
                          {editLogo.trim() && (
                            <div className="mt-2 w-10 h-10 rounded-lg overflow-hidden border border-[#1e293b]">
                              <img src={editLogo.trim()} alt="Preview" className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">Custom Brief Links <span className="font-normal text-[#334155]">(overrides MediaMaxxing links)</span></label>
                          <textarea value={editLinks} onChange={(e) => setEditLinks(e.target.value)}
                            placeholder="One link per line&#10;https://docs.google.com/document/d/..."
                            rows={3}
                            className="w-full px-3 py-2 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-sm text-white placeholder:text-[#334155] outline-none focus:border-blu-500/40 resize-y" />
                          <p className="text-[10px] text-[#334155] mt-1">Leave empty to use default MediaMaxxing links</p>
                        </div>
                        <button onClick={() => handleSaveOverride(c.id)} disabled={savingOverride}
                          className="px-5 py-2 bg-blu-500 text-white rounded-lg text-[13px] font-bold hover:bg-blu-600 transition-all disabled:opacity-40">
                          {savingOverride ? "Saving..." : "Save Visuals"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      /* ════════════════════════════════════════════
         ANNOUNCEMENTS TAB
         ════════════════════════════════════════════ */
      ) : tab === "announcements" ? (
        <div className="space-y-6">
          {/* Compose / Edit form */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
            <h3 className="text-[13px] font-bold text-white mb-4 font-display">
              {annEditing ? "Edit Announcement" : "New Announcement"}
            </h3>
            <div className="space-y-3">
              <input type="text" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Title" className="w-full px-3 py-2 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-sm text-white placeholder:text-[#334155] outline-none focus:border-blu-500/40" />
              <textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Write your announcement..."
                rows={5}
                className="w-full px-3 py-2 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-sm text-white placeholder:text-[#334155] outline-none focus:border-blu-500/40 resize-y" />
              <div className="flex flex-wrap items-center gap-3">
                <select value={annCategory} onChange={(e) => setAnnCategory(e.target.value)}
                  className="px-3 py-2 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-sm text-white outline-none focus:border-blu-500/40">
                  <option value="update">Update</option>
                  <option value="news">News</option>
                  <option value="creator-win">Creator Win</option>
                  <option value="tip">Tip</option>
                </select>
                <label className="flex items-center gap-2 text-[12px] text-[#94a3b8] cursor-pointer select-none">
                  <input type="checkbox" checked={annPinned} onChange={(e) => setAnnPinned(e.target.checked)}
                    className="accent-blu-500 w-4 h-4" />
                  Pin to top
                </label>
                <div className="flex gap-2 ml-auto">
                  {annEditing && (
                    <button onClick={() => { setAnnEditing(null); setAnnTitle(""); setAnnBody(""); setAnnCategory("update"); setAnnPinned(false); }}
                      className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#94a3b8] bg-[#1e293b] hover:bg-[#334155] transition-all">
                      Cancel
                    </button>
                  )}
                  <button disabled={annSaving || !annTitle.trim() || !annBody.trim()}
                    onClick={async () => {
                      setAnnSaving(true);
                      const { data: { user } } = await supabase.auth.getUser();
                      if (annEditing) {
                        const { error } = await supabase.from("announcements")
                          .update({ title: annTitle.trim(), body: annBody.trim(), category: annCategory, pinned: annPinned, updated_at: new Date().toISOString() })
                          .eq("id", annEditing);
                        if (error) { toast.error(error.message); } else { toast.success("Announcement updated"); }
                      } else {
                        const { error } = await supabase.from("announcements")
                          .insert({ title: annTitle.trim(), body: annBody.trim(), category: annCategory, pinned: annPinned, author_id: user?.id });
                        if (error) { toast.error(error.message); } else { toast.success("Announcement posted"); }
                      }
                      setAnnTitle(""); setAnnBody(""); setAnnCategory("update"); setAnnPinned(false); setAnnEditing(null);
                      await loadAnnouncements();
                      setAnnSaving(false);
                    }}
                    className="px-5 py-2 bg-blu-500 text-white rounded-lg text-[13px] font-bold hover:bg-blu-600 transition-all disabled:opacity-40">
                    {annSaving ? "Saving..." : annEditing ? "Update" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Existing announcements */}
          {announcements.length === 0 ? (
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-12 text-center">
              <div className="text-3xl mb-3 opacity-40">📢</div>
              <p className="text-[#475569] text-sm">No announcements yet. Create your first one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className={cn(
                  "bg-[#111827] border rounded-xl p-5",
                  a.pinned ? "border-blu-500/30" : "border-[#1e293b]"
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {a.pinned && (
                          <span className="text-[9px] font-bold text-blu-400 bg-blu-500/10 border border-blu-500/20 px-1.5 py-0.5 rounded-full uppercase">Pinned</span>
                        )}
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border",
                          a.category === "creator-win" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                          a.category === "news" ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
                          a.category === "tip" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                          "text-blu-400 bg-blu-500/10 border-blu-500/20"
                        )}>
                          {a.category === "creator-win" ? "Creator Win" : a.category}
                        </span>
                        <span className="text-[10px] text-[#334155]">{relativeTime(a.created_at)}</span>
                      </div>
                      <h4 className="text-[14px] font-bold text-white font-display mb-1">{a.title}</h4>
                      <p className="text-[12px] text-[#94a3b8] line-clamp-3 whitespace-pre-wrap">{a.body}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { setAnnEditing(a.id); setAnnTitle(a.title); setAnnBody(a.body); setAnnCategory(a.category); setAnnPinned(a.pinned); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-blu-400 bg-blu-500/10 hover:bg-blu-500/20 transition-all">
                        Edit
                      </button>
                      {annDeleting === a.id ? (
                        <div className="flex gap-1">
                          <button onClick={async () => {
                            await supabase.from("announcements").delete().eq("id", a.id);
                            setAnnDeleting(null);
                            toast.success("Announcement deleted");
                            await loadAnnouncements();
                          }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all">
                            Confirm
                          </button>
                          <button onClick={() => setAnnDeleting(null)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#94a3b8] bg-[#1e293b] hover:bg-[#334155] transition-all">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setAnnDeleting(a.id)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
