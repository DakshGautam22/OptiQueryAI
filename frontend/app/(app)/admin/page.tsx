"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import DataTable, { DataTableColumn } from "@/components/shared/data-table";
import {
  Users,
  FileSpreadsheet,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Shield,
  Activity,
  UserX,
  UserCheck
} from "lucide-react";

interface OrgUser {
  id: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  is_active: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_email: string;
  connection_name: string;
  sql_preview: string;
  execution_time_ms: number;
  row_count: number;
  success: boolean;
  ip_address: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  // State
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Security Check: Redirect non-admins immediately
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    if (user && user.role === "admin") {
      loadData();
    }
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, logsRes] = await Promise.all([
        apiClient.get("/admin/users"),
        apiClient.get("/admin/audit-logs")
      ]);
      setUsers(usersRes.data);
      setAuditLogs(logsRes.data);
    } catch (err) {
      console.error("Failed to fetch admin workspace datasets", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle toggling user status or updating user role
  const handleUpdateUser = async (userId: string, newRole: string, newStatus: boolean) => {
    setActionLoading(userId);
    try {
      const res = await apiClient.put(`/admin/users/${userId}`, {
        role: newRole,
        is_active: newStatus
      });
      
      // Update local state list
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: res.data.role, is_active: res.data.is_active } : u))
      );
    } catch (err: any) {
      alert(`User modification failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // If role is viewer/analyst, don't show the dashboard content during the redirect cycle
  if (!user || user.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Enforcing authorization credentials...
          </span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Compiling audit logs and user rosters...
          </span>
        </div>
      </div>
    );
  }

  // Table columns for User Roster
  const userColumns: DataTableColumn<OrgUser>[] = [
    {
      key: "email",
      header: "Member User",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 font-bold shrink-0 text-xs">
            {row.email.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">{row.email}</p>
            <span className="text-[10px] text-slate-500 font-medium">Joined: {new Date(row.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      )
    },
    {
      key: "role",
      header: "System Role Permission",
      sortable: true,
      render: (row) => {
        const isSelf = row.id === user.id;
        return (
          <select
            value={row.role}
            disabled={isSelf || actionLoading !== null}
            onChange={(e) => handleUpdateUser(row.id, e.target.value, row.is_active)}
            className="bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="admin">Administrator</option>
            <option value="analyst">Analyst</option>
            <option value="viewer">Viewer</option>
          </select>
        );
      }
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      render: (row) =>
        row.is_active ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/25">
            Deactivated
          </span>
        )
    },
    {
      key: "actions",
      header: "Access Operation",
      sortable: false,
      render: (row) => {
        const isSelf = row.id === user.id;
        const isUpdating = actionLoading === row.id;
        
        if (isSelf) {
          return <span className="text-[10px] text-slate-500 italic font-semibold">Self-managed</span>;
        }

        return (
          <button
            onClick={() => handleUpdateUser(row.id, row.role, !row.is_active)}
            disabled={actionLoading !== null}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border transition-all ${
              row.is_active
                ? "bg-red-500/10 border-red-500/20 text-red-450 hover:bg-red-500/15"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : row.is_active ? (
              <>
                <UserX className="h-3.5 w-3.5" /> Deactivate
              </>
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5" /> Activate
              </>
            )}
          </button>
        );
      }
    }
  ];

  // Table columns for Audit Log Roster
  const auditColumns: DataTableColumn<AuditLog>[] = [
    {
      key: "user_email",
      header: "Triggered By",
      sortable: true,
      render: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-200 block">{row.user_email}</span>
          <span className="text-[10px] text-slate-550 font-medium font-mono">{row.ip_address}</span>
        </div>
      )
    },
    {
      key: "connection_name",
      header: "Context Connection",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-300 font-semibold">{row.connection_name}</span>
      )
    },
    {
      key: "sql_preview",
      header: "SQL Pipeline Statement",
      sortable: false,
      render: (row) => (
        <pre className="font-mono text-[10px] text-slate-400 max-w-[260px] truncate bg-slate-950/40 p-1.5 rounded border border-slate-900/60">
          <code>{row.sql_preview}</code>
        </pre>
      )
    },
    {
      key: "telemetry",
      header: "Telemetry Stats",
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-3 text-slate-400 text-xs">
          <span className="flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3 text-slate-500" /> {row.execution_time_ms} ms
          </span>
          <span className="text-slate-600 font-bold">•</span>
          <span className="font-mono">{row.row_count} rows</span>
        </div>
      )
    },
    {
      key: "success",
      header: "Status",
      sortable: true,
      render: (row) =>
        row.success ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
            Validated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-405 border border-red-500/20">
            Blocked
          </span>
        )
    },
    {
      key: "created_at",
      header: "Date Time",
      sortable: true,
      render: (row) => (
        <span className="text-slate-500 text-[10px]">
          {new Date(row.created_at).toLocaleString()}
        </span>
      )
    }
  ];

  return (
    <main className="flex-1 p-8 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Title Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-900/60 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white glow-text flex items-center gap-2">
            <Shield className="h-7 w-7 text-purple-400" /> Administration Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Audit query transactions, enforce safety policies, and manage organization user memberships.
          </p>
        </div>
      </div>

      {/* Tabs Switcher Control */}
      <div className="flex border-b border-slate-850 gap-2 mb-8">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all ${
            activeTab === "users"
              ? "border-purple-500 text-purple-400 font-extrabold"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          <Users className="h-4 w-4" /> User Roster ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all ${
            activeTab === "audit"
              ? "border-purple-500 text-purple-400 font-extrabold"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" /> Global Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Render Active Tab Table Panel */}
      {activeTab === "users" ? (
        <div className="glass-panel p-6 rounded-xl border border-slate-800/80">
          <DataTable
            columns={userColumns}
            data={users}
            pageSize={10}
          />
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-xl border border-slate-800/80">
          <DataTable
            columns={auditColumns}
            data={auditLogs}
            pageSize={10}
          />
        </div>
      )}
    </main>
  );
}
