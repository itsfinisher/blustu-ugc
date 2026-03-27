"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { getCampaigns, enrichCampaigns, type EnrichedCampaign, type CampaignOverride } from "@/lib/api";
import { syncUserSubmissions, type LocalSubmission } from "@/lib/sync";
import { PlatformIcon, platformColor } from "@/components/PlatformIcons";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [campaigns, setCampaigns] = useState<EnrichedCampaign[]>([]);
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles").select("username").eq("id", user.id).single();
      const uname = profile?.username || "creator";
      setUsername(uname);

      // Load campaigns from MM API + local overrides immediately
      let campData: EnrichedCampaign[] = [];
      try {
        const [raw, overridesRes] = await Promise.all([
          getCampaigns(),
          supabase.from("campaign_overrides").select("*"),
        ]);
        campData = enrichCampaigns(raw, (overridesRes.data || []) as CampaignOverride[]);
      } catch {}
      setCampaigns(campData);

      const { data: localSubs } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });
      setSubmissions(localSubs || []);
      setLoading(false);

      // Sync from MediaMaxxing in background, then refresh local data
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

  const totalViews = submissions.reduce((a, s) => a + (s.views || 0), 0);
  const approvedCount = submissions.filter((s) => s.status === "approved").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white font-display tracking-tight">
          Welcome back, {username}
        </h1>
        <p className="text-sm text-[#64748b] mt-1">Here&apos;s what&apos;s happening with your content</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatBox label="Campaigns" value={loading ? "\u2014" : String(campaigns.length)} />
        <StatBox label="Submissions" value={loading ? "\u2014" : String(submissions.length)} />
        <StatBox label="Approved" value={loading ? "\u2014" : String(approvedCount)} />
        <StatBox label="Total Views" value={loading ? "\u2014" : totalViews.toLocaleString()} accent />
      </div>

      {/* Campaigns */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white font-display">Active Campaigns</h2>
          <button onClick={() => router.push("/campaigns")}
            className="text-[13px] text-blu-400 font-semibold hover:underline">
            View all
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading ? (
            <>
              <div className="skeleton-dark h-48 rounded-xl" />
              <div className="skeleton-dark h-48 rounded-xl" />
            </>
          ) : campaigns.slice(0, 4).map((c) => (
            <button key={c.id} onClick={() => router.push(`/campaigns/${c.id}`)}
              className="bg-[#111827] border border-[#1e293b] rounded-xl text-left transition-all hover:border-blu-500/30 hover:bg-[#0f1629] flex flex-col overflow-hidden group">
              {/* Banner */}
              <div className="w-full h-28 relative overflow-hidden bg-gradient-to-br from-[#1e293b] to-[#0a0f1e]">
                {c.banner_image_url ? (
                  <img src={c.banner_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex gap-2">
                      {c.allowed_platforms.map((p) => (
                        <PlatformIcon key={p} platform={p} className="w-6 h-6 opacity-20" />
                      ))}
                    </div>
                  </div>
                )}
                {c.partner_rpm_usd != null && (
                  <span className="absolute top-2 right-2 text-[11px] font-bold text-blu-400 bg-[#060b18]/80 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-blu-500/20">
                    ${c.partner_rpm_usd.toFixed(2)}/1K
                  </span>
                )}
              </div>
              {/* Content */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start gap-2.5 mb-2">
                  {c.logo_url && (
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-[#1e293b] -mt-6 relative bg-[#111827]">
                      <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <h3 className="text-[14px] font-bold text-white font-display leading-snug">{c.title}</h3>
                </div>
                <p className="text-[12px] text-[#475569] line-clamp-2 mb-3">{c.description}</p>
                <div className="flex gap-1.5 mt-auto">
                  {c.allowed_platforms.map((p) => (
                    <span key={p} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${platformColor(p)}15`, color: platformColor(p), border: `1px solid ${platformColor(p)}25` }}>
                      <PlatformIcon platform={p} className="w-3 h-3 inline-block" /> {p}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
      <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-extrabold font-display tracking-tight ${accent ? "text-blu-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
