"use client";

import React from "react";
import {
  Check,
  Loader2,
  AlertCircle,
  HelpCircle,
  BrainCircuit,
  Binary,
  ShieldCheck,
  Search,
  Sparkles,
  Bookmark
} from "lucide-react";
import { PipelineStep } from "@/hooks/use-query-pipeline";

interface AgentPipelineStatusProps {
  steps: PipelineStep[];
}

export default function AgentPipelineStatus({ steps }: AgentPipelineStatusProps) {
  // Map step key to icon for visual representation
  const getStepIcon = (key: string, status: string) => {
    const iconClass = "h-5 w-5";
    switch (key) {
      case "INTENT_AGENT":
        return <BrainCircuit className={iconClass} />;
      case "SCHEMA_AGENT":
        return <Search className={iconClass} />;
      case "SQL_GENERATOR_AGENT":
        return <Binary className={iconClass} />;
      case "VALIDATION_AGENT":
        return <ShieldCheck className={iconClass} />;
      case "OPTIMIZATION_AGENT":
        return <Sparkles className={iconClass} />;
      case "EXPLANATION_AGENT":
        return <Bookmark className={iconClass} />;
      default:
        return <HelpCircle className={iconClass} />;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Horizontal Steps container */}
      <div className="relative flex justify-between items-center w-full">
        {/* Connection Background Line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 -z-10" />

        {steps.map((step, idx) => {
          const isPending = step.status === "pending";
          const isLoading = step.status === "loading";
          const isSuccess = step.status === "success";
          const isError = step.status === "error";

          // Icon Border and Color configuration
          let wrapperStyles = "bg-slate-950 border-slate-800 text-slate-500";
          let textStyles = "text-slate-500";
          
          if (isSuccess) {
            wrapperStyles = "bg-emerald-950/80 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/5";
            textStyles = "text-emerald-400 font-semibold";
          } else if (isLoading) {
            wrapperStyles = "bg-purple-950/80 border-purple-500 text-purple-400 shadow-md shadow-purple-500/10 animate-pulse ring-2 ring-purple-500/20";
            textStyles = "text-purple-400 font-semibold";
          } else if (isError) {
            wrapperStyles = "bg-red-950/80 border-red-500 text-red-400 shadow-md shadow-red-500/10";
            textStyles = "text-red-400 font-semibold";
          }

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 w-24 text-center group">
              {/* Outer status badge */}
              <div
                className={`h-11 w-11 rounded-xl border flex items-center justify-center transition-all duration-350 ${wrapperStyles}`}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isError ? (
                  <AlertCircle className="h-5 w-5" />
                ) : isSuccess ? (
                  <Check className="h-4.5 w-4.5 stroke-[3px]" />
                ) : (
                  getStepIcon(step.key, step.status)
                )}
              </div>

              {/* Step label text */}
              <span className={`text-[10px] mt-2.5 tracking-wide uppercase ${textStyles}`}>
                {step.name.split(" ")[0]}
              </span>

              {/* Dynamic status line segment to next step */}
              {idx < steps.length - 1 && (
                <div
                  className={`absolute left-[54%] top-[22px] w-[calc(100%-12px)] h-0.5 -z-10 transition-all duration-500 ${
                    isSuccess
                      ? "bg-emerald-500/60"
                      : isLoading
                      ? "bg-purple-500/40 bg-[linear-gradient(to_right,_#8b5cf6,_#1e293b)] bg-[length:200%_auto] animate-shimmer"
                      : isError
                      ? "bg-red-500/40"
                      : "bg-slate-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Global Error disclosure if any pipeline agent fails */}
      {steps.some(s => s.status === "error") && (
        <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-200 text-xs rounded-lg flex gap-2 animate-fade-in mt-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <div className="flex-1">
            <span className="font-bold text-red-400">
              Pipeline Blocked at {steps.find(s => s.status === "error")?.name}:
            </span>{" "}
            {steps.find(s => s.status === "error")?.error_message || "Operation failed."}
          </div>
        </div>
      )}
    </div>
  );
}
