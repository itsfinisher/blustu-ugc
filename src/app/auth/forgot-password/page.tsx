"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/sign-in`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  const inputClass =
    "w-full px-4 py-3 bg-[#0a0f1e] border border-[#1e293b] rounded-xl text-sm text-white placeholder:text-[#475569] outline-none transition-all focus:border-blu-500 focus:ring-[3px] focus:ring-blu-500/10";

  return (
    <>
      <h2 className="font-display text-2xl font-extrabold text-white mb-1 tracking-tight">
        Reset password
      </h2>
      <p className="text-[#64748b] text-sm mb-7">We&apos;ll send you a reset link</p>

      <div className="bg-[#111827] rounded-2xl p-7 border border-[#1e293b]">
        {sent ? (
          <div className="text-center py-4">
            <div className="w-[52px] h-[52px] rounded-full bg-blu-500/10 flex items-center justify-center mx-auto mb-3.5 text-2xl">
              ✉️
            </div>
            <p className="font-bold text-white mb-1.5 font-display">Check your email</p>
            <p className="text-[#64748b] text-sm">We&apos;ve sent a reset link to {email}</p>
            <Link
              href="/auth/sign-in"
              className="inline-block mt-4 text-blu-400 text-[13px] font-semibold hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 mb-4 text-red-400 text-[13px] font-medium">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blu-500 text-white rounded-xl text-[15px] font-bold font-display cursor-pointer transition-all hover:bg-blu-600 hover:shadow-[0_4px_12px_rgba(47,149,232,0.25)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-h-[48px]"
              >
                {loading ? <span className="spinner" /> : "Send Reset Link"}
              </button>
            </div>
            <p className="mt-5 text-center">
              <Link href="/auth/sign-in" className="text-blu-400 text-[13px] font-semibold hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </>
  );
}
