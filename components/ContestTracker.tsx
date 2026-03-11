"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface Problem {
  contestId: number;
  index: string;
  name: string;
  rating?: number;
}

interface Contest {
  id: number;
  name: string;
  type: string;
  phase: string;
  durationSeconds: number;
  startTimeSeconds: number;
}

interface ContestRow {
  contest: Contest;
  problems: Problem[];
}

type ProblemState = "SOLVED" | "ATTEMPTED" | "UNSOLVED" | "NA";

const DIVISION_FILTERS = ["ALL", "Div. 1", "Div. 2", "Div. 3", "Div. 4", "Div. 1+2", "Educational", "Global", "Others"] as const;

const DIV_COLOR: Record<string, string> = {
  "ALL": "#8b949e",
  "Div. 1": "#f85149",
  "Div. 2": "#e3b341",
  "Div. 3": "#58a6ff",
  "Div. 4": "#56d364",
  "Div. 1+2": "#d2a8ff",
  "Educational": "#db6d28",
  "Global": "#e879f9",
  "Others": "#8b949e",
};

function getDivision(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("div. 1") && n.includes("div. 2")) return "Div. 1+2";
  if (n.includes("div. 1")) return "Div. 1";
  if (n.includes("div. 2")) return "Div. 2";
  if (n.includes("div. 3")) return "Div. 3";
  if (n.includes("div. 4")) return "Div. 4";
  if (n.includes("educational")) return "Educational";
  if (n.includes("global")) return "Global";
  return "Others";
}

function getProblemState(pid: string, solvedSet: Set<string>, attemptedSet: Set<string>): ProblemState {
  if (solvedSet.has(pid)) return "SOLVED";
  if (attemptedSet.has(pid)) return "ATTEMPTED";
  return "UNSOLVED";
}

const STATE_STYLES: Record<ProblemState | "NA", string> = {
  SOLVED:    "bg-[#1a4d2e] border-[#2ea043] text-[#56d364]",
  ATTEMPTED: "bg-[#3d2a00] border-[#e3b341] text-[#e3b341]",
  UNSOLVED:  "bg-[#0d1117] border-[#21262d] text-[#8b949e]",
  NA:        "bg-[#0a0a0a] border-[#161616] text-[#333]",
};

const PROBLEM_COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
// ── CACHE_KEY now lives in lib/storage-keys.ts ──────────────────────────────

