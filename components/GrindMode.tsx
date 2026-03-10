"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { CF_SCORE_MAP } from "@/lib/constants";

// ── Types ────────────────────────────────────────────────────────────────────
interface ProbDetail { pid: string; name: string; timeTakenSecs: number; rating: number; }
interface SessionLog {
  id: string; date: string; workMins: number; problemsSolved: number;
  pointsEarned: number; type: string; avgTimeSecs: number;
  details: ProbDetail[]; flowRating?: number; intent?: string;
  plannedMins?: number; breakCount: number;
}
interface GrindTask { id: number; text: string; done: boolean; pinned: boolean; priority: 'high' | 'normal'; }
type Phase = 'IDLE' | 'INTENT' | 'FLOW' | 'REST' | 'RATE';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
  return `${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
}
function fmtMins(s: number) { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// ── Animated flow ring ───────────────────────────────────────────────────────
function FlowRing({ phase, targetRest, restSecs }: { phase: Phase; targetRest: number; restSecs: number }) {
  const r = 118, c = 2 * Math.PI * r;
  const pct = phase === 'REST' && targetRest > 0 ? Math.min(restSecs / targetRest, 1) : 0;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 280 280">
      {phase === 'FLOW' && (
        <circle cx="140" cy="140" r={r} fill="none" stroke="#f85149" strokeWidth="1"
          strokeDasharray="3 14" strokeLinecap="round"
          style={{ transformOrigin:'center', animation:'grindRingSpin 45s linear infinite', opacity: 0.4 }} />
      )}
      {phase === 'REST' && (
        <>
          <circle cx="140" cy="140" r={r} fill="none" stroke="#111" strokeWidth="2.5" />
          <circle cx="140" cy="140" r={r} fill="none" stroke="#58a6ff" strokeWidth="2.5"
            strokeLinecap="round"
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
  const [showEditRest, setShowEditRest] = useState(false);
  const [editRestVal, setEditRestVal] = useState('');

  const [intent, setIntent] = useState('');
  const [plannedMins, setPlannedMins] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  const [flowRating, setFlowRating] = useState(0);
  const [breakCount, setBreakCount] = useState(0);

  const [tasks, setTasks] = useState<GrindTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newPri, setNewPri] = useState<'normal'|'high'>('normal');
  const [editingTask, setEditingTask] = useState<GrindTask|null>(null);
  const [editText, setEditText] = useState('');
  const [showTaskPanel, setShowTaskPanel] = useState(true);

  const [sessionStartTS, setSessionStartTS] = useState<number|null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SessionLog|null>(null);
  const [history, setHistory] = useState<SessionLog[]>([]);
  const [weekData, setWeekData] = useState<Record<string,number>>({});
  const [showHistory, setShowHistory] = useState(false);

  const timerRef = useRef<NodeJS.Timeout|null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    try { const h = localStorage.getItem('cf_grind_v3'); if (h) setHistory(JSON.parse(h)); } catch {}
    try { const t = localStorage.getItem('cf_grind_tasks'); if (t) setTasks(JSON.parse(t)); } catch {}
    try { const w = localStorage.getItem('cf_grind_week'); if (w) setWeekData(JSON.parse(w)); } catch {}
    const t = setTimeout(() => setShowPrompt(true), 1800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'grind-ring-css';
    style.textContent = `@keyframes grindRingSpin { 100% { transform: rotate(360deg); } }`;
    if (!document.getElementById('grind-ring-css')) document.head.appendChild(style);
  }, []);

  const saveTasks = useCallback((t: GrindTask[]) => {
    setTasks(t);
    try { localStorage.setItem('cf_grind_tasks', JSON.stringify(t)); } catch {}
  }, []);

  const saveHistory = useCallback((h: SessionLog[]) => {
    setHistory(h);
    try { localStorage.setItem('cf_grind_v3', JSON.stringify(h)); } catch {}
  }, []);

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
    setEditRestVal(String(Math.round(rec / 60)));
    setRestSecs(0);
    setBreakCount(b => b + 1);
    setPhase('REST');
    startTick('rest');
  }, [workSecs, startTick]);

  const resumeFlow = useCallback(() => {
    setPhase('FLOW');
    startTick('work');
  }, [startTick]);

  const applyRestEdit = useCallback(() => {
    const m = parseInt(editRestVal);
    if (!isNaN(m) && m > 0) setTargetRest(m * 60);
    setShowEditRest(false);
  }, [editRestVal]);

  // ── Terminate & extract ───────────────────────────────────────────────────
  const terminate = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('RATE');
    setSyncing(true);

    let points = 0, type = 'GRIND / PRACTICE';
    const details: ProbDetail[] = [];

    try {
      if (sessionStartTS && handle) {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=100`);
        const data = await res.json();
        if (data.status === 'OK') {
          const subs = data.result.filter((s:any) => s.creationTimeSeconds >= sessionStartTS).reverse();
          if (subs.some((s:any) => s.author.participantType === 'CONTESTANT')) type = 'LIVE OPS (RATED)';
          else if (subs.some((s:any) => s.author.participantType === 'VIRTUAL')) type = 'SIMULATION (VIRTUAL)';
          let mark = sessionStartTS;
          const seen = new Set<string>();
          subs.forEach((s:any) => {
            if (s.verdict === 'OK' && s.problem) {
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
    const today = todayKey();
    const newWd = { ...weekData, [today]: (weekData[today] || 0) + workSecs };
    try { localStorage.setItem('cf_grind_week', JSON.stringify(newWd)); } catch {}
    setWeekData(newWd);

    const report: SessionLog = {
      id: Date.now().toString(), date: new Date().toISOString(),
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
    // Save placeholder (rating applied on confirm)
    saveHistory([report, ...history]);
  }, [sessionStartTS, handle, workSecs, intent, plannedMins, breakCount, weekData, history, saveHistory]);

  const confirmRate = useCallback(() => {
    if (!lastReport) { setPhase('IDLE'); return; }
    const updated = { ...lastReport, flowRating };
    saveHistory([updated, ...history.slice(1)]);
    setLastReport(updated);
    setPhase('IDLE');
    setIntent(''); setPlannedMins('');
    setTimeout(() => setShowPrompt(true), 2500);
  }, [lastReport, flowRating, history, saveHistory]);

  // ── Task ops ───────────────────────────────────────────────────────────────
  const addTask = () => {
    if (!newTask.trim()) return;
    saveTasks([{ id: Date.now(), text: newTask.trim(), done: false, pinned: false, priority: newPri }, ...tasks]);
    setNewTask(''); setNewPri('normal');
  };
  const toggleTask = (id: number) => saveTasks(tasks.map(t => t.id===id ? {...t, done:!t.done} : t));
  const pinTask = (id: number) => saveTasks(tasks.map(t => ({...t, pinned: t.id===id ? !t.pinned : false})));
  const deleteTask = (id: number) => saveTasks(tasks.filter(t => t.id!==id));
  const saveEdit = () => {
    if (!editingTask) return;
    if (editText.trim()) saveTasks(tasks.map(t => t.id===editingTask.id ? {...t, text:editText.trim()} : t));
    setEditingTask(null);
  };

  const pinned  = tasks.find(t => t.pinned && !t.done);
  const pending = tasks.filter(t => !t.done && !t.pinned);
  const done    = tasks.filter(t => t.done);

  // ── Weekly bars ────────────────────────────────────────────────────────────
  const weekBars = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const sec = weekData[key] || 0;
    return { key, sec, pct: Math.min(100, sec/(8*3600)*100), isToday: key===todayKey(), day: d.toLocaleDateString('en-GB',{weekday:'short'}) };
  });

  const totalMins = history.reduce((a,h) => a+h.workMins, 0);
  const totalACs  = history.reduce((a,h) => a+h.problemsSolved, 0);
  const totalXP   = history.reduce((a,h) => a+h.pointsEarned, 0);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: INTENT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'INTENT') return (
    <div className="fixed inset-0 bg-[#050505] z-[9999] flex items-center justify-center font-mono p-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-[#f85149] text-[9px] uppercase tracking-[4px]">// Pre-session briefing</div>
        <h2 className="text-white text-3xl font-black leading-tight">What's the<br/>mission?</h2>
        <div className="space-y-1">
          <div className="text-[#333] text-[9px] uppercase tracking-[2px] mb-1.5">Session intent</div>
          <input
            value={intent} onChange={e => setIntent(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') startFlow(); if (e.key==='Escape') setPhase('IDLE'); }}
            placeholder="e.g. Crack 3 Div2 D's, finish segment tree problems…"
            className="w-full bg-transparent border border-[#1a1a1a] focus:border-[#f85149] text-white font-mono text-sm px-4 py-3 rounded-[4px] outline-none transition-colors placeholder:text-[#222]"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <div className="text-[#333] text-[9px] uppercase tracking-[2px] mb-1.5">Approx. time you'll grind</div>
          <div className="flex items-center gap-3">
            <input type="number" min="10" max="600" value={plannedMins} onChange={e => setPlannedMins(e.target.value)}
              placeholder="90"
              className="w-24 bg-transparent border border-[#1a1a1a] focus:border-[#e3b341] text-white font-mono text-sm px-3 py-2.5 rounded-[4px] outline-none transition-colors text-center" />
            <span className="text-[#333] text-xs font-mono uppercase tracking-[1px]">minutes</span>
            {plannedMins && <span className="text-[#444] text-xs font-mono">(≈ {fmtMins(parseInt(plannedMins)*60)})</span>}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={() => setPhase('IDLE')}
            className="flex-1 bg-transparent border border-[#1a1a1a] text-[#444] font-mono text-xs py-3 rounded-[4px] hover:border-[#333] hover:text-[#666] transition-all uppercase tracking-wider">
            ← Back
          </button>
          <button onClick={startFlow}
            className="flex-[2] bg-[#f85149] text-black font-black text-sm py-3 rounded-[4px] hover:bg-[#ff6a64] transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(248,81,73,0.25)]">
            {intent ? 'Engage Protocol →' : 'Skip & Engage →'}
          </button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: FLOW / REST
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'FLOW' || phase === 'REST') {
    const isFlow = phase === 'FLOW';
    const accent = isFlow ? '#f85149' : '#58a6ff';
    const restPct = targetRest > 0 ? Math.min(100, Math.round(restSecs/targetRest*100)) : 0;

    return (
      <div className="fixed inset-0 bg-[#050505] z-[9999] flex flex-col font-mono overflow-hidden select-none">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 pt-6 text-[9px] uppercase tracking-[4px]">
          <span style={{ color: accent }}>
            {isFlow ? '[ Flow State Active ]' : '[ Mandatory Rest Phase ]'}
          </span>
          <div className="flex items-center gap-5 text-[#222]">
            {intent && <span className="max-w-xs truncate normal-case text-[#2a2a2a]">↳ {intent}</span>}
            {breakCount > 0 && <span>Breaks: {breakCount}</span>}
          </div>
        </div>

        {/* Timer */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="relative w-[280px] h-[280px] flex items-center justify-center">
            <FlowRing phase={phase} targetRest={targetRest} restSecs={restSecs} />
            <div className="z-10 text-center">
              <div className="font-black tracking-tighter leading-none transition-colors duration-700"
                style={{ fontSize:'clamp(4rem,11vw,7rem)', color: accent, textShadow:`0 0 60px ${accent}30` }}>
                {isFlow ? fmt(workSecs) : fmt(restSecs)}
              </div>
              {!isFlow && targetRest > 0 && (
                <div className="text-[10px] mt-2 uppercase tracking-[2px]" style={{ color: accent }}>
                  {restPct}% complete
                </div>
              )}
            </div>
          </div>

          <div className="text-[#222] text-[9px] uppercase tracking-[3px]">
            {isFlow ? 'Nescafé-fueled execution' : `Rest target: ${fmtMins(targetRest)}`}
          </div>

          {/* Edit rest */}
          {!isFlow && (
            <div className="flex items-center gap-2 mt-1">
              {showEditRest ? (
                <>
                  <input type="number" value={editRestVal} min="1" onChange={e => setEditRestVal(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') applyRestEdit(); if(e.key==='Escape') setShowEditRest(false); }}
                    className="w-14 bg-transparent border border-[#222] focus:border-[#58a6ff] text-white text-sm px-2 py-1 rounded-[4px] outline-none text-center font-mono" autoFocus />
                  <span className="text-[#333] text-xs">min</span>
                  <button onClick={applyRestEdit} className="text-xs text-[#56d364] border border-[#56d364]/30 px-2 py-1 rounded-[4px] hover:bg-[#56d364]/10 transition-all bg-transparent cursor-pointer">✓</button>
                  <button onClick={() => setShowEditRest(false)} className="text-xs text-[#333] bg-transparent border-none cursor-pointer">✕</button>
                </>
              ) : (
                <button onClick={() => setShowEditRest(true)} className="text-[8px] uppercase tracking-[2px] text-[#222] hover:text-[#555] transition-colors bg-transparent border-none cursor-pointer">
                  ✎ Edit rest duration
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pinned task */}
        {isFlow && pinned && (
          <div className="mx-8 mb-3 flex items-center gap-3 px-4 py-2.5 rounded-[4px]"
            style={{ border:'1px solid rgba(248,81,73,0.2)', background:'rgba(248,81,73,0.03)' }}>
            <span className="text-[#f85149] text-[8px] uppercase tracking-[2px] shrink-0">Locked On</span>
            <span className="text-[#c9d1d9] text-sm flex-1 truncate">{pinned.text}</span>
            <button onClick={() => toggleTask(pinned.id)}
              className="text-[8px] text-[#56d364] uppercase tracking-[2px] border border-[#56d364]/30 px-2 py-1 rounded-[4px] hover:bg-[#56d364]/10 transition-all bg-transparent cursor-pointer">
              Done ✓
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-4 justify-center px-8 pb-8 flex-wrap">
          {isFlow ? (
            <>
              <button onClick={initiateRest}
                className="px-8 py-3 bg-transparent border-2 border-[#58a6ff] text-[#58a6ff] font-bold uppercase tracking-widest hover:bg-[#58a6ff] hover:text-black transition-all text-sm rounded-[4px]">
                Initiate Rest
              </button>
              <button onClick={() => setShowTaskPanel(s => !s)}
                className="px-5 py-3 bg-transparent border border-[#1a1a1a] text-[#333] font-mono text-xs uppercase tracking-wider hover:border-[#333] hover:text-[#666] transition-all rounded-[4px]">
                Tasks {pending.length + (pinned ? 1 : 0) > 0 ? `(${pending.length + (pinned ? 1 : 0)})` : ''}
              </button>
            </>
          ) : (
            <button onClick={resumeFlow}
              className="px-8 py-3 bg-transparent border-2 border-[#f85149] text-[#f85149] font-bold uppercase tracking-widest hover:bg-[#f85149] hover:text-black transition-all text-sm rounded-[4px]">
              Resume Execution
            </button>
          )}
          <button onClick={terminate}
            className="px-5 py-3 bg-transparent border border-[#1a1a1a] text-[#333] font-mono text-xs uppercase tracking-wider hover:border-[#f85149] hover:text-[#f85149] transition-all rounded-[4px]">
            Terminate &amp; Extract
          </button>
        </div>

        {/* Floating task panel */}
        {isFlow && showTaskPanel && (
          <div className="absolute top-16 right-5 w-68 max-w-[280px] bg-[#0a0a0a] border border-[#151515] rounded-[6px] p-4 max-h-[55vh] overflow-y-auto shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#333] text-[8px] uppercase tracking-[3px]">Task Queue</span>
              <button onClick={() => setShowTaskPanel(false)} className="text-[#222] text-xs hover:text-[#444] bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="flex gap-1.5 mb-3">
              <button onClick={() => setNewPri(p => p==='high'?'normal':'high')}
                className={`w-7 h-7 rounded-[4px] border font-mono text-xs font-black transition-all bg-transparent cursor-pointer shrink-0 ${newPri==='high' ? 'border-[#f85149] text-[#f85149]' : 'border-[#1a1a1a] text-[#222]'}`}>!</button>
              <input value={newTask} onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key==='Enter' && addTask()} placeholder="New task…"
                className="flex-1 bg-transparent border border-[#1a1a1a] focus:border-[#333] text-white text-xs px-2 py-1.5 rounded-[4px] outline-none font-mono placeholder:text-[#1a1a1a]" />
              <button onClick={addTask} className="w-7 h-7 bg-[#f85149] text-black text-xs font-black rounded-[4px] hover:bg-[#ff6a64] transition-all cursor-pointer shrink-0">+</button>
            </div>
            <div className="space-y-1">
              {pinned && (
                <div className="flex items-center gap-1.5 pl-2 py-1.5 rounded-[4px] border-l-2 border-[#f85149] bg-[rgba(248,81,73,0.04)]">
                  <input type="checkbox" onChange={() => toggleTask(pinned.id)} className="w-3 h-3 accent-[#56d364] cursor-pointer shrink-0" />
                  <span className="text-white text-xs flex-1 truncate">{pinned.text}</span>
                  <button onClick={() => pinTask(pinned.id)} className="text-[8px] text-[#e3b341] bg-transparent border-none cursor-pointer shrink-0">📌</button>
                </div>
              )}
              {pending.map(t => (
                <div key={t.id} className="flex items-center gap-1.5 pl-2 py-1.5 rounded-[4px] group hover:bg-[#111] transition-colors">
                  <input type="checkbox" onChange={() => toggleTask(t.id)} className="w-3 h-3 accent-[#56d364] cursor-pointer shrink-0" />
                  <span className={`text-xs flex-1 truncate ${t.priority==='high'?'text-[#f85149]':'text-[#555]'}`}>{t.text}</span>
                  <div className="hidden group-hover:flex gap-1 shrink-0">
                    <button onClick={() => pinTask(t.id)} className="text-[8px] text-[#333] hover:text-[#e3b341] bg-transparent border-none cursor-pointer">📌</button>
                    <button onClick={() => deleteTask(t.id)} className="text-[8px] text-[#333] hover:text-[#f85149] bg-transparent border-none cursor-pointer">✕</button>
                  </div>
                </div>
              ))}
              {done.length > 0 && (
                <div className="pt-1.5 mt-1 border-t border-[#111] text-[7px] uppercase tracking-[2px] text-[#1a1a1a]">
                  {done.length} done
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit task modal during flow */}
        {editingTask && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
            <div className="bg-[#0d0d0d] border border-[#222] rounded-[6px] p-5 w-72 space-y-3">
              <div className="text-[#58a6ff] text-[9px] uppercase tracking-[3px]">Edit Task</div>
              <input value={editText} onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') saveEdit(); if(e.key==='Escape') setEditingTask(null); }}
                className="w-full bg-transparent border border-[#222] focus:border-[#58a6ff] text-white font-mono text-sm px-3 py-2 rounded-[4px] outline-none" autoFocus />
              <div className="flex gap-2">
                <button onClick={() => setEditingTask(null)} className="flex-1 bg-transparent border border-[#222] text-[#444] text-xs py-2 rounded-[4px] cursor-pointer">Cancel</button>
                <button onClick={saveEdit} className="flex-[2] bg-[#58a6ff] text-black text-xs font-bold py-2 rounded-[4px] cursor-pointer hover:bg-[#7ab8ff] transition-all">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RATE
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'RATE') return (
    <div className="fixed inset-0 bg-[#050505] z-[9999] flex items-center justify-center font-mono p-8">
      <div className="w-full max-w-sm text-center space-y-5">
        {syncing ? (
          <div className="text-[#e3b341] text-sm animate-pulse uppercase tracking-[3px]">[ Fetching and parsing telemetry… ]</div>
        ) : (
          <>
            <div className="text-[#56d364] text-[9px] uppercase tracking-[4px]">// Operation complete</div>
            <h2 className="text-white text-2xl font-black">Rate your flow</h2>
            {lastReport && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l:'Focus Time', v:`${lastReport.workMins}m`, c:'#e3b341' },
                  { l:'ACs', v:String(lastReport.problemsSolved), c:'#56d364' },
                  { l:'XP', v:`+${lastReport.pointsEarned}`, c:'#56d364' },
                ].map(s => (
                  <div key={s.l} className="bg-[#0a0a0a] border border-[#111] rounded-[4px] p-3">
                    <div className="text-[#333] text-[7px] uppercase tracking-[2px] mb-1">{s.l}</div>
                    <div className="font-black text-lg" style={{color:s.c}}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}
            {lastReport?.intent && (
              <div className="text-left text-[#2a2a2a] text-xs border-l-2 border-[#111] pl-3 italic">
                "{lastReport.intent}"
                {lastReport.plannedMins && (
                  <span className="ml-2 not-italic text-[#222]">· planned {lastReport.plannedMins}m, actual {lastReport.workMins}m</span>
                )}
              </div>
            )}
            {lastReport?.breakCount > 0 && (
              <div className="text-[#222] text-[9px] uppercase tracking-[2px]">{lastReport.breakCount} break{lastReport.breakCount>1?'s':''} taken</div>
            )}
            {/* Stars */}
            <div className="flex justify-center gap-4 py-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setFlowRating(n)}
                  className="text-4xl transition-all bg-transparent border-none cursor-pointer hover:scale-110"
                  style={{ filter: n<=flowRating ? 'drop-shadow(0 0 8px #e3b341)' : 'none', opacity: n<=flowRating ? 1 : 0.15 }}>
                  ★
                </button>
              ))}
            </div>
            <div className="text-[#333] text-[9px] uppercase tracking-[2px]">
              {['Skip rating','Rough session','Below average','Decent grind','Good flow','Peak performance'][flowRating]}
            </div>
            <button onClick={confirmRate}
              className="w-full bg-[#56d364] text-black font-black uppercase tracking-widest py-4 rounded-[4px] hover:bg-[#6ee87a] transition-all text-sm">
              Log Session &amp; Exit
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: IDLE
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-in fade-in duration-400 space-y-5">

      {/* Engage prompt */}
      {showPrompt && (
        <div className="relative overflow-hidden rounded-[4px] p-5 flex items-center justify-between gap-4"
          style={{ background:'#050505', border:'1px solid rgba(248,81,73,0.25)', boxShadow:'0 0 30px rgba(248,81,73,0.06)' }}>
          <div className="absolute top-0 left-0 right-0 h-[1px]"
            style={{ background:'linear-gradient(90deg, transparent, #f85149, transparent)' }} />
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#f85149] flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f85149] animate-pulse shadow-[0_0_6px_#f85149] inline-block" />
              Standby — no active engagement detected
            </div>
            <p className="font-mono text-[11px] text-[#333]">Would you like to initialize Grind Mode?</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowPrompt(false)}
              className="bg-transparent border border-[#111] text-[#333] font-mono text-xs px-3 py-2 rounded-[4px] hover:border-[#222] hover:text-[#555] transition-all cursor-pointer uppercase tracking-wider">
              Later
            </button>
            <button onClick={() => { setShowPrompt(false); setPhase('INTENT'); }}
              className="bg-[#f85149] text-black font-black text-xs px-4 py-2 rounded-[4px] hover:bg-[#ff6a64] transition-all cursor-pointer uppercase tracking-widest shadow-[0_0_12px_rgba(248,81,73,0.25)]">
              Engage →
            </button>
          </div>
        </div>
      )}

      {/* Launch card */}
      <div className="bg-[#050505] border-l-[4px] border-l-[#f85149] border border-[#f85149]/20 rounded-[4px] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-[0_0_30px_rgba(248,81,73,0.07)]">
        <div>
          <h2 className="text-[#f85149] font-mono text-xl font-black uppercase tracking-widest mb-1">Grind Mode</h2>
          <p className="text-[#2a2a2a] font-mono text-[10px] uppercase tracking-[1px]">Flowmodoro · Session intent · Editable breaks · Auto-context · Per-problem speed</p>
          {lastReport && (
            <div className="mt-2 font-mono text-[9px] text-[#2a2a2a] flex items-center gap-3">
              <span>Last: {new Date(lastReport.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
              <span>·</span><span>{lastReport.workMins}m</span>
              <span>·</span><span>{lastReport.problemsSolved} ACs</span>
              <span>·</span><span>+{lastReport.pointsEarned} XP</span>
              {lastReport.flowRating ? <><span>·</span><span className="text-[#e3b341]">{'★'.repeat(lastReport.flowRating)}</span></> : null}
            </div>
          )}
        </div>
        <button onClick={() => setPhase('INTENT')}
          className="bg-[#f85149] text-black font-black uppercase tracking-widest px-8 py-4 rounded-[4px] text-sm hover:bg-[#ff6a64] transition-all shadow-[0_0_20px_rgba(248,81,73,0.3)] shrink-0 cursor-pointer">
          Engage Protocol
        </button>
      </div>

      {/* Last report */}
      {lastReport && !syncing && (
        <div className="bg-[#050505] border border-[#58a6ff]/20 border-t-[2px] border-t-[#58a6ff] rounded-[4px] p-5">
          <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#58a6ff] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] inline-block" />
            Last Operation — {lastReport.type}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
            {[
              { l:'Focus', v:`${lastReport.workMins}m`, c:'#e3b341' },
              { l:'Avg Solve', v:fmt(lastReport.avgTimeSecs), c:'#d2a8ff' },
              { l:'ACs', v:String(lastReport.problemsSolved), c:'#56d364' },
              { l:'XP', v:`+${lastReport.pointsEarned}`, c:'#56d364' },
              { l:'Breaks', v:String(lastReport.breakCount||0), c:'#58a6ff' },
            ].map(s => (
              <div key={s.l} className="bg-black/20 border border-[#0f0f0f] rounded-[4px] p-3">
                <div className="font-mono text-[8px] uppercase tracking-[2px] text-[#333] mb-1">{s.l}</div>
                <div className="font-mono text-xl font-black" style={{color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>
          {lastReport.intent && (
            <div className="font-mono text-[9px] text-[#2a2a2a] border-l-2 border-[#111] pl-3 mb-4 italic">
              Mission: "{lastReport.intent}"
              {lastReport.plannedMins && (
                <span className="ml-2 not-italic text-[#1a1a1a]">— Planned {lastReport.plannedMins}m · Actual {lastReport.workMins}m</span>
              )}
            </div>
          )}
          {lastReport.details.length > 0 && (
            <div className="space-y-1.5 mt-2">
              <div className="font-mono text-[8px] uppercase tracking-[2px] text-[#333] mb-2">Kill Feed</div>
              {lastReport.details.map((d,i) => (
                <div key={i} className="flex justify-between items-center font-mono text-sm border-b border-[#0a0a0a] pb-1.5">
                  <span className="text-[#c9d1d9]">{d.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#333] text-xs">{d.rating}</span>
                    <span className="text-[#e3b341]">{fmt(d.timeTakenSecs)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {lastReport.flowRating ? (
            <div className="mt-3 font-mono text-[9px] text-[#333] flex items-center gap-2">
              Flow: <span className="text-[#e3b341]">{'★'.repeat(lastReport.flowRating)}{'☆'.repeat(5-lastReport.flowRating)}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Task queue */}
      <div className="bg-[#050505] border border-[#111] rounded-[4px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#333]">Task Queue</div>
          <span className="font-mono text-[8px] text-[#1a1a1a]">
            {pending.length + (pinned?1:0)} pending · {done.length} done
          </span>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setNewPri(p => p==='high'?'normal':'high')}
            className={`w-8 h-8 rounded-[4px] border font-mono text-sm font-black transition-all bg-transparent cursor-pointer shrink-0 ${newPri==='high' ? 'border-[#f85149] text-[#f85149]' : 'border-[#111] text-[#222]'}`}>!</button>
          <input value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addTask()}
            placeholder="Add task to queue… (Enter)"
            className="flex-1 bg-transparent border border-[#111] focus:border-[#333] text-white font-mono text-sm px-3 py-2 rounded-[4px] outline-none placeholder:text-[#111] transition-colors" />
          <button onClick={addTask} className="px-4 bg-[#111] hover:bg-[#1a1a1a] text-[#444] hover:text-white font-mono text-sm rounded-[4px] transition-all border border-[#1a1a1a] cursor-pointer">Add</button>
        </div>

        {tasks.length === 0 ? (
          <div className="text-[#111] font-mono text-[10px] text-center py-5 border border-dashed border-[#0f0f0f] rounded-[4px]">
            // Queue empty — load tasks before engaging
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {pinned && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-[rgba(248,81,73,0.03)] border border-[#f85149]/10 group">
                <input type="checkbox" onChange={() => toggleTask(pinned.id)} className="w-3.5 h-3.5 accent-[#56d364] cursor-pointer shrink-0" />
                <span className="text-[9px] text-[#f85149] font-mono shrink-0">📌</span>
                {editingTask?.id===pinned.id ? (
                  <input value={editText} onChange={e=>setEditText(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter')saveEdit(); if(e.key==='Escape')setEditingTask(null); }}
                    className="flex-1 bg-transparent border-b border-[#58a6ff] text-white text-sm outline-none font-mono" autoFocus />
                ) : (
                  <span className="text-white font-mono text-sm flex-1 truncate">{pinned.text}</span>
                )}
                <div className="hidden group-hover:flex gap-1 shrink-0">
                  <button onClick={()=>{setEditingTask(pinned);setEditText(pinned.text);}} className="text-[8px] text-[#333] hover:text-[#58a6ff] bg-transparent border-none cursor-pointer">✎</button>
                  <button onClick={()=>pinTask(pinned.id)} className="text-[8px] text-[#444] hover:text-[#e3b341] bg-transparent border-none cursor-pointer">unpin</button>
                  <button onClick={()=>deleteTask(pinned.id)} className="text-[8px] text-[#333] hover:text-[#f85149] bg-transparent border-none cursor-pointer">✕</button>
                </div>
              </div>
            )}
            {pending.map(t => (
              <div key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-[4px] group transition-colors hover:bg-[#080808] ${t.priority==='high'?'border-l-2 border-[#f85149]/40':''}`}>
                <input type="checkbox" onChange={() => toggleTask(t.id)} className="w-3.5 h-3.5 accent-[#56d364] cursor-pointer shrink-0" />
                {editingTask?.id===t.id ? (
                  <input value={editText} onChange={e=>setEditText(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter')saveEdit(); if(e.key==='Escape')setEditingTask(null); }}
                    className="flex-1 bg-transparent border-b border-[#58a6ff] text-white text-sm outline-none font-mono" autoFocus />
                ) : (
                  <span className={`font-mono text-sm flex-1 truncate ${t.priority==='high'?'text-[#f85149]':'text-[#555]'}`}>{t.text}</span>
                )}
                <div className="hidden group-hover:flex gap-1 shrink-0">
                  <button onClick={()=>pinTask(t.id)} className="text-[8px] text-[#333] hover:text-[#e3b341] bg-transparent border-none cursor-pointer">📌</button>
                  <button onClick={()=>{setEditingTask(t);setEditText(t.text);}} className="text-[8px] text-[#333] hover:text-[#58a6ff] bg-transparent border-none cursor-pointer">✎</button>
                  <button onClick={()=>deleteTask(t.id)} className="text-[8px] text-[#333] hover:text-[#f85149] bg-transparent border-none cursor-pointer">✕</button>
                </div>
              </div>
            ))}
            {done.length > 0 && (
              <div className="pt-2 mt-1 border-t border-[#0a0a0a]">
                <div className="font-mono text-[7px] text-[#1a1a1a] uppercase tracking-[2px] mb-1">{done.length} completed</div>
                {done.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 opacity-25 group">
                    <input type="checkbox" checked onChange={() => toggleTask(t.id)} className="w-3.5 h-3.5 accent-[#56d364] cursor-pointer shrink-0" />
                    <span className="font-mono text-sm flex-1 truncate text-[#333] line-through">{t.text}</span>
                    <button onClick={()=>deleteTask(t.id)} className="hidden group-hover:block text-[8px] text-[#222] hover:text-[#f85149] bg-transparent border-none cursor-pointer">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weekly activity bars */}
      <div className="bg-[#050505] border border-[#111] rounded-[4px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#333]">7-Day Activity</div>
          <div className="font-mono text-[8px] text-[#1a1a1a]">
            {fmtMins(weekBars.reduce((a,b)=>a+b.sec,0))} this week
          </div>
        </div>
        <div className="flex gap-2 items-end" style={{ height: '60px' }}>
          {weekBars.map(d => (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[7px] font-mono" style={{ color: d.sec > 0 ? '#333' : 'transparent' }}>
                {fmtMins(d.sec)}
              </div>
              <div className="w-full relative rounded-[2px]" style={{ height:'36px', background:'#080808' }}>
                <div className="absolute bottom-0 left-0 right-0 rounded-[2px] transition-all duration-700"
                  style={{
                    height: `${Math.max(d.pct, d.sec>0?6:0)}%`,
                    background: d.isToday ? '#f85149' : '#e3b341',
                    opacity: d.isToday ? 1 : 0.4,
                    boxShadow: d.isToday ? '0 0 8px rgba(248,81,73,0.4)' : 'none',
                  }} />
              </div>
              <div className="font-mono text-[7px]" style={{ color: d.isToday ? '#f85149' : '#222' }}>{d.day}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#0a0a0a]">
          {[
            { l:'All-time Focus', v: fmtMins(totalMins*60) },
            { l:'All-time ACs', v: String(totalACs) },
            { l:'All-time XP', v: `+${totalXP}` },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className="font-mono text-[7px] uppercase tracking-[2px] text-[#1a1a1a] mb-1">{s.l}</div>
              <div className="font-mono text-base font-black text-[#333]">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* History table */}
      <div className="bg-[#050505] border border-[#111] rounded-[4px] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#333]">Session Logs</div>
          <button onClick={() => setShowHistory(s=>!s)}
            className="font-mono text-[8px] uppercase tracking-[2px] text-[#222] hover:text-[#444] bg-transparent border-none cursor-pointer transition-colors">
            {showHistory ? 'Collapse ↑' : `Expand (${history.length}) ↓`}
          </button>
        </div>
        {showHistory && (
          history.length === 0 ? (
            <div className="text-[#111] font-mono text-[10px] text-center py-4">// No records found.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {history.map((h,i) => (
                <div key={h.id||i} className="flex items-center gap-3 font-mono text-xs border-b border-[#080808] pb-2 px-2 hover:bg-[#080808] rounded-[4px] transition-colors">
                  <span className="text-[#58a6ff] text-[10px] shrink-0">{new Date(h.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                  <span className="text-[#222] text-[8px] uppercase flex-1 truncate">{h.type.split(' (')[0]}</span>
                  <span className="text-[#555]">{h.workMins}m</span>
                  <span className="text-[#e3b341] shrink-0">{fmt(h.avgTimeSecs||0)}/avg</span>
                  <span className="text-[#56d364] shrink-0">{h.problemsSolved}AC</span>
                  <span className="text-[#e3b341] font-bold shrink-0">+{h.pointsEarned}</span>
                  {h.flowRating ? <span className="text-[#e3b341] shrink-0">{'★'.repeat(h.flowRating)}</span> : null}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
