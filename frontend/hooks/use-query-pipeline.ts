"use client";

import { useState, useRef } from "react";
import apiClient from "@/lib/api-client";

export interface PipelineStep {
  id: string;
  name: string;
  key: string;
  status: "pending" | "loading" | "success" | "error";
  error_message?: string;
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: "1", name: "Intent Classification", key: "INTENT_AGENT", status: "pending" },
  { id: "2", name: "Schema Harvesting", key: "SCHEMA_AGENT", status: "pending" },
  { id: "3", name: "SQL Generation", key: "SQL_GENERATOR_AGENT", status: "pending" },
  { id: "4", name: "Safety Validation", key: "VALIDATION_AGENT", status: "pending" },
  { id: "5", name: "Query Optimization", key: "OPTIMIZATION_AGENT", status: "pending" },
  { id: "6", name: "Explanation Output", key: "EXPLANATION_AGENT", status: "pending" }
];

export function useQueryPipeline() {
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Generation Outputs
  const [generatedSql, setGeneratedSql] = useState("");
  const [optimizedSql, setOptimizedSql] = useState("");
  const [optimizationReport, setOptimizationReport] = useState<string[]>([]);
  const [explanationSteps, setExplanationSteps] = useState<string[]>([]);
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    suggestions: string[];
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Execution Outputs
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [chartConfig, setChartConfig] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };

  const startSimulation = () => {
    clearSimulation();
    setSteps(INITIAL_STEPS.map((s, idx) => (idx === 0 ? { ...s, status: "loading" } : s)));

    let currentStepIdx = 0;
    simulationIntervalRef.current = setInterval(() => {
      currentStepIdx++;
      if (currentStepIdx < INITIAL_STEPS.length) {
        setSteps(prev =>
          prev.map((s, idx) => {
            if (idx < currentStepIdx) return { ...s, status: "success" };
            if (idx === currentStepIdx) return { ...s, status: "loading" };
            return s;
          })
        );
      } else {
        clearSimulation();
      }
    }, 450); // Move step every 450ms during active loading
  };

  const generateSql = async (
    connectionId: string,
    question: string,
    sessionId: string | null = null,
    conversationHistory: any[] = []
  ) => {
    setGenerating(true);
    setGenerationError(null);
    setValidation(null);
    setGeneratedSql("");
    setOptimizedSql("");
    setOptimizationReport([]);
    setExplanationSteps([]);

    // Clear previous query run results
    setRows([]);
    setColumns([]);
    setChartConfig(null);
    setExecutionError(null);

    startSimulation();

    try {
      const res = await apiClient.post("/query/generate", {
        connection_id: connectionId,
        question,
        session_id: sessionId || undefined,
        conversation_history: conversationHistory
      });

      clearSimulation();

      const data = res.data;
      setGeneratedSql(data.generated_sql);
      setOptimizedSql(data.optimized_sql);
      setOptimizationReport(data.optimization_report || []);
      setExplanationSteps(data.explanation_steps || []);
      setValidation(data.validation);

      // Resolve step statuses based on safety validation
      if (data.validation && !data.validation.valid) {
        setSteps(prev =>
          prev.map(s => {
            const numId = parseInt(s.id);
            if (numId < 4) return { ...s, status: "success" };
            if (numId === 4) {
              return {
                ...s,
                status: "error",
                error_message: data.validation.errors.join("; ") || "Query failed safety validation checks."
              };
            }
            return { ...s, status: "pending" };
          })
        );
      } else {
        // All steps succeeded
        setSteps(INITIAL_STEPS.map(s => ({ ...s, status: "success" })));
      }

      return data;
    } catch (err: any) {
      clearSimulation();
      const errData = err.response?.data;
      const errorMsg = errData?.detail || err.message || "Failed to generate query.";
      setGenerationError(errorMsg);

      // Check if backend specified which agent failed
      const failedStageKey = errData?.error_stage || "SQL_GENERATOR_AGENT";

      setSteps(prev => {
        let hasFailed = false;
        return prev.map(s => {
          if (hasFailed) return { ...s, status: "pending" };

          if (s.key === failedStageKey) {
            hasFailed = true;
            return {
              ...s,
              status: "error",
              error_message: errData?.error_message || errorMsg
            };
          }
          return { ...s, status: "success" };
        });
      });

      throw err;
    } finally {
      setGenerating(false);
    }
  };

  const executeSql = async (connectionId: string, sql: string) => {
    setExecuting(true);
    setExecutionError(null);
    setRows([]);
    setColumns([]);
    setChartConfig(null);

    try {
      const res = await apiClient.post("/query/execute", {
        connection_id: connectionId,
        sql
      });

      setRows(res.data.rows || []);
      setColumns(res.data.columns || []);
      setChartConfig(res.data.chart_config);
      return res.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Query execution failed.";
      setExecutionError(errorMsg);
      throw err;
    } finally {
      setExecuting(false);
    }
  };

  const resetPipeline = () => {
    setSteps(INITIAL_STEPS);
    setGeneratedSql("");
    setOptimizedSql("");
    setOptimizationReport([]);
    setExplanationSteps([]);
    setValidation(null);
    setGenerationError(null);
    setRows([]);
    setColumns([]);
    setChartConfig(null);
    setExecutionError(null);
  };

  return {
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
  };
}
