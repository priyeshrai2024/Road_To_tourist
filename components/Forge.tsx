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
      
      {/* HEADER PANEL */}
      <div className="bg-[#050505] border border-[#db6d28]/30 border-t-[3px] border-t-[#db6d28] rounded-[4px] p-6 shadow-[0_0_25px_rgba(219,109,40,0.1)] flex justify-between items-center mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[#db6d28] blur-[100px] opacity-10 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-[#db6d28] text-lg font-black uppercase tracking-[3px] m-0 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#db6d28] animate-pulse" />
            The Forge // Spaced Repetition
          </h2>
          <p className="text-[#4a5568] font-mono text-[10px] uppercase tracking-[1px] m-0">Failed algorithms enter here. They do not leave until they are conquered.</p>
        </div>
        <div className="flex gap-6 relative z-10">
          <div className="text-center"><div className="text-3xl font-mono font-bold text-[#f85149] drop-shadow-[0_0_10px_rgba(248,81,73,0.5)]">{due.length}</div><div className="text-[10px] text-[#4a5568] uppercase tracking-widest mt-1">Action Req</div></div>
          <div className="text-center"><div className="text-3xl font-mono font-bold text-[#e3b341]">{waiting.length}</div><div className="text-[10px] text-[#4a5568] uppercase tracking-widest mt-1">Cooling</div></div>
          <div className="text-center"><div className="text-3xl font-mono font-bold text-[#56d364]">{forged.length}</div><div className="text-[10px] text-[#4a5568] uppercase tracking-widest mt-1">Forged</div></div>
        </div>
      </div>

      {/* TACTICAL TABS */}
      <div className="flex gap-2 mb-6 border-b border-[#1a1a1a] pb-4">
        <button onClick={() => setActiveTab('DUE')} className={`font-mono text-xs font-bold uppercase px-6 py-2.5 rounded-[4px] transition-all duration-200 cursor-pointer ${activeTab==='DUE'?'bg-[rgba(248,81,73,0.1)] text-[#f85149] border border-[#f85149]/50 shadow-[0_0_10px_rgba(248,81,73,0.2)]':'bg-[#0a0a0a] text-[#4a5568] border border-[#1a1a1a] hover:border-[#333]'}`}>Crucible ({due.length})</button>
        <button onClick={() => setActiveTab('WAITING')} className={`font-mono text-xs font-bold uppercase px-6 py-2.5 rounded-[4px] transition-all duration-200 cursor-pointer ${activeTab==='WAITING'?'bg-[rgba(227,179,65,0.1)] text-[#e3b341] border border-[#e3b341]/50 shadow-[0_0_10px_rgba(227,179,65,0.2)]':'bg-[#0a0a0a] text-[#4a5568] border border-[#1a1a1a] hover:border-[#333]'}`}>Cooling ({waiting.length})</button>
        <button onClick={() => setActiveTab('FORGED')} className={`font-mono text-xs font-bold uppercase px-6 py-2.5 rounded-[4px] transition-all duration-200 cursor-pointer ${activeTab==='FORGED'?'bg-[rgba(86,211,100,0.1)] text-[#56d364] border border-[#56d364]/50 shadow-[0_0_10px_rgba(86,211,100,0.2)]':'bg-[#0a0a0a] text-[#4a5568] border border-[#1a1a1a] hover:border-[#333]'}`}>Armory ({forged.length})</button>
      </div>

      {/* LIST RENDER */}
      <div className="space-y-3">
        {activeTab === 'DUE' && (due.length === 0 ? <div className="text-[#4a5568] font-mono tracking-[1px] text-xs py-10 text-center border border-dashed border-[#1a1a1a] rounded-[4px] bg-[#050505]">// THE CRUCIBLE IS EMPTY. ALL WEAKNESSES FORGED.</div> : 
          due.map(f => (
            <div key={f.pid} className="flex justify-between items-center p-5 bg-[rgba(248,81,73,0.03)] border-l-[3px] border-[#f85149] border-y border-r border-y-[#1a1a1a] border-r-[#1a1a1a] rounded-[4px] group hover:bg-[rgba(248,81,73,0.05)] transition-colors">
              <div>
                <a href={`https://codeforces.com/contest/${f.cid}/problem/${f.idx}`} target="_blank" className="text-[#e0e6ed] font-mono text-[1rem] font-bold hover:text-[#f85149] transition-colors tracking-tight no-underline">{f.name}</a>
                <div className="text-[#4a5568] text-[10px] uppercase font-mono mt-2 flex gap-4">
                  <span>Added: <strong className="text-[#8b949e]">{new Date(f.added * 1000).toLocaleDateString()}</strong></span>
                  <span>Rating: <strong className="text-[#e3b341]">{f.rating || '?'}</strong></span>
                  <span>Target Level: <strong className="text-[#58a6ff]">{f.level}</strong></span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => markFailedAgain(f.pid)} className="px-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] text-[#4a5568] text-[10px] font-bold font-mono uppercase tracking-[1px] hover:border-[#f85149] hover:text-[#f85149] transition-colors rounded-[4px] cursor-pointer">Failed Again</button>
                <a href={`https://codeforces.com/contest/${f.cid}/problem/${f.idx}`} target="_blank" className="px-6 py-2 bg-[#f85149] text-black text-[10px] font-black font-mono tracking-[1px] uppercase hover:bg-[#ff6a64] transition-colors rounded-[4px] no-underline flex items-center shadow-[0_0_10px_rgba(248,81,73,0.3)]">Engage Target</a>
              </div>
            </div>
          ))
        )}
        
        {activeTab === 'WAITING' && waiting.map(f => (
          <div key={f.pid} className="flex justify-between items-center p-5 bg-[#050505] border border-[#1a1a1a] rounded-[4px] opacity-70 hover:opacity-100 transition-opacity">
            <div>
              <span className="text-[#c9d1d9] font-mono font-bold">{f.name}</span>
              <div className="text-[#4a5568] text-[10px] uppercase tracking-[1px] font-mono mt-1">Level {f.level}</div>
            </div>
            <div className="text-[#e3b341] font-mono text-[10px] font-bold tracking-[1px] border border-[#e3b341]/30 bg-[#e3b341]/10 px-3 py-1.5 rounded-[4px] uppercase">Unlocks in {Math.ceil((f.nextReview - (Date.now()/1000))/3600)} Hrs</div>
          </div>
        ))}
        
        {activeTab === 'FORGED' && forged.map(f => (
          <div key={f.pid} className="flex justify-between items-center p-5 bg-[rgba(86,211,100,0.02)] border border-[#1a1a1a] rounded-[4px]">
            <div><span className="text-[#4a5568] font-mono font-bold line-through">{f.name}</span></div>
            <div className="text-[#56d364] font-mono text-[10px] tracking-[1px] border border-[#56d364]/20 bg-[rgba(86,211,100,0.05)] px-3 py-1.5 rounded-[4px] uppercase font-bold">Forged @ {new Date(f.forgedAt! * 1000).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}