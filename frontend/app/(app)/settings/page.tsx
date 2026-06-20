"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import {
  User,
  Lock,
  Building,
  Key,
  ShieldAlert,
  Copy,
  Check,
  Loader2,
  Trash2,
  RefreshCw,
  Sparkles,
  Info
} from "lucide-react";

interface MeResponse {
  id: string;
  email: string;
  role: string;
  org_name: string;
  org_plan: string;
  created_at: string;
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // API Key state (Mocked locally for SaaS tier display)
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  useEffect(() => {
    fetchMe();
    // Load mock API key from localStorage if it exists
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("optiquery_mock_api_key");
      if (savedKey) setApiKey(savedKey);
    }
  }, []);

  async function fetchMe() {
    setLoadingMe(true);
    try {
      const res = await apiClient.get("/auth/me");
      setMeData(res.data);
    } catch (err) {
      console.error("Failed to load user settings profile information", err);
    } finally {
      setLoadingMe(false);
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    setPasswordLoading(true);
    try {
      await apiClient.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess("Password successfully updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail || "Failed to update user password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const generateApiKey = () => {
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    const key = `oq_live_${randomHex}`;
    setApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("optiquery_mock_api_key", key);
    }
  };

  const revokeApiKey = () => {
    if (confirm("Are you sure you want to revoke this API Key? Any client application using this key will immediately lose access to OptiQuery agents.")) {
      setApiKey(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("optiquery_mock_api_key");
      }
    }
  };

  const copyToClipboard = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const getPlanBadgeStyle = (plan?: string) => {
    const p = plan?.toLowerCase() || "free";
    if (p === "enterprise" || p === "pro") {
      return "bg-purple-500/10 border-purple-500/35 text-purple-400";
    }
    return "bg-slate-500/10 border-slate-500/20 text-slate-400";
  };

  if (loadingMe) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Fetching profile configurations...
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 p-8 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header Title */}
      <div className="mb-8 border-b border-slate-900/60 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white glow-text">Account Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your personal credentials, organizational plan limits, and token integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile settings & Password management */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Section Card */}
          <div className="glass-panel rounded-xl p-6 border border-slate-800/80">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2 mb-6">
              <User className="h-4.5 w-4.5 text-purple-450" /> Profile Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={meData?.email || user?.email || ""}
                  className="w-full bg-slate-950/60 border border-slate-900 px-4 py-2.5 rounded-lg text-slate-400 focus:outline-none cursor-not-allowed text-xs font-semibold"
                />
                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
                  <Info className="h-3 w-3 text-slate-500 shrink-0" />
                  Email updates are managed via organization SSO administrators.
                </p>
              </div>
            </div>
          </div>

          {/* Password Section Card */}
          <div className="glass-panel rounded-xl p-6 border border-slate-800/80">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2 mb-6">
              <Lock className="h-4.5 w-4.5 text-purple-450" /> Update Password
            </h2>

            {passwordError && (
              <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-lg mb-5 animate-shake">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-lg mb-5">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-lg btn-premium-primary text-xs font-bold text-white transition-all shadow-md shadow-purple-600/10"
                >
                  {passwordLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Organization Details & API Keys */}
        <div className="lg:col-span-1 space-y-8">
          {/* Organization Info Card */}
          <div className="glass-panel rounded-xl p-6 border border-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2 mb-6">
              <Building className="h-4.5 w-4.5 text-purple-455" /> Organization Details
            </h2>

            <div className="space-y-4">
              <div>
                <span className="block text-[9px] font-bold text-slate-550 uppercase tracking-wider">
                  Organization Context
                </span>
                <span className="text-sm font-bold text-slate-200 block mt-1">
                  {meData?.org_name || "OptiQuery AI Client"}
                </span>
              </div>

              <div className="border-t border-slate-900/60 pt-4 flex justify-between items-center">
                <div>
                  <span className="block text-[9px] font-bold text-slate-550 uppercase tracking-wider">
                    Subscription Tier
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                    Limits scale with organization plan.
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getPlanBadgeStyle(meData?.org_plan)}`}>
                  <Sparkles className="h-3 w-3" /> {meData?.org_plan || "Free"} Plan
                </span>
              </div>
            </div>
          </div>

          {/* API Key Box Card */}
          <div className="glass-panel rounded-xl p-6 border border-slate-800/80">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2 mb-4">
              <Key className="h-4.5 w-4.5 text-purple-450" /> Developer API Keys
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Generate credentials to interact with OptiQuery query validation and optimization pipelines programmatically.
            </p>

            {apiKey ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="password"
                      readOnly
                      value={apiKey}
                      className="w-full bg-slate-950 border border-slate-850 pl-3.5 pr-10 py-2.5 rounded-lg text-slate-300 focus:outline-none text-xs font-mono select-all"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
                      title="Copy Key to Clipboard"
                    >
                      {apiKeyCopied ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={revokeApiKey}
                    className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 text-red-400 transition-all"
                    title="Revoke Key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg flex gap-2.5 items-start">
                  <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-450 leading-relaxed font-semibold">
                    Keep this key private. Do not commit it to Git repositories or publish it in client-side production packages.
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={generateApiKey}
                className="w-full py-2.5 rounded-lg bg-purple-650 hover:bg-purple-700 text-xs font-bold text-white shadow-md shadow-purple-600/10 transition-all flex items-center justify-center gap-2"
              >
                <Key className="h-4 w-4" /> Generate New API Key
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
