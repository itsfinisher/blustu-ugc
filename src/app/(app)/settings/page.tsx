"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { YouTubeIcon, TikTokIcon, InstagramIcon } from "@/components/PlatformIcons";

type Tab = "profile" | "accounts";

interface Profile {
  username: string;
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

interface LinkedAccount {
  id: string;
  platform: string;
  username: string;
  url: string;
  created_at: string;
}

const PLATFORM_ICONS: Record<string, React.FC<{ className?: string }>> = {
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
};

const PLATFORMS = [
  { value: "youtube", label: "YouTube", color: "#FF0000" },
  { value: "tiktok", label: "TikTok", color: "#00f2ea" },
  { value: "instagram", label: "Instagram", color: "#E1306C" },
];

export default function SettingsPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");

  // Profile state
  const [profile, setProfile] = useState<Profile>({ username: "", full_name: null, phone_number: null, avatar_url: null });
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Connected accounts state
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [addingAccount, setAddingAccount] = useState(false);
  const [newPlatform, setNewPlatform] = useState("tiktok");
  const [newUsername, setNewUsername] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email || "");

      const { data: p } = await supabase
        .from("profiles")
        .select("username, full_name, phone_number, avatar_url")
        .eq("id", user.id)
        .single();

      if (p) {
        setProfile(p);
        setFullName(p.full_name || "");
        setUsername(p.username || "");
        setPhoneNumber(p.phone_number || "");
      }

      const { data: accs } = await supabase
        .from("linked_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      setAccounts(accs || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleSaveProfile = async () => {
    if (!username.trim()) { toast.error("Username is required"); return; }
    if (username.includes(" ")) { toast.error("Username cannot contain spaces"); return; }
    setSavingProfile(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        username: username.trim().toLowerCase(),
        phone_number: phoneNumber.trim() || null,
      })
      .eq("id", userId);

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Username is already taken" : error.message);
    } else {
      setProfile((prev) => ({ ...prev, full_name: fullName.trim() || null, username: username.trim().toLowerCase(), phone_number: phoneNumber.trim() || null }));
      toast.success("Profile updated");
    }
    setSavingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("File must be an image"); return; }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); setUploadingAvatar(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
    if (updateError) { toast.error(updateError.message); } else {
      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
      toast.success("Avatar updated");
    }
    setUploadingAvatar(false);
  };

  const handleRemoveAvatar = async () => {
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    setProfile((prev) => ({ ...prev, avatar_url: null }));
    toast.success("Avatar removed");
  };

  const buildProfileUrl = (platform: string, uname: string): string => {
    if (platform === "tiktok") return `https://www.tiktok.com/@${uname}`;
    if (platform === "instagram") return `https://www.instagram.com/${uname}`;
    if (platform === "youtube") return `https://www.youtube.com/@${uname}`;
    return "";
  };

  const handleAddAccount = async () => {
    if (!newUsername.trim()) { toast.error("Username is required"); return; }
    setSavingAccount(true);

    const cleanUsername = newUsername.trim().replace(/^@/, "");
    const url = buildProfileUrl(newPlatform, cleanUsername);

    const { data, error } = await supabase
      .from("linked_accounts")
      .insert({ user_id: userId, platform: newPlatform, username: cleanUsername, url })
      .select()
      .single();

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Account already linked" : error.message);
    } else {
      setAccounts((prev) => [...prev, data]);
      setNewUsername("");
      setAddingAccount(false);
      toast.success("Account linked");
    }
    setSavingAccount(false);
  };

  const handleRemoveAccount = async (id: string) => {
    const { error } = await supabase.from("linked_accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Account removed");
  };

  const inputClass = "w-full px-4 py-3 bg-[#0a0f1e] border border-[#1e293b] rounded-xl text-sm text-white placeholder:text-[#475569] outline-none transition-all focus:border-blu-500 focus:ring-[3px] focus:ring-blu-500/10";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-dark h-10 w-48 rounded-xl" />
        <div className="skeleton-dark h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-white font-display tracking-tight">Settings</h1>
        <p className="text-sm text-[#64748b] mt-1">Manage your profile and connected accounts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1e293b] pb-px">
        {([
          { key: "profile" as Tab, label: "Profile" },
          { key: "accounts" as Tab, label: "Connected Accounts", count: accounts.length },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-[13px] font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
              tab === t.key ? "text-blu-400 border-blu-400" : "text-[#64748b] border-transparent hover:text-[#94a3b8]"
            )}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="text-[10px] bg-[#1e293b] px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === "profile" && (
        <div className="max-w-xl space-y-6">
          {/* Avatar */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
            <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-4">Profile Picture</h3>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#0a0f1e] border-2 border-dashed border-[#1e293b] flex items-center justify-center flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-[#334155]">{(profile.full_name || profile.username || "?").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex gap-2.5">
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
                  className="px-4 py-2 bg-[#1e293b] border border-[#334155] text-white rounded-lg text-[12px] font-semibold hover:bg-[#334155] transition-all disabled:opacity-40">
                  {uploadingAvatar ? "Uploading..." : "Change"}
                </button>
                {profile.avatar_url && (
                  <button onClick={handleRemoveAvatar}
                    className="px-4 py-2 text-red-400 border border-red-500/20 rounded-lg text-[12px] font-semibold hover:bg-red-500/10 transition-all">
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#475569] mt-3">Upload a profile picture (max 2MB)</p>
          </div>

          {/* Profile Info */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
            <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name" className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="username" className={inputClass} />
                <p className="text-[10px] text-[#475569] mt-1">Lowercase letters, numbers, and underscores only</p>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Email</label>
                <input type="email" value={email} disabled className={cn(inputClass, "opacity-50 cursor-not-allowed")} />
                <p className="text-[10px] text-[#475569] mt-1">Contact support to change your email</p>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Phone Number</label>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000" className={inputClass} />
              </div>
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="w-full py-3 bg-blu-500 text-white rounded-xl text-[14px] font-bold font-display transition-all hover:bg-blu-600 active:scale-[0.98] disabled:opacity-40">
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected Accounts Tab */}
      {tab === "accounts" && (
        <div className="max-w-xl space-y-5">
          {/* Info banner */}
          <div className="bg-blu-500/5 border border-blu-500/15 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-4 h-4 text-blu-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-[12px] text-blu-400/80">
              Connect your social media accounts to submit content to campaigns. You can link multiple accounts per platform.
            </p>
          </div>

          {/* Add account button */}
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Social Accounts</h3>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.value} onClick={() => { setNewPlatform(p.value); setAddingAccount(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all hover:bg-[#111827]"
                  style={{ borderColor: `${p.color}30`, color: p.color }}>
                  {(() => { const Icon = PLATFORM_ICONS[p.value]; return Icon ? <Icon className="w-3.5 h-3.5" /> : null; })()}
                  {p.label} +
                </button>
              ))}
            </div>
          </div>

          {/* Add account form */}
          {addingAccount && (
            <div className="bg-[#111827] border border-blu-500/20 rounded-xl p-5 animate-fade-in">
              <h4 className="text-sm font-bold text-white font-display mb-3">
                Link {PLATFORMS.find((p) => p.value === newPlatform)?.label} Account
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Platform</label>
                  <div className="flex gap-2">
                    {PLATFORMS.map((p) => (
                      <button key={p.value} onClick={() => setNewPlatform(p.value)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-all",
                          newPlatform === p.value
                            ? "border-blu-500/30 bg-blu-500/10 text-white"
                            : "border-[#1e293b] text-[#475569] hover:border-[#334155]"
                        )}>
                        {(() => { const Icon = PLATFORM_ICONS[p.value]; return Icon ? <Icon className="w-3.5 h-3.5" /> : null; })()}
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#94a3b8] mb-1.5">Username</label>
                  <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="@username" className={inputClass} />
                </div>
                <div className="flex gap-2.5">
                  <button onClick={handleAddAccount} disabled={savingAccount || !newUsername.trim()}
                    className="flex-1 py-2.5 bg-blu-500 text-white rounded-xl text-[13px] font-bold transition-all hover:bg-blu-600 active:scale-[0.98] disabled:opacity-40">
                    {savingAccount ? "Linking..." : "Link Account"}
                  </button>
                  <button onClick={() => { setAddingAccount(false); setNewUsername(""); }}
                    className="px-4 py-2.5 text-[#475569] text-[13px] font-semibold hover:text-[#94a3b8] transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account list */}
          {accounts.length === 0 && !addingAccount ? (
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-[#0a0f1e] border border-[#1e293b] flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#334155]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.657-5.513a4.5 4.5 0 010 6.364l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
                </svg>
              </div>
              <p className="text-[#475569] text-sm font-medium">No accounts connected</p>
              <p className="text-[#334155] text-[12px] mt-1">Connect your social media accounts to get started.</p>
            </div>
          ) : (
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden divide-y divide-[#1e293b]">
              {accounts.map((acc) => {
                const p = PLATFORMS.find((pl) => pl.value === acc.platform);
                return (
                  <div key={acc.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${p?.color || "#475569"}15`, color: p?.color || "#475569" }}>
                      {(() => { const Icon = PLATFORM_ICONS[acc.platform]; return Icon ? <Icon className="w-5 h-5" /> : null; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: `${p?.color || "#475569"}15`, color: p?.color || "#475569" }}>
                          {acc.platform}
                        </span>
                      </div>
                      <a href={acc.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-semibold text-white hover:text-blu-400 transition-colors">
                        @{acc.username}
                      </a>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        Verified
                      </span>
                      <button onClick={() => handleRemoveAccount(acc.id)}
                        className="text-[11px] text-[#475569] hover:text-red-400 transition-colors font-semibold">
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
