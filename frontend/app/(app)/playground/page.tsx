"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useQueryPipeline } from "@/hooks/use-query-pipeline";
import SqlEditor from "@/components/query/sql-editor";
import AgentPipelineStatus from "@/components/query/agent-pipeline-status";
import ResultChart from "@/components/query/result-chart";
import {
  Database,
  Play,
  Terminal,
  HelpCircle,
  BarChart2,
  Table as TableIcon,
  Sparkles,
  Download,
  AlertTriangle,
  Loader2,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
  db_type: string;
}

function PlaygroundContent() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("query");
  const connParam = searchParams.get("connection_id");

  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [activeTab, setActiveTab] = useState<"table" | "chart" | "explain" | "report">("table");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const {
    steps,
    generating,
    executing,
    generatedSql,
    optimizedSql,
    optimizationReport,
    explanationSteps,
    validation,
    generationError,
    rows,
    columns,
    chartConfig,
    executionError,
    generateSql,
    executeSql,
    setOptimizedSql,
    resetPipeline
  } = useQueryPipeline();

  // Load connections and auto-trigger if params exist
  useEffect(() => {
    async function loadConnectionsAndParams() {
      try {
        const res = await apiClient.get("/connections");
        setConnections(res.data);
        
        let connId = "";
        if (connParam) {
          connId = connParam;
          setSelectedConnectionId(connParam);
        } else if (res.data.length > 0) {
          connId = res.data[0].id;
          setSelectedConnectionId(res.data[0].id);
        }

        if (queryParam) {
          setQuestion(queryParam);
          if (connId) {
            // Auto trigger SQL generation
            generateSql(connId, queryParam);
            setActiveTab("table");
          }
        }
      } catch (err) {
        console.error("Error loading connections in playground", err);
      }
    }
    loadConnectionsAndParams();
  }, [queryParam, connParam]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedConnectionId) return;
    try {
      await generateSql(selectedConnectionId, question.trim());
      setActiveTab("table");
    } catch (err) {
      // Handled in hook
    }
  };

  const handleRunExecution = async () => {
    if (!optimizedSql || !selectedConnectionId) return;
    try {
      await executeSql(selectedConnectionId, optimizedSql);
      setCurrentPage(1);
    } catch (err) {
      // Handled in hook
    }
  };

  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const headers = columns.join(",");
    const csvRows = rows.map(row =>
      columns
        .map(col => {
          const val = row[col];
          const valStr = val === null || val === undefined ? "" : String(val);
          const escaped = valStr.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    );
    const csvString = [headers, ...csvRows].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `playground_export_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex-grow flex flex-col min-h-0">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white glow-text flex items-center gap-2">
            <Terminal className="h-7 w-7 text-purple-400" /> SQL Playground
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Input natural questions to execute and analyze database structures.
          </p>
        </div>
        <button
          onClick={resetPipeline}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-400 rounded-lg border border-slate-850 hover:text-slate-200 transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Clear Playground
        </button>
      </div>

      {/* Top Split Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left Side: Inputs */}
        <div className="glass-panel p-6 rounded-xl border border-slate-800/80 flex flex-col gap-5 justify-between">
          <form onSubmit={handleGenerate} className="space-y-4 flex-1">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Select Database Context
              </label>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Database className="h-4 w-4 text-purple-400" /> Active Connection
              </div>
            </div>
            <select
              value={selectedConnectionId}
              onChange={e => setSelectedConnectionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 px-3 py-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-350"
            >
              {connections.length === 0 ? (
                <option value="">No databases configured</option>
              ) : (
                connections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.db_type})
                  </option>
                ))
              )}
            </select>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                User Question (Natural Language)
              </label>
              <textarea
                rows={4}
                required
                placeholder="What are the average orders and signups grouped by month?"
                className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-150 placeholder-slate-550 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none transition-all"
                value={question}
                onChange={e => setQuestion(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={generating || !question.trim() || !selectedConnectionId}
              className="w-full py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 btn-premium-primary text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing Prompts...
                </>
              ) : (
                <>
                  Generate SQL Statement <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Code Editor */}
        <div className="glass-panel p-6 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                SQL COMPILER WORKSPACE (EDITABLE)
              </label>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                SQLGLOT OPTIMIZED
              </span>
            </div>
            
            <div className="flex-1 min-h-[160px]">
              <SqlEditor
                value={optimizedSql}
                onChange={setOptimizedSql}
                height="170px"
              />
            </div>

            <button
              onClick={handleRunExecution}
              disabled={executing || !optimizedSql || !selectedConnectionId}
              className="w-full py-2.5 rounded-lg font-semibold text-xs border border-purple-500/30 hover:border-purple-500/50 bg-purple-600/10 hover:bg-purple-600/15 text-purple-400 transition-all flex items-center justify-center gap-2"
            >
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Querying Database...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Execute SQL Query
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Middle Pipeline Stepper */}
      {(generating || steps.some(s => s.status !== "pending")) && (
        <div className="glass-panel p-6 rounded-xl border border-slate-800/80 mb-8 animate-fade-in">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-5">
            Agent Execution Pipeline
          </h3>
          <AgentPipelineStatus steps={steps} />
        </div>
      )}

      {/* Bottom Panel */}
      {(rows.length > 0 || executionError || generationError || explanationSteps.length > 0 || optimizationReport.length > 0) && (
        <div className="glass-panel rounded-xl border border-slate-800/80 overflow-hidden animate-fade-in">
          <div className="flex justify-between items-center bg-slate-900/60 px-6 py-3 border-b border-slate-855">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("table")}
                className={`flex items-center gap-1.5 text-xs font-bold uppercase pb-1.5 border-b-2 transition-all ${
                  activeTab === "table"
                    ? "border-purple-500 text-white"
                    : "border-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                <TableIcon className="h-4 w-4" /> Data Table
              </button>
              {rows.length > 0 && chartConfig && chartConfig.type !== "table" && (
                <button
                  onClick={() => setActiveTab("chart")}
                  className={`flex items-center gap-1.5 text-xs font-bold uppercase pb-1.5 border-b-2 transition-all ${
                    activeTab === "chart"
                      ? "border-purple-500 text-white"
                      : "border-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                <BarChart2 className="h-4 w-4" /> Visualizer
              </button>
              )}
              {explanationSteps.length > 0 && (
                <button
                  onClick={() => setActiveTab("explain")}
                  className={`flex items-center gap-1.5 text-xs font-bold uppercase pb-1.5 border-b-2 transition-all ${
                    activeTab === "explain"
                      ? "border-purple-500 text-white"
                      : "border-transparent text-slate-500 hover:text-slate-350"
                  }`}
                >
                  <HelpCircle className="h-4 w-4" /> Explanation
                </button>
              )}
              {optimizationReport.length > 0 && (
                <button
                  onClick={() => setActiveTab("report")}
                  className={`flex items-center gap-1.5 text-xs font-bold uppercase pb-1.5 border-b-2 transition-all ${
                    activeTab === "report"
                      ? "border-purple-500 text-white"
                      : "border-transparent text-slate-500 hover:text-slate-350"
                  }`}
                >
                  <Sparkles className="h-4 w-4" /> Optimization Report
                </button>
              )}
            </div>

            {activeTab === "table" && rows.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition-all"
              >
                <Download className="h-3.5 w-3.5 text-purple-400" /> Export CSV
              </button>
            )}
          </div>

          <div className="p-6">
            {executionError && (
              <div className="flex gap-2.5 p-3 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 text-xs">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                <span>{executionError}</span>
              </div>
            )}

            {activeTab === "table" && rows.length > 0 && (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-900/60 rounded-lg">
                  <table className="w-full text-left text-[11px] font-medium divide-y divide-slate-900">
                    <thead className="bg-slate-900/20 text-slate-450 uppercase tracking-wider text-[9px] font-bold">
                      <tr>
                        {columns.map(col => (
                          <th key={col} className="px-4 py-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 bg-slate-950/20 text-slate-300">
                      {paginatedRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/10">
                          {columns.map(col => (
                            <td key={col} className="px-4 py-2.5 max-w-[200px] truncate">
                              {row[col] !== null ? String(row[col]) : <span className="text-slate-655 italic">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center text-xs text-slate-500 font-semibold px-2 pt-2">
                    <span>
                      Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRows)} of {totalRows} records
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1 px-2.5 rounded bg-slate-950 border border-slate-850 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-slate-950 transition-all flex items-center gap-1 text-[11px]"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-1 px-2.5 rounded bg-slate-950 border border-slate-850 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-slate-950 transition-all flex items-center gap-1 text-[11px]"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "chart" && rows.length > 0 && chartConfig && (
              <div className="p-2">
                <ResultChart chartConfig={chartConfig} rows={rows} />
              </div>
            )}

            {activeTab === "explain" && explanationSteps.length > 0 && (
              <div className="p-2 space-y-3.5 text-xs text-slate-400 leading-relaxed max-w-2xl">
                <h4 className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">
                  Execution Steps Map
                </h4>
                <ol className="list-decimal pl-4 space-y-2">
                  {explanationSteps.map((step, sIdx) => (
                    <li key={sIdx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {activeTab === "report" && optimizationReport.length > 0 && (
              <div className="p-2 space-y-3 text-xs text-slate-400 leading-relaxed max-w-2xl">
                <h4 className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">
                  Query Transformations Applied
                </h4>
                <ul className="list-disc pl-4 space-y-2">
                  {optimizationReport.map((rep, idx) => (
                    <li key={idx}>{rep}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <main className="flex-1 flex flex-col p-8 bg-slate-950 text-slate-100 overflow-y-auto h-full">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center bg-slate-950">
            <div className="flex flex-col items-center gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Loading playground...
              </span>
            </div>
          </div>
        }
      >
        <PlaygroundContent />
      </Suspense>
    </main>
  );
}
