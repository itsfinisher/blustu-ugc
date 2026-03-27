"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { relativeTime, cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null };
}

const CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "creator-win": { label: "Creator Win", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  update: { label: "Update", bg: "bg-blu-500/10", text: "text-blu-400", border: "border-blu-500/20" },
  news: { label: "News", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  tip: { label: "Tip", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

function categoryStyle(cat: string) {
  return CATEGORY_STYLES[cat] || { label: cat, bg: "bg-[#1e293b]/50", text: "text-[#94a3b8]", border: "border-[#1e293b]" };
}

export default function AnnouncementsPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*, profiles(username, avatar_url)")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      setPosts((data as Announcement[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.category === filter);
  const categories = ["all", ...Array.from(new Set(posts.map((p) => p.category)))];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white font-display tracking-tight">Announcements</h1>
        <p className="text-[13px] text-[#475569] mt-1">Updates, creator wins, and news from the BluStu team</p>
      </div>

      {/* Filters */}
      {categories.length > 2 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {categories.map((cat) => {
            const active = filter === cat;
            const style = cat === "all" ? null : categoryStyle(cat);
            return (
              <button key={cat} onClick={() => setFilter(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border",
                  active
                    ? cat === "all"
                      ? "bg-white/10 text-white border-white/20"
                      : `${style!.bg} ${style!.text} ${style!.border}`
                    : "bg-transparent text-[#475569] border-[#1e293b] hover:bg-[#111827]"
                )}>
                {cat === "all" ? "All" : categoryStyle(cat).label}
              </button>
            );
          })}
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-[#1e293b] rounded w-1/4 mb-3" />
              <div className="h-6 bg-[#1e293b] rounded w-3/4 mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-[#1e293b] rounded w-full" />
                <div className="h-3 bg-[#1e293b] rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-12 text-center">
          <div className="text-3xl mb-3 opacity-40">📢</div>
          <p className="text-[#475569] text-sm">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => {
            const style = categoryStyle(post.category);
            return (
              <article key={post.id}
                className={cn(
                  "bg-[#111827] border rounded-xl overflow-hidden transition-all",
                  post.pinned ? "border-blu-500/30 ring-1 ring-blu-500/10" : "border-[#1e293b]"
                )}>
                <div className="p-6">
                  {/* Meta row */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {post.pinned && (
                      <span className="text-[10px] font-bold text-blu-400 bg-blu-500/10 border border-blu-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Pinned
                      </span>
                    )}
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border", style.bg, style.text, style.border)}>
                      {style.label}
                    </span>
                    <span className="text-[11px] text-[#334155]">{relativeTime(post.created_at)}</span>
                  </div>

                  {/* Title */}
                  <h2 className="text-[17px] font-bold text-white font-display mb-3 leading-snug">{post.title}</h2>

                  {/* Body */}
                  <div className="text-[13px] text-[#94a3b8] leading-relaxed whitespace-pre-wrap">{post.body}</div>

                  {/* Author */}
                  {post.profiles?.username && (
                    <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center gap-2">
                      {post.profiles.avatar_url ? (
                        <img src={post.profiles.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-blu-500/10 border border-blu-500/20 flex items-center justify-center text-[9px] font-bold text-blu-400">
                          {post.profiles.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[11px] text-[#475569] font-medium">@{post.profiles.username}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
