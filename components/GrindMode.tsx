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
    return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '00')}`;
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

  // ─── FULLSCREEN FLOW / REST MODE ─────────────────────────────────────────────
  if (mode !== 'IDLE') {
    const isFlow = mode === 'FLOW';
    return (
      <div className="fixed inset-0 bg-[#000000] z-[9999] flex flex-col justify-center items-center font-mono p-8">

        {/* Top-left status tag */}
        <div className="absolute top-10 left-10 font-mono text-[9px] tracking-[5px] uppercase text-white/20">
          {isFlow ? '[ Flow State Active ]' : '[ Rest Phase ]'}
        </div>

        {/* Forge targets panel — top right */}
        {forgeTargets.length > 0 && isFlow && (
          <div className="absolute top-10 right-10 border border-white/[0.06] p-5 text-right">
            <div className="font-mono text-[9px] tracking-[4px] uppercase text-[#f85149]/60 mb-3">
              Forge Targets Due
            </div>
            {forgeTargets.map((t:any) => (
              <div key={t.pid} className="font-mono text-[10px] text-white/25 mt-1">
                [{t.pid}] {t.name}
              </div>
            ))}
          </div>
        )}

        {/* Massive timer — sterile military clock */}
        <div className={`font-mono leading-none tracking-tighter select-none transition-colors duration-700 ${
          isFlow
            ? 'text-[#c5a059] text-[clamp(6rem,18vw,14rem)]'
            : 'text-[#f85149] text-[clamp(6rem,18vw,14rem)]'
        }`}>
          {isFlow ? formatTime(workSecs) : formatTime(restSecs)}
        </div>

        {/* Sub-label */}
        <div className="font-mono text-[10px] tracking-[5px] uppercase text-white/20 mt-6">
          {isFlow
            ? 'Execution in Progress'
            : `Mandatory Rest — Target ${formatTime(targetRest)}`
          }
        </div>

        {/* Action buttons */}
        <div className="flex gap-6 mt-20">
          {isFlow ? (
            <button
              onClick={startRest}
              className="px-8 py-3 bg-transparent border border-white/15 text-white/35 font-mono text-[10px] tracking-[4px] uppercase hover:border-white/30 hover:text-white/60 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer"
            >
              Initiate Rest
            </button>
          ) : (
            <button
              onClick={startFlow}
              className="px-8 py-3 bg-transparent border border-[#c5a059]/30 text-[#c5a059]/60 font-mono text-[10px] tracking-[4px] uppercase hover:border-[#c5a059]/60 hover:text-[#c5a059] hover:bg-[rgba(197,160,89,0.03)] transition-all duration-200 cursor-pointer"
            >
              Resume Execution
            </button>
          )}
          <button
            onClick={terminateSession}
            className="px-8 py-3 bg-transparent border border-[#f85149]/30 text-[#f85149]/50 font-mono text-[10px] tracking-[4px] uppercase hover:border-[#f85149]/70 hover:text-[#f85149]/80 hover:bg-[rgba(248,81,73,0.03)] transition-all duration-200 cursor-pointer"
          >
            Terminate & Extract
          </button>
        </div>
      </div>
    );
  }

  // ─── IDLE DASHBOARD VIEW ─────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500">

      {/* ENGAGE PANEL */}
      <div className="bg-[#020202] border border-white/[0.05] border-t border-t-[#f85149]/50 p-8 flex justify-between items-center mb-8 relative">
        {/* Razor red top line */}
        <div className="absolute top-0 left-0 w-full h-px bg-[#f85149]/40" />
        <div>
          <h2 className="font-serif text-xl font-normal text-white/85 tracking-wide m-0 mb-2">
            Initialize Grind Mode
          </h2>
          <p className="font-mono text-[9px] tracking-[2px] uppercase text-white/20 m-0">
            Zero distractions. Auto-reads contest / virtual context and calculates per-problem execution speed.
          </p>
        </div>
        <button
          onClick={startFlow}
          className="font-mono text-[10px] tracking-[4px] uppercase px-8 py-3 bg-transparent border border-[#f85149]/40 text-[#f85149]/70 hover:border-[#f85149]/80 hover:text-[#f85149] hover:bg-[rgba(248,81,73,0.04)] transition-all duration-200 cursor-pointer shrink-0 ml-8"
        >
          Engage Protocol
        </button>
      </div>

      {/* SYNCING INDICATOR */}
      {syncing && (
        <div className="font-mono text-[9px] tracking-[4px] uppercase text-[#c5a059]/60 animate-pulse mb-8">
          [ Fetching and parsing telemetry... ]
        </div>
      )}

      {/* LAST REPORT PANEL */}
      {lastReport && !syncing && (
        <div className="bg-[#020202] border border-white/[0.05] border-t border-t-white/20 p-8 mb-8 relative">
          <div className="absolute top-0 left-0 w-full h-px bg-white/15" />

          <h3 className="font-serif text-lg font-normal text-white/75 tracking-wide mb-1">
            Operation Extracted
          </h3>
          <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-8">
            {lastReport.type}
          </p>

          <div className="grid grid-cols-4 gap-px bg-white/[0.04] mb-8">
            <div className="bg-[#020202] p-5">
              <span className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 block mb-3">Total Focus</span>
              <span className="font-mono text-2xl font-light text-white/70">{lastReport.workMins}<span className="text-sm ml-1 text-white/30">m</span></span>
            </div>
            <div className="bg-[#020202] p-5">
              <span className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 block mb-3">Avg Solve Time</span>
              <span className="font-mono text-2xl font-light text-[#c5a059]/80">{formatTime(lastReport.avgTimeSecs)}</span>
            </div>
            <div className="bg-[#020202] p-5">
              <span className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 block mb-3">Targets Solved</span>
              <span className="font-mono text-2xl font-light text-white/70">{lastReport.problemsSolved}</span>
            </div>
            <div className="bg-[#020202] p-5">
              <span className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 block mb-3">Points Earned</span>
              <span className="font-mono text-2xl font-light text-[#c5a059]/80">+{lastReport.pointsEarned}</span>
            </div>
          </div>

          {lastReport.details.length > 0 && (
            <div>
              <div className="font-mono text-[8px] tracking-[4px] uppercase text-white/15 mb-4">
                Kill Feed / Time Taken
              </div>
              <div className="space-y-px">
                {lastReport.details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-3 px-4 bg-[#020202] hover:bg-white/[0.02] transition-colors duration-150 border-l border-l-white/[0.05]">
                    <span className="font-mono text-xs text-white/50">
                      {d.name}
                      <span className="text-white/20 ml-2">({d.rating})</span>
                    </span>
                    <span className="font-mono text-xs text-[#c5a059]/60">{formatTime(d.timeTakenSecs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SESSION LOG TABLE */}
      <div className="bg-[#020202] border border-white/[0.04] p-8">
        <div className="absolute top-0 left-0 w-full h-px bg-white/[0.06]" />

        <h3 className="font-serif text-lg font-normal text-white/65 tracking-wide mb-1">
          Confidential Session Logs
        </h3>
        <div className="w-6 h-px bg-white/10 mb-8 mt-2" />

        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="pb-3 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Date</th>
              <th className="pb-3 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Context</th>
              <th className="pb-3 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Focus Time</th>
              <th className="pb-3 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Avg Speed</th>
              <th className="pb-3 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">ACs</th>
              <th className="pb-3 font-mono text-[8px] tracking-[3px] uppercase text-[#c5a059]/40 font-normal">Yield</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center font-mono text-[9px] tracking-[3px] uppercase text-white/15">
                    // No records found.
                  </td>
                </tr>
              )
              : history.map((h, i) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="py-3 text-white/35">{new Date(h.date).toLocaleDateString()}</td>
                  <td className="py-3 text-white/40 text-[10px] tracking-wide">{h.type}</td>
                  <td className="py-3 text-white/45">{h.workMins}m</td>
                  <td className="py-3 text-[#c5a059]/60">{formatTime(h.avgTimeSecs || 0)}</td>
                  <td className="py-3 text-white/45">{h.problemsSolved}</td>
                  <td className="py-3 text-[#c5a059]/70">{h.pointsEarned}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
