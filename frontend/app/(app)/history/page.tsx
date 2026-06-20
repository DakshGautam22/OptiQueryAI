"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import DataTable, { DataTableColumn } from "@/components/shared/data-table";
import {
  History,
  Calendar,
  Database,
  Search,
  CheckCircle2,
  XCircle,
  Play,
  Loader2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
}

interface QueryLog {
  id: string;
  connection_id: string;
  user_id: string;
  session_id: string;
  natural_language: string;
  generated_sql: string;
  optimized_sql: string;
  execution_time_ms: number;
  row_count: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<QueryLog[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failure">("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchFilters();
    fetchHistory();
  }, []);

  async function fetchFilters() {
    try {
      const res = await apiClient.get("/connections");
      setConnections(res.data);
    } catch (err) {
      console.error("Failed loading connections for history filter", err);
    }
  }

  async function fetchHistory() {
    setLoading(true);
    try {
      let url = "/query/history?limit=100";
      if (selectedConnectionId) {
        url += `&connection_id=${selectedConnectionId}`;
      }
      if (startDate) {
        url += `&start_date=${new Date(startDate).toISOString()}`;
      }
      if (endDate) {
        url += `&end_date=${new Date(endDate).toISOString()}`;
      }

      const res = await apiClient.get(url);
      setHistory(res.data);
    } catch (err) {
      console.error("Failed querying history audits", err);
    } finally {
      setLoading(false);
    }
  }

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleClearFilters = () => {
    setSelectedConnectionId("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setSearchTerm("");
    // Re-fetch default
    setTimeout(() => {
      apiClient.get("/query/history?limit=100").then(res => setHistory(res.data));
    }, 0);
  };

  const handleReRun = (log: QueryLog) => {
    const url = `/playground?query=${encodeURIComponent(log.natural_language)}&connection_id=${log.connection_id}`;
    router.push(url);
  };

  const getConnectionName = (connId: string) => {
    const conn = connections.find(c => c.id === connId);
    return conn ? conn.name : "Unknown Context";
  };

  // Client-side filtering for status and search term
  const filteredHistory = history.filter(log => {
    // Status Filter
    if (statusFilter === "success" && !log.success) return false;
    if (statusFilter === "failure" && log.success) return false;

    // Search Term Filter
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchText = (log.natural_language + " " + (log.optimized_sql || log.generated_sql)).toLowerCase();
      if (!matchText.includes(term)) return false;
    }

    return true;
  });

  // Table Columns Setup
  const columns: DataTableColumn<QueryLog>[] = [
    {
      key: "natural_language",
      header: "User Query",
      sortable: true,
      render: (row) => (
        <div className="max-w-[220px]">
          <p className="text-xs font-semibold text-slate-200 truncate">{row.natural_language}</p>
          <span className="text-[10px] text-slate-500 font-medium">{getConnectionName(row.connection_id)}</span>
        </div>
      )
    },
    {
      key: "optimized_sql",
      header: "Generated SQL Preview",
      sortable: false,
      render: (row) => (
        <pre className="font-mono text-[10px] text-slate-400 max-w-[240px] truncate bg-slate-950/40 p-1.5 rounded border border-slate-900/60">
          <code>{row.optimized_sql || row.generated_sql}</code>
        </pre>
      )
    },
    {
      key: "execution_time_ms",
      header: "Duration",
      sortable: true,
      render: (row) => <span className="text-slate-300 font-mono text-xs">{row.execution_time_ms} ms</span>
    },
    {
      key: "row_count",
      header: "Rows",
      sortable: true,
      render: (row) => <span className="text-slate-300 font-mono text-xs">{row.row_count}</span>
    },
    {
      key: "success",
      header: "Security Status",
      sortable: true,
      render: (row) =>
        row.success ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" /> Validated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/25">
            <XCircle className="h-3 w-3" /> Blocked
          </span>
        )
    },
    {
      key: "created_at",
      header: "Timestamp",
      sortable: true,
      render: (row) => (
        <span className="text-slate-500 text-[10px]">
          {new Date(row.created_at).toLocaleString()}
        </span>
      )
    },
    {
      key: "actions",
      header: "Action",
      sortable: false,
      render: (row) => (
        <button
          onClick={() => handleReRun(row)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-[10px] font-bold text-purple-400 transition-all"
        >
          <Play className="h-3 w-3" /> Re-run
        </button>
      )
    }
  ];

  return (
    <main className="flex-1 p-8 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white glow-text flex items-center gap-2">
          <History className="h-7 w-7 text-purple-400" /> Query Auditing
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Search, audit, and re-run logged multi-agent database transactions.
        </p>
      </div>

      {/* Filter Control Bar */}
      <form onSubmit={handleApplyFilters} className="glass-panel p-5 rounded-xl border border-slate-800/80 mb-8 space-y-4">
        <div className="flex flex-wrap gap-4 items-end text-sm">
          {/* Connection */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Connection Context
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Database className="h-4 w-4" />
              </span>
              <select
                value={selectedConnectionId}
                onChange={e => setSelectedConnectionId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-350"
              >
                <option value="">All Connections</option>
                {connections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Picker Range */}
          <div className="w-[150px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Start Date
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Calendar className="h-4 w-4" />
              </span>
              <input
                type="date"
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-350"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="w-[150px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              End Date
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Calendar className="h-4 w-4" />
              </span>
              <input
                type="date"
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-350"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="w-[150px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Safety Status
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-350"
            >
              <option value="all">All Queries</option>
              <option value="success">Validated Only</option>
              <option value="failure">Blocked Only</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white rounded-lg shadow-md shadow-purple-600/10 transition-all"
            >
              <Search className="h-3.5 w-3.5" /> Apply
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-xs font-semibold text-slate-400 rounded-lg transition-all"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Text Search bar */}
        <div className="border-t border-slate-850 pt-4 flex gap-3 relative">
          <input
            type="text"
            placeholder="Search natural queries or SQL statements..."
            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-200 placeholder-slate-550 rounded-lg py-2 pl-4 pr-12 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </form>

      {/* DataTable Output */}
      {loading ? (
        <div className="glass-panel p-20 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800/80">
          <Loader2 className="h-7 w-7 text-purple-500 animate-spin" />
          <span className="text-xs text-slate-500 uppercase tracking-widest">Querying audit logs...</span>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-xl border border-slate-800/80">
          <DataTable
            columns={columns}
            data={filteredHistory}
            pageSize={10}
          />
        </div>
      )}
    </main>
  );
}
