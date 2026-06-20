"use client";

import React, { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";

interface SqlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  height?: string;
}

export default function SqlEditor({
  value,
  onChange,
  readOnly = false,
  className = "",
  height = "250px"
}: SqlEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [editorTheme, setEditorTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setMounted(true);
    
    // Initial read
    const currentTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light" | null;
    if (currentTheme === "light" || currentTheme === "dark") {
      setEditorTheme(currentTheme);
    }

    // Observe changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          const newTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light" | null;
          if (newTheme === "light" || newTheme === "dark") {
            setEditorTheme(newTheme);
          }
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return (
      <div
        className={`bg-slate-950 font-mono text-xs border border-slate-900 rounded-lg p-4 text-slate-500 animate-pulse ${className}`}
        style={{ height }}
      >
        Initializing SQL Editor...
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border border-slate-900/60 bg-slate-950 shadow-inner ${className}`}>
      <CodeMirror
        value={value}
        height={height}
        extensions={[sql()]}
        theme={editorTheme}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true
        }}
      />
    </div>
  );
}
