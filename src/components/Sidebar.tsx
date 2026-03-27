"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/submissions", label: "Submissions", icon: "submissions" },
  { href: "/earnings", label: "Earnings", icon: "earnings" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

interface SidebarProps {
  username: string;
  email: string;
  role: string;
}

export default function Sidebar({ username, email, role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
    router.refresh();
  };

  const allItems = role === "admin"
    ? [...navItems, { href: "/admin", label: "Admin", icon: "admin" }]
    : navItems;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-[#0a0f1e] border-r border-[#1e293b] z-50">
        <div className="p-5 pb-4">
          <Image src="/logos/blustu-logo.png" alt="BluStu" width={110} height={40}
            className="rounded-[4px]" style={{ objectFit: "contain", width: "auto", height: "auto" }} priority />
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {allItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all text-left",
                  active
                    ? "bg-blu-500/10 text-blu-400"
                    : "text-[#64748b] hover:bg-[#111827] hover:text-[#94a3b8]"
                )}>
                <SidebarIcon name={item.icon} active={active} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#1e293b]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blu-500/10 border border-blu-500/20 flex items-center justify-center text-[12px] font-bold text-blu-400 font-display flex-shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">@{username}</div>
              <div className="text-[11px] text-[#475569] truncate">{email}</div>
            </div>
          </div>
          <button onClick={handleSignOut}
            className="w-full mt-1 px-3 py-2 rounded-lg text-[12px] font-medium text-[#475569] hover:text-[#94a3b8] hover:bg-[#111827] transition-all text-left">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0f1e] border-t border-[#1e293b] z-50 flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
        {allItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-[10px] font-semibold transition-colors",
                active ? "text-blu-400" : "text-[#475569]"
              )}>
              <SidebarIcon name={item.icon} active={active} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

function SidebarIcon({ name, active }: { name: string; active: boolean }) {
  const cls = "w-[18px] h-[18px]";
  const color = "currentColor";

  if (name === "home") return (
    <svg className={cls} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  );
  if (name === "campaigns") return (
    <svg className={cls} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
  if (name === "submissions") return (
    <svg className={cls} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" />
    </svg>
  );
  if (name === "earnings") return (
    <svg className={cls} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
  if (name === "settings") return (
    <svg className={cls} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  if (name === "admin") return (
    <svg className={cls} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
  return null;
}
