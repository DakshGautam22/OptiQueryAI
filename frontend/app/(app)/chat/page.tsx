"use client";

import React, { useEffect, useState, useRef } from "react";
import apiClient from "@/lib/api-client";
import SqlEditor from "@/components/query/sql-editor";
import ResultChart from "@/components/query/result-chart";
import Link from "next/link";
import {
  MessageSquare,
  Plus,
  Send,
  Database,
  Terminal,
  Play,
  HelpCircle,
  BarChart2,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  User,
  Shield,
  ChevronRight
} from "lucide-react";

interface Connection {
  id: string;
  name: string;
  db_type: string;
}

interface ChatSession {
  session_id: string;
  last_message: string;
  created_at: string;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sql_generated?: string;
  optimized_sql?: string;
  explanation_steps?: string[];
  created_at?: string;
}

interface ExecutionResult {
  loading: boolean;
  error: string | null;
  columns: string[];
  rows: any[];
  chartConfig: any;
  activeTab: "table" | "chart";
}

export default function ChatPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Map of SQL block collapse states per message index
  const [sqlCollapsed, setSqlCollapsed] = useState<{ [msgIdx: number]: boolean }>({});

  // Map of active query executions inline per message index
  const [inlineExecResults, setInlineExecResults] = useState<{ [msgIdx: number]: ExecutionResult }>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
    initializeData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function initializeData() {
    setLoading(true);
    try {
      const [connRes, sessRes] = await Promise.all([
        apiClient.get("/connections"),
        apiClient.get("/chat/sessions")
      ]);
      setConnections(connRes.data);
      if (connRes.data.length > 0) {
        setSelectedConnectionId(connRes.data[0].id);
      }
      setSessions(sessRes.data);
      if (sessRes.data.length > 0) {
        loadSession(sessRes.data[0].session_id);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Error loading chat workspace data", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSession(sessId: string) {
    setLoading(true);
    try {
      const res = await apiClient.get(`/chat/sessions/${sessId}`);
      setActiveSessionId(sessId);
      // Map backend fields to frontend interface
      const formatted = res.data.map((m: any) => ({
        role: m.role,
        content: m.content,
        sql_generated: m.sql_generated,
        optimized_sql: m.sql_generated,
        explanation_steps: []
      }));
      setMessages(formatted);
      setInlineExecResults({});
      setSqlCollapsed({});
    } catch (err) {
      console.error("Error loading messages for session", err);
    } finally {
      setLoading(false);
    }
  }

  const handleStartNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInlineExecResults({});
    setSqlCollapsed({});
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedConnectionId) return;

    const userMessageText = inputValue.trim();
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setSending(true);

    const updatedMessages = [...messages, { role: "user", content: userMessageText } as ChatMessage];
    setMessages(updatedMessages);

    try {
      const payload = {
        connection_id: selectedConnectionId,
        message: userMessageText,
        session_id: activeSessionId || undefined
      };

      const res = await apiClient.post("/chat/message", payload);
      
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.data.response,
        sql_generated: res.data.sql_generated,
        optimized_sql: res.data.optimized_sql,
        explanation_steps: res.data.explanation_steps || []
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (!activeSessionId) {
        setActiveSessionId(res.data.session_id);
        const sessRes = await apiClient.get("/chat/sessions");
        setSessions(sessRes.data);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Failed to generate sql query refinement.";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ Error: ${errMsg}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleRunQueryInline = async (msgIdx: number, sql: string) => {
    setInlineExecResults(prev => ({
      ...prev,
      [msgIdx]: {
        loading: true,
        error: null,
        columns: [],
        rows: [],
        chartConfig: null,
        activeTab: "table"
      }
    }));

    try {
      const res = await apiClient.post("/query/execute", {
        connection_id: selectedConnectionId,
        sql: sql
      });

      setInlineExecResults(prev => ({
        ...prev,
        [msgIdx]: {
          loading: false,
          error: null,
          columns: res.data.columns || [],
          rows: res.data.rows || [],
          chartConfig: res.data.chart_config,
          activeTab: res.data.chart_config?.type !== "table" ? "chart" : "table"
        }
      }));
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || err.message;
      setInlineExecResults(prev => ({
        ...prev,
        [msgIdx]: {
          loading: false,
          error: detailMsg,
          columns: [],
          rows: [],
          chartConfig: null,
          activeTab: "table"
        }
      }));
    }
  };

  const toggleSqlCollapse = (msgIdx: number) => {
    setSqlCollapsed(prev => ({
      ...prev,
      [msgIdx]: !prev[msgIdx]
    }));
  };

  const toggleInlineTab = (msgIdx: number, tab: "table" | "chart") => {
    setInlineExecResults(prev => {
      const current = prev[msgIdx];
      if (!current) return prev;
      return {
        ...prev,
        [msgIdx]: {
          ...current,
          activeTab: tab
        }
      };
    });
  };

  return (
    <main className="flex-1 flex bg-slate-950 text-slate-100 overflow-hidden h-full">
      {/* Sessions Sidebar */}
      <div className="w-64 flex flex-col border-r border-slate-800/80 p-4 bg-slate-900/10 min-h-0">
        <button
          onClick={handleStartNewSession}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-purple-500/30 hover:border-purple-500/50 bg-purple-600/10 hover:bg-purple-600/15 text-xs font-bold text-purple-400 transition-all mb-4"
        >
          <Plus className="h-4 w-4" /> New Chat
        </button>

        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 px-2">
          Chat Sessions
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-550 italic p-2 text-center">No chat logs</p>
          ) : (
            sessions.map(sess => {
              const isActive = activeSessionId === sess.session_id;
              return (
                <div
                  key={sess.session_id}
                  onClick={() => loadSession(sess.session_id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border text-left flex flex-col gap-1 ${
                    isActive
                      ? "bg-slate-900 border-slate-800 text-slate-200"
                      : "hover:bg-slate-900/40 border-transparent text-slate-450 hover:text-slate-350"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className={`h-3.5 w-3.5 ${isActive ? "text-purple-400" : "text-slate-600"}`} />
                    <span className="text-xs font-semibold truncate flex-1">{sess.last_message}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium self-end">
                    {new Date(sess.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Thread Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-950/20">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800/60 bg-slate-900/10 flex justify-between items-center">
          <span className="font-bold text-sm text-white glow-text">OptiQuery AI Chatbot</span>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-400" />
            <select
              value={selectedConnectionId}
              onChange={e => setSelectedConnectionId(e.target.value)}
              className="bg-slate-950 border border-slate-850 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
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
          </div>
        </div>

        {/* Message logs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6">
              <div className="h-12 w-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 animate-bounce">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Conversational Refiner</h3>
              {connections.length === 0 ? (
                <>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Please connect a database first to start asking natural language questions.
                  </p>
                  <Link
                    href="/connections"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg btn-premium-primary text-xs font-bold text-white transition-all shadow-md shrink-0"
                  >
                    <Database className="h-4 w-4" /> Connect a Database
                  </Link>
                </>
              ) : (
                <p className="text-xs text-slate-400 leading-relaxed">
                  Start a conversation! The agent maintains session context so you can refine SQL statements contextually. Try: <i>"Show only the top 10 products"</i> or <i>"Group those results by city"</i>.
                </p>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const hasSql = !!msg.optimized_sql;
                const isCollapsed = sqlCollapsed[idx] !== false; // Collapse by default
                const res = inlineExecResults[idx];

                return (
                  <div key={idx} className={`flex gap-4 max-w-4xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      isUser
                        ? "bg-purple-600/10 border-purple-500/20 text-purple-400"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}>
                      {isUser ? <User className="h-4.5 w-4.5" /> : <Shield className="h-4.5 w-4.5 text-purple-400" />}
                    </div>

                    <div className={`flex flex-col gap-3.5 p-4 rounded-xl ${
                      isUser
                        ? "bg-purple-600/15 border border-purple-500/20 text-slate-200"
                        : "glass-panel border border-slate-850 text-slate-300"
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                      {/* CodeMirror SQL collapsable view */}
                      {hasSql && (
                        <div className="space-y-3 mt-1.5" onClick={e => e.stopPropagation()}>
                          <div className="border border-slate-900 rounded-lg overflow-hidden bg-slate-950">
                            {/* Toggle Header bar */}
                            <button
                              onClick={() => toggleSqlCollapse(idx)}
                              className="w-full flex justify-between items-center bg-slate-900/60 px-4 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-900 hover:text-slate-300 transition-colors uppercase tracking-wider"
                            >
                              <span className="flex items-center gap-1">
                                <Terminal className="h-3.5 w-3.5 text-purple-400" /> Compiled SQL statement
                              </span>
                              <span>
                                {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                              </span>
                            </button>

                            {/* Collapsible SQL Block */}
                            {!isCollapsed && (
                              <div className="p-3 border-t border-slate-900 animate-fade-in">
                                <SqlEditor
                                  value={msg.optimized_sql!}
                                  readOnly={true}
                                  height="160px"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRunQueryInline(idx, msg.optimized_sql!)}
                              disabled={res?.loading}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-premium-primary text-xs font-bold text-white transition-all"
                            >
                              {res?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              Run Query
                            </button>
                          </div>

                          {/* Inline Results logs */}
                          {res && (
                            <div className="mt-4 rounded-xl border border-slate-900 bg-slate-950/40 overflow-hidden animate-fade-in max-w-2xl">
                              <div className="flex justify-between items-center bg-slate-900/60 px-4 py-2 border-b border-slate-900 text-xs font-semibold text-slate-400">
                                <span>Query Output</span>
                                {res.rows.length > 0 && res.chartConfig?.type !== "table" && (
                                  <div className="flex gap-1.5 bg-slate-950 p-0.5 rounded border border-slate-850">
                                    <button
                                      onClick={() => toggleInlineTab(idx, "table")}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        res.activeTab === "table"
                                          ? "bg-slate-900 text-white"
                                          : "text-slate-500 hover:text-slate-305"
                                      }`}
                                    >
                                      <TableIcon className="h-3 w-3 inline mr-0.5" /> Table
                                    </button>
                                    <button
                                      onClick={() => toggleInlineTab(idx, "chart")}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        res.activeTab === "chart"
                                          ? "bg-slate-900 text-white"
                                          : "text-slate-500 hover:text-slate-305"
                                      }`}
                                    >
                                      <BarChart2 className="h-3 w-3 inline mr-0.5" /> Chart
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="p-4">
                                {res.loading ? (
                                  <div className="py-4 flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                                    <span className="text-xs text-slate-500">Running database query...</span>
                                  </div>
                                ) : res.error ? (
                                  <div className="flex gap-2.5 p-3 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 text-xs">
                                    <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{res.error}</span>
                                  </div>
                                ) : res.rows.length === 0 ? (
                                  <p className="text-xs text-slate-500 py-3 italic text-center">
                                    Empty result set returned.
                                  </p>
                                ) : res.activeTab === "table" ? (
                                  <div className="overflow-auto max-h-[240px] border border-slate-900 rounded-lg">
                                    <table className="w-full text-left text-[10px] font-medium divide-y divide-slate-900">
                                      <thead className="bg-slate-900/30 text-slate-450 sticky top-0 uppercase tracking-wider text-[8px] font-bold">
                                        <tr>
                                          {res.columns.map(col => (
                                            <th key={col} className="px-3 py-2.5">
                                              {col}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-850/40 bg-slate-950/40 text-slate-350">
                                        {res.rows.map((row, rIdx) => (
                                          <tr key={rIdx} className="hover:bg-slate-900/15">
                                            {res.columns.map(col => (
                                              <td key={col} className="px-3 py-2 truncate max-w-[150px]">
                                                {row[col] !== null ? String(row[col]) : <span className="text-slate-600">NULL</span>}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="w-full h-48 mt-1">
                                    {mounted && (
                                      <ResultChart
                                        chartConfig={res.chartConfig}
                                        rows={res.rows}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex gap-4 max-w-4xl mr-auto animate-pulse">
                  <div className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-400" />
                  </div>
                  <div className="p-4 rounded-xl glass-panel border border-slate-850 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Refining generated SQL context...</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* User Input bar */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-900/10">
          <form onSubmit={handleSendMessage} className="flex gap-3 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value);
                const target = e.target;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              disabled={sending || !selectedConnectionId}
              placeholder={
                selectedConnectionId
                  ? "Refine or write a new database prompt..."
                  : "Please select a connection to send messages."
              }
              className="flex-1 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-100 placeholder-slate-550 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none max-h-24 transition-all"
            />
            <button
              type="submit"
              disabled={sending || !inputValue.trim() || !selectedConnectionId}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:bg-slate-900 disabled:text-slate-600 transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 text-[10px] text-slate-500 text-center">
            Ask database questions. Conversation context is automatically maintained by the backend.
          </div>
        </div>
      </div>
    </main>
  );
}
