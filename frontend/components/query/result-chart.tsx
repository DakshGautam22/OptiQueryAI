"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";
import { TrendingUp, FileText } from "lucide-react";

interface ResultChartProps {
  chartConfig: {
    type: "bar" | "line" | "pie" | "kpi" | "table";
    x_axis?: string;
    y_axes?: string[];
  };
  rows: any[];
}

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export default function ResultChart({ chartConfig, rows }: ResultChartProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setMounted(true);
    const theme = document.documentElement.getAttribute("data-theme") as "dark" | "light" | null;
    if (theme === "light" || theme === "dark") {
      setCurrentTheme(theme);
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          const newTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light" | null;
          if (newTheme === "light" || newTheme === "dark") {
            setCurrentTheme(newTheme);
          }
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-xs bg-slate-950/20 rounded-xl border border-slate-900">
        Initializing Chart Engine...
      </div>
    );
  }

  if (!chartConfig || !rows || rows.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs bg-slate-950/20 rounded-xl border border-slate-900">
        <FileText className="h-6 w-6 mb-2 text-slate-700" />
        No rendering parameters available.
      </div>
    );
  }

  const { type, x_axis, y_axes } = chartConfig;
  const xAxisName = x_axis || "";
  const yAxisName = y_axes && y_axes[0] ? y_axes[0] : "";

  // 1. KPI Card View Handler
  if (type === "kpi") {
    const firstRow = rows[0];
    const key = yAxisName || Object.keys(firstRow)[0];
    const val = firstRow[key];
    const displayValue = typeof val === "number" ? val.toLocaleString() : String(val);

    return (
      <div className="h-64 flex items-center justify-center">
        <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-purple-600/5 text-center min-w-[240px] max-w-sm relative overflow-hidden group shadow-lg shadow-purple-950/10">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            Auto Detected Metric ({key})
          </p>
          <h2 className="text-4xl font-extrabold text-white glow-text leading-none mb-3">
            {displayValue}
          </h2>
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
            <TrendingUp className="h-3 w-3" /> Auto Compiled
          </div>
        </div>
      </div>
    );
  }

  // 2. Bar Chart View Handler
  if (type === "bar" && xAxisName) {
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={currentTheme === "dark" ? "#1e293b" : "#cbd5e1"} opacity={0.4} />
            <XAxis dataKey={xAxisName} stroke={currentTheme === "dark" ? "#64748b" : "#475569"} fontSize={10} tickLine={false} />
            <YAxis stroke={currentTheme === "dark" ? "#64748b" : "#475569"} fontSize={10} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: currentTheme === "dark" ? "#020617" : "#ffffff",
                borderColor: currentTheme === "dark" ? "#1e293b" : "#cbd5e1",
                borderRadius: "8px",
                fontSize: "11px",
                color: currentTheme === "dark" ? "#f8fafc" : "#0f172a"
              }}
            />
            <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
            {y_axes?.map((yCol, idx) => (
              <Bar
                key={yCol}
                dataKey={yCol}
                fill={COLORS[idx % COLORS.length]}
                radius={[4, 4, 0, 0]}
                name={yCol}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // 3. Line Chart View Handler
  if (type === "line" && xAxisName) {
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={currentTheme === "dark" ? "#1e293b" : "#cbd5e1"} opacity={0.4} />
            <XAxis dataKey={xAxisName} stroke={currentTheme === "dark" ? "#64748b" : "#475569"} fontSize={10} tickLine={false} />
            <YAxis stroke={currentTheme === "dark" ? "#64748b" : "#475569"} fontSize={10} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: currentTheme === "dark" ? "#020617" : "#ffffff",
                borderColor: currentTheme === "dark" ? "#1e293b" : "#cbd5e1",
                borderRadius: "8px",
                fontSize: "11px",
                color: currentTheme === "dark" ? "#f8fafc" : "#0f172a"
              }}
            />
            <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
            {y_axes?.map((yCol, idx) => (
              <Line
                key={yCol}
                type="monotone"
                dataKey={yCol}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 1 }}
                activeDot={{ r: 5 }}
                name={yCol}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // 4. Pie Chart View Handler
  if (type === "pie" && xAxisName && yAxisName) {
    const pieData = rows.map(r => ({
      name: r[xAxisName] ? String(r[xAxisName]) : "Unknown",
      value: typeof r[yAxisName] === "number" ? r[yAxisName] : parseFloat(String(r[yAxisName])) || 0
    }));

    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
            >
              {pieData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: currentTheme === "dark" ? "#020617" : "#ffffff",
                borderColor: currentTheme === "dark" ? "#1e293b" : "#cbd5e1",
                borderRadius: "8px",
                fontSize: "11px",
                color: currentTheme === "dark" ? "#f8fafc" : "#0f172a"
              }}
            />
            <Legend wrapperStyle={{ fontSize: "10px" }} layout="vertical" align="right" verticalAlign="middle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Fallback view
  return (
    <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs bg-slate-950/20 rounded-xl border border-slate-900">
      <FileText className="h-6 w-6 mb-2 text-slate-700" />
      Unsupported rendering type: {type || "unknown"}
    </div>
  );
}
