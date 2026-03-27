"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { toast } from "sonner";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [contentLink1, setContentLink1] = useState("");
  const [contentLink2, setContentLink2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) { setError("Full name is required"); return; }
    if (!username.trim()) { setError("Username is required"); return; }
    if (username.includes(" ")) { setError("Username cannot contain spaces"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!contentLink1.trim()) { setError("At least one content link is required"); return; }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const contentLinks = [contentLink1.trim(), contentLink2.trim()].filter(Boolean);

      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        status: "pending",
        role: "creator",
        content_links: contentLinks,
      });

      if (profileError) {
        setError(
          profileError.message.includes("duplicate")
            ? "Username is already taken"
            : profileError.message
        );
        setLoading(false);
        return;
      }
    }

    toast.success("Application submitted! We'll review it shortly.");
    router.push("/pending");
    router.refresh();
  };

  const inputClass =
    "w-full px-4 py-3 bg-[#0a0f1e] border border-[#1e293b] rounded-xl text-sm text-white placeholder:text-[#475569] outline-none transition-all focus:border-blu-500 focus:ring-[3px] focus:ring-blu-500/10";

  return (
    <>
      <h2 className="font-display text-2xl font-extrabold text-white mb-1 tracking-tight">
        Apply to join BluStu
      </h2>
      <p className="text-[#64748b] text-sm mb-7">Submit your application to the creator network</p>

      <form onSubmit={handleSubmit} className="bg-[#111827] rounded-2xl p-7 border border-[#1e293b]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 mb-4 text-red-400 text-[13px] font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name" required className={inputClass} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="coolcreator" required className={inputClass} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@example.com" required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6} className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required minLength={6} className={inputClass} />
            </div>
          </div>

          <div className="pt-2 border-t border-[#1e293b]">
            <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1">Content Portfolio</label>
            <p className="text-[11px] text-[#475569] mb-3">Link 1-2 pieces of content you&apos;ve created (TikTok, Instagram, YouTube)</p>
            <div className="space-y-2.5">
              <input type="url" value={contentLink1} onChange={(e) => setContentLink1(e.target.value)}
                placeholder="https://www.tiktok.com/@you/video/..." required className={inputClass} />
              <input type="url" value={contentLink2} onChange={(e) => setContentLink2(e.target.value)}
                placeholder="https://www.instagram.com/reel/... (optional)" className={inputClass} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-blu-500 text-white rounded-xl text-[15px] font-bold font-display cursor-pointer transition-all hover:bg-blu-600 hover:shadow-[0_4px_12px_rgba(47,149,232,0.25)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-h-[48px] mt-1">
            {loading ? <span className="spinner" /> : "Submit Application"}
          </button>
        </div>

        <p className="mt-5 text-center text-[13px] text-[#64748b]">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-blu-500 font-semibold hover:underline">Sign in</Link>
        </p>
      </form>
    </>
  );
}
