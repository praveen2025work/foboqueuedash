"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCrosstab,
  fetchHealth,
  fetchRecon,
  fetchSummary,
  type CrosstabResult,
  type FilterParams,
  type ReconRecord,
  type ReconSummary,
} from "../lib/api";

// ---------- helpers ----------

const today = () => new Date().toISOString().slice(0, 10);

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "\u2014";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms < 0) return "\u2014";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

// Status colors work in both themes
const STATUS_BADGE: Record<string, string> = {
  COMPLETE: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
  PROCESSING: "bg-blue-500/20 text-blue-600 dark:text-blue-400 ring-blue-500/30",
  PENDING: "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  FAILED: "bg-red-500/20 text-red-600 dark:text-red-400 ring-red-500/30",
};

const REGION_BADGE: Record<string, string> = {
  APAC: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  EMEA: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  AMER: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
};

const STATUS_BAR_COLORS: Record<string, string> = {
  COMPLETE: "bg-emerald-500",
  PROCESSING: "bg-blue-500",
  PENDING: "bg-amber-500",
  FAILED: "bg-red-500",
};

const BAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-cyan-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500",
  "bg-teal-500", "bg-rose-500", "bg-lime-500", "bg-violet-500",
];

type Tab = "management" | "operations" | "admin";
type GroupBy = "status" | "region" | "business_area" | "hierarchy" | "service";
type ChartMode = "simple" | "by_status";

const GROUP_BY_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "region", label: "Region" },
  { key: "business_area", label: "Business Area" },
  { key: "hierarchy", label: "Hierarchy" },
  { key: "service", label: "Service" },
];

const NAV_ITEMS: { tab: Tab; icon: string; label: string }[] = [
  { tab: "management", icon: "\u25A6", label: "Management" },
  { tab: "operations", icon: "\u2630", label: "Operations" },
  { tab: "admin", icon: "\u2699", label: "Admin" },
];

// ---------- component ----------

