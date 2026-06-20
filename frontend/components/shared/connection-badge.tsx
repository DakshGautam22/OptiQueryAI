"use client";

import React from "react";
import { Server, Database } from "lucide-react";

interface ConnectionBadgeProps {
  dbType: string;
  className?: string;
}

export default function ConnectionBadge({ dbType, className = "" }: ConnectionBadgeProps) {
  const normalized = dbType.toLowerCase().trim();
  
  if (normalized === "postgresql" || normalized === "postgres") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 ${className}`}>
        <Database className="h-3.5 w-3.5" /> PostgreSQL
      </span>
    );
  }

  if (normalized === "mysql") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400 ${className}`}>
        <Server className="h-3.5 w-3.5" /> MySQL
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 border border-slate-500/20 text-slate-400 ${className}`}>
      <Database className="h-3.5 w-3.5" /> {dbType}
    </span>
  );
}
