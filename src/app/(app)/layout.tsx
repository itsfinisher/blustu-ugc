"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Sidebar from "@/components/Sidebar";

interface Profile {
  username: string;
  status: string;
  role: string;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/sign-in"); return; }

      setEmail(user.email || "");

      const { data } = await supabase
        .from("profiles")
        .select("username, status, role")
        .eq("id", user.id)
        .single();

      if (!data || data.status !== "approved") {
        router.push("/pending");
        return;
      }

      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060b18]">
        <div className="text-center">
          <div className="spinner-dark mx-auto mb-3" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <p className="text-sm text-[#64748b]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Sidebar username={profile?.username || "creator"} email={email} role={profile?.role || "creator"} />
      <main className="md:ml-[240px] min-h-screen">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28 md:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