export default function ReconDashboard() {
  const [tab, setTab] = useState<Tab>("management");
  const [busDate, setBusDate] = useState(today());
  const [records, setRecords] = useState<ReconRecord[]>([]);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [crosstab, setCrosstab] = useState<CrosstabResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envLabel, setEnvLabel] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [selectedRecord, setSelectedRecord] = useState<ReconRecord | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("region");
  const [chartMode, setChartMode] = useState<ChartMode>("by_status");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // filters
  const [fStatus, setFStatus] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [fBA, setFBA] = useState("");
  const [fHierarchy, setFHierarchy] = useState("");
  const [fService, setFService] = useState("");
  const [fHoliday, setFHoliday] = useState("");
  const [fMotif, setFMotif] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Theme init from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fobo-theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("fobo-theme", next);
  };

  const filterParams: FilterParams = {
    bus_date: busDate,
    status: fStatus || undefined,
    region: fRegion || undefined,
    business_area: fBA || undefined,
    hierarchy: fHierarchy || undefined,
    service: fService || undefined,
    is_holiday: fHoliday || undefined,
    in_motif: fMotif || undefined,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fp: FilterParams = {
        bus_date: busDate,
        status: fStatus || undefined,
        region: fRegion || undefined,
        business_area: fBA || undefined,
        hierarchy: fHierarchy || undefined,
        service: fService || undefined,
        is_holiday: fHoliday || undefined,
        in_motif: fMotif || undefined,
      };
      const [recs, sum, h] = await Promise.all([
        fetchRecon(fp),
        fetchSummary(fp),
        fetchHealth(),
      ]);
      setRecords(recs);
      setSummary(sum);
      setEnvLabel(h.env.toUpperCase());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setLoading(false);
      setCountdown(30);
    }
  }, [busDate, fStatus, fRegion, fBA, fHierarchy, fService, fHoliday, fMotif]);

  // Load crosstab when groupBy or chartMode changes
  const loadCrosstab = useCallback(async () => {
    if (chartMode !== "by_status" || groupBy === "status") {
      setCrosstab(null);
      return;
    }
    try {
      const fp: FilterParams = {
        bus_date: busDate,
        status: fStatus || undefined,
        region: fRegion || undefined,
        business_area: fBA || undefined,
        hierarchy: fHierarchy || undefined,
        service: fService || undefined,
        is_holiday: fHoliday || undefined,
        in_motif: fMotif || undefined,
      };
      const ct = await fetchCrosstab({ ...fp, group_by: groupBy, split_by: "status" });
      setCrosstab(ct);
    } catch {
      setCrosstab(null);
    }
  }, [busDate, groupBy, chartMode, fStatus, fRegion, fBA, fHierarchy, fService, fHoliday, fMotif]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCrosstab(); }, [loadCrosstab]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { load(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  // CSV export
  const exportCSV = () => {
    if (!records.length) return;
    const headers = Object.keys(records[0]);
    const csv = [
      headers.join(","),
      ...records.map((r) => headers.map((h) => `"${r[h as keyof ReconRecord] ?? ""}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recon_${busDate}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unique values for dropdowns (from full unfiltered would be ideal, but from current records is fine)
  const uniqueStatuses = [...new Set(records.map((r) => r.status))].sort();
  const uniqueRegions = [...new Set(records.map((r) => r.regn_id))].sort();
  const uniqueBAs = [...new Set(records.map((r) => r.business_area_name))].sort();
  const uniqueHierarchies = [...new Set(records.map((r) => r.hierarchy_level7))].sort();
  const uniqueServices = [...new Set(records.map((r) => r.service_name))].sort();

  // Group-by data for simple chart
  const getGroupData = (): [string, number][] => {
    if (!summary) return [];
    const map: Record<GroupBy, Record<string, number>> = {
      status: summary.by_status,
      region: summary.by_region,
      business_area: summary.by_business_area,
      hierarchy: summary.by_hierarchy || {},
      service: summary.by_service || {},
    };
    return Object.entries(map[groupBy]).sort((a, b) => b[1] - a[1]).slice(0, 15);
  };

  // -- shared styles using CSS vars --
  const inputCls = "rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bg-input-border)", color: "var(--text-primary)" };
  const selectOptionStyle = { backgroundColor: "var(--select-bg)" };

  // ======== SIDEBAR ========
  const sidebar = (
    <div className="flex w-56 flex-col" style={{ background: `linear-gradient(to bottom, var(--bg-sidebar), var(--bg-sidebar-end))`, borderRight: "1px solid var(--border-subtle)" }}>
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500 text-sm font-bold">F</div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>FOBO</div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Recon Monitor</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.tab}
            onClick={() => setTab(item.tab)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              tab === item.tab
                ? "bg-blue-500/15 text-blue-500 border-l-2 border-blue-500 pl-[10px]"
                : "hover:bg-[var(--bg-surface-hover)]"
            }`}
            style={tab !== item.tab ? { color: "var(--text-secondary)" } : undefined}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer: env badge + theme toggle */}
      <div className="px-4 py-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {envLabel && (
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            envLabel === "MOCK" ? "bg-yellow-500/15 text-yellow-600" :
            envLabel === "PROD" ? "bg-red-500/15 text-red-500" :
            "bg-blue-500/15 text-blue-500"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              envLabel === "MOCK" ? "bg-yellow-500" : envLabel === "PROD" ? "bg-red-500" : "bg-blue-500"
            }`} />
            {envLabel}
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all hover:bg-[var(--bg-surface-hover)]"
          style={{ color: "var(--text-secondary)" }}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? "\u2600" : "\u263D"}
        </button>
      </div>
    </div>
  );

  // ======== HEADER BAR ========
  const headerBar = (
    <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center gap-4">
        <h2 className="text-base font-semibold capitalize" style={{ color: "var(--text-heading)" }}>{tab}</h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>|</span>
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--text-secondary)" }}>Date</label>
          <input
            type="date" value={busDate} onChange={(e) => setBusDate(e.target.value)}
            className={inputCls} style={inputStyle}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono">{countdown}s</span>
        </div>
        <button onClick={load} className={`rounded-lg px-3 py-1.5 text-xs transition hover:opacity-80`} style={{ background: "var(--bg-input)", border: "1px solid var(--bg-input-border)", color: "var(--text-secondary)" }}>
          Refresh
        </button>
      </div>
    </div>
  );

  // ======== SKELETON ========
  const skeleton = (
    <div className="space-y-4 p-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: "var(--bg-surface)" }} />
      ))}
    </div>
  );

  // ======== ERROR BANNER ========
  const errorBanner = error && (
    <div className="mx-6 mt-4 glass rounded-xl px-4 py-3 text-sm text-red-500" style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)" }}>
      {error}
      <button onClick={load} className="ml-3 underline hover:opacity-80">Retry</button>
    </div>
  );

  // ======== FILTERS ROW ========
  const makeSelect = (value: string, setter: (v: string) => void, options: string[], label: string) => (
    <div className="flex items-center gap-1.5" key={label}>
      <label className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</label>
      <select value={value} onChange={(e) => setter(e.target.value)} className={inputCls} style={inputStyle}>
        <option value="" style={selectOptionStyle}>All</option>
        {options.map((o) => <option key={o} value={o} style={selectOptionStyle}>{o}</option>)}
      </select>
    </div>
  );

  const filtersRow = (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        {makeSelect(fStatus, setFStatus, uniqueStatuses, "Status")}
        {makeSelect(fRegion, setFRegion, uniqueRegions, "Region")}
        {makeSelect(fBA, setFBA, uniqueBAs, "Business Area")}
        <button
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          className="text-xs text-blue-500 hover:text-blue-400 ml-2"
        >
          {showMoreFilters ? "Less filters \u25B2" : "More filters \u25BC"}
        </button>
      </div>
      {showMoreFilters && (
        <div className="flex flex-wrap items-center gap-3 px-6 pb-3">
          {makeSelect(fHierarchy, setFHierarchy, uniqueHierarchies, "Hierarchy")}
          {makeSelect(fService, setFService, uniqueServices, "Service")}
          {makeSelect(fHoliday, setFHoliday, ["Y", "N"], "Holiday")}
          {makeSelect(fMotif, setFMotif, ["Y", "N"], "In Motif")}
        </div>
      )}
    </div>
  );

  // ============ STACKED BAR CHART ============
  const stackedChart = () => {
    if (!crosstab || !crosstab.labels.length) return null;
    const { labels, split_keys, series } = crosstab;

    // Calculate totals per label for percentage width
    const totals = labels.map((_, i) =>
      split_keys.reduce((sum, sk) => sum + (series[sk]?.[i] || 0), 0)
    );
    const maxTotal = Math.max(...totals, 1);

    return (
      <div className="space-y-3">
        {/* Legend */}
        <div className="flex gap-4 mb-2">
          {split_keys.map((sk) => (
            <div key={sk} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm ${STATUS_BAR_COLORS[sk] || "bg-gray-400"}`} />
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{sk}</span>
            </div>
          ))}
        </div>
        {/* Bars */}
        {labels.map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-44 truncate text-xs" style={{ color: "var(--text-secondary)" }} title={label}>{label}</span>
            <div className="flex-1 flex rounded-full overflow-hidden h-6" style={{ background: "var(--bg-surface)", width: `${(totals[i] / maxTotal) * 100}%`, minWidth: "60px" }}>
              {split_keys.map((sk) => {
                const val = series[sk]?.[i] || 0;
                if (val === 0) return null;
                const pct = (val / totals[i]) * 100;
                return (
                  <div
                    key={sk}
                    className={`h-6 ${STATUS_BAR_COLORS[sk] || "bg-gray-400"} flex items-center justify-center transition-all duration-500`}
                    style={{ width: `${pct}%`, minWidth: val > 0 ? "20px" : "0" }}
                    title={`${sk}: ${val}`}
                  >
                    {pct > 12 && <span className="text-[10px] font-semibold text-white">{val}</span>}
                  </div>
                );
              })}
            </div>
            <span className="text-xs font-mono w-8 text-right" style={{ color: "var(--text-muted)" }}>{totals[i]}</span>
          </div>
        ))}
      </div>
    );
  };

  // ============ MANAGEMENT TAB ============
  const managementTab = () => {
    if (!summary) return skeleton;
    const kpis = [
      { label: "Total", value: summary.total, gradient: "from-slate-500/20 to-slate-600/5", text: "text-slate-500" },
      { label: "Complete", value: summary.by_status["COMPLETE"] || 0, gradient: "from-emerald-500/20 to-emerald-600/5", text: "text-emerald-500" },
      { label: "Processing", value: summary.by_status["PROCESSING"] || 0, gradient: "from-blue-500/20 to-blue-600/5", text: "text-blue-500" },
      { label: "Pending", value: summary.by_status["PENDING"] || 0, gradient: "from-amber-500/20 to-amber-600/5", text: "text-amber-500" },
      { label: "Failed", value: summary.by_status["FAILED"] || 0, gradient: "from-red-500/20 to-red-600/5", text: "text-red-500" },
    ];

    const simpleData = getGroupData();
    const simpleMax = Math.max(...simpleData.map(([, v]) => v), 1);

    const showStacked = chartMode === "by_status" && groupBy !== "status";

    return (
      <div className="space-y-6 p-6">
        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className={`glass rounded-xl p-4 bg-gradient-to-br ${k.gradient}`}>
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{k.label}</div>
              <div className={`mt-1 text-3xl font-bold ${k.text}`}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Chart section */}
        <div className="glass rounded-xl p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>Distribution</h3>
            <div className="flex items-center gap-3">
              {/* Chart mode toggle */}
              <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-surface)" }}>
                {(["simple", "by_status"] as ChartMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setChartMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      chartMode === mode ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" : ""
                    }`}
                    style={chartMode !== mode ? { color: "var(--text-secondary)" } : undefined}
                  >
                    {mode === "simple" ? "Simple" : "By Status"}
                  </button>
                ))}
              </div>
              {/* Group-by pills */}
              <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-surface)" }}>
                {GROUP_BY_OPTIONS.filter((o) => chartMode === "simple" || o.key !== "status").map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setGroupBy(opt.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      groupBy === opt.key ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" : ""
                    }`}
                    style={groupBy !== opt.key ? { color: "var(--text-secondary)" } : undefined}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart content */}
          {showStacked && crosstab ? stackedChart() : (
            <div className="space-y-2.5">
              {simpleData.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-44 truncate text-xs" style={{ color: "var(--text-secondary)" }} title={name}>{name}</span>
                  <div className="flex-1 rounded-full h-6 overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                    <div
                      className={`h-6 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]} flex items-center justify-end pr-3 transition-all duration-500 ease-out`}
                      style={{ width: `${Math.max((count / simpleMax) * 100, 8)}%` }}
                    >
                      <span className="text-[11px] font-semibold text-white drop-shadow">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
              {simpleData.length === 0 && (
                <div className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No data available</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============ OPERATIONS TABLE ============
  const operationsTab = () => (
    <div className="flex h-full">
      <div className={`flex-1 overflow-auto ${selectedRecord ? "w-2/3" : ""}`}>
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 backdrop-blur text-[11px] uppercase tracking-wider" style={{ background: "var(--bg-thead)", color: "var(--text-muted)" }}>
            <tr>
              <th className="px-3 py-3">ID</th>
              <th className="px-3 py-3">Bus Date</th>
              <th className="px-3 py-3">Book ID</th>
              <th className="px-3 py-3">Region</th>
              <th className="px-3 py-3">Business Area</th>
              <th className="px-3 py-3">Hierarchy</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Rec Type</th>
              <th className="px-3 py-3">Exceptions</th>
              <th className="px-3 py-3">Start</th>
              <th className="px-3 py-3">End</th>
              <th className="px-3 py-3">Duration</th>
            </tr>
          </thead>
          <tbody style={{ borderColor: "var(--border-subtle)" }}>
            {records.map((r) => (
              <tr
                key={r.msbk_bus_dtl_id}
                onClick={() => setSelectedRecord(r)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--row-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{r.msbk_bus_dtl_id}</td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.bus_date}</td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{r.msbk_id}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${REGION_BADGE[r.regn_id] || "bg-gray-500/20"}`}>{r.regn_id}</span>
                </td>
                <td className="px-3 py-2 text-xs max-w-[180px] truncate" style={{ color: "var(--text-primary)" }} title={r.business_area_name}>{r.business_area_name}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{r.hierarchy_level7}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_BADGE[r.status] || ""}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.rec_id}</td>
                <td className={`px-3 py-2 font-mono text-xs ${r.expn > 0 ? "text-amber-500 font-semibold" : ""}`} style={r.expn === 0 ? { color: "var(--text-muted)" } : undefined}>{r.expn}</td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.start_time?.split(" ")[1] || "\u2014"}</td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.end_time?.split(" ")[1] || "\u2014"}</td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{duration(r.start_time, r.end_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && !loading && (
          <div className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>No records found</div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedRecord && (
        <div className="w-1/3 overflow-auto" style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--drawer-bg)" }}>
          <div className="sticky top-0 flex items-center justify-between px-5 py-3" style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>Record Details</h3>
            <button onClick={() => setSelectedRecord(null)} className="text-lg hover:opacity-70" style={{ color: "var(--text-secondary)" }}>&times;</button>
          </div>
          <dl className="p-5 space-y-2 text-xs">
            {Object.entries(selectedRecord).map(([k, v]) => (
              <div key={k} className="flex justify-between pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
                <dd className="font-mono text-right max-w-[200px] truncate" style={{ color: "var(--text-primary)" }} title={String(v ?? "")}>{String(v ?? "\u2014")}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );

  // ============ ADMIN TABLE ============
  const adminTab = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{records.length} records</span>
        <button onClick={exportCSV} className="rounded-lg px-3 py-1.5 text-xs transition hover:opacity-80" style={{ background: "var(--bg-input)", border: "1px solid var(--bg-input-border)", color: "var(--text-secondary)" }}>
          Export CSV
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 backdrop-blur text-[10px] uppercase tracking-wider" style={{ background: "var(--bg-thead)", color: "var(--text-muted)" }}>
            <tr>
              <th className="px-3 py-3">ID</th>
              <th className="px-3 py-3">Bus Date</th>
              <th className="px-3 py-3">MSBK ID</th>
              <th className="px-3 py-3">Rec ID</th>
              <th className="px-3 py-3">SubCat ID</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Region</th>
              <th className="px-3 py-3">Business Area</th>
              <th className="px-3 py-3">Hierarchy</th>
              <th className="px-3 py-3">Service</th>
              <th className="px-3 py-3">Expn</th>
              <th className="px-3 py-3">ExpnCnt</th>
              <th className="px-3 py-3">Holiday</th>
              <th className="px-3 py-3">Motif</th>
              <th className="px-3 py-3">Start</th>
              <th className="px-3 py-3">End</th>
              <th className="px-3 py-3">Updated By</th>
              <th className="px-3 py-3">Last Update</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.msbk_bus_dtl_id}
                className={`transition-colors ${r.expn > 100 ? "border-l-2 border-l-red-500" : ""}`}
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--row-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-primary)" }}>{r.msbk_bus_dtl_id}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-secondary)" }}>{r.bus_date}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-primary)" }}>{r.msbk_id}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-secondary)" }}>{r.rec_id}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-muted)" }}>{r.rec_subcategory_id}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_BADGE[r.status] || ""}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${REGION_BADGE[r.regn_id] || ""}`}>{r.regn_id}</span>
                </td>
                <td className="px-3 py-2 max-w-[140px] truncate" style={{ color: "var(--text-primary)" }} title={r.business_area_name}>{r.business_area_name}</td>
                <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{r.hierarchy_level7}</td>
                <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{r.service_name}</td>
                <td className={`px-3 py-2 font-mono ${r.expn > 0 ? "text-amber-500 font-semibold" : ""}`} style={r.expn === 0 ? { color: "var(--text-muted)" } : undefined}>{r.expn}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-muted)" }}>{r.expncount}</td>
                <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.is_holiday}</td>
                <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.in_motif}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-secondary)" }}>{r.start_time?.split(" ")[1] || "\u2014"}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-secondary)" }}>{r.end_time?.split(" ")[1] || "\u2014"}</td>
                <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{r.last_updated_by}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "var(--text-muted)" }}>{r.last_update}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-primary)" }}>
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden">
        {headerBar}
        {errorBanner}
        {tab !== "management" && filtersRow}
        <div className="flex-1 overflow-auto">
          {loading ? skeleton : tab === "management" ? managementTab() : tab === "operations" ? operationsTab() : adminTab()}
        </div>
      </div>
    </div>
  );
}
