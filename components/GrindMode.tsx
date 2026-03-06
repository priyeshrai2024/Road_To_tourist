"use client";

import { useState, useEffect, useRef } from 'react';

interface ProbDetail { pid: string; name: string; timeTakenSecs: number; rating: number; }
interface SessionLog { date: string; workMins: number; problemsSolved: number; pointsEarned: number; type: string; avgTimeSecs: number; details: ProbDetail[]; }

const CF_SCORE_MAP: Record<number, number> = { 800:15, 900:20, 1000:30, 1100:45, 1200:65, 1300:90, 1400:130, 1500:180, 1600:250, 1700:350, 1800:500, 1900:720, 2000:1050, 2100:1530, 2200:2250, 2300:3300, 2400:4800 };

export default function GrindMode({ handle }: { handle: string }) {
  const [mode, setMode] = useState<'IDLE' | 'FLOW' | 'REST'>('IDLE');
  const [workSecs, setWorkSecs] = useState(0);
  const [restSecs, setRestSecs] = useState(0);
  const [targetRest, setTargetRest] = useState(0);
  const [history, setHistory] = useState<SessionLog[]>([]);
  const [sessionStartTS, setSessionStartTS] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SessionLog | null>(null);
  const [forgeTargets, setForgeTargets] = useState<any[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('cf_grind_history');
    if (saved) setHistory(JSON.parse(saved));
    
    // Pull active targets from Forge
    const f = JSON.parse(localStorage.getItem('cf_forge_v1') || '{}');
    const due = Object.values(f).filter((x:any) => x.status === 'DUE').slice(0, 3);
    setForgeTargets(due);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startFlow = () => {
    if (mode === 'IDLE') setSessionStartTS(Date.now() / 1000);
    setMode('FLOW');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setWorkSecs(prev => prev + 1), 1000);
  };

  const startRest = () => {
    setMode('REST');
    setTargetRest(Math.floor(workSecs / 5)); 
    setRestSecs(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setRestSecs(prev => prev + 1), 1000);
  };

  const terminateSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMode('IDLE');
    setSyncing(true);

    let points = 0;
    let type = 'GRIND / PRACTICE';
    const probDetails: ProbDetail[] = [];

    try {
      if (sessionStartTS && handle) {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=50`);
        const data = await res.json();
        if (data.status === 'OK') {
          // Filter subs within session and sort chronologically
          const sessionSubs = data.result.filter((s:any) => s.creationTimeSeconds >= sessionStartTS).reverse();
          
          if (sessionSubs.some((s:any) => s.author.participantType === 'CONTESTANT')) type = 'LIVE OPS (RATED)';
          else if (sessionSubs.some((s:any) => s.author.participantType === 'VIRTUAL')) type = 'SIMULATION (VIRTUAL)';

          let lastTimeMarker = sessionStartTS;
          const uniqueSolves = new Set<string>();

          sessionSubs.forEach((s: any) => {
            if (s.verdict === 'OK' && s.problem) {
              const pid = `${s.problem.contestId}-${s.problem.index}`;
              if (!uniqueSolves.has(pid)) {
                uniqueSolves.add(pid);
                const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
                points += CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;
                
                // Calculate time taken for this specific problem
                const timeTaken = s.creationTimeSeconds - lastTimeMarker;
                lastTimeMarker = s.creationTimeSeconds; // move marker forward
                
                probDetails.push({ pid, name: s.problem.name, timeTakenSecs: timeTaken, rating: s.problem.rating || 800 });
              }
            }
          });
        }
      }
    } catch (e) { console.error("Telemetry sync failed."); }

    const avgTime = probDetails.length > 0 ? Math.round(probDetails.reduce((sum, p) => sum + p.timeTakenSecs, 0) / probDetails.length) : 0;
    
    const report: SessionLog = { date: new Date().toISOString(), workMins: parseFloat((workSecs / 60).toFixed(1)), problemsSolved: probDetails.length, pointsEarned: points, type, avgTimeSecs: avgTime, details: probDetails };
    
    const newHistory = [report, ...history];
    setHistory(newHistory);
    localStorage.setItem('cf_grind_history', JSON.stringify(newHistory));
    setLastReport(report);
    
    setWorkSecs(0); setRestSecs(0); setTargetRest(0); setSessionStartTS(null); setSyncing(false);
  };

  if (mode !== 'IDLE') {
    const isFlow = mode === 'FLOW';
    return (
      <div className="fixed inset-0 bg-[#050505] z-[9999] flex flex-col justify-center items-center font-mono selection:bg-[#f85149] p-8">
        <div className="absolute top-10 left-10 text-[#8b949e] tracking-[5px] uppercase text-sm">[ DIRECT OVERRIDE: FLOW STATE ]</div>
        
        {forgeTargets.length > 0 && isFlow && (
          <div className="absolute top-10 right-10 bg-[rgba(248,81,73,0.05)] border border-[#f85149]/30 rounded-lg p-4 text-right">
            <div className="text-[#f85149] text-xs uppercase tracking-widest font-bold mb-2">Forge Targets Due</div>
            {forgeTargets.map((t:any) => <div key={t.pid} className="text-[#8b949e] text-xs">[{t.pid}] {t.name}</div>)}
          </div>
        )}

        <div className={`text-[12rem] leading-none font-bold tracking-tighter transition-colors duration-1000 ${isFlow ? 'text-[#f85149] drop-shadow-[0_0_80px_rgba(248,81,73,0.3)]' : 'text-[#58a6ff] drop-shadow-[0_0_80px_rgba(88,166,255,0.3)]'}`}>
          {isFlow ? formatTime(workSecs) : formatTime(restSecs)}
        </div>
        
        <div className="text-xl text-[#8b949e] tracking-widest uppercase mt-4">
          {isFlow ? 'Nescafé-Fueled Execution' : `Mandatory Rest Phase / Target: ${formatTime(targetRest)}`}
        </div>

        <div className="flex gap-8 mt-20">
          {isFlow ? (
            <button onClick={startRest} className="px-8 py-4 bg-transparent border-2 border-[#58a6ff] text-[#58a6ff] font-bold uppercase tracking-widest hover:bg-[#58a6ff] hover:text-black transition-all">Initiate Rest</button>
          ) : (
            <button onClick={startFlow} className="px-8 py-4 bg-transparent border-2 border-[#f85149] text-[#f85149] font-bold uppercase tracking-widest hover:bg-[#f85149] hover:text-black transition-all">Resume Execution</button>
          )}
          <button onClick={terminateSession} className="px-8 py-4 bg-[#1e2024] border border-[#30363d] text-[#8b949e] font-bold uppercase tracking-widest hover:border-[#f85149] hover:text-[#f85149] transition-all">Terminate & Extract</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-400">
      <div className="bg-[#1e2024] border border-[#f85149] border-l-8 rounded-[12px] p-8 shadow-[0_10px_40px_rgba(248,81,73,0.15)] flex justify-between items-center mb-8">
        <div>
          <h2 className="text-[#f85149] text-2xl font-black uppercase tracking-widest m-0 mb-2">Initialize Grind Mode</h2>
          <p className="text-[#8b949e] font-mono text-sm m-0">Zero distractions. Auto-reads contest/virtual context and calculates per-problem execution speed.</p>
        </div>
        <button onClick={startFlow} className="bg-[#f85149] text-black font-black uppercase tracking-widest px-10 py-5 rounded-lg text-lg hover:bg-[#ff6a64] transition-colors shadow-[0_0_20px_rgba(248,81,73,0.4)]">Engage Protocol</button>
      </div>

      {syncing && <div className="text-[#e3b341] font-mono animate-pulse mb-8">[ FETCHING AND PARSING TELEMETRY... ]</div>}
      
      {lastReport && !syncing && (
        <div className="bg-[#1e2024] border border-[#58a6ff] border-t-4 rounded-[12px] p-6 mb-8 font-mono shadow-lg">
          <h3 className="text-[#58a6ff] uppercase font-bold mb-4 border-b border-[#30363d] pb-2 text-lg">Operation Extracted: {lastReport.type}</h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-black/30 p-4 rounded"><span className="text-[#8b949e] text-[10px] block uppercase">Total Focus</span><span className="text-2xl text-white font-bold">{lastReport.workMins}m</span></div>
            <div className="bg-black/30 p-4 rounded"><span className="text-[#8b949e] text-[10px] block uppercase">Avg Solve Time</span><span className="text-2xl text-[#e3b341] font-bold">{formatTime(lastReport.avgTimeSecs)}</span></div>
            <div className="bg-black/30 p-4 rounded"><span className="text-[#8b949e] text-[10px] block uppercase">Targets Killed</span><span className="text-2xl text-white font-bold">{lastReport.problemsSolved}</span></div>
            <div className="bg-black/30 p-4 rounded"><span className="text-[#8b949e] text-[10px] block uppercase">XP Gained</span><span className="text-2xl text-[#56d364] font-bold">+{lastReport.pointsEarned}</span></div>
          </div>
          {lastReport.details.length > 0 && (
             <div className="space-y-2">
               <div className="text-xs text-[#8b949e] uppercase mb-2">Kill Feed / Time Taken:</div>
               {lastReport.details.map((d,i) => (
                 <div key={i} className="flex justify-between border-b border-[#30363d]/50 pb-1 text-sm"><span className="text-white">{d.name} <span className="text-xs text-[#8b949e]">({d.rating})</span></span><span className="text-[#e3b341]">{formatTime(d.timeTakenSecs)}</span></div>
               ))}
             </div>
          )}
        </div>
      )}

      <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-4 m-0">Confidential Session Logs</h3>
        <table className="w-full text-left font-mono text-sm">
          <thead className="text-[#8b949e]"><tr><th className="pb-2">Date</th><th className="pb-2">Context</th><th className="pb-2">Execution Time</th><th className="pb-2">Avg Speed</th><th className="pb-2">ACs</th><th className="pb-2 text-[#e3b341]">Yield</th></tr></thead>
          <tbody>
            {history.length === 0 ? <tr><td colSpan={6} className="py-4 text-center italic text-[#8b949e]">No records found.</td></tr> : 
              history.map((h, i) => (
                <tr key={i} className="border-t border-[#30363d]/50 hover:bg-white/5 transition-colors">
                  <td className="py-3 text-[#58a6ff]">{new Date(h.date).toLocaleDateString()}</td>
                  <td className="py-3 text-white text-xs">{h.type}</td>
                  <td className="py-3 text-white">{h.workMins}m</td>
                  <td className="py-3 text-[#e3b341]">{formatTime(h.avgTimeSecs || 0)}</td>
                  <td className="py-3 text-white">{h.problemsSolved}</td>
                  <td className="py-3 text-[#e3b341] font-bold">{h.pointsEarned}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}