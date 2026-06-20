"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import ConnectionBadge from "@/components/shared/connection-badge";
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  X,
  ShieldCheck,
  Server
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  is_active: boolean;
  last_tested_at: string | null;
}

interface SchemaColumn {
  id: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_pk: boolean;
  is_fk: boolean;
  ref_table: string | null;
  ref_column: string | null;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [schemaColumns, setSchemaColumns] = useState<SchemaColumn[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Sheet state (custom Radix/ShadCN Sheet replacement)
  const [showAddSheet, setShowAddSheet] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    db_type: "postgresql",
    host: "",
    port: 5432,
    database_name: "",
    username: "",
    password: ""
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    setLoading(true);
    try {
      const res = await apiClient.get("/connections");
      setConnections(res.data);
      if (res.data.length > 0) {
        setSelectedConnection(res.data[0]);
        fetchSchema(res.data[0].id);
      }
    } catch (err) {
      console.error("Error fetching connections list", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSchema(connId: string) {
    setSchemaLoading(true);
    try {
      const res = await apiClient.get(`/connections/${connId}/schema`);
      setSchemaColumns(res.data);
    } catch (err) {
      console.error("Error querying connection schema", err);
      setSchemaColumns([]);
    } finally {
      setSchemaLoading(false);
    }
  }

  const handleSelectConnection = (conn: Connection) => {
    setSelectedConnection(conn);
    fetchSchema(conn.id);
  };

  const handleTestConnection = async (connId: string) => {
    setActionLoading(`test_${connId}`);
    try {
      const res = await apiClient.post(`/connections/${connId}/test`);
      setConnections(prev =>
        prev.map(c => (c.id === connId ? { ...c, is_active: res.data.is_active, last_tested_at: new Date().toISOString() } : c))
      );
      if (selectedConnection?.id === connId) {
        setSelectedConnection(prev => prev ? { ...prev, is_active: res.data.is_active, last_tested_at: new Date().toISOString() } : null);
      }
      alert(res.data.is_active ? "Connection test passed!" : `Test failed: ${res.data.error_message || "Unknown error"}`);
    } catch (err: any) {
      alert(`Test execution failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncSchema = async (connId: string) => {
    setActionLoading(`sync_${connId}`);
    try {
      await apiClient.post(`/connections/${connId}/refresh`);
      alert("Synchronization triggered successfully! Updating schema database indexes.");
      if (selectedConnection?.id === connId) {
        fetchSchema(connId);
      }
    } catch (err: any) {
      alert(`Synchronization failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConnection = async (connId: string) => {
    if (!confirm("Are you sure you want to delete this database connection? This deletes all associated schema maps and log histories.")) {
      return;
    }
    try {
      await apiClient.delete(`/connections/${connId}`);
      setConnections(prev => prev.filter(c => c.id !== connId));
      if (selectedConnection?.id === connId) {
        setSelectedConnection(null);
        setSchemaColumns([]);
      }
      alert("Connection successfully deleted.");
    } catch (err: any) {
      alert(`Deletion failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setTestResult(null);

    try {
      await apiClient.post("/connections", formData);
      setShowAddSheet(false);
      setFormData({
        name: "",
        db_type: "postgresql",
        host: "",
        port: 5432,
        database_name: "",
        username: "",
        password: ""
      });
      fetchConnections();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Credentials config verification error.");
    }
  };

  const handleSheetTest = async () => {
    setFormError(null);
    setTestResult(null);
    setActionLoading("sheet_test");
    try {
      const res = await apiClient.post("/connections", { ...formData, name: "TEST_TEMP_DB" });
      const testRes = await apiClient.post(`/connections/${res.data.id}/test`);
      await apiClient.delete(`/connections/${res.data.id}`);

      setTestResult({
        success: testRes.data.is_active,
        message: testRes.data.is_active ? "Connection successful!" : `Test failed: ${testRes.data.error_message || "Unknown error"}`
      });
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const tables: { [tableName: string]: SchemaColumn[] } = {};
  schemaColumns.forEach(col => {
    if (!tables[col.table_name]) {
      tables[col.table_name] = [];
    }
    tables[col.table_name].push(col);
  });

  return (
    <main className="flex-1 flex bg-slate-950 text-slate-100 overflow-hidden h-full relative">
      {/* Left Pane: Grid Table of Connections */}
      <div className="w-1/2 flex flex-col border-r border-slate-800/80 p-6 overflow-y-auto min-h-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white glow-text">Database Connections</h1>
            <p className="text-slate-400 text-xs mt-1">Configure credentials and query schemas.</p>
          </div>
          <button
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white shadow-md shadow-purple-600/10 transition-all"
          >
            <Plus className="h-4 w-4" /> Add Connection
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
          </div>
        ) : connections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-slate-850 rounded-xl bg-slate-900/5">
            <Database className="h-9 w-9 text-slate-700 mb-2" />
            <p className="text-xs text-slate-500 text-center mb-4">No active database configurations found.</p>
            <button
              onClick={() => setShowAddSheet(true)}
              className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white transition-all animate-pulse"
            >
              Configure Connection
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map(conn => {
              const isSelected = selectedConnection?.id === conn.id;
              const isTesting = actionLoading === `test_${conn.id}`;
              const isSyncing = actionLoading === `sync_${conn.id}`;

              return (
                <div
                  key={conn.id}
                  onClick={() => handleSelectConnection(conn)}
                  className={`glass-panel p-5 rounded-xl border transition-all cursor-pointer flex flex-col gap-4 relative overflow-hidden ${
                    isSelected ? "border-purple-500/50 bg-purple-900/5 shadow-purple-900/10" : "border-slate-800 hover:border-slate-750 bg-slate-900/10"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-950/60 flex items-center justify-center border border-slate-850">
                        <Database className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">{conn.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                          {conn.database_name} • {conn.host}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConnectionBadge dbType={conn.db_type} />
                      {conn.is_active ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-800/60 pt-3 text-xs text-slate-400">
                    <span className="text-[11px] font-medium text-slate-500">
                      Sync: {conn.last_tested_at ? new Date(conn.last_tested_at).toLocaleDateString() : "Never"}
                    </span>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleTestConnection(conn.id)}
                        disabled={actionLoading !== null}
                        className="p-1.5 rounded hover:bg-slate-900 text-slate-350 hover:text-white transition-all flex items-center gap-1 text-[11px] font-semibold"
                        title="Live connectivity health test"
                      >
                        {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" /> : <Activity className="h-3.5 w-3.5" />}
                        Test
                      </button>
                      <button
                        onClick={() => handleSyncSchema(conn.id)}
                        disabled={actionLoading !== null}
                        className="p-1.5 rounded hover:bg-slate-900 text-slate-350 hover:text-white transition-all flex items-center gap-1 text-[11px] font-semibold"
                        title="Force schema metadata refresh"
                      >
                        {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Sync
                      </button>
                      <button
                        onClick={() => handleDeleteConnection(conn.id)}
                        className="p-1.5 rounded hover:bg-red-950/20 text-slate-550 hover:text-red-400 transition-all"
                        title="Delete connection"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Pane: Schema details */}
      <div className="w-1/2 flex flex-col p-6 overflow-y-auto bg-slate-950/30 min-h-0">
        <h2 className="text-xl font-bold text-white mb-1 tracking-wide flex items-center gap-2">
          <Server className="h-5 w-5 text-purple-400" /> Schema Explorer
        </h2>
        <p className="text-slate-400 text-xs mb-6">
          {selectedConnection
            ? `Harvested tables & columns for "${selectedConnection.name}"`
            : "Select a database connection to browse schemas."}
        </p>

        {!selectedConnection ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-850 rounded-xl p-10 bg-slate-900/5">
            <Database className="h-8 w-8 text-slate-700 mb-2" />
            <p className="text-xs text-slate-500 text-center">No connection selected.</p>
          </div>
        ) : schemaLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
              <span className="text-xs text-slate-500">Querying schema tables...</span>
            </div>
          </div>
        ) : Object.keys(tables).length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-850 rounded-xl p-10 bg-slate-950/30 text-center">
            <RefreshCw className="h-8 w-8 text-slate-700 mb-2 animate-pulse" />
            <h4 className="text-sm font-semibold text-slate-300 mb-1">No schema details cached</h4>
            <p className="text-xs text-slate-550 max-w-[280px] mb-4">
              Metadata schemas must be harvested and compiled before agent interactions are available.
            </p>
            <button
              onClick={() => handleSyncSchema(selectedConnection.id)}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-xs font-bold text-purple-400 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Sync Metadata Schema
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {Object.entries(tables).map(([tableName, cols]) => (
              <TableAccordion key={tableName} tableName={tableName} columns={cols} />
            ))}
          </div>
        )}
      </div>

      {/* Add Connection Sheet (Slide-out panel drawer) */}
      {showAddSheet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-all duration-300">
          <div
            className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 z-50 overflow-y-auto flex flex-col gap-6 shadow-2xl animate-slide-in"
          >
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">Configure Database</h2>
                <p className="text-slate-400 text-xs mt-0.5">Parameters are AES-255 encrypted at rest.</p>
              </div>
              <button
                onClick={() => setShowAddSheet(false)}
                className="p-1 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-450 hover:text-slate-200 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 text-xs rounded-lg animate-shake">
                {formError}
              </div>
            )}
            {testResult && (
              <div className={`p-3 border text-xs rounded-lg ${
                testResult.success 
                  ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-200" 
                  : "bg-red-950/40 border-red-500/20 text-red-200"
              }`}>
                {testResult.message}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-5 flex-1 flex flex-col justify-between text-sm">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Postgres Main"
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      DB Dialect
                    </label>
                    <select
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-250 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                      value={formData.db_type}
                      onChange={e => {
                        const val = e.target.value;
                        let portVal = 5432;
                        if (val === "mysql") portVal = 3306;
                        if (val === "sqlite") portVal = 0;
                        setFormData(prev => {
                          const updated = { ...prev, db_type: val, port: portVal };
                          if (val === "sqlite") {
                            updated.host = "localhost";
                            updated.username = "sqlite";
                            updated.password = "sqlite";
                          }
                          return updated;
                        });
                      }}
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="sqlite">SQLite</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Server Host IP
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="127.0.0.1 or domain"
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                      value={formData.host}
                      onChange={e => setFormData(prev => ({ ...prev, host: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Port
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                      value={formData.port}
                      onChange={e => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Database Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="production_db"
                    className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                    value={formData.database_name}
                    onChange={e => setFormData(prev => ({ ...prev, database_name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      User Account
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="postgres or root"
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                      value={formData.username}
                      onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                      value={formData.password}
                      onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-800/60 pt-4 mt-6">
                <button
                  type="button"
                  onClick={handleSheetTest}
                  disabled={actionLoading === "sheet_test"}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded-lg transition-all text-slate-350"
                >
                  {actionLoading === "sheet_test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Test Connection
                </button>
                <div className="flex gap-2.5">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold btn-premium-primary rounded-lg transition-all text-white shadow-md shadow-purple-600/10"
                  >
                    Save Context
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function TableAccordion({ tableName, columns }: { tableName: string; columns: SchemaColumn[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass-panel rounded-lg border border-slate-800/80 bg-slate-900/5 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-850/40 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "transform rotate-90" : ""}`} />
          <span className="text-sm font-semibold text-slate-200">{tableName}</span>
          <span className="text-[10px] text-slate-500 font-bold">({columns.length} columns)</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800/50 bg-slate-950/20 divide-y divide-slate-850/60">
          {columns.map(col => (
            <div key={col.column_name} className="flex items-center justify-between py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-300">{col.column_name}</span>
                {col.is_pk && (
                  <span className="inline-flex items-center text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/20">
                    PK
                  </span>
                )}
                {col.is_fk && (
                  <span
                    className="inline-flex items-center text-[9px] font-bold text-blue-400 bg-blue-400/10 px-1 py-0.2 rounded border border-blue-400/20"
                    title={`FK reference to ${col.ref_table}.${col.ref_column}`}
                  >
                    FK
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-500 font-mono text-[9px]">
                {col.data_type}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
