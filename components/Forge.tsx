"use client";

import { useState, useEffect } from 'react';

interface ForgeItem { pid: string; name: string; cid: number; idx: string; level: number; nextReview: number; status: 'WAITING' | 'DUE' | 'FORGED'; added: number; forgedAt?: number; rating?: number; }

export default function Forge({ rawSubsList }: { rawSubsList: any[] }) {
  const [forge, setForge] = useState<Record<string, ForgeItem>>({});
  const [activeTab, setActiveTab] = useState<'DUE' | 'WAITING' | 'FORGED'>('DUE');

  useEffect(() => {
    if (!rawSubsList || rawSubsList.length === 0) return;

    const solved = new Set<string>();
    const failed = new Map<string, any>();

    // Process chronologically
    [...rawSubsList].reverse().forEach(s => {
      if (!s.problem) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (s.verdict === 'OK') solved.add(pid);
      else if (s.verdict === 'WRONG_ANSWER' || s.verdict === 'TIME_LIMIT_EXCEEDED' || s.verdict === 'RUNTIME_ERROR') {
        failed.set(pid, s);
      }
    });

    let currentForge: Record<string, ForgeItem> = JSON.parse(localStorage.getItem('cf_forge_v1') || '{}');
    const now = Date.now() / 1000;
    let updated = false;

    // 1. Ingest new fails
    failed.forEach((s, pid) => {
      if (!solved.has(pid) && !currentForge[pid]) {
        currentForge[pid] = { pid, name: s.problem.name, cid: s.problem.contestId, idx: s.problem.index, rating: s.problem.rating, level: 1, nextReview: now + 86400, // 24 hours
        status: 'WAITING', added: now };
        updated = true;
      }
    });

    // 2. Update statuses (Forged or Due)
    Object.keys(currentForge).forEach(pid => {
      if (solved.has(pid) && currentForge[pid].status !== 'FORGED') {
        currentForge[pid].status = 'FORGED';
        currentForge[pid].forgedAt = now;
        updated = true;
      } else if (currentForge[pid].status === 'WAITING' && now >= currentForge[pid].nextReview) {
        currentForge[pid].status = 'DUE';
        updated = true;
      }
    });

    if (updated) localStorage.setItem('cf_forge_v1', JSON.stringify(currentForge));
    setForge(currentForge);
  }, [rawSubsList]);

  const forgeItems = Object.values(forge);
  const due     = forgeItems.filter(f => f.status === 'DUE').sort((a, b) => a.nextReview - b.nextReview);
  const waiting = forgeItems.filter(f => f.status === 'WAITING').sort((a, b) => a.nextReview - b.nextReview);
  const forged  = forgeItems.filter(f => f.status === 'FORGED').sort((a, b) => (b.forgedAt || 0) - (a.forgedAt || 0));

  const markFailedAgain = (pid: string) => {
    const newForge = { ...forge };
    newForge[pid].level += 1;
    // Level 2 = 3 days, Level 3 = 7 days
    const delay = newForge[pid].level === 2 ? 86400 * 3 : 86400 * 7;
    newForge[pid].nextReview = (Date.now() / 1000) + delay;
    newForge[pid].status = 'WAITING';
    localStorage.setItem('cf_forge_v1', JSON.stringify(newForge));
    setForge(newForge);
  };

  return (
    <div className="animate-in fade-in duration-500">

      {/* HEADER PANEL */}
      <div className="bg-[#020202] border-t border-t-[#c5a059]/40 border-x border-b border-white/[0.04] p-8 mb-10 flex justify-between items-center relative">
        {/* Single razor gold line at top */}
        <div className="absolute top-0 left-0 w-full h-px bg-[#c5a059]/50" />

        <div>
          <h2 className="font-serif text-xl font-normal text-white/85 tracking-wide m-0 mb-2">
            The Forge
          </h2>
          <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 m-0">
            Spaced Repetition // Failed algorithms enter. They do not leave until conquered.
          </p>
        </div>

        <div className="flex gap-10">
          <div className="text-center">
            <div className="font-mono text-3xl font-light text-[#f85149]">{due.length}</div>
            <div className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mt-1">Action Req</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-3xl font-light text-[#c5a059]">{waiting.length}</div>
            <div className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mt-1">Cooling</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-3xl font-light text-white/35">{forged.length}</div>
            <div className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mt-1">Archived</div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-8 mb-8 border-b border-white/[0.05]">
        <button
          onClick={() => setActiveTab('DUE')}
          className={`font-mono text-[10px] tracking-[3px] uppercase pb-3 cursor-pointer bg-transparent border-none transition-all duration-200 ${
            activeTab === 'DUE'
              ? 'text-[#f85149] border-b border-b-[#f85149] -mb-px'
              : 'text-white/20 hover:text-white/40'
          }`}
        >
          Crucible ({due.length})
        </button>
        <button
          onClick={() => setActiveTab('WAITING')}
          className={`font-mono text-[10px] tracking-[3px] uppercase pb-3 cursor-pointer bg-transparent border-none transition-all duration-200 ${
            activeTab === 'WAITING'
              ? 'text-[#c5a059] border-b border-b-[#c5a059] -mb-px'
              : 'text-white/20 hover:text-white/40'
          }`}
        >
          Cooling ({waiting.length})
        </button>
        <button
          onClick={() => setActiveTab('FORGED')}
          className={`font-mono text-[10px] tracking-[3px] uppercase pb-3 cursor-pointer bg-transparent border-none transition-all duration-200 ${
            activeTab === 'FORGED'
              ? 'text-white/50 border-b border-b-white/30 -mb-px'
              : 'text-white/20 hover:text-white/40'
          }`}
        >
          Archived ({forged.length})
        </button>
      </div>

      {/* LIST RENDER */}
      <div className="space-y-px">

        {/* DUE TAB */}
        {activeTab === 'DUE' && (
          due.length === 0
            ? (
              <div className="font-mono text-[10px] tracking-[3px] uppercase text-white/15 py-16 text-center border border-dashed border-white/[0.05]">
                // The crucible is empty. All weaknesses forged.
              </div>
            )
            : due.map(f => (
              <div
                key={f.pid}
                className="flex justify-between items-center px-5 py-4 bg-[#020202] border-l border-l-[#f85149] hover:bg-white/[0.02] transition-all duration-200 group"
              >
                <div>
                  <a
                    href={`https://codeforces.com/contest/${f.cid}/problem/${f.idx}`}
                    target="_blank"
                    className="font-mono text-sm text-white/70 group-hover:text-white/90 transition-colors duration-200 no-underline tracking-tight"
                  >
                    {f.name}
                  </a>
                  <div className="font-mono text-[9px] tracking-[2px] uppercase text-white/20 mt-2 flex gap-5">
                    <span>Added <span className="text-white/35">{new Date(f.added * 1000).toLocaleDateString()}</span></span>
                    <span>Rating <span className="text-[#c5a059]/70">{f.rating || '?'}</span></span>
                    <span>Level <span className="text-white/35">{f.level}</span></span>
                  </div>
                </div>
                <div className="flex gap-3 shrink-0 ml-6">
                  <button
                    onClick={() => markFailedAgain(f.pid)}
                    className="px-4 py-2 bg-transparent border border-white/[0.08] text-white/25 font-mono text-[9px] tracking-[2px] uppercase hover:border-white/20 hover:text-white/50 transition-all duration-200 cursor-pointer"
                  >
                    Failed Again
                  </button>
                  <a
                    href={`https://codeforces.com/contest/${f.cid}/problem/${f.idx}`}
                    target="_blank"
                    className="px-5 py-2 bg-transparent border border-[#f85149]/50 text-[#f85149]/80 font-mono text-[9px] tracking-[2px] uppercase hover:bg-[rgba(248,81,73,0.06)] hover:border-[#f85149] hover:text-[#f85149] transition-all duration-200 no-underline flex items-center cursor-pointer"
                  >
                    Engage
                  </a>
                </div>
              </div>
            ))
        )}

        {/* WAITING TAB */}
        {activeTab === 'WAITING' && (
          waiting.length === 0
            ? (
              <div className="font-mono text-[10px] tracking-[3px] uppercase text-white/15 py-16 text-center border border-dashed border-white/[0.05]">
                // Nothing cooling.
              </div>
            )
            : waiting.map(f => (
              <div
                key={f.pid}
                className="flex justify-between items-center px-5 py-4 bg-[#020202] border-l border-l-[#c5a059]/30 hover:bg-white/[0.02] hover:border-l-[#c5a059]/60 transition-all duration-200"
              >
                <div>
                  <span className="font-mono text-sm text-white/45 tracking-tight">{f.name}</span>
                  <div className="font-mono text-[9px] tracking-[2px] uppercase text-white/20 mt-2">
                    Level {f.level}
                  </div>
                </div>
                <div className="font-mono text-[9px] tracking-[2px] uppercase text-[#c5a059]/60 border border-[#c5a059]/15 px-3 py-1.5 shrink-0 ml-6">
                  Unlocks in {Math.ceil((f.nextReview - (Date.now() / 1000)) / 3600)} hrs
                </div>
              </div>
            ))
        )}

        {/* FORGED TAB */}
        {activeTab === 'FORGED' && (
          forged.length === 0
            ? (
              <div className="font-mono text-[10px] tracking-[3px] uppercase text-white/15 py-16 text-center border border-dashed border-white/[0.05]">
                // Nothing archived yet.
              </div>
            )
            : forged.map(f => (
              <div
                key={f.pid}
                className="flex justify-between items-center px-5 py-4 bg-[#020202] border-l border-l-white/[0.06] hover:bg-white/[0.01] transition-all duration-200"
              >
                <span className="font-mono text-sm text-white/20 line-through tracking-tight">{f.name}</span>
                <div className="font-mono text-[9px] tracking-[2px] uppercase text-white/20 border border-white/[0.06] px-3 py-1.5 shrink-0 ml-6">
                  Archived {new Date(f.forgedAt! * 1000).toLocaleDateString()}
                </div>
              </div>
            ))
        )}

      </div>
    </div>
  );
}
