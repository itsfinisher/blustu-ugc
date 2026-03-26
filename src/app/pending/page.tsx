"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function PendingPage() {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/sign-in"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .single();

      if (profile?.status === "approved") {
        router.push("/dashboard");
        return;
      }
      setStatus(profile?.status || "pending");
    }
    check();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
  };

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-[#111827] border border-[#1e293b] flex items-center justify-center mx-auto mb-6">
          {status === "rejected" ? (
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-blu-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {status === "rejected" ? (
          <>
            <h1 className="text-2xl font-extrabold text-white font-display mb-2">Application Not Approved</h1>
            <p className="text-[#64748b] text-sm leading-relaxed mb-8">
              Unfortunately, your application wasn&apos;t approved at this time. You can reach out to our team for more information.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-white font-display mb-2">Application Under Review</h1>
            <p className="text-[#64748b] text-sm leading-relaxed mb-8">
              Thanks for applying to BluStu! Our team is reviewing your application. You&apos;ll get access once you&apos;re approved.
            </p>
          </>
        )}

        <button onClick={handleSignOut}
          className="px-6 py-2.5 bg-[#111827] border border-[#1e293b] text-[#94a3b8] rounded-xl text-sm font-semibold hover:border-[#334155] transition-all">
          Sign Out
        </button>
      </div>
    </div>
  );
}
