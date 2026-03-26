"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { getCampaigns, enrichCampaigns, type EnrichedCampaign, type CampaignOverride } from "@/lib/api";
import { platformIcon, platformColor, daysRemaining, cn } from "@/lib/utils";

export default function CampaignsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<EnrichedCampaign[]>([]);
  const [memberships, setMemberships] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: mems } = await supabase
        .from("campaign_memberships")
        .select("campaign_id, status")
        .eq("user_id", user.id);

      if (mems) {
        const map = new Map<string, string>();
        mems.forEach((m: { campaign_id: string; status: string }) => map.set(m.campaign_id, m.status));
        setMemberships(map);
      }

      const [campData, overridesRes] = await Promise.all([
        getCampaigns().catch(() => []),
        supabase.from("campaign_overrides").select("*"),
      ]);

      setCampaigns(enrichCampaigns(campData, (overridesRes.data || []) as CampaignOverride[]));
      setLoading(false);
    }
    load();
  }, [supabase]);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-white font-display tracking-tight">Campaigns</h1>
        <p className="text-sm text-[#64748b] mt-1">Browse and join active campaigns</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-dark h-56 rounded-xl" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-[#111827] border border-[#1e293b] flex items-center justify-center mx-auto mb-4 text-3xl">
            📋
          </div>
          <p className="text-[#64748b] text-sm font-medium">No campaigns available right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const days = daysRemaining(c.ends_at);
            const memberStatus = memberships.get(c.id);

            return (
              <button key={c.id} onClick={() => router.push(`/campaigns/${c.id}`)}
                className="bg-[#111827] border border-[#1e293b] rounded-xl text-left transition-all hover:border-blu-500/30 hover:bg-[#0f1629] flex flex-col overflow-hidden group">

                {/* Banner image area */}
                <div className="w-full h-36 relative overflow-hidden bg-gradient-to-br from-[#1e293b] to-[#0a0f1e]">
                  {c.banner_image_url ? (
                    <img src={c.banner_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="flex gap-2">
                        {c.allowed_platforms.map((p) => (
                          <span key={p} className="text-3xl opacity-20">{platformIcon(p)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* RPM badge overlay */}
                  {c.partner_rpm_usd != null && (
                    <span className="absolute top-3 right-3 text-[12px] font-bold text-blu-400 bg-[#060b18]/80 backdrop-blur-sm px-3 py-1 rounded-full border border-blu-500/20">
                      ${c.partner_rpm_usd.toFixed(2)}/1K
                    </span>
                  )}
                  {/* Status badges */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {c.is_elite_only && (
                      <span className="text-[9px] font-bold text-amber-400 bg-[#060b18]/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-amber-500/20 uppercase">
                        Elite
                      </span>
                    )}
                    {memberStatus && (
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase backdrop-blur-sm",
                        memberStatus === "approved" ? "text-emerald-400 bg-[#060b18]/80 border border-emerald-500/20" :
                        memberStatus === "rejected" ? "text-red-400 bg-[#060b18]/80 border border-red-500/20" :
                        "text-amber-400 bg-[#060b18]/80 border border-amber-500/20"
                      )}>
                        {memberStatus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-2">
                    {c.logo_url && (
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-[#1e293b] -mt-7 relative bg-[#111827]">
                        <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h3 className="text-[15px] font-bold text-white font-display leading-snug">{c.title}</h3>
                  </div>

                  <p className="text-[12px] text-[#475569] line-clamp-2 mb-3">{c.description}</p>

                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {c.allowed_platforms.map((p) => (
                      <span key={p} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${platformColor(p)}15`, color: platformColor(p), border: `1px solid ${platformColor(p)}25` }}>
                        {platformIcon(p)} {p}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-3 border-t border-[#1e293b] flex justify-between items-center">
                    <span className="text-[11px] text-[#475569]">
                      Max ${c.max_payout_usd.toFixed(0)} per post
                    </span>
                    {days !== null && (
                      <span className={`text-[11px] font-semibold ${days <= 3 ? "text-red-400" : "text-[#475569]"}`}>
                        {days === 0 ? "Ends today" : `${days}d left`}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
