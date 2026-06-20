"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "../../stores/auth-store";
import { logout } from "../../lib/auth";
import {
  LayoutDashboard,
  Database,
  MessageSquare,
  History,
  LogOut,
  Sun,
  Moon,
  User,
  ShieldAlert,
  Terminal,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [theme, setTheme] = useState<"light" | "dark">("dark"); // Default to dark

  // Initialize theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
      const initialTheme = savedTheme || "dark";
      setTheme(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      clearUser();
      router.push("/login");
    }
  };

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Connections", href: "/connections", icon: Database },
    { name: "SQL Playground", href: "/playground", icon: Terminal },
    { name: "Chatbot Console", href: "/chat", icon: MessageSquare },
    { name: "Query History", href: "/history", icon: History },
  ];

  return (
    <aside className="w-64 h-screen flex flex-col bg-slate-950/40 backdrop-blur-md border-r border-slate-900/60 text-slate-300 relative z-20">
      {/* Sidebar Header Title */}
      <div className="p-6 border-b border-slate-900/60 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-600/25">
          <ShieldAlert className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-white tracking-wide glow-text text-lg">OptiQuery AI</span>
      </div>

      {/* Navigation Menu Links */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                isActive
                  ? "bg-gradient-to-r from-purple-500/15 to-indigo-500/5 text-purple-400 border-l-2 border-purple-500 pl-3.5 shadow-md shadow-purple-950/10"
                  : "hover:bg-slate-900/30 hover:text-slate-200 text-slate-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer Operations */}
      <div className="p-4 border-t border-slate-800/60 space-y-4">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-medium bg-slate-950/40 border border-slate-900/60 hover:bg-slate-900/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 text-slate-400"
        >
          <span className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-4 w-4 text-purple-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
            {theme === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-500">Toggle</span>
        </button>

        {/* User Badge Info */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-950/25 border border-slate-900/60">
          <div className="h-9 w-9 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold uppercase text-sm">
            {user?.email ? user.email.slice(0, 2) : <User className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user?.email || "guest@optiquery.ai"}
            </p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-600/20 text-purple-400 mt-1 border border-purple-500/30">
              {user?.role || "viewer"}
            </span>
          </div>
        </div>

        {/* Logout Action Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-950/30 hover:text-red-400 text-slate-400 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" />
          Logout Session
        </button>
      </div>
    </aside>
  );
}
