"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { toast } from "sonner";

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    toast.success("Welcome back!");
    router.push("/dashboard");
    router.refresh();
  };

  const inputClass =
    "w-full px-4 py-3 bg-[#0a0f1e] border border-[#1e293b] rounded-xl text-sm text-white placeholder:text-[#475569] outline-none transition-all focus:border-blu-500 focus:ring-[3px] focus:ring-blu-500/10";

  return (
    <>
      <h2 className="font-display text-2xl font-extrabold text-white mb-1 tracking-tight">
        Welcome back
      </h2>
      <p className="text-[#64748b] text-sm mb-7">Sign in to your creator portal</p>

      <form onSubmit={handleSubmit} className="bg-[#111827] rounded-2xl p-7 border border-[#1e293b]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 mb-4 text-red-400 text-[13px] font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@example.com" required className={inputClass} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required className={inputClass} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-blu-500 text-white rounded-xl text-[15px] font-bold font-display cursor-pointer transition-all hover:bg-blu-600 hover:shadow-[0_4px_12px_rgba(47,149,232,0.25)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-h-[48px] mt-1">
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </div>

        <div className="mt-5 text-center text-[13px] text-[#64748b] space-y-2">
          <Link href="/auth/forgot-password" className="block text-blu-500 font-semibold hover:underline">
            Forgot password?
          </Link>
          <p>
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="text-blu-500 font-semibold hover:underline">Sign up</Link>
          </p>
        </div>
      </form>
    </>
  );
}
