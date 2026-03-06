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
  const due = forgeItems.filter(f => f.status === 'DUE').sort((a,b) => a.nextReview - b.nextReview);
  const waiting = forgeItems.filter(f => f.status === 'WAITING').sort((a,b) => a.nextReview - b.nextReview);
  const forged = forgeItems.filter(f => f.status === 'FORGED').sort((a,b) => (b.forgedAt || 0) - (a.forgedAt || 0));

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
    <div className="animate-in fade-in duration-400">
      <div className="bg-[#1e2024] border border-[#db6d28] border-l-8 rounded-[12px] p-8 shadow-[0_10px_40px_rgba(219,109,40,0.15)] flex justify-between items-center mb-8">
        <div>
          <h2 className="text-[#db6d28] text-2xl font-black uppercase tracking-widest m-0 mb-2">The Forge (Spaced Repetition)</h2>
          <p className="text-[#8b949e] font-mono text-sm m-0">Failed algorithms enter here. They do not leave until they are conquered.</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center"><div className="text-2xl font-mono font-bold text-[#f85149]">{due.length}</div><div className="text-[10px] text-[#8b949e] uppercase tracking-widest">Action Req</div></div>
          <div className="text-center"><div className="text-2xl font-mono font-bold text-[#e3b341]">{waiting.length}</div><div className="text-[10px] text-[#8b949e] uppercase tracking-widest">Cooling</div></div>
          <div className="text-center"><div className="text-2xl font-mono font-bold text-[#56d364]">{forged.length}</div><div className="text-[10px] text-[#8b949e] uppercase tracking-widest">Forged</div></div>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-[#30363d] pb-4">
        <button onClick={() => setActiveTab('DUE')} className={`font-mono text-sm uppercase px-4 py-2 rounded transition-colors ${activeTab==='DUE'?'bg-[#f85149]/20 text-[#f85149] border border-[#f85149]':'bg-transparent text-[#8b949e] border border-transparent hover:border-[#30363d]'}`}>Crucible ({due.length})</button>
        <button onClick={() => setActiveTab('WAITING')} className={`font-mono text-sm uppercase px-4 py-2 rounded transition-colors ${activeTab==='WAITING'?'bg-[#e3b341]/20 text-[#e3b341] border border-[#e3b341]':'bg-transparent text-[#8b949e] border border-transparent hover:border-[#30363d]'}`}>Cooling ({waiting.length})</button>
        <button onClick={() => setActiveTab('FORGED')} className={`font-mono text-sm uppercase px-4 py-2 rounded transition-colors ${activeTab==='FORGED'?'bg-[#56d364]/20 text-[#56d364] border border-[#56d364]':'bg-transparent text-[#8b949e] border border-transparent hover:border-[#30363d]'}`}>Armory ({forged.length})</button>
      </div>

      <div className="space-y-3">
        {activeTab === 'DUE' && (due.length === 0 ? <div className="text-[#8b949e] font-mono italic p-6 text-center border border-[#30363d] rounded-lg bg-[#1e2024]">The Crucible is empty. All current weaknesses forged.</div> : 
          due.map(f => (
            <div key={f.pid} className="flex justify-between items-center p-4 bg-[rgba(248,81,73,0.05)] border border-[#f85149] rounded-lg group">
              <div>
                <a href={`https://codeforces.com/contest/${f.cid}/problem/${f.idx}`} target="_blank" className="text-white font-mono text-lg font-bold hover:text-[#58a6ff] transition-colors">{f.name}</a>
                <div className="text-[#8b949e] text-xs font-mono mt-1">Added: {new Date(f.added * 1000).toLocaleDateString()} | Rating: {f.rating || '?'} | Current Level: {f.level}</div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => markFailedAgain(f.pid)} className="px-4 py-2 bg-[#1e2024] border border-[#30363d] text-[#8b949e] text-xs font-mono uppercase hover:border-[#f85149] hover:text-[#f85149] transition-colors rounded">Failed Again</button>
                <a href={`https://codeforces.com/contest/${f.cid}/problem/${f.idx}`} target="_blank" className="px-4 py-2 bg-[#f85149] text-black text-xs font-bold font-mono uppercase hover:bg-[#ff6a64] transition-colors rounded no-underline flex items-center">Engage Target</a>
              </div>
            </div>
          ))
        )}
        {activeTab === 'WAITING' && waiting.map(f => (
          <div key={f.pid} className="flex justify-between items-center p-4 bg-[#1e2024] border border-[#30363d] rounded-lg opacity-70">
            <div><span className="text-white font-mono">{f.name}</span><div className="text-[#8b949e] text-xs font-mono mt-1">Level {f.level}</div></div>
            <div className="text-[#e3b341] font-mono text-xs border border-[#e3b341]/30 bg-[#e3b341]/10 px-3 py-1 rounded">Unlocks in {Math.ceil((f.nextReview - (Date.now()/1000))/3600)} Hours</div>
          </div>
        ))}
        {activeTab === 'FORGED' && forged.map(f => (
          <div key={f.pid} className="flex justify-between items-center p-4 bg-[rgba(86,211,100,0.05)] border border-[#56d364] rounded-lg">
            <div><span className="text-white font-mono line-through opacity-70">{f.name}</span></div>
            <div className="text-[#56d364] font-mono text-xs font-bold">FORGED @ {new Date(f.forgedAt! * 1000).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}