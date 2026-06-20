"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import ConnectionBadge from "@/components/shared/connection-badge";
import {
  Database,
  Play,
  CheckCircle2,
  AlertTriangle,
  History,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  User,
  Plus
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
  db_type: string;
  database_name: string;
  host: string;
  is_active: boolean;
  last_tested_at: string | null;
}

interface QueryLog {
  id: string;
  natural_language: string;
  generated_sql: string;
  optimized_sql: string;
  success: boolean;
  execution_time_ms: number;
  created_at: string;
  user_id: string;
}

export default function DashboardPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [history, setHistory] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    queriesToday: 0,
    activeConnections: 0,
    avgExecutionTime: 0,
    successRate: 100
  });

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [connRes, histRes] = await Promise.all([
          apiClient.get("/connections"),
          apiClient.get("/query/history?limit=100")
        ]);

        const connData = connRes.data as Connection[];
        const histData = histRes.data as QueryLog[];

        setConnections(connData);
        setHistory(histData.slice(0, 10)); // Top 10 for activity feed

        // Compute KPIs
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        const queriesToday = histData.filter(q => new Date(q.created_at).getTime() >= startOfToday).length;
        const activeConnections = connData.filter(c => c.is_active).length;
        
        const validQueries = histData.filter(q => q.success);
        const avgExecutionTime = validQueries.length > 0
          ? Math.round(validQueries.reduce((acc, q) => acc + q.execution_time_ms, 0) / validQueries.length)
          : 0;
          
        const successRate = histData.length > 0
          ? Math.round((validQueries.length / histData.length) * 100)
          : 100;

        setKpis({
          queriesToday,
          activeConnections,
          avgExecutionTime,
          successRate
        });
      } catch (err) {
        console.error("Failed loading dashboard KPIs", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Compiling metric states...
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-grow p-8 bg-slate-950/10 text-slate-100 overflow-y-auto">
      {/* Premium Glass Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-900/15 via-indigo-900/5 to-slate-900/10 p-6 md:p-8 mb-8 shadow-lg shadow-purple-950/5 animate-fade-in">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-1">
              <Zap className="h-3 w-3 animate-pulse text-purple-400" /> Platform Active
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-purple-400 bg-[length:200%_auto] animate-gradient-flow font-black">OptiQuery AI</span>
            </h1>
            <p className="text-slate-350 text-sm max-w-2xl leading-relaxed">
              Unlock the power of conversational SQL. Generate fully validated, high-performance queries, browse interactive schemas, and monitor database execution telemetry.
            </p>
          </div>
          <Link
            href="/playground"
            className="flex items-center gap-2 px-4.5 py-2.5 rounded-lg btn-premium-primary text-xs font-bold text-white transition-all shadow-md shrink-0"
          >
            <Play className="h-4 w-4" /> Start Querying
          </Link>
        </div>
      </div>

      {/* 4 Premium Metric Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* KPI 1: Queries Executed */}
        <div className="glass-panel p-6 rounded-xl border border-slate-900/60 relative overflow-hidden group hover:scale-[1.02] cursor-default">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Queries Executed</p>
              <h3 className="text-3xl font-black text-white mt-2 tracking-tight">{kpis.queriesToday}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300 shadow-sm shadow-purple-500/10">
              <History className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${Math.min(kpis.queriesToday * 5, 100)}%` }} />
          </div>
          <div className="mt-3 text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-purple-400" /> Since session initialization
          </div>
        </div>

        {/* KPI 2: Active Connections */}
        <div className="glass-panel p-6 rounded-xl border border-slate-900/60 relative overflow-hidden group hover:scale-[1.02] cursor-default">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Active Connections</p>
              <h3 className="text-3xl font-black text-white mt-2 tracking-tight">
                {kpis.activeConnections} <span className="text-xs font-semibold text-slate-500">/ {connections.length}</span>
              </h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm shadow-blue-500/10">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${connections.length > 0 ? (kpis.activeConnections / connections.length) * 100 : 0}%` }} />
          </div>
          <div className="mt-3 text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-blue-400" /> Operational connections
          </div>
        </div>

        {/* KPI 3: Avg Response Speed */}
        <div className="glass-panel p-6 rounded-xl border border-slate-900/60 relative overflow-hidden group hover:scale-[1.02] cursor-default">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Avg Response Speed</p>
              <h3 className="text-3xl font-black text-white mt-2 tracking-tight">
                {kpis.avgExecutionTime} <span className="text-xs font-semibold text-slate-500">ms</span>
              </h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300 shadow-sm shadow-amber-500/10">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${kpis.avgExecutionTime > 0 ? Math.max(100 - (kpis.avgExecutionTime / 5), 10) : 0}%` }} />
          </div>
          <div className="mt-3 text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-amber-400" /> Successful queries average
          </div>
        </div>

        {/* KPI 4: Pipeline Compliance */}
        <div className="glass-panel p-6 rounded-xl border border-slate-900/60 relative overflow-hidden group hover:scale-[1.02] cursor-default">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Pipeline Success</p>
              <h3 className="text-3xl font-black text-white mt-2 tracking-tight">{kpis.successRate}%</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm shadow-emerald-500/10">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: `${kpis.successRate}%` }} />
          </div>
          <div className="mt-3 text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Audit validation compliance
          </div>
        </div>
      </div>

      {/* Grid: Health Connections & Activity logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Connection Status List */}
        <div className="lg:col-span-1 glass-panel rounded-xl p-6 border border-slate-900/60 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b border-slate-900/40 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Database Status</h2>
            <Link
              href="/connections"
              className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition-all"
            >
              Configure <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>

          {connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-900 rounded-lg bg-slate-950/20">
              <Database className="h-7 w-7 text-slate-800 mb-2" />
              <p className="text-xs text-slate-500 text-center px-4">
                No active connections. Configure database access to start monitoring.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {connections.map(conn => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/40 border border-slate-900/60 hover:border-purple-500/30 hover:bg-slate-900/10 hover:translate-x-1 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${conn.is_active ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-red-500 shadow-lg shadow-red-500/50"} transition-all`} />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-purple-400 transition-colors">
                        {conn.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate max-w-[150px] mt-0.5 font-mono">
                        {conn.database_name}
                      </p>
                    </div>
                  </div>
                  <ConnectionBadge dbType={conn.db_type} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-6 border border-slate-900/60 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-900/40 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Activity Feed</h2>
            <Link
              href="/history"
              className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition-all"
            >
              All Audits <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-slate-900 rounded-lg bg-slate-950/20 text-center">
              <History className="h-7 w-7 text-slate-800 mb-2" />
              <p className="text-xs text-slate-500">No recent activity found. Run database queries in the playground.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-900/40 overflow-y-auto max-h-[360px] pr-1">
              {history.map(log => (
                <div key={log.id} className="py-4 flex justify-between items-start gap-4 hover:bg-slate-900/10 px-2 rounded-lg transition-colors group">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded bg-slate-900/80 border border-slate-850 flex items-center justify-center text-slate-400 shrink-0 mt-0.5 group-hover:border-purple-500/30 group-hover:text-purple-400 transition-all">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors leading-relaxed">
                        {log.natural_language}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 mt-1.5 truncate max-w-[420px] bg-slate-950/50 px-2 py-1 rounded border border-slate-900/50">
                        {log.optimized_sql || log.generated_sql}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {log.success ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                        Failed
                      </span>
                    )}
                    <span className="text-[9px] text-slate-500 font-medium">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
