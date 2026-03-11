"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface Problem { contestId: number; index: string; name: string; rating?: number; }
interface Contest { id: number; name: string; type: string; phase: string; durationSeconds: number; startTimeSeconds: number; }
interface ContestRow { contest: Contest; problems: Problem[]; }
type ProblemState = "SOLVED" | "ATTEMPTED" | "UNSOLVED" | "NA";

const DIVISION_FILTERS = ["ALL", "Div. 1", "Div. 2", "Div. 3", "Div. 4", "Div. 1+2", "Educational", "Global", "Others"] as const;
const DIV_COLOR: Record<string, string> = { "ALL": "#8b949e", "Div. 1": "#f85149", "Div. 2": "#e3b341", "Div. 3": "#58a6ff", "Div. 4": "#56d364", "Div. 1+2": "#d2a8ff", "Educational": "#fb923c", "Global": "#e879f9", "Others": "#8b949e" };

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

const PROBLEM_COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const CACHE_KEY = STORAGE_KEYS.CONTEST_ARCHIVE;
const PAGE_SIZE = 50;

export default function ContestTracker({ handle, rawSubs }: { handle: string; rawSubs: any[] }) {
  const [contests, setContests] = useState<ContestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");
  const [divFilter, setDivFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { solvedSet, attemptedSet } = useMemo(() => {
    const solved = new Set<string>(); const attempted = new Set<string>();
    rawSubs.forEach((s: any) => {
      if (!s.problem) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (s.verdict === "OK") solved.add(pid);
      else if (s.verdict !== "COMPILATION_ERROR") attempted.add(pid);
    });
    solved.forEach(pid => attempted.delete(pid));
    return { solvedSet: solved, attemptedSet: attempted };
  }, [rawSubs]);

  const fetchContestArchive = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true); else setIsSyncing(true);
    setError("");
    try {
      // PROXY FIX: Routing contest list through middleman
      const contestUrl = encodeURIComponent("https://codeforces.com/api/contest.list?gym=false");
      const contestRes = await fetch(`/api/cf?url=${contestUrl}`);
      const contestData = await contestRes.json();
      
      if (contestData.status !== "OK") throw new Error("Contest list fetch failed");
      const finished: Contest[] = contestData.result.filter((c: any) => c.phase === "FINISHED" && c.type === "CF");
      
      // PROXY FIX: Routing problemset through middleman
      const probUrl = encodeURIComponent("https://codeforces.com/api/problemset.problems");
      const probRes = await fetch(`/api/cf?url=${probUrl}`);
      const probData = await probRes.json();
      
      if (probData.status !== "OK") throw new Error("Problemset fetch failed");
      
      const probsByContest: Record<number, Problem[]> = {};
      probData.result.problems.forEach((p: any) => {
        if (!p.contestId || !PROBLEM_COLS.includes(p.index)) return;
        if (!probsByContest[p.contestId]) probsByContest[p.contestId] = [];
        probsByContest[p.contestId].push({ contestId: p.contestId, index: p.index, name: p.name, rating: p.rating });
      });
      
      Object.values(probsByContest).forEach(probs => probs.sort((a, b) => a.index.localeCompare(b.index)));
      const rows: ContestRow[] = finished.filter(c => probsByContest[c.id]?.length > 0).map(c => ({ contest: { id: c.id, name: c.name, type: c.type, phase: c.phase, durationSeconds: c.durationSeconds, startTimeSeconds: c.startTimeSeconds }, problems: probsByContest[c.id] }));
      
      setContests(rows);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), rows })); } catch {}
    } catch (e: any) {
      if (!isBackground) { setError(e.message || "Failed to sync archive"); } else { setIsSyncing(false); }
    } finally {
      setLoading(false); setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.rows?.length > 0) { setContests(parsed.rows); setLoading(false); fetchContestArchive(true); return; }
      } catch {}
    }
    fetchContestArchive(false);
  }, [fetchContestArchive]);

  const filtered = useMemo(() => {
    let rows = contests;
    if (divFilter !== "ALL") rows = rows.filter(r => getDivision(r.contest.name) === divFilter);
    if (search.trim()) { const q = search.trim().toLowerCase(); rows = rows.filter(r => r.contest.name.toLowerCase().includes(q) || String(r.contest.id).includes(q)); }
    return rows;
  }, [contests, divFilter, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <p className="text-sm animate-pulse font-medium" style={{ color: 'var(--accent)' }}>Loading contest archive...</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fetching CF contest list + problemset</p>
    </div>
  );

  if (error && contests.length === 0) return (
    <div className="text-center py-20 text-sm" style={{ color: 'var(--status-wa)' }}>{error}</div>
  );

  return (
    <div className="animate-in fade-in duration-300 flex flex-col gap-5">

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search contests..."
            className="flex-1 text-sm px-4 py-2.5 rounded-lg outline-none transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
          <button onClick={() => fetchContestArchive(true)} disabled={isSyncing}
            className="px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: isSyncing ? 'var(--bg-card)' : 'var(--accent-10)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            {isSyncing ? '↻ Syncing...' : '↻ Force Sync'}
          </button>
        </div>

        {/* Division filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {DIVISION_FILTERS.map(div => (
            <button key={div} onClick={() => { setDivFilter(div); setPage(1); }}
              className="text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium"
              style={{
                background: divFilter === div ? `${DIV_COLOR[div]}18` : 'var(--bg-card)',
                border: `1px solid ${divFilter === div ? DIV_COLOR[div] : 'var(--border)'}`,
                color: divFilter === div ? DIV_COLOR[div] : 'var(--text-muted)',
              }}>{div}</button>
          ))}
          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} contests</span>
        </div>

        {/* Legend */}
        <div className="flex gap-5 text-xs">
          {[['Solved', '#1a4d2e', '#2ea043', '#56d364'], ['Attempted', '#3d2a00', '#e3b341', '#e3b341'], ['Unsolved', 'var(--bg-card)', 'var(--border)', 'var(--text-muted)'], ['N/A', 'var(--bg-base)', 'var(--bg-base)', 'var(--border)']].map(([label, bg, border, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border" style={{ background: bg, borderColor: border }} />
              <span style={{ color }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-xs border-collapse min-w-[1000px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <th className="px-3 py-3 text-left font-medium w-12" style={{ color: 'var(--text-muted)' }}>#</th>
              <th className="px-3 py-3 text-left font-medium w-48" style={{ color: 'var(--text-muted)' }}>Contest</th>
              {PROBLEM_COLS.map(col => (
                <th key={col} className="px-2 py-3 text-center font-medium" style={{ color: 'var(--text-muted)' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => {
              const div = getDivision(row.contest.name);
              const divColor = DIV_COLOR[div] || 'var(--text-muted)';
              const problemSlots = PROBLEM_COLS.map(col => row.problems.find(p => p.index === col) || null);
              return (
                <tr key={row.contest.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-2">
                    <a href={`https://codeforces.com/contest/${row.contest.id}`} target="_blank" className="font-semibold hover:underline" style={{ color: divColor }}>CF {row.contest.id}</a>
                    <div className="text-[0.6rem] mt-0.5 max-w-[190px] truncate" style={{ color: 'var(--text-muted)' }}>{row.contest.name}</div>
                    <div className="text-[0.55rem] mt-0.5 font-medium" style={{ color: divColor }}>{div}</div>
                  </td>
                  {problemSlots.map((prob, ci) => {
                    if (!prob) return (
                      <td key={ci} className="px-1 py-2">
                        <div className="rounded border px-2 py-1.5 text-center" style={{ background: 'var(--bg-base)', borderColor: 'var(--bg-base)', color: 'var(--border)' }}>
                          <div className="text-[0.6rem]">—</div>
                        </div>
                      </td>
                    );
                    const pid = `${prob.contestId}-${prob.index}`;
                    const state: ProblemState = solvedSet.has(pid) ? "SOLVED" : attemptedSet.has(pid) ? "ATTEMPTED" : "UNSOLVED";
                    const bg = state === 'SOLVED' ? '#1a4d2e' : state === 'ATTEMPTED' ? '#3d2a00' : 'var(--bg-card)';
                    const border = state === 'SOLVED' ? '#2ea043' : state === 'ATTEMPTED' ? '#e3b341' : 'var(--border)';
                    const color = state === 'SOLVED' ? '#56d364' : state === 'ATTEMPTED' ? '#e3b341' : 'var(--text-muted)';
                    return (
                      <td key={ci} className="px-1 py-2">
                        <a href={`https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`} target="_blank"
                          className="block rounded border px-2 py-1.5 transition-all hover:brightness-125 no-underline"
                          style={{ background: bg, borderColor: border, color }}>
                          <div className="text-[0.65rem] font-medium truncate max-w-[120px]">{prob.name}</div>
                          <div className="text-[0.6rem] mt-0.5 opacity-70">{prob.rating ?? "N/A"}</div>
                        </a>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>← Prev</button>
          <span style={{ color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Next →</button>
        </div>
      )}
    </div>
  );
}