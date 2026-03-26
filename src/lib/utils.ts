export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function daysRemaining(endsAt: string | null): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
}

export function platformIcon(p: string): string {
  return ({ tiktok: "\u266A", instagram: "\u25CE", youtube: "\u25B6" } as Record<string, string>)[p] || p;
}

export function platformColor(p: string): string {
  return ({ tiktok: "#ff0050", instagram: "#E1306C", youtube: "#FF0000" } as Record<string, string>)[p] || "#888";
}

export function statusStyle(s: string): { bg: string; text: string; border: string } {
  if (s === "approved") return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
  if (s === "rejected") return { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };
  return { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" };
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Extract a thumbnail URL from a video content URL (YouTube only, others return null). */
export function extractThumbnail(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  return null;
}

/** Format a number with K/M suffixes for compact display. */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
