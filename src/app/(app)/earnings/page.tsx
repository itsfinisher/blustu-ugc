"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { getCampaigns, type Campaign } from "@/lib/api";
import { syncUserSubmissions, type LocalSubmission } from "@/lib/sync";
import { platformIcon, cn, compactNumber } from "@/lib/utils";

interface CampaignEarnings {
  campaign: Campaign;
  approvedSubs: LocalSubmission[];
  pendingSubs: LocalSubmission[];
  approvedViews: number;
  pendingViews: number;
  approvedEarnings: number;
  pendingEarnings: number;
}

export default function EarningsPage() {
  const supabase = createClient();
  const [campaignEarnings, setCampaignEarnings] = useState<CampaignEarnings[]>([]);
  const [totals, setTotals] = useState({ approvedEarnings: 0, pendingEarnings: 0, approvedViews: 0, pendingViews: 0, approvedCount: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles").select("username").eq("id", user.id).single();
      const uname = profile?.username || "creator";

      let campaigns: Campaign[] = [];
      try { campaigns = await getCampaigns(); } catch {}

      const { data: subs } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });

      calculateEarnings(campaigns, subs || []);
      setLoading(false);

      syncUserSubmissions(supabase, user.id, uname).then(async () => {
        const { data: refreshed } = await supabase
          .from("submissions")
          .select("*")
          .eq("user_id", user.id)
          .neq("status", "deleted")
          .order("created_at", { ascending: false });
        if (refreshed) calculateEarnings(campaigns, refreshed);
      });
    }

    function calculateEarnings(campaigns: Campaign[], submissions: LocalSubmission[]) {
      const campMap = new Map<string, Campaign>();
      campaigns.forEach((c) => campMap.set(c.id, c));

      const approved = submissions.filter((s) => s.status === "approved");
      const pending = submissions.filter((s) => s.status === "pending");

      // Group by campaign
      const approvedByCamp = new Map<string, LocalSubmission[]>();
      const pendingByCamp = new Map<string, LocalSubmission[]>();
      for (const s of approved) {
        const arr = approvedByCamp.get(s.campaign_id) || [];
        arr.push(s);
        approvedByCamp.set(s.campaign_id, arr);
      }
      for (const s of pending) {
        const arr = pendingByCamp.get(s.campaign_id) || [];
        arr.push(s);
        pendingByCamp.set(s.campaign_id, arr);
      }

      const results: CampaignEarnings[] = [];
      let grandApprovedEarnings = 0, grandPendingEarnings = 0;
      let grandApprovedViews = 0, grandPendingViews = 0;

      // Build results for all campaigns that have any submissions
      const allCampIds = new Set<string>();
      approvedByCamp.forEach((_, k) => allCampIds.add(k));
      pendingByCamp.forEach((_, k) => allCampIds.add(k));
      allCampIds.forEach((campId) => {
        const campaign = campMap.get(campId);
        if (!campaign) return;
        const rpm = campaign.partner_rpm_usd || 0;

        const aSubs = approvedByCamp.get(campId) || [];
        const pSubs = pendingByCamp.get(campId) || [];
        const aViews = aSubs.reduce((a, s) => a + (s.views || 0), 0);
        const pViews = pSubs.reduce((a, s) => a + (s.views || 0), 0);
        const aEarn = (aViews / 1000) * rpm;
        const pEarn = (pViews / 1000) * rpm;

        grandApprovedEarnings += aEarn;
        grandPendingEarnings += pEarn;
        grandApprovedViews += aViews;
        grandPendingViews += pViews;

        results.push({
          campaign, approvedSubs: aSubs, pendingSubs: pSubs,
          approvedViews: aViews, pendingViews: pViews,
          approvedEarnings: aEarn, pendingEarnings: pEarn,
        });
      });

      // Include campaigns with no submissions
      campaigns.forEach((c) => {
        if (!allCampIds.has(c.id)) {
          results.push({
            campaign: c, approvedSubs: [], pendingSubs: [],
            approvedViews: 0, pendingViews: 0,
            approvedEarnings: 0, pendingEarnings: 0,
          });
        }
      });

      results.sort((a, b) => (b.approvedEarnings + b.pendingEarnings) - (a.approvedEarnings + a.pendingEarnings));
      setCampaignEarnings(results);
      setTotals({
        approvedEarnings: grandApprovedEarnings, pendingEarnings: grandPendingEarnings,
        approvedViews: grandApprovedViews, pendingViews: grandPendingViews,
        approvedCount: approved.length, pendingCount: pending.length,
      });
    }

    load();
  }, [supabase]);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-white font-display tracking-tight">Earnings</h1>
        <p className="text-sm text-[#64748b] mt-1">Track your revenue across campaigns</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#111827] border border-emerald-500/20 rounded-xl p-4 col-span-2 lg:col-span-1">
          <div className="text-[11px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-1">Approved Earnings</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-display">
            {loading ? "\u2014" : `$${totals.approvedEarnings.toFixed(2)}`}
          </div>
          <div className="text-[10px] text-emerald-400/50 mt-0.5">
            {loading ? "" : `${totals.approvedCount} post${totals.approvedCount !== 1 ? "s" : ""} \u00B7 ${compactNumber(totals.approvedViews)} views`}
          </div>
        </div>
        <div className="bg-[#111827] border border-amber-500/20 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-amber-400/70 uppercase tracking-wider mb-1">Pending Earnings</div>
          <div className="text-2xl font-extrabold text-amber-400 font-display">
            {loading ? "\u2014" : `$${totals.pendingEarnings.toFixed(2)}`}
          </div>
          <div className="text-[10px] text-amber-400/50 mt-0.5">
            {loading ? "" : `${totals.pendingCount} post${totals.pendingCount !== 1 ? "s" : ""} \u00B7 ${compactNumber(totals.pendingViews)} views`}
          </div>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider mb-1">Avg per Approved Post</div>
          <div className="text-2xl font-extrabold text-blu-400 font-display">
            {loading ? "\u2014" : totals.approvedCount > 0 ? `$${(totals.approvedEarnings / totals.approvedCount).toFixed(2)}` : "$0.00"}
          </div>
        </div>
      </div>

      {/* Pending earnings notice */}
      {!loading && totals.pendingEarnings > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
          <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <p className="text-[12px] text-amber-400/80">
            Pending earnings are estimated based on current views but have not been approved yet.
            Only approved submissions count toward your actual earnings.
          </p>
        </div>
      )}

      {/* Campaign breakdown */}
      <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-3">By Campaign</h2>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-dark h-28 rounded-xl" />)}
        </div>
      ) : campaignEarnings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#475569] text-sm">No campaigns yet. Join a campaign and start earning!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaignEarnings.map((ce) => {
            const rpm = ce.campaign.partner_rpm_usd || 0;
            const totalEarn = ce.approvedEarnings + ce.pendingEarnings;
            return (
              <div key={ce.campaign.id} className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-white font-display">{ce.campaign.title}</h3>
                    <div className="flex gap-1.5 mt-1">
                      {ce.campaign.allowed_platforms.map((p) => (
                        <span key={p} className="text-[10px] font-semibold text-[#475569]">
                          {platformIcon(p)} {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {ce.approvedEarnings > 0 && (
                      <div className="text-xl font-extrabold text-emerald-400 font-display">
                        ${ce.approvedEarnings.toFixed(2)}
                      </div>
                    )}
                    {ce.pendingEarnings > 0 && (
                      <div className={cn(
                        "font-extrabold text-amber-400 font-display",
                        ce.approvedEarnings > 0 ? "text-sm" : "text-xl"
                      )}>
                        {ce.approvedEarnings > 0 && "+"} ${ce.pendingEarnings.toFixed(2)}
                        <span className="text-[10px] font-normal text-amber-400/60 ml-1">pending</span>
                      </div>
                    )}
                    {totalEarn === 0 && (
                      <div className="text-xl font-extrabold text-[#334155] font-display">$0.00</div>
                    )}
                    <div className="text-[10px] text-[#475569]">
                      {ce.approvedEarnings > 0 ? "approved earnings" : totalEarn > 0 ? "" : "earned"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#0a0f1e] rounded-lg p-3">
                    <div className="text-[10px] text-[#475569] mb-0.5">RPM</div>
                    <div className="text-sm font-bold text-white font-display">${rpm.toFixed(2)}</div>
                  </div>
                  <div className="bg-[#0a0f1e] rounded-lg p-3">
                    <div className="text-[10px] text-[#475569] mb-0.5">Total Views</div>
                    <div className="text-sm font-bold text-white font-display">{compactNumber(ce.approvedViews + ce.pendingViews)}</div>
                  </div>
                  <div className="bg-[#0a0f1e] rounded-lg p-3">
                    <div className="text-[10px] text-emerald-400/60 mb-0.5">Approved</div>
                    <div className="text-sm font-bold text-emerald-400 font-display">{ce.approvedSubs.length}</div>
                  </div>
                  <div className="bg-[#0a0f1e] rounded-lg p-3">
                    <div className="text-[10px] text-amber-400/60 mb-0.5">Pending</div>
                    <div className="text-sm font-bold text-amber-400 font-display">{ce.pendingSubs.length}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
