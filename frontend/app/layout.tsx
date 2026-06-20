"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "../stores/auth-store";
import { getUser } from "../lib/auth";
import Sidebar from "../components/layout/sidebar";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setUser, clearUser } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync session authentication state from localStorage
  useEffect(() => {
    const userSession = getUser();
    if (userSession) {
      setUser(userSession);
    } else {
      clearUser();
    }
    setIsInitialized(true);
  }, [setUser, clearUser]);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <html lang="en" data-theme="dark">
      <head>
        <title>OptiQuery AI - NL-to-SQL SaaS Optimizer</title>
        <meta name="description" content="Production-grade NL-to-SQL SaaS platform and query optimizer." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Anti-flash theme script before render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex bg-slate-950 text-slate-100 antialiased relative overflow-hidden">
        {/* Ambient Premium Radial Background Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-[40%] right-[10%] w-[35%] h-[35%] rounded-full bg-fuchsia-900/5 blur-[100px] pointer-events-none" />
        
        {!isInitialized ? (
          <div className="flex-grow min-h-screen flex items-center justify-center bg-slate-950/20 backdrop-blur-sm z-50">
            <div className="flex flex-col items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
              <span className="text-xs font-semibold text-purple-400/80 uppercase tracking-widest">
                Initializing OptiQuery AI...
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Show Sidebar navigation if the user is authenticated and not on Auth pages */}
            {!isAuthPage && <Sidebar />}
            
            {/* Page main content body viewport wrapper */}
            <div className={`flex-1 flex flex-col relative z-10 ${
              isAuthPage ? "min-h-screen overflow-y-auto" : "h-screen overflow-hidden"
            }`}>
              {children}
            </div>
          </>
        )}
      </body>
    </html>
  );
}
