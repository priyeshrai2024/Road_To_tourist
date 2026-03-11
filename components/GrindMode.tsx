"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CF_SCORE_MAP } from "@/lib/constants";
import { STORAGE_KEYS } from "@/lib/storage-keys";

// ── Types ────────────────────────────────────────────────────────────────────
interface ProbDetail { pid: string; name: string; timeTakenSecs: number; rating: number; }
interface SessionLog {
  id: string; date: string; startTs: number; endTs: number; workMins: number;
  problemsSolved: number; pointsEarned: number; type: string; avgTimeSecs: number;
  details: ProbDetail[]; flowRating?: number; intent?: string; breakCount: number;
  plannedMins?: number;
}
interface GrindTask { id: number; text: string; done: boolean; pinned: boolean; priority: 'high' | 'normal'; estMins?: number; }
interface TmrPlan { id: number; text: string; }
type Phase = 'IDLE' | 'INTENT' | 'FLOW' | 'REST' | 'RATE';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
  return `${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
}
function fmtMins(s: number) { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function getWeekMonday(d: Date) { const day=new Date(d), dow=day.getDay(), diff=dow===0?-6:1-dow; day.setDate(day.getDate()+diff); day.setHours(0,0,0,0); return day; }

// ── Theme Colors (Gruvbox) ───────────────────────────────────────────────────
const theme = {
  bg: '#1d2021', surface: '#282828', sh: '#3c3836', text: '#ebdbb2',
  muted: '#a89984', accent: '#fabd2f', stop: '#fb4934', ok: '#b8bb26'
};

// ── Animated flow ring ───────────────────────────────────────────────────────
function FlowRing({ phase, targetRest, restSecs }: { phase: Phase; targetRest: number; restSecs: number }) {
  const r = 118, c = 2 * Math.PI * r;
  const pct = phase === 'REST' && targetRest > 0 ? Math.min(restSecs / targetRest, 1) : 0;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 280 280">
      {phase === 'FLOW' && (
        <circle cx="140" cy="140" r={r} fill="none" stroke={theme.accent} strokeWidth="2"
          strokeDasharray="4 16" strokeLinecap="round"
          style={{ transformOrigin:'center', animation:'grindRingSpin 45s linear infinite', opacity: 0.5 }} />
      )}
      {phase === 'REST' && (
        <>
          <circle cx="140" cy="140" r={r} fill="none" stroke={theme.sh} strokeWidth="3" />
          <circle cx="140" cy="140" r={r} fill="none" stroke="#58a6ff" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c * (1 - pct)}`}
            style={{ transform:'rotate(-90deg)', transformOrigin:'center', transition:'stroke-dasharray 1s ease' }} />
        </>
      )}
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GrindMode({ handle }: { handle: string }) {
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [workSecs, setWorkSecs] = useState(0);
  const [restSecs, setRestSecs] = useState(0);
  const [targetRest, setTargetRest] = useState(0);

  const [intent, setIntent] = useState('');
  const [plannedMins, setPlannedMins] = useState('');

  const [flowRating, setFlowRating] = useState(0);
  const [breakCount, setBreakCount] = useState(0);

  const [tasks, setTasks] = useState<GrindTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newPri, setNewPri] = useState<'normal'|'high'>('normal');
  const [newEst, setNewEst] = useState('');

  const [tmrPlan, setTmrPlan] = useState<TmrPlan[]>([]);
  const [newTmr, setNewTmr] = useState('');
  const [showTmrModal, setShowTmrModal] = useState(false);

  const [sessionStartTS, setSessionStartTS] = useState<number|null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SessionLog|null>(null);
  const [history, setHistory] = useState<SessionLog[]>([]);

  const [targetHrs, setTargetHrs] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [rogueACs, setRogueACs] = useState<any[]>([]);

  const timerRef = useRef<NodeJS.Timeout|null>(null);
  const [wrActiveTab, setWrActiveTab] = useState(0);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    try { const h = localStorage.getItem(STORAGE_KEYS.GRIND_SESSIONS); if (h) setHistory(JSON.parse(h)); } catch {}
    try { const t = localStorage.getItem(STORAGE_KEYS.GRIND_TASKS); if (t) setTasks(JSON.parse(t)); } catch {}
    try { const tp = localStorage.getItem(STORAGE_KEYS.GRIND_TMR_PLAN); if (tp) setTmrPlan(JSON.parse(tp)); } catch {}
    try { const tg = localStorage.getItem(STORAGE_KEYS.GRIND_TARGET_HRS); if (tg) setTargetHrs(parseInt(tg)); } catch {}
  }, []);

  // ── Rogue AC Detection ────────────────────────────────────────────────────
  useEffect(() => {
    if (!handle || phase !== 'IDLE') return;
    const checkForRogues = async () => {
      try {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=50`);
        const data = await res.json();
        if (data.status === 'OK') {
          const now = Date.now() / 1000;
          const recent = data.result.filter((s:any) => s.verdict === 'OK' && s.author.participantType === 'PRACTICE' && (now - s.creationTimeSeconds) < 86400 * 2);
          const missing = recent.filter((s:any) => {
            return !history.some(h => s.creationTimeSeconds >= h.startTs && s.creationTimeSeconds <= h.endTs);
          });
          setRogueACs(missing);
        }
      } catch (e) {}
    };
    checkForRogues();
  }, [handle, phase, history]);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'grind-ring-css';
    style.textContent = `@keyframes grindRingSpin { 100% { transform: rotate(360deg); } }`;
    if (!document.getElementById('grind-ring-css')) document.head.appendChild(style);
  }, []);

  const saveTasks = useCallback((t: GrindTask[]) => { setTasks(t); try { localStorage.setItem(STORAGE_KEYS.GRIND_TASKS, JSON.stringify(t)); } catch {} }, []);
  const saveHistory = useCallback((h: SessionLog[]) => { setHistory(h); try { localStorage.setItem(STORAGE_KEYS.GRIND_SESSIONS, JSON.stringify(h)); } catch {} }, []);
  const saveTmrPlan = useCallback((tp: TmrPlan[]) => { setTmrPlan(tp); try { localStorage.setItem(STORAGE_KEYS.GRIND_TMR_PLAN, JSON.stringify(tp)); } catch {} }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const startTick = useCallback((field: 'work'|'rest') => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (field === 'work') setWorkSecs(p => p + 1);
      else setRestSecs(p => p + 1);
    }, 1000);
  }, []);

  const startFlow = useCallback(() => {
    if (phase === 'IDLE' || phase === 'INTENT') {
      setSessionStartTS(Date.now() / 1000);
      setWorkSecs(0); setBreakCount(0);
    }
    setPhase('FLOW');
    startTick('work');
  }, [phase, startTick]);

  const initiateRest = useCallback(() => {
    const rec = Math.max(60, Math.floor(workSecs / 5));
    setTargetRest(rec);
    setRestSecs(0);
    setBreakCount(b => b + 1);
    setPhase('REST');
    startTick('rest');
  }, [workSecs, startTick]);

  const resumeFlow = useCallback(() => { setPhase('FLOW'); startTick('work'); }, [startTick]);

  // ── Terminate & extract ───────────────────────────────────────────────────
  const terminate = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('RATE');
    setSyncing(true);

    let points = 0, type = 'PRACTICE GRIND';
    const details: ProbDetail[] = [];

    try {
      if (sessionStartTS && handle) {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=100`);
        const data = await res.json();
        if (data.status === 'OK') {
          const subs = data.result.filter((s:any) => s.creationTimeSeconds >= sessionStartTS).reverse();
          let mark = sessionStartTS;
          const seen = new Set<string>();
          subs.forEach((s:any) => {
            if (s.verdict === 'OK' && s.problem && s.author.participantType === 'PRACTICE') {
              const pid = `${s.problem.contestId}-${s.problem.index}`;
              if (!seen.has(pid)) {
                seen.add(pid);
                const r = s.problem.rating ? Math.floor(s.problem.rating/100)*100 : 800;
                points += CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;
                details.push({ pid, name: s.problem.name, timeTakenSecs: s.creationTimeSeconds - mark, rating: s.problem.rating || 800 });
                mark = s.creationTimeSeconds;
              }
            }
          });
        }
      }
    } catch {}

    const avg = details.length > 0 ? Math.round(details.reduce((a,p) => a + p.timeTakenSecs, 0) / details.length) : 0;

    const report: SessionLog = {
      id: Date.now().toString(), date: new Date().toISOString(),
      startTs: sessionStartTS || (Date.now()/1000 - workSecs), endTs: Date.now()/1000,
      workMins: parseFloat((workSecs / 60).toFixed(1)),
      problemsSolved: details.length, pointsEarned: points, type,
      avgTimeSecs: avg, details, flowRating: 0,
      intent: intent || undefined,
      plannedMins: parseInt(plannedMins) || undefined,
      breakCount,
    };
    setLastReport(report);
    setSyncing(false);
    setFlowRating(0);
    setWorkSecs(0); setRestSecs(0); setTargetRest(0); setSessionStartTS(null); setBreakCount(0);
    saveHistory([report, ...history]);
  }, [sessionStartTS, handle, workSecs, intent, plannedMins, breakCount, history, saveHistory]);

  const confirmRate = useCallback(() => {
    if (!lastReport) { setPhase('IDLE'); return; }
    const updated = { ...lastReport, flowRating };
    saveHistory([updated, ...history.slice(1)]);
    setLastReport(updated);
    setPhase('IDLE'); setIntent(''); setPlannedMins('');
  }, [lastReport, flowRating, history, saveHistory]);

  const logRogueACs = () => {
    if (rogueACs.length === 0) return;
    const pts = rogueACs.reduce((sum, s) => sum + (CF_SCORE_MAP[s.problem?.rating ? Math.min(2400, Math.floor(s.problem.rating/100)*100) : 800] || 10), 0);
    const details = rogueACs.map(s => ({ pid: `${s.problem.contestId}-${s.problem.index}`, name: s.problem.name, timeTakenSecs: 0, rating: s.problem.rating || 800 }));
    const assumedMins = rogueACs.length * 20;
    const ts = rogueACs[rogueACs.length-1].creationTimeSeconds;
    const report: SessionLog = {
      id: Date.now().toString(), date: new Date(ts*1000).toISOString(), startTs: ts - (assumedMins*60), endTs: ts,
      workMins: assumedMins, problemsSolved: rogueACs.length, pointsEarned: pts, type: 'RETROACTIVE RECON',
      avgTimeSecs: 0, details, flowRating: 3, intent: 'Logged retroactively', breakCount: 0
    };
    saveHistory([report, ...history].sort((a,b) => b.endTs - a.endTs));
    setRogueACs([]);
  };

  // ── Stats Calculations ──────────────────────────────────────────────────────
  const { totalMins, todayMins, streak, weekSecs, peakGrid, weeklyReviews } = useMemo(() => {
    let tMins = 0, tdyMins = 0;
    const dMap: Record<string, number> = {};
    const hSecs = new Array(24).fill(0);

    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const mon = getWeekMonday(now);

    history.forEach(h => {
      tMins += h.workMins;
      const dStr = new Date(h.date).toLocaleDateString();
      if (dStr === todayStr) tdyMins += h.workMins;
      dMap[dStr] = (dMap[dStr] || 0) + h.workMins;
      const hour = new Date(h.startTs * 1000).getHours();
      hSecs[hour] += h.workMins;
    });

    let s = 0; let c = new Date();
    while (true) {
      if (dMap[c.toLocaleDateString()] > 0) s++;
      else if (c.toLocaleDateString() !== todayStr) break;
      c.setDate(c.getDate() - 1);
    }

    let wSecs = 0;
    for(let i=0; i<7; i++) {
      const d = new Date(mon); d.setDate(d.getDate() + i);
      wSecs += (dMap[d.toLocaleDateString()] || 0) * 60;
    }

    const reviews = [];
    for(let w=0; w<4; w++) {
      const wMon = new Date(mon); wMon.setDate(wMon.getDate() - (w * 7));
      const wSun = new Date(wMon); wSun.setDate(wSun.getDate() + 6);
      let wTotal = 0, wAcs = 0, maxD = 0, activeD = 0;
      for(let i=0; i<7; i++) {
        const d = new Date(wMon); d.setDate(d.getDate() + i);
        const dStr = d.toLocaleDateString();
        if (dMap[dStr] > 0) { wTotal += dMap[dStr]; activeD++; if (dMap[dStr] > maxD) maxD = dMap[dStr]; }
      }
      history.filter(h => {
        const d = new Date(h.date); return d >= wMon && d <= wSun;
      }).forEach(h => wAcs += h.problemsSolved);
      reviews.push({ label: w === 0 ? 'This Week' : `${wMon.getDate()}/${wMon.getMonth()+1} - ${wSun.getDate()}/${wSun.getMonth()+1}`, total: wTotal, acs: wAcs, maxD, activeD });
    }

    const maxH = Math.max(1, ...hSecs);
    const pGrid = hSecs.map(sec => sec === 0 ? 0 : Math.ceil((sec / maxH) * 5));

    return { totalMins: tMins, todayMins: tdyMins, streak: s, weekSecs: wSecs, peakGrid: pGrid, weeklyReviews: reviews };
  }, [history]);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: INTENT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'INTENT') return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center font-sans p-8" style={{ background: 'rgba(29, 32, 33, 0.95)' }}>
      <div className="w-full max-w-md space-y-6 p-8 rounded-2xl shadow-2xl" style={{ background: theme.surface, border: `1px solid ${theme.sh}` }}>
        <div className="text-[11px] uppercase tracking-[3px] font-bold" style={{ color: theme.accent }}>// Pre-Flight Briefing</div>
        <h2 className="text-3xl font-black leading-tight tracking-tight" style={{ color: theme.text }}>What is the<br/>target?</h2>
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[2px] font-semibold" style={{ color: theme.muted }}>Session intent</div>
          <input value={intent} onChange={e => setIntent(e.target.value)} onKeyDown={e => { if (e.key==='Enter') startFlow(); if (e.key==='Escape') setPhase('IDLE'); }}
            placeholder="e.g. Clear 3 Div2 D's..." className="w-full text-sm px-4 py-3 rounded outline-none transition-colors"
            style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}`, color: theme.text }} autoFocus />
        </div>
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[2px] font-semibold" style={{ color: theme.muted }}>Approx. duration (mins)</div>
          <input type="number" min="10" max="600" value={plannedMins} onChange={e => setPlannedMins(e.target.value)} placeholder="90"
            className="w-full text-sm px-4 py-3 rounded outline-none transition-colors"
            style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}`, color: theme.text }} />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => setPhase('IDLE')} className="flex-1 py-3 rounded transition-all uppercase tracking-wider text-xs font-bold cursor-pointer" style={{ background: 'transparent', border: `1px solid ${theme.sh}`, color: theme.muted }}>Abort</button>
          <button onClick={startFlow} className="flex-[2] font-black text-sm py-3 rounded transition-all uppercase tracking-widest cursor-pointer" style={{ background: theme.accent, color: theme.bg, boxShadow: `0 4px 15px rgba(250,189,47,0.2)` }}>Engage Protocol</button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: FLOW / REST
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'FLOW' || phase === 'REST') {
    const isFlow = phase === 'FLOW';
    const accent = isFlow ? theme.accent : '#58a6ff';
    const restPct = targetRest > 0 ? Math.min(100, Math.round(restSecs/targetRest*100)) : 0;
    const pinned = tasks.find(t => t.pinned && !t.done);

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col font-sans overflow-hidden select-none" style={{ background: '#050505' }}>
        <div className="flex items-center justify-between px-8 pt-8 text-[11px] font-bold uppercase tracking-[3px]">
          <span style={{ color: accent }}>{isFlow ? '⚡ FLOW STATE ACTIVE' : '⏸ MANDATORY REST'}</span>
          <div className="flex items-center gap-5 text-[#888]">
            {intent && <span className="max-w-xs truncate">↳ {intent}</span>}
            {breakCount > 0 && <span>Breaks: {breakCount}</span>}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="relative w-[340px] h-[340px] flex items-center justify-center">
            <FlowRing phase={phase} targetRest={targetRest} restSecs={restSecs} />
            <div className="z-10 text-center">
              <div className="font-mono font-light tracking-tighter leading-none transition-colors duration-700" style={{ fontSize:'6.5rem', color: accent, textShadow:`0 0 40px ${accent}40` }}>
                {isFlow ? fmt(workSecs) : fmt(restSecs)}
              </div>
              {!isFlow && targetRest > 0 && <div className="text-xs mt-3 font-bold uppercase tracking-[2px]" style={{ color: accent }}>{restPct}% complete</div>}
            </div>
          </div>
        </div>

        {isFlow && pinned && (
          <div className="mx-auto w-full max-w-lg mb-8 flex items-center gap-4 px-5 py-4 rounded-xl border" style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
            <span className="text-[10px] font-bold uppercase tracking-[2px] shrink-0" style={{ color: accent }}>Locked On</span>
            <span className="text-white text-sm font-medium flex-1 truncate">{pinned.text}</span>
            <button onClick={() => saveTasks(tasks.map(t => t.id === pinned.id ? {...t, done: true} : t))} className="text-[10px] font-bold uppercase tracking-[2px] border px-3 py-1.5 rounded transition-all cursor-pointer hover:bg-white/10" style={{ borderColor: accent, color: accent, background: 'transparent' }}>Done ✓</button>
          </div>
        )}

        <div className="flex gap-4 justify-center px-8 pb-12 flex-wrap">
          {isFlow ? (
            <button onClick={initiateRest} className="px-8 py-3 bg-transparent border-2 font-bold uppercase tracking-widest transition-all text-sm rounded cursor-pointer" style={{ borderColor: '#58a6ff', color: '#58a6ff' }}>Initiate Rest</button>
          ) : (
            <button onClick={resumeFlow} className="px-8 py-3 bg-transparent border-2 font-bold uppercase tracking-widest transition-all text-sm rounded cursor-pointer" style={{ borderColor: theme.accent, color: theme.accent }}>Resume Execution</button>
          )}
          <button onClick={terminate} className="px-6 py-3 bg-transparent border text-xs font-bold uppercase tracking-wider transition-all rounded cursor-pointer hover:text-[#f85149] hover:border-[#f85149]" style={{ borderColor: theme.sh, color: theme.muted }}>Extract</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RATE
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'RATE') return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center font-sans p-8" style={{ background: 'rgba(29, 32, 33, 0.95)' }}>
      <div className="w-full max-w-sm text-center space-y-6">
        {syncing ? (
          <div className="text-sm font-bold animate-pulse uppercase tracking-[3px]" style={{ color: theme.accent }}>[ Fetching Telemetry... ]</div>
        ) : (
          <>
            <div className="text-[11px] font-bold uppercase tracking-[4px]" style={{ color: theme.ok }}>// Extraction Complete</div>
            <h2 className="text-4xl font-black" style={{ color: theme.text }}>Rate your flow</h2>
            {lastReport && (
              <div className="grid grid-cols-3 gap-3">
                {[{ l:'Focus', v:`${lastReport.workMins}m`, c:theme.accent }, { l:'ACs', v:String(lastReport.problemsSolved), c:theme.ok }, { l:'XP', v:`+${lastReport.pointsEarned}`, c:'#58a6ff' }].map(s => (
                  <div key={s.l} className="rounded-xl p-4 text-center" style={{ background: theme.surface, border: `1px solid ${theme.sh}` }}>
                    <div className="text-[9px] font-bold uppercase tracking-[2px] mb-1" style={{ color: theme.muted }}>{s.l}</div>
                    <div className="font-black text-2xl font-mono" style={{ color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-center gap-4 py-4">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setFlowRating(n)} className="text-4xl transition-all bg-transparent border-none cursor-pointer hover:scale-125" style={{ filter: n<=flowRating ? `drop-shadow(0 0 10px ${theme.accent})` : 'none', opacity: n<=flowRating ? 1 : 0.2 }}>★</button>
              ))}
            </div>
            <button onClick={confirmRate} className="w-full font-black uppercase tracking-widest py-4 rounded transition-all text-sm cursor-pointer shadow-lg hover:-translate-y-1" style={{ background: theme.ok, color: theme.bg }}>Log Session</button>
          </>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: IDLE (DASHBOARD)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-in fade-in duration-400 space-y-6 max-w-4xl mx-auto pb-20 font-sans" style={{ color: theme.text }}>

      {/* ROGUE AC BANNER */}
      {rogueACs.length > 0 && (
        <div className="rounded-xl p-5 flex items-center justify-between" style={{ background: 'rgba(251,73,52,0.1)', border: `1px solid rgba(251,73,52,0.3)` }}>
          <div>
            <div className="font-bold text-[11px] uppercase tracking-[2px] mb-1 flex items-center gap-2" style={{ color: theme.stop }}><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: theme.stop }} /> Rogue Activity Detected</div>
            <div className="text-sm font-medium">You solved <span className="font-bold" style={{ color: theme.stop }}>{rogueACs.length} problems</span> outside of Grind Mode recently.</div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRogueACs([])} className="text-xs font-bold uppercase transition-colors bg-transparent border-none cursor-pointer" style={{ color: theme.muted }}>Dismiss</button>
            <button onClick={logRogueACs} className="font-bold text-xs uppercase px-4 py-2 rounded transition-colors cursor-pointer" style={{ background: theme.stop, color: theme.text, border: 'none' }}>Log as Session</button>
          </div>
        </div>
      )}

      {/* MAIN FOCUS CARD */}
      <div className="p-8 md:p-10 rounded-2xl relative shadow-2xl flex flex-col items-center text-center" style={{ background: theme.surface, border: `1px solid ${theme.sh}` }}>
        <button onClick={() => setShowSettings(true)} className="absolute top-5 right-5 text-xl transition-transform hover:rotate-45 cursor-pointer bg-transparent border-none" style={{ color: theme.muted }} title="Settings">⚙</button>

        <h2 className="text-[12px] font-bold uppercase tracking-[3px] mb-6" style={{ color: theme.muted }}>Focus Session</h2>

        {tmrPlan.length > 0 && (
          <div className="w-full max-w-sm mb-8 p-4 rounded-xl text-left cursor-pointer transition-colors border-l-4" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}`, borderLeftColor: theme.accent }} onClick={() => setShowTmrModal(true)}>
            <span className="font-bold text-[10px] uppercase tracking-[1.5px] block mb-2" style={{ color: theme.accent }}>📋 Today's Intentions</span>
            <div className="space-y-1.5">
              {tmrPlan.map((t, i) => (
                <div key={t.id} className="text-sm font-medium"><span className="font-mono text-[10px] mr-2" style={{ color: theme.accent }}>{i+1}.</span>{t.text}</div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[6.5rem] font-mono font-light leading-none tracking-tighter mb-8">{fmt(workSecs)}</div>

        <button onClick={() => setPhase('INTENT')} className="px-12 py-4 rounded-lg font-black uppercase tracking-widest text-sm shadow-xl transition-transform hover:-translate-y-1 cursor-pointer" style={{ background: theme.accent, color: theme.bg }}>
          Start Session
        </button>

        {/* Task Section */}
        <div className="w-full mt-10 pt-8 border-t" style={{ borderColor: theme.sh }}>
          <div className="flex gap-2">
            <button onClick={() => setNewPri(p => p==='high'?'normal':'high')} className="w-11 h-11 rounded flex items-center justify-center font-bold text-lg cursor-pointer transition-colors" style={{ background: newPri === 'high' ? 'rgba(251,73,52,0.1)' : 'transparent', border: `1px solid ${newPri === 'high' ? theme.stop : theme.sh}`, color: newPri === 'high' ? theme.stop : theme.muted }}>{newPri==='high'?'!':'–'}</button>
            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key==='Enter' && saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false, pinned: false, priority: newPri }])} placeholder="What are you working on?" className="flex-1 px-4 py-3 rounded text-sm outline-none transition-colors" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}`, color: theme.text }} />
            <input type="number" value={newEst} onChange={e => setNewEst(e.target.value)} placeholder="~min" className="w-20 px-3 py-3 rounded text-sm outline-none transition-colors" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}`, color: theme.text }} />
            <button onClick={() => { if(newTask.trim()) { saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false, pinned: false, priority: newPri, estMins: parseInt(newEst)||undefined }]); setNewTask(''); setNewEst(''); setNewPri('normal'); } }} className="px-6 py-3 rounded font-bold text-sm cursor-pointer" style={{ background: theme.sh, color: theme.text, border: 'none' }}>Add</button>
          </div>

          <div className="mt-4 space-y-2 text-left">
            {tasks.filter(t => !t.done).map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-l-4 transition-colors hover:border-gray-500" style={{ background: 'rgba(0,0,0,0.1)', borderColor: theme.sh, borderLeftColor: t.priority==='high' ? theme.stop : theme.sh }}>
                <input type="checkbox" onChange={() => saveTasks(tasks.map(x => x.id === t.id ? {...x, done: true} : x))} className="w-4 h-4 cursor-pointer accent-[#b8bb26]" />
                <span className="text-sm font-medium flex-1">{t.text}</span>
                {t.estMins && <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: theme.muted }}>~{t.estMins}m</span>}
                <div className="flex gap-2">
                  <button onClick={() => saveTasks(tasks.map(x => ({...x, pinned: x.id === t.id ? !x.pinned : false})))} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: t.pinned ? theme.accent : theme.muted }}>{t.pinned ? '📌' : '📍'}</button>
                  <button onClick={() => saveTasks(tasks.filter(x => x.id !== t.id))} className="text-xs bg-transparent border-none cursor-pointer hover:text-red-500" style={{ color: theme.muted }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-right">
            <button onClick={() => setShowTmrModal(true)} className="text-[11px] font-bold uppercase tracking-[1px] px-4 py-2 border rounded cursor-pointer transition-colors hover:bg-white/5" style={{ borderColor: theme.sh, color: theme.muted, background: 'transparent' }}>📋 Plan Tomorrow</button>
          </div>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: 'Total Focus', v: `${(totalMins/60).toFixed(1)}h` },
          { l: 'Today', v: `${(todayMins/60).toFixed(1)}h`, c: todayMins > 0 ? theme.ok : undefined },
          { l: 'Streak', v: `${streak} days`, c: streak > 2 ? theme.stop : undefined },
          { l: 'Daily Avg', v: `${history.length > 0 ? Math.round(totalMins / new Set(history.map(h=>h.date)).size) : 0}m` }
        ].map(s => (
          <div key={s.l} className="rounded-xl p-6 text-center transition-transform hover:-translate-y-1 border-t-4" style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${theme.sh}`, borderTopColor: theme.sh }}>
            <div className="text-3xl font-black font-mono mb-2" style={{ color: (s as any).c || theme.text }}>{s.v}</div>
            <div className="font-bold text-[10px] uppercase tracking-[2px]" style={{ color: theme.muted }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WEEKLY TARGET */}
        <div className="rounded-xl p-8" style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${theme.sh}` }}>
          <div className="text-[11px] font-bold uppercase tracking-[3px] mb-6 flex items-center justify-between" style={{ color: theme.muted }}>
            Weekly Target
            <span className="font-mono text-xs" style={{ color: theme.text }}>{(weekSecs/3600).toFixed(1)}h / {targetHrs}h</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: theme.sh }}>
            <div className="h-full transition-all duration-1000" style={{ background: theme.accent, width: `${Math.min(100, (weekSecs / (targetHrs * 3600)) * 100)}%` }} />
          </div>
        </div>

        {/* PEAK HOURS */}
        <div className="rounded-xl p-8" style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${theme.sh}` }}>
          <div className="text-[11px] font-bold uppercase tracking-[3px] mb-6" style={{ color: theme.muted }}>Peak Execution Hours</div>
          <div className="grid grid-cols-24 gap-1 h-14 items-end">
            {peakGrid.map((level, i) => (
              <div key={i} className="w-full rounded-sm transition-all" title={`${i}:00`}
                style={{ height: level === 0 ? '4px' : `${level * 20}%`, background: level === 0 ? '#111' : theme.accent, opacity: level === 0 ? 1 : 0.3 + (level * 0.14) }} />
            ))}
          </div>
          <div className="grid grid-cols-24 gap-1 mt-2">
            {peakGrid.map((_, i) => (
              <div key={i} className="text-[9px] font-mono text-center" style={{ color: theme.muted }}>{i%4===0 ? i : ''}</div>
            ))}
          </div>
        </div>
      </div>

      {/* WEEKLY REVIEWS */}
      <div className="rounded-xl p-8" style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${theme.sh}` }}>
        <div className="flex gap-2 mb-6">
          {weeklyReviews.map((w, i) => (
            <button key={i} onClick={() => setWrActiveTab(i)} className="text-[11px] font-bold uppercase tracking-[1px] px-3 py-2 rounded cursor-pointer transition-colors border-none" style={{ background: wrActiveTab === i ? theme.accent : 'transparent', color: wrActiveTab === i ? theme.bg : theme.muted }}>
              {w.label}
            </button>
          ))}
        </div>
        {weeklyReviews[wrActiveTab] && (() => {
          const w = weeklyReviews[wrActiveTab];
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l: 'Focus Time', v: `${(w.total/60).toFixed(1)}h` },
                { l: 'Problems AC', v: String(w.acs) },
                { l: 'Active Days', v: `${w.activeD}/7` },
                { l: 'Peak Day', v: `${(w.maxD/60).toFixed(1)}h` },
              ].map(s => (
                <div key={s.l} className="rounded-lg p-4 text-center" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}` }}>
                  <div className="text-2xl font-black font-mono" style={{ color: theme.accent }}>{s.v}</div>
                  <div className="text-[10px] uppercase tracking-[1px] mt-1" style={{ color: theme.muted }}>{s.l}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* TOMORROW PLAN MODAL */}
      {showTmrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl border" style={{ background: theme.surface, borderColor: theme.sh }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold" style={{ color: theme.text }}>📋 Tomorrow's Battle Plan</h3>
              <button onClick={() => setShowTmrModal(false)} className="text-2xl cursor-pointer hover:text-red-400 transition-colors bg-transparent border-none" style={{ color: theme.muted }}>×</button>
            </div>
            <p className="text-sm mb-6" style={{ color: theme.muted }}>They'll appear as pinned intentions when you start your next session.</p>
            <div className="space-y-3 mb-6">
              {tmrPlan.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded border" style={{ background: 'rgba(0,0,0,0.2)', borderColor: theme.sh }}>
                  <span className="font-mono text-xs font-bold" style={{ color: theme.accent }}>{i+1}</span>
                  <span className="flex-1 text-sm">{t.text}</span>
                  <button onClick={() => saveTmrPlan(tmrPlan.filter(x => x.id !== t.id))} className="text-red-400 bg-transparent border-none cursor-pointer">✕</button>
                </div>
              ))}
            </div>
            {tmrPlan.length < 3 && (
              <div className="flex gap-2">
                <input value={newTmr} onChange={e => setNewTmr(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && newTmr.trim()) { saveTmrPlan([...tmrPlan, {id: Date.now(), text: newTmr.trim()}]); setNewTmr(''); } }} placeholder="Add a priority..." className="flex-1 px-4 py-3 rounded text-sm outline-none" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}`, color: theme.text }} autoFocus />
                <button onClick={() => { if(newTmr.trim()) { saveTmrPlan([...tmrPlan, {id: Date.now(), text: newTmr.trim()}]); setNewTmr(''); } }} className="px-6 py-3 rounded font-bold text-sm cursor-pointer" style={{ background: theme.sh, color: theme.text, border: 'none' }}>Add</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SETTINGS & LEDGER MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border" style={{ background: theme.surface, borderColor: theme.sh }}>
            <div className="p-8 border-b flex justify-between items-center" style={{ borderColor: theme.sh }}>
              <h3 className="text-xl font-bold" style={{ color: theme.text }}>⚙ Configuration & Data</h3>
              <button onClick={() => setShowSettings(false)} className="text-3xl cursor-pointer hover:text-red-400 transition-colors bg-transparent border-none" style={{ color: theme.muted }}>×</button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-10">
              {/* Weekly Target Setting */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[2px] mb-4" style={{ color: theme.muted }}>Weekly Target</h4>
                <div className="flex items-center gap-4">
                  <input type="number" value={targetHrs} onChange={e => { setTargetHrs(Number(e.target.value)); localStorage.setItem(STORAGE_KEYS.GRIND_TARGET_HRS, e.target.value); }} className="w-32 px-4 py-3 rounded text-sm outline-none font-mono" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${theme.sh}`, color: theme.text }} />
                  <span className="text-sm" style={{ color: theme.muted }}>Hours per week</span>
                </div>
              </div>

              {/* Session Ledger */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[2px] mb-4" style={{ color: theme.muted }}>Session Ledger (Raw Data)</h4>
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: theme.sh }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <tr>
                        <th className="p-4 font-normal" style={{ color: theme.muted }}>Date</th>
                        <th className="p-4 font-normal" style={{ color: theme.muted }}>Intent</th>
                        <th className="p-4 font-normal w-24 text-center" style={{ color: theme.muted }}>Mins</th>
                        <th className="p-4 font-normal w-24 text-center" style={{ color: theme.muted }}>Rating</th>
                        <th className="p-4 font-normal w-20 text-center" style={{ color: theme.muted }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center italic" style={{ color: theme.muted }}>No sessions recorded.</td></tr>
                      ) : history.map(h => (
                        <tr key={h.id} className="border-t transition-colors hover:bg-white/5" style={{ borderColor: theme.sh }}>
                          <td className="p-4 font-mono text-xs">{new Date(h.startTs * 1000).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</td>
                          <td className="p-4 truncate max-w-[200px]">{h.intent || '—'}</td>
                          <td className="p-4 text-center">
                            <input type="number" value={h.workMins} onChange={e => {
                              const v = Number(e.target.value);
                              setHistory(prev => { const next = prev.map(x => x.id === h.id ? {...x, workMins: v} : x); localStorage.setItem(STORAGE_KEYS.GRIND_SESSIONS, JSON.stringify(next)); return next; });
                            }} className="w-16 px-2 py-1 rounded outline-none font-mono text-center bg-black/40 border-none" style={{ color: theme.text }} />
                          </td>
                          <td className="p-4 text-center">
                            <input type="number" min="0" max="5" value={h.flowRating || 0} onChange={e => {
                              const v = Number(e.target.value);
                              setHistory(prev => { const next = prev.map(x => x.id === h.id ? {...x, flowRating: v} : x); localStorage.setItem(STORAGE_KEYS.GRIND_SESSIONS, JSON.stringify(next)); return next; });
                            }} className="w-12 px-2 py-1 rounded outline-none font-mono text-center bg-black/40 border-none" style={{ color: theme.text }} />
                          </td>
                          <td className="p-4 text-center">
                            <button onClick={() => { const next = history.filter(x => x.id !== h.id); saveHistory(next); }} className="text-xs font-bold uppercase cursor-pointer bg-transparent border-none hover:text-red-400 transition-colors" style={{ color: theme.muted }}>Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
