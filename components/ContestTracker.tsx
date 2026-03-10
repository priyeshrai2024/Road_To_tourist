"use client";

import { useState, useEffect, useMemo } from "react";

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

export default function ContestTracker({
  handle,
  rawSubs,
}: {
  handle: string;
  rawSubs: any[];
}) {
  const [contests, setContests] = useState<ContestRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    // Remove from attempted if solved
    solved.forEach(pid => attempted.delete(pid));
    return { solvedSet: solved, attemptedSet: attempted };
  }, [rawSubs]);

  useEffect(() => {
    const fetchContests = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch contest list
        const contestRes = await fetch("https://codeforces.com/api/contest.list?gym=false");
        const contestData = await contestRes.json();
        if (contestData.status !== "OK") throw new Error("Contest list fetch failed");

        // Only finished contests
        const finished: Contest[] = contestData.result.filter(
          (c: Contest) => c.phase === "FINISHED" && c.type === "CF"
        );

        // Fetch problemset (all problems with contestId)
        const probRes = await fetch("https://codeforces.com/api/problemset.problems");
        const probData = await probRes.json();
        if (probData.status !== "OK") throw new Error("Problemset fetch failed");

        // Group problems by contestId
        const probsByContest: Record<number, Problem[]> = {};
        probData.result.problems.forEach((p: Problem) => {
          if (!p.contestId) return;
          if (!probsByContest[p.contestId]) probsByContest[p.contestId] = [];
          probsByContest[p.contestId].push(p);
        });

        // Sort problems within each contest by index
        Object.values(probsByContest).forEach(probs =>
          probs.sort((a, b) => a.index.localeCompare(b.index))
        );

        // Build rows — only contests that have problems
        const rows: ContestRow[] = finished
          .filter(c => probsByContest[c.id] && probsByContest[c.id].length > 0)
          .map(c => ({ contest: c, problems: probsByContest[c.id] }));

        setContests(rows);
      } catch (e: any) {
        setError(e.message || "Failed to load contests");
      }
      setLoading(false);
    };
    fetchContests();
  }, []);

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

  // Stats
  const stats = useMemo(() => {
    let totalProblems = 0, solved = 0, attempted = 0;
    contests.forEach(r => r.problems.forEach(p => {
      const pid = `${p.contestId}-${p.index}`;
      totalProblems++;
      if (solvedSet.has(pid)) solved++;
      else if (attemptedSet.has(pid)) attempted++;
    }));
    return { totalProblems, solved, attempted, unsolved: totalProblems - solved - attempted };
  }, [contests, solvedSet, attemptedSet]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="text-[#e3b341] font-mono text-sm animate-pulse tracking-widest">LOADING CONTEST ARCHIVE...</div>
      <div className="text-[#333] font-mono text-xs">Fetching CF contest list + problemset</div>
    </div>
  );

  if (error) return (
    <div className="text-center py-20 text-[#f85149] font-mono text-sm">[ERROR] {error}</div>
  );

  return (
    <div className="animate-in fade-in duration-400 flex flex-col gap-6">

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by contest name or ID..."
          className="w-full bg-[#050505] border border-[#1a1a1a] text-[#e0e6ed] font-mono text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#e3b341] placeholder:text-[#333]"
        />
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
          <div className="ml-auto font-mono text-[0.6rem] text-[#333] self-center">
            {filtered.length} contests
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 font-mono text-[0.65rem]">
        {[
          ["SOLVED", "#56d364", "bg-[#1a4d2e] border-[#2ea043]"],
          ["ATTEMPTED", "#e3b341", "bg-[#3d2a00] border-[#e3b341]"],
          ["UNSOLVED", "#8b949e", "bg-[#0d1117] border-[#21262d]"],
          ["N/A", "#333", "bg-[#0a0a0a] border-[#161616]"],
        ].map(([label, color, bg]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm border ${bg}`} />
            <span style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1a1a1a]">
        <table className="w-full font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1a1a1a] bg-[#050505]">
              <th className="px-3 py-3 text-left text-[#444] font-normal w-10">#</th>
              <th className="px-3 py-3 text-left text-[#444] font-normal w-48">Contest</th>
              {PROBLEM_COLS.map(col => (
                <th key={col} className="px-2 py-3 text-center text-[#444] font-normal w-36">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => {
              const div = getDivision(row.contest.name);
              const divColor = DIV_COLOR[div] || "#555";
              // Pad problems to always show 8 cols
              const problemSlots: (Problem | null)[] = PROBLEM_COLS.map((col) =>
                row.problems.find(p => p.index === col) || null
              );

              return (
                <tr
                  key={row.contest.id}
                  className="border-b border-[#0f0f0f] hover:bg-[#0d0d0d] transition-colors"
                >
                  {/* Row number */}
                  <td className="px-3 py-2 text-[#333]">{(page - 1) * PAGE_SIZE + i + 1}</td>

                  {/* Contest name */}
                  <td className="px-3 py-2">
                    <a
                      href={`https://codeforces.com/contest/${row.contest.id}`}
                      target="_blank"
                      className="hover:underline font-bold"
                      style={{ color: divColor }}
                    >
                      CF {row.contest.id}
                    </a>
                    <div className="text-[#555] text-[0.6rem] mt-0.5 max-w-[170px] truncate">{row.contest.name}</div>
                    <div className="text-[0.55rem] mt-0.5" style={{ color: divColor }}>{div}</div>
                  </td>

                  {/* Problem cells */}
                  {problemSlots.map((prob, ci) => {
                    if (!prob) return (
                      <td key={ci} className="px-2 py-2">
                        <div className={`rounded border px-2 py-1.5 text-center ${STATE_STYLES.NA}`}>
                          <div className="text-[0.6rem]">—</div>
                        </div>
                      </td>
                    );

                    const pid = `${prob.contestId}-${prob.index}`;
                    const state = getProblemState(pid, solvedSet, attemptedSet);
                    const style = STATE_STYLES[state];

                    return (
                      <td key={ci} className="px-2 py-2">
                        <a
                          href={`https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`}
                          target="_blank"
                          className={`block rounded border px-2 py-1.5 transition-all hover:brightness-125 no-underline ${style}`}
                        >
                          <div className="text-[0.65rem] font-bold truncate max-w-[130px]">{prob.name}</div>
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
        <div className="flex items-center justify-center gap-3 font-mono text-xs">
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