export default function ContestTracker({
  handle,
  rawSubs,
}: {
  handle: string;
  rawSubs: any[];
}) {
  const [contests, setContests] = useState<ContestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");
  
  const [divFilter, setDivFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Build solved and attempted sets from rawSubs
  const { solvedSet, attemptedSet } = useMemo(() => {
    const solved = new Set<string>();
    const attempted = new Set<string>();
    rawSubs.forEach((s: any) => {
      if (!s.problem) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (s.verdict === "OK") solved.add(pid);
      else if (s.verdict !== "COMPILATION_ERROR") attempted.add(pid);
    });
    solved.forEach(pid => attempted.delete(pid));
    return { solvedSet: solved, attemptedSet: attempted };
  }, [rawSubs]);

  // ─── API SYNCHRONIZATION WITH CACHING ─────────────────────────────────
  const fetchContestArchive = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsSyncing(true);
    setError("");

    try {
      const contestRes = await fetch("https://codeforces.com/api/contest.list?gym=false");
      const contestData = await contestRes.json();
      if (contestData.status !== "OK") throw new Error("Contest list fetch failed");

      const finished: Contest[] = contestData.result.filter(
        (c: any) => c.phase === "FINISHED" && c.type === "CF"
      );

      const probRes = await fetch("https://codeforces.com/api/problemset.problems");
      const probData = await probRes.json();
      if (probData.status !== "OK") throw new Error("Problemset fetch failed");

      const probsByContest: Record<number, Problem[]> = {};
      
      // Optimization: Only extract problems that match our columns to drastically reduce localStorage size
      probData.result.problems.forEach((p: any) => {
        if (!p.contestId || !PROBLEM_COLS.includes(p.index)) return;
        if (!probsByContest[p.contestId]) probsByContest[p.contestId] = [];
        probsByContest[p.contestId].push({
          contestId: p.contestId,
          index: p.index,
          name: p.name,
          rating: p.rating
        });
      });

      Object.values(probsByContest).forEach(probs =>
        probs.sort((a, b) => a.index.localeCompare(b.index))
      );

      const rows: ContestRow[] = finished
        .filter(c => probsByContest[c.id] && probsByContest[c.id].length > 0)
        .map(c => ({
          contest: { id: c.id, name: c.name, type: c.type, phase: c.phase, durationSeconds: c.durationSeconds, startTimeSeconds: c.startTimeSeconds },
          problems: probsByContest[c.id]
        }));

      setContests(rows);
      
      // Cache the highly compressed row data
      try { localStorage.setItem(STORAGE_KEYS.CONTEST_ARCHIVE, JSON.stringify({ timestamp: Date.now(), rows })); } catch (e) {}

    } catch (e: any) {
      if (!isBackground) setError(e.message || "Failed to sync archive");
      // FIX #3: always reset both loading states on error so buttons don't stay frozen
      setLoading(false);
      setIsSyncing(false);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // ─── OFFLINE-FIRST BOOT SEQUENCE ──────────────────────────────────────
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.CONTEST_ARCHIVE);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.rows && parsed.rows.length > 0) {
          setContests(parsed.rows);
          setLoading(false); // Instantly bypass loading screen
          fetchContestArchive(true); // Trigger background sync
          return;
        }
      } catch (e) {}
    }
    // If no valid cache, force a hard load
    fetchContestArchive(false);
  }, [fetchContestArchive]);

  const filtered = useMemo(() => {
    let rows = contests;
    if (divFilter !== "ALL") rows = rows.filter(r => getDivision(r.contest.name) === divFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.contest.name.toLowerCase().includes(q) ||
        String(r.contest.id).includes(q)
      );
    }
    return rows;
  }, [contests, divFilter, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="text-[#e3b341] font-mono text-sm animate-pulse tracking-widest">LOADING CONTEST ARCHIVE...</div>
      <div className="text-[#333] font-mono text-xs">Fetching CF contest list + problemset</div>
    </div>
  );

  if (error && contests.length === 0) return (
    <div className="text-center py-20 text-[#f85149] font-mono text-sm">[ERROR] {error}</div>
  );

  return (
    <div className="animate-in fade-in duration-400 flex flex-col gap-6">

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* Search & Manual Sync */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by contest name or ID..."
            className="flex-1 bg-[#050505] border border-[#1a1a1a] text-[#e0e6ed] font-mono text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#e3b341] placeholder:text-[#333]"
          />
          <button 
            onClick={() => fetchContestArchive(true)} 
            disabled={isSyncing}
            className={`px-6 py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-widest border transition-all ${isSyncing ? 'bg-[#1a1a1a] border-[#333] text-[#555] cursor-not-allowed' : 'bg-[#050505] border-[#58a6ff]/30 text-[#58a6ff] hover:bg-[#58a6ff]/10 cursor-pointer'}`}
          >
            {isSyncing ? '↻ SYNCING...' : '↻ FORCE SYNC'}
          </button>
        </div>

        {/* Division filters */}
        <div className="flex flex-wrap gap-2">
          {DIVISION_FILTERS.map(div => (
            <button
              key={div}
              onClick={() => { setDivFilter(div); setPage(1); }}
              className="font-mono text-[0.65rem] uppercase tracking-widest px-4 py-1.5 rounded-md border transition-all cursor-pointer"
              style={{
                background: divFilter === div ? `${DIV_COLOR[div]}18` : "#050505",
                borderColor: divFilter === div ? DIV_COLOR[div] : "#1a1a1a",
                color: divFilter === div ? DIV_COLOR[div] : "#555",
                boxShadow: divFilter === div ? `0 0 8px ${DIV_COLOR[div]}33` : "none",
              }}
            >
              {div}
            </button>
          ))}
        </div>
      </div>

      {/* Contest Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1a1a1a]">
        <table className="w-full font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1a1a1a]" style={{ background: "#080808" }}>
              <th className="text-left py-3 px-4 text-[#555] font-normal uppercase tracking-widest w-16">ID</th>
              <th className="text-left py-3 px-4 text-[#555] font-normal uppercase tracking-widest">Contest</th>
              <th className="text-left py-3 px-4 text-[#555] font-normal uppercase tracking-widest w-24 hidden sm:table-cell">Duration</th>
              {PROBLEM_COLS.map(c => (
                <th key={c} className="text-center py-3 px-2 text-[#555] font-normal uppercase tracking-widest w-16">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr
                key={row.contest.id}
                className="border-b border-[#0f0f0f] hover:bg-white/[0.02] transition-colors"
                style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.005)" }}
              >
                <td className="py-2.5 px-4 text-[#333]">{row.contest.id}</td>
                <td className="py-2.5 px-4">
                  <a
                    href={`https://codeforces.com/contest/${row.contest.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#8b949e] hover:text-[#e3b341] transition-colors"
                  >
                    {row.contest.name}
                  </a>
                </td>
                <td className="py-2.5 px-4 text-[#444] hidden sm:table-cell">
                  {Math.floor(row.contest.durationSeconds / 3600)}h
                </td>
                {PROBLEM_COLS.map(col => {
                  const prob = row.problems.find(p => p.index === col);
                  if (!prob) {
                    return (
                      <td key={col} className="py-2 px-2">
                        <div className={`w-12 h-8 rounded border text-center flex items-center justify-center text-[10px] ${STATE_STYLES["NA"]}`}>—</div>
                      </td>
                    );
                  }
                  const pid = `${prob.contestId}-${prob.index}`;
                  const state = getProblemState(pid, solvedSet, attemptedSet);
                  return (
                    <td key={col} className="py-2 px-2">
                      <a
                        href={`https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${prob.name}${prob.rating ? ` (${prob.rating})` : ''}`}
                      >
                        <div className={`w-12 h-8 rounded border text-center flex items-center justify-center text-[10px] font-bold transition-all hover:scale-105 ${STATE_STYLES[state]}`}>
                          {prob.rating ?? "N/A"}
                        </div>
                      </a>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 font-mono text-xs mt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-[#050505] border border-[#1a1a1a] text-[#555] rounded hover:border-[#e3b341] hover:text-[#e3b341] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            ← PREV
          </button>
          <span className="text-[#444]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-[#050505] border border-[#1a1a1a] text-[#555] rounded hover:border-[#e3b341] hover:text-[#e3b341] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
