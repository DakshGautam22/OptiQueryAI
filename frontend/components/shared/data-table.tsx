"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pageSize?: number;
  className?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  pageSize = 10,
  className = ""
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Sorting Logic
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        comparison = aVal === bVal ? 0 : aVal ? 1 : -1;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  // Pagination Logic
  const totalRows = sortedData.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (colKey: string, sortable?: boolean) => {
    if (!sortable) return;

    if (sortColumn === colKey) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Reset page on sort change
  };

  const getSortIcon = (colKey: string, sortable?: boolean) => {
    if (!sortable) return null;
    if (sortColumn !== colKey) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 ml-1.5 shrink-0" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-purple-400 ml-1.5 shrink-0" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-purple-400 ml-1.5 shrink-0" />
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-900/60 rounded-xl bg-slate-950/20 backdrop-blur-md">
        <table className="w-full text-left text-sm divide-y divide-slate-900/80">
          <thead className="bg-slate-900/30 text-slate-400 text-xs uppercase tracking-wider font-semibold">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key, col.sortable)}
                  className={`px-5 py-4 ${col.sortable ? "cursor-pointer hover:bg-slate-900/40 hover:text-slate-200" : ""} transition-colors select-none`}
                >
                  <div className="flex items-center">
                    {col.header}
                    {getSortIcon(col.key, col.sortable)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850/40 text-slate-300">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-slate-500 italic">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-900/10 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-5 py-3.5 truncate max-w-[240px]">
                      {col.render ? col.render(row) : row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : "-"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs text-slate-500 font-semibold px-2">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRows)} of {totalRows} entries
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 px-3 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-slate-950 transition-all flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 px-3 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-slate-950 transition-all flex items-center gap-1"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
