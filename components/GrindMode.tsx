"use client";

import React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CF_SCORE_MAP } from "@/lib/constants";

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
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
}
function fmtMins(s: number) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function getWeekMonday(d: Date) { const day = new Date(d), dow = day.getDay(), diff = dow === 0 ? -6 : 1 - dow; day.setDate(day.getDate() + diff); day.setHours(0, 0, 0, 0); return day; }

// ── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: '#161718',
  surface: '#1e2022',
  card: '#242628',
  border: '#2e3133',
  borderHi: '#3d4245',
  text: '#e8dcc8',
  muted: '#7c7468',
  dim: '#4a4540',
  accent: '#fabd2f',
  accentDim: 'rgba(250,189,47,0.12)',
  accentGlow: 'rgba(250,189,47,0.25)',
  red: '#fb4934',
  redDim: 'rgba(251,73,52,0.12)',
  green: '#b8bb26',
  greenDim: 'rgba(184,187,38,0.12)',
  blue: '#83a598',
  blueDim: 'rgba(131,165,152,0.12)',
  purple: '#d3869b',
};

// ── Extra helpers ─────────────────────────────────────────────────────────────
function fmtSecs(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sc = s % 60;
  return sc > 0 ? `${m}m ${sc}s` : `${m}m`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      <span>{children}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

function MiniStatCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
      {color && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />}
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon && <span>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: color || T.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: T.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── MiniBar component ─────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: '100%', height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ── Animated Flow Ring ────────────────────────────────────────────────────────
function FlowRing({ phase, targetRest, restSecs }: { phase: Phase; targetRest: number; restSecs: number }) {
  const r = 110, c = 2 * Math.PI * r;
  // During rest, pct goes from 1 down to 0 as it counts down
  const pct = phase === 'REST' && targetRest > 0 ? Math.max(0, restSecs / targetRest) : 0;
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 280 280">
      {phase === 'FLOW' && (
        <circle cx="140" cy="140" r={r} fill="none" stroke={T.accent} strokeWidth="2.5"
          strokeDasharray="4 16" strokeLinecap="round"
          style={{ transformOrigin: 'center', animation: 'grindRingSpin 45s linear infinite, pulseRing 4s ease-in-out infinite' }} />
      )}
      {phase === 'REST' && (
        <>
          <circle cx="140" cy="140" r={r} fill="none" stroke={T.border} strokeWidth="3" />
          <circle cx="140" cy="140" r={r} fill="none" stroke={T.blue} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c * (1 - pct)}`}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray 1s linear', filter: `drop-shadow(0 0 6px ${T.blue})`, animation: 'pulseRing 6s ease-in-out infinite' }} />
        </>
      )}
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', overflow: 'hidden'
    }}>
      {color && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, borderRadius: '12px 12px 0 0' }} />}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <span>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'monospace', color: color || T.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted }}>{sub}</div>}
    </div>
  );
}

// ── Heatmap Hour Grid ─────────────────────────────────────────────────────────
function HourHeatmap({ grid }: { grid: number[] }) {
  const labels = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 36 }}>
        {grid.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: '100%', borderRadius: 2,
              height: v === 0 ? 3 : 4 + v * 6,
              background: v === 0 ? T.border : v <= 2 ? `${T.accent}60` : v <= 4 ? `${T.accent}99` : T.accent,
              transition: 'height 0.4s ease',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {labels.map(l => <span key={l} style={{ fontSize: 9, color: T.dim, fontFamily: 'monospace' }}>{l}</span>)}
      </div>
    </div>
  );
}

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function WeekBars({ history }: { history: SessionLog[] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const mon = getWeekMonday(new Date());
  const dMap: Record<string, number> = {};
  history.forEach(h => {
    const d = new Date(h.date).toLocaleDateString();
    dMap[d] = (dMap[d] || 0) + h.workMins;
  });
  const vals = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(d.getDate() + i);
    return dMap[d.toLocaleDateString()] || 0;
  });
  const max = Math.max(1, ...vals);
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%', borderRadius: 3,
            height: v === 0 ? 3 : Math.max(4, (v / max) * 48),
            background: i === todayIdx ? T.accent : v > 0 ? `${T.accent}55` : T.border,
            boxShadow: i === todayIdx && v > 0 ? `0 0 8px ${T.accentGlow}` : 'none',
            transition: 'height 0.5s ease',
          }} />
          <span style={{ fontSize: 9, color: i === todayIdx ? T.accent : T.dim, fontFamily: 'monospace', fontWeight: i === todayIdx ? 700 : 400 }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────
function SessionRow({ log }: { log: SessionLog }) {
  const [open, setOpen] = useState(false);
  const date = new Date(log.startTs * 1000);
  const stars = log.flowRating || 0;
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ width: 3, height: 32, borderRadius: 2, background: log.type === 'RETROACTIVE RECON' ? T.purple : T.accent, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.intent || 'Free Grind'}</div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', marginTop: 2 }}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: T.accent }}>{Math.round(log.workMins)}m</div>
            <div style={{ fontSize: 10, color: T.muted }}>{log.problemsSolved} ACs</div>
          </div>
          {stars > 0 && (
            <div style={{ display: 'flex', gap: 1 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ fontSize: 9, color: n <= stars ? T.accent : T.dim }}>★</span>
              ))}
            </div>
          )}
          <span style={{ fontSize: 10, color: T.dim, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>
      {open && log.details.length > 0 && (
        <div style={{ padding: '0 16px 12px 32px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {log.details.map(d => (
            <div key={d.pid} style={{
              fontSize: 10, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 4,
              background: T.card, border: `1px solid ${T.border}`, color: T.muted,
              display: 'flex', gap: 6, alignItems: 'center'
            }}>
              <span style={{ color: T.accent }}>{d.pid}</span>
              <span style={{ color: T.text }}>{d.name.length > 20 ? d.name.slice(0, 20) + '…' : d.name}</span>
              {d.rating > 0 && <span style={{ color: T.dim }}>·{d.rating}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
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
  const [newPri, setNewPri] = useState<'normal' | 'high'>('normal');
  const [newEst, setNewEst] = useState('');
  const [tmrPlan, setTmrPlan] = useState<TmrPlan[]>([]);
  const [newTmr, setNewTmr] = useState('');
  const [showTmrModal, setShowTmrModal] = useState(false);
  const [sessionStartTS, setSessionStartTS] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SessionLog | null>(null);
  const [history, setHistory] = useState<SessionLog[]>([]);
  const [targetHrs, setTargetHrs] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [rogueACs, setRogueACs] = useState<any[]>([]);
  const [wrActiveTab, setWrActiveTab] = useState(0);
  const [activeIdleTab, setActiveIdleTab] = useState<'tasks' | 'history'>('tasks');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    try { const h = localStorage.getItem('cf_grind_v4'); if (h) setHistory(JSON.parse(h)); } catch {}
    try { const t = localStorage.getItem('cf_grind_tasks_v4'); if (t) setTasks(JSON.parse(t)); } catch {}
    try { const tp = localStorage.getItem('cf_grind_tmr'); if (tp) setTmrPlan(JSON.parse(tp)); } catch {}
    try { const tg = localStorage.getItem('cf_grind_target'); if (tg) setTargetHrs(parseInt(tg)); } catch {}
    const style = document.createElement('style');
    style.id = 'grind-ring-css';
    style.textContent = `@keyframes grindRingSpin { 100% { transform: rotate(360deg); } } @keyframes pulseRing { 0%, 100% { transform: scale(0.98); opacity: 0.6; } 50% { transform: scale(1.02); opacity: 1; } } @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } } @keyframes pulse-dot { 0%,100%{opacity:1;} 50%{opacity:0.3;} }`;
    if (!document.getElementById('grind-ring-css')) document.head.appendChild(style);
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
          const recent = data.result.filter((s: any) => s.verdict === 'OK' && s.author.participantType === 'PRACTICE' && (now - s.creationTimeSeconds) < 86400 * 2);
          const missing = recent.filter((s: any) => !history.some(h => s.creationTimeSeconds >= h.startTs && s.creationTimeSeconds <= h.endTs));
          setRogueACs(missing);
        }
      } catch {}
    };
    checkForRogues();
  }, [handle, phase, history]);

  const saveTasks = useCallback((t: GrindTask[]) => { setTasks(t); try { localStorage.setItem('cf_grind_tasks_v4', JSON.stringify(t)); } catch {} }, []);
  const saveHistory = useCallback((h: SessionLog[]) => { setHistory(h); try { localStorage.setItem('cf_grind_v4', JSON.stringify(h)); } catch {} }, []);
  const saveTmrPlan = useCallback((tp: TmrPlan[]) => { setTmrPlan(tp); try { localStorage.setItem('cf_grind_tmr', JSON.stringify(tp)); } catch {} }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const startTick = useCallback((field: 'work' | 'rest') => {
    if (timerRef.current) clearInterval(timerRef.current);
    lastTickRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = Math.floor((now - lastTickRef.current) / 1000);
      
      if (delta >= 1) {
        lastTickRef.current += delta * 1000;
        
        if (field === 'work') {
          setWorkSecs(p => p + delta);
        } else {
          setRestSecs(p => {
            if (p - delta <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 0; // Auto-stop at 0
            }
            return p - delta;
          });
        }
      }
    }, 500); // 500ms interval handles background throttling flawlessly
  }, []);

  const startFlow = useCallback(() => {
    if (phase === 'IDLE' || phase === 'INTENT') {
      setSessionStartTS(Date.now() / 1000);
      setWorkSecs(0); setBreakCount(0);
    }
    setPhase('FLOW'); startTick('work');
  }, [phase, startTick]);

  const initiateRest = useCallback(() => {
    // Dynamic fatigue algorithm
    let shiftTotalSec = parseInt(localStorage.getItem('cf_grind_shiftTotal') || '0');
    let lastEnd = parseInt(localStorage.getItem('cf_grind_lastEnd') || '0');
    
    // Reset shift if it's been > 2 hours since last session
    if (Date.now() - lastEnd > 7200000) { shiftTotalSec = 0; }
    shiftTotalSec += workSecs;
    localStorage.setItem('cf_grind_shiftTotal', shiftTotalSec.toString());
    localStorage.setItem('cf_grind_lastEnd', Date.now().toString());

    const shiftHours = shiftTotalSec / 3600;
    const volMult = 1 + (0.15 * Math.max(0, shiftHours - 4));

    const hour = new Date().getHours();
    let circMult = 1.0;
    if (hour >= 22 || hour < 2) circMult = 1.2;
    else if (hour >= 2 && hour < 6) circMult = 1.5;
    else if (hour >= 6 && hour < 8) circMult = 1.15;

    // Base assumption for GrindMode is high difficulty
    const diffMult = 1.25; 

    const rawBreak = (workSecs / 5) * volMult * circMult * diffMult;
    const rec = Math.max(60, Math.min(Math.floor(rawBreak), 2700));

    setTargetRest(rec); 
    setRestSecs(rec); // Start at target and count down
    setBreakCount(b => b + 1); 
    setPhase('REST'); 
    startTick('rest');
  }, [workSecs, startTick]);

  const resumeFlow = useCallback(() => { setPhase('FLOW'); startTick('work'); }, [startTick]);

  const terminate = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('RATE'); setSyncing(true);
    let points = 0, type = 'PRACTICE GRIND';
    const details: ProbDetail[] = [];
    try {
      if (sessionStartTS && handle) {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=100`);
        const data = await res.json();
        if (data.status === 'OK') {
          const subs = data.result.filter((s: any) => s.creationTimeSeconds >= sessionStartTS).reverse();
          let mark = sessionStartTS;
          const seen = new Set<string>();
          subs.forEach((s: any) => {
            if (s.verdict === 'OK' && s.problem && s.author.participantType === 'PRACTICE') {
              const pid = `${s.problem.contestId}-${s.problem.index}`;
              if (!seen.has(pid)) {
                seen.add(pid);
                const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
                points += CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;
                details.push({ pid, name: s.problem.name, timeTakenSecs: s.creationTimeSeconds - mark, rating: s.problem.rating || 800 });
                mark = s.creationTimeSeconds;
              }
            }
          });
        }
      }
    } catch {}
    const avg = details.length > 0 ? Math.round(details.reduce((a, p) => a + p.timeTakenSecs, 0) / details.length) : 0;
    const report: SessionLog = {
      id: Date.now().toString(), date: new Date().toISOString(),
      startTs: sessionStartTS || (Date.now() / 1000 - workSecs), endTs: Date.now() / 1000,
      workMins: parseFloat((workSecs / 60).toFixed(1)),
      problemsSolved: details.length, pointsEarned: points, type,
      avgTimeSecs: avg, details, flowRating: 0,
      intent: intent || undefined, plannedMins: parseInt(plannedMins) || undefined, breakCount,
    };
    setLastReport(report); setSyncing(false); setFlowRating(0);
    setWorkSecs(0); setRestSecs(0); setTargetRest(0); setSessionStartTS(null); setBreakCount(0);
    saveHistory([report, ...history]);
  }, [sessionStartTS, handle, workSecs, intent, plannedMins, breakCount, history, saveHistory]);

  const confirmRate = useCallback(() => {
    if (!lastReport) { setPhase('IDLE'); return; }
    const updated = { ...lastReport, flowRating };
    saveHistory([updated, ...history.slice(1)]);
    setLastReport(updated); setPhase('IDLE'); setIntent(''); setPlannedMins('');
  }, [lastReport, flowRating, history, saveHistory]);

  const logRogueACs = () => {
    if (rogueACs.length === 0) return;
    const pts = rogueACs.reduce((sum, s) => sum + (CF_SCORE_MAP[s.problem?.rating ? Math.floor(s.problem.rating / 100) * 100 : 800] || 10), 0);
    const details = rogueACs.map(s => ({ pid: `${s.problem.contestId}-${s.problem.index}`, name: s.problem.name, timeTakenSecs: 0, rating: s.problem.rating || 800 }));
    const assumedMins = rogueACs.length * 20;
    const ts = rogueACs[rogueACs.length - 1].creationTimeSeconds;
    const report: SessionLog = {
      id: Date.now().toString(), date: new Date(ts * 1000).toISOString(), startTs: ts - (assumedMins * 60), endTs: ts,
      workMins: assumedMins, problemsSolved: rogueACs.length, pointsEarned: pts, type: 'RETROACTIVE RECON',
      avgTimeSecs: 0, details, flowRating: 3, intent: 'Logged retroactively', breakCount: 0,
    };
    saveHistory([report, ...history].sort((a, b) => b.endTs - a.endTs));
    setRogueACs([]);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const { totalMins, todayMins, streak, weekSecs, peakGrid, weeklyReviews } = useMemo(() => {
    let tMins = 0, tdyMins = 0;
    const dMap: Record<string, number> = {};
    const hSecs = new Array(24).fill(0);
    const now = new Date(), todayStr = now.toLocaleDateString(), mon = getWeekMonday(now);
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
    for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(d.getDate() + i); wSecs += (dMap[d.toLocaleDateString()] || 0) * 60; }
    const reviews = [];
    for (let w = 0; w < 4; w++) {
      const wMon = new Date(mon); wMon.setDate(wMon.getDate() - w * 7);
      const wSun = new Date(wMon); wSun.setDate(wSun.getDate() + 6);
      let wTotal = 0, wAcs = 0, maxD = 0, activeD = 0;
      for (let i = 0; i < 7; i++) { const d = new Date(wMon); d.setDate(d.getDate() + i); const dStr = d.toLocaleDateString(); if (dMap[dStr] > 0) { wTotal += dMap[dStr]; activeD++; if (dMap[dStr] > maxD) maxD = dMap[dStr]; } }
      history.filter(h => { const d = new Date(h.date); return d >= wMon && d <= wSun; }).forEach(h => wAcs += h.problemsSolved);
      reviews.push({ label: w === 0 ? 'This Week' : `${wMon.getDate()}/${wMon.getMonth() + 1}`, total: wTotal, acs: wAcs, maxD, activeD });
    }
    const maxH = Math.max(1, ...hSecs);
    const pGrid = hSecs.map(sec => sec === 0 ? 0 : Math.ceil((sec / maxH) * 5));
    return { totalMins: tMins, todayMins: tdyMins, streak: s, weekSecs: wSecs, peakGrid: pGrid, weeklyReviews: reviews };
  }, [history]);

  const weekPct = Math.min(100, Math.round((weekSecs / (targetHrs * 3600)) * 100));

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: INTENT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'INTENT') return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(16,17,18,0.96)', backdropFilter: 'blur(12px)', padding: 24, fontFamily: 'sans-serif'
    }}>
      <div style={{
        width: '100%', maxWidth: 460, background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: 36, boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${T.border}`,
        animation: 'fadeSlideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1px solid ${T.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent }}>Pre-Session Brief</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: T.text, marginTop: 1 }}>Set your target</div>
          </div>
        </div>

        {/* Intent input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 8 }}>Session intent</label>
          <input
            value={intent} onChange={e => setIntent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') startFlow(); if (e.key === 'Escape') setPhase('IDLE'); }}
            placeholder="e.g. Clear 3 Div2 D's…"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, color: T.text,
              background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.borderHi}`, outline: 'none',
              boxSizing: 'border-box', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.borderHi}
          />
        </div>

        {/* Duration */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 8 }}>Planned duration</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[60, 90, 120].map(m => (
              <button key={m}
                onClick={() => setPlannedMins(String(m))}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: plannedMins === String(m) ? T.accentDim : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${plannedMins === String(m) ? T.accent : T.border}`,
                  color: plannedMins === String(m) ? T.accent : T.muted,
                }}
              >{m}m</button>
            ))}
            <input
              type="number" placeholder="custom" value={[60, 90, 120].includes(Number(plannedMins)) ? '' : plannedMins}
              onChange={e => setPlannedMins(e.target.value)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: 12, textAlign: 'center',
                background: 'rgba(0,0,0,0.2)', border: `1px solid ${T.border}`, color: T.text, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Today's plan preview */}
        {tmrPlan.length > 0 && (
          <div style={{ marginBottom: 24, padding: '12px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Today's priorities</div>
            {tmrPlan.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.accent, minWidth: 14 }}>{i + 1}.</span>
                <span style={{ fontSize: 12, color: T.text }}>{t.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setPhase('IDLE')} style={{
            padding: '13px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, transition: 'all 0.15s', letterSpacing: '1px', textTransform: 'uppercase',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
          >Abort</button>
          <button onClick={startFlow} style={{
            flex: 1, padding: '13px 0', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: 'pointer',
            background: T.accent, border: 'none', color: T.bg, letterSpacing: '2px', textTransform: 'uppercase',
            boxShadow: `0 4px 20px ${T.accentGlow}`, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${T.accentGlow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${T.accentGlow}`; }}
          >⚡ Engage</button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: FLOW / REST
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'FLOW' || phase === 'REST') {
    const isFlow = phase === 'FLOW';
    const accent = isFlow ? T.accent : T.blue;
    // Calculates elapsed % instead of remaining % for the bottom bar
    const restPct = targetRest > 0 ? Math.min(100, Math.round(((targetRest - restSecs) / targetRest) * 100)) : 0;
    const pinned = tasks.find(t => t.pinned && !t.done);
    const todayACs = history.filter(h => new Date(h.date).toLocaleDateString() === new Date().toLocaleDateString()).reduce((a, h) => a + h.problemsSolved, 0);

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column',
        background: '#0c0d0e', fontFamily: 'sans-serif', overflow: 'hidden', userSelect: 'none',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px', borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: accent }}>
              {isFlow ? 'Flow State Active' : 'Recovery Protocol'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {intent && <span style={{ fontSize: 11, color: T.muted, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {intent}</span>}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.dim }}>breaks</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: T.muted }}>{breakCount}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.dim }}>today ACs</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: T.green }}>{todayACs}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 }}>
          {/* Timer circle */}
          <div style={{ position: 'relative', width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlowRing phase={phase} targetRest={targetRest} restSecs={restSecs} />
            <div style={{ zIndex: 10, textAlign: 'center' }}>
              <div style={{
                fontSize: '5.5rem', fontFamily: 'monospace', fontWeight: 200, lineHeight: 1,
                color: accent, letterSpacing: '-3px',
                textShadow: `0 0 30px ${accent}40`,
                transition: 'color 0.7s ease',
              }}>
                {isFlow ? fmt(workSecs) : fmt(restSecs)}
              </div>
              {!isFlow && targetRest > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: accent }}>
                  {restSecs === 0 ? 'Ready' : `${Math.round((restSecs / targetRest) * 100)}% remaining`}
                </div>
              )}
              {isFlow && plannedMins && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: T.dim, marginBottom: 4, letterSpacing: '1px' }}>target</div>
                  <MiniBar value={workSecs / 60} max={Number(plannedMins)} color={T.accent} />
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontFamily: 'monospace' }}>{Math.round(workSecs / 60)}/{plannedMins}m</div>
                </div>
              )}
            </div>
          </div>

          {/* Pinned task */}
          {isFlow && pinned && (
            <div style={{
              width: '100%', maxWidth: 520, display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', borderRadius: 12,
              background: `${accent}0d`, border: `1px solid ${accent}30`,
            }}>
              <div style={{ width: 3, height: 36, borderRadius: 2, background: accent, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: accent, marginBottom: 3 }}>Locked On</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{pinned.text}</div>
                {pinned.estMins && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>est. {pinned.estMins}m</div>}
              </div>
              <button
                onClick={() => saveTasks(tasks.map(t => t.id === pinned.id ? { ...t, done: true } : t))}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', background: 'transparent', border: `1px solid ${accent}`,
                  color: accent, letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${accent}20`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >Done ✓</button>
            </div>
          )}

          {/* Rest progress bar */}
          {!isFlow && targetRest > 0 && (
            <div style={{ width: '100%', maxWidth: 520 }}>
              <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: T.blue, borderRadius: 4,
                  width: `${restPct}%`, transition: 'width 1s ease',
                  boxShadow: `0 0 12px ${T.blue}60`,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>
                <span>{fmt(targetRest - restSecs)} elapsed</span>
                <span>{fmt(targetRest)} target</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div style={{ padding: '20px 28px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 12, justifyContent: 'center' }}>
          {isFlow ? (
            <button onClick={initiateRest} style={{
              padding: '12px 28px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', background: T.blueDim, border: `1px solid ${T.blue}50`,
              color: T.blue, letterSpacing: '1.5px', textTransform: 'uppercase', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = `${T.blue}25`; e.currentTarget.style.borderColor = T.blue; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.blueDim; e.currentTarget.style.borderColor = `${T.blue}50`; }}
            >⏸ Rest</button>
          ) : (
            <button onClick={resumeFlow} style={{
              padding: '12px 28px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', background: T.accentDim, border: `1px solid ${T.accent}50`,
              color: T.accent, letterSpacing: '1.5px', textTransform: 'uppercase', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}25`; e.currentTarget.style.borderColor = T.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.accentDim; e.currentTarget.style.borderColor = `${T.accent}50`; }}
            >⚡ Resume</button>
          )}
          <button onClick={terminate} style={{
            padding: '12px 24px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`,
            color: T.muted, letterSpacing: '1.5px', textTransform: 'uppercase', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.color = T.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
          >■ Extract</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RATE — rich stats breakdown
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'RATE') {
    // ── Derived stats from lastReport ──────────────────────────────────────
    const r = lastReport;
    const solvedDetails = r?.details ?? [];
    const ratedProblems = solvedDetails.filter(d => d.rating > 0);
    const avgRating = ratedProblems.length > 0
      ? Math.round(ratedProblems.reduce((a, d) => a + d.rating, 0) / ratedProblems.length) : 0;
    const maxRating = ratedProblems.length > 0 ? Math.max(...ratedProblems.map(d => d.rating)) : 0;
    const minRating = ratedProblems.length > 0 ? Math.min(...ratedProblems.map(d => d.rating)) : 0;
    const timedProblems = solvedDetails.filter(d => d.timeTakenSecs > 30);
    const avgTimeSecs = timedProblems.length > 0
      ? Math.round(timedProblems.reduce((a, d) => a + d.timeTakenSecs, 0) / timedProblems.length) : 0;
    const maxTimeSecs = timedProblems.length > 0 ? Math.max(...timedProblems.map(d => d.timeTakenSecs)) : 0;
    const minTimeSecs = timedProblems.length > 0 ? Math.min(...timedProblems.map(d => d.timeTakenSecs)) : 0;
    const fastestProblem = timedProblems.find(d => d.timeTakenSecs === minTimeSecs);
    const slowestProblem = timedProblems.find(d => d.timeTakenSecs === maxTimeSecs);
    const focusMins = r ? Math.round(r.workMins) : 0;
    const efficiency = r && focusMins > 0 && r.problemsSolved > 0
      ? Math.round(focusMins / r.problemsSolved) : 0;
    const plannedM = r?.plannedMins ?? 0;
    const planAccuracy = plannedM > 0 ? Math.min(200, Math.round((focusMins / plannedM) * 100)) : null;
    const xpPerHour = focusMins > 0 && r ? Math.round((r.pointsEarned / focusMins) * 60) : 0;
    const acRate = focusMins > 0 && r ? parseFloat((r.problemsSolved / (focusMins / 60)).toFixed(1)) : 0;

    // Rating distribution bucketed
    const ratingBuckets: Record<number, number> = {};
    ratedProblems.forEach(d => {
      const bucket = Math.floor(d.rating / 200) * 200;
      ratingBuckets[bucket] = (ratingBuckets[bucket] || 0) + 1;
    });
    const bucketEntries = Object.entries(ratingBuckets).sort((a, b) => Number(a[0]) - Number(b[0]));
    const maxBucketCount = Math.max(1, ...Object.values(ratingBuckets));

    // Rating color helper
    const ratingColor = (r: number) => r >= 2400 ? '#ff0000' : r >= 2100 ? '#ff8c00' : r >= 1900 ? '#aa00aa' : r >= 1600 ? '#0000ff' : r >= 1400 ? '#03a89e' : r >= 1200 ? T.green : T.muted;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'stretch',
        background: '#0c0d0e', fontFamily: 'sans-serif', overflow: 'hidden',
      }}>
        {/* Left pane — sticky summary */}
        <div style={{
          width: 260, flexShrink: 0, background: T.surface, borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', padding: 28,
        }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: T.green }}>Extraction Complete</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.text, lineHeight: 1.2 }}>Session<br/>Debrief</div>
            {r?.intent && <div style={{ marginTop: 8, fontSize: 11, color: T.muted, fontStyle: 'italic' }}>"{r.intent}"</div>}
          </div>

          {syncing ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>⚙️</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>Syncing…</div>
              </div>
            </div>
          ) : (
            <>
              {/* Top 3 hero stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {[
                  { l: 'Focus Time', v: `${focusMins}m`, sub: plannedM > 0 ? `of ${plannedM}m planned` : undefined, c: T.accent },
                  { l: 'Problems AC\'d', v: String(r?.problemsSolved ?? 0), sub: r?.problemsSolved ? `${acRate}/hr rate` : 'none this session', c: T.green },
                  { l: 'XP Earned', v: `+${r?.pointsEarned ?? 0}`, sub: xpPerHour > 0 ? `${xpPerHour} xp/hr` : undefined, c: T.blue },
                ].map(s => (
                  <div key={s.l} style={{ padding: '12px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'monospace', color: s.c, lineHeight: 1 }}>{s.v}</div>
                    {s.sub && <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>{s.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Flow rating */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Flow Rating</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setFlowRating(n)} style={{
                      fontSize: 24, background: 'transparent', border: 'none', cursor: 'pointer',
                      transition: 'all 0.15s', transform: n <= flowRating ? 'scale(1.2)' : 'scale(1)',
                      filter: n <= flowRating ? `drop-shadow(0 0 6px ${T.accent})` : 'none',
                      opacity: n <= flowRating ? 1 : 0.2, color: T.accent, padding: 0,
                    }}>★</button>
                  ))}
                </div>
              </div>

              {/* Log button */}
              <button onClick={confirmRate} style={{
                width: '100%', padding: '13px 0', borderRadius: 10, fontSize: 12, fontWeight: 900,
                cursor: 'pointer', background: T.green, border: 'none', color: T.bg,
                letterSpacing: '2px', textTransform: 'uppercase', boxShadow: `0 4px 16px ${T.greenDim}`,
                transition: 'all 0.15s', marginTop: 'auto',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >Log Session →</button>
            </>
          )}
        </div>

        {/* Right pane — scrollable detail stats */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {syncing ? null : (
            <>
              {/* ── Row 1: Time & Pace metrics ─────────────────────────────── */}
              <div>
                <SectionLabel>Time & Pace</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <MiniStatCard label="Avg Time/Problem" value={avgTimeSecs > 0 ? fmtSecs(avgTimeSecs) : '—'} color={T.accent} icon="⏱" />
                  <MiniStatCard label="Fastest Solve" value={minTimeSecs > 0 ? fmtSecs(minTimeSecs) : '—'} sub={fastestProblem?.name.slice(0, 14)} color={T.green} icon="⚡" />
                  <MiniStatCard label="Slowest Solve" value={maxTimeSecs > 0 ? fmtSecs(maxTimeSecs) : '—'} sub={slowestProblem?.name.slice(0, 14)} color={T.red} icon="🐢" />
                  <MiniStatCard label="Mins/Problem" value={efficiency > 0 ? `${efficiency}m` : '—'} sub="focus efficiency" color={T.blue} icon="📐" />
                </div>
              </div>

              {/* ── Row 2: Rating metrics ───────────────────────────────────── */}
              <div>
                <SectionLabel>Rating Breakdown</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                  <MiniStatCard label="Avg Rating" value={avgRating > 0 ? String(avgRating) : '—'} color={ratingColor(avgRating)} icon="★" />
                  <MiniStatCard label="Hardest AC" value={maxRating > 0 ? String(maxRating) : '—'} color={ratingColor(maxRating)} icon="🏆" />
                  <MiniStatCard label="Easiest AC" value={minRating > 0 ? String(minRating) : '—'} color={ratingColor(minRating)} icon="✓" />
                  <MiniStatCard label="Rated Solved" value={`${ratedProblems.length}/${solvedDetails.length}`} color={T.muted} icon="📊" />
                </div>
                {/* Rating distribution bar chart */}
                {bucketEntries.length > 0 && (
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, marginBottom: 12 }}>Distribution</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 52 }}>
                      {bucketEntries.map(([bucket, count]) => (
                        <div key={bucket} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{
                            width: '100%', borderRadius: 3,
                            height: Math.max(4, (count / maxBucketCount) * 40),
                            background: ratingColor(Number(bucket)),
                            opacity: 0.85,
                          }} />
                          <span style={{ fontSize: 8, color: T.dim, fontFamily: 'monospace' }}>{bucket}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Row 3: Session health ───────────────────────────────────── */}
              <div>
                <SectionLabel>Session Health</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <MiniStatCard label="Breaks Taken" value={String(r?.breakCount ?? 0)} sub={r && r.breakCount > 3 ? 'consider fewer' : 'solid focus'} color={r && (r.breakCount ?? 0) > 3 ? T.red : T.green} icon="⏸" />
                  <MiniStatCard label="Plan Accuracy" value={planAccuracy !== null ? `${planAccuracy}%` : '—'} sub={planAccuracy !== null ? (planAccuracy > 110 ? 'overran' : planAccuracy < 80 ? 'underran' : 'on target') : 'no plan set'} color={planAccuracy !== null ? (planAccuracy >= 80 && planAccuracy <= 110 ? T.green : T.accent) : T.dim} icon="🎯" />
                  <MiniStatCard label="XP / Hour" value={xpPerHour > 0 ? String(xpPerHour) : '—'} sub="grind intensity" color={xpPerHour > 80 ? T.green : xpPerHour > 40 ? T.accent : T.muted} icon="⚡" />
                  <MiniStatCard label="AC Rate" value={acRate > 0 ? `${acRate}/hr` : '—'} sub="problems per hour" color={acRate >= 2 ? T.green : acRate >= 1 ? T.accent : T.muted} icon="📈" />
                </div>
              </div>

              {/* ── Row 4: Problem-by-problem table ────────────────────────── */}
              {solvedDetails.length > 0 && (
                <div>
                  <SectionLabel>Problem Log</SectionLabel>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {['#', 'Problem', 'Rating', 'Time Taken', 'Speed'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: h === '#' || h === 'Rating' || h === 'Time Taken' || h === 'Speed' ? 'center' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, fontFamily: 'monospace' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {solvedDetails.map((d, i) => {
                          const isMax = d.timeTakenSecs === maxTimeSecs && timedProblems.length > 1;
                          const isMin = d.timeTakenSecs === minTimeSecs && timedProblems.length > 1;
                          const speedPct = maxTimeSecs > 0 && d.timeTakenSecs > 30 ? Math.round((1 - (d.timeTakenSecs - minTimeSecs) / (maxTimeSecs - minTimeSecs + 1)) * 100) : null;
                          return (
                            <tr key={d.pid} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: T.dim }}>{i + 1}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <a href={`https://codeforces.com/problemset/problem/${d.pid.replace('-', '/')}`} target="_blank" rel="noreferrer"
                                  style={{ color: T.text, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
                                  onMouseEnter={e => e.currentTarget.style.color = T.accent}
                                  onMouseLeave={e => e.currentTarget.style.color = T.text}
                                >{d.name}</a>
                                <div style={{ fontSize: 10, color: T.dim, fontFamily: 'monospace', marginTop: 1 }}>{d.pid}</div>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                {d.rating > 0
                                  ? <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: ratingColor(d.rating) }}>{d.rating}</span>
                                  : <span style={{ color: T.dim }}>—</span>
                                }
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12 }}>
                                {d.timeTakenSecs > 30 ? (
                                  <span style={{ color: isMin ? T.green : isMax ? T.red : T.text }}>
                                    {fmtSecs(d.timeTakenSecs)}
                                    {isMin && <span style={{ marginLeft: 4, fontSize: 9, color: T.green }}>fastest</span>}
                                    {isMax && <span style={{ marginLeft: 4, fontSize: 9, color: T.red }}>slowest</span>}
                                  </span>
                                ) : <span style={{ color: T.dim }}>—</span>}
                              </td>
                              <td style={{ padding: '10px 20px', textAlign: 'center' }}>
                                {speedPct !== null ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${speedPct}%`, background: speedPct > 60 ? T.green : speedPct > 30 ? T.accent : T.red, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.muted, minWidth: 28 }}>{speedPct}%</span>
                                  </div>
                                ) : <span style={{ color: T.dim, fontSize: 11 }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Row 5: Comparison vs personal bests ─────────────────────── */}
              {history.length > 1 && r && (
                <div>
                  <SectionLabel>vs. Your Average</SectionLabel>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    {(() => {
                      const prevSessions = history.slice(1); // exclude current (just logged)
                      const avgFocusMins = prevSessions.reduce((a, h) => a + h.workMins, 0) / prevSessions.length;
                      const avgACs = prevSessions.reduce((a, h) => a + h.problemsSolved, 0) / prevSessions.length;
                      const avgXP = prevSessions.reduce((a, h) => a + h.pointsEarned, 0) / prevSessions.length;
                      const avgRatingHist = prevSessions.flatMap(h => h.details.filter(d => d.rating > 0).map(d => d.rating));
                      const avgRatingSess = avgRatingHist.length > 0 ? Math.round(avgRatingHist.reduce((a, b) => a + b, 0) / avgRatingHist.length) : 0;

                      const rows = [
                        { metric: 'Focus Time', current: `${focusMins}m`, avg: `${Math.round(avgFocusMins)}m`, better: focusMins >= avgFocusMins },
                        { metric: 'Problems AC\'d', current: String(r.problemsSolved), avg: avgACs.toFixed(1), better: r.problemsSolved >= avgACs },
                        { metric: 'XP Earned', current: String(r.pointsEarned), avg: Math.round(avgXP).toString(), better: r.pointsEarned >= avgXP },
                        ...(avgRatingSess > 0 && avgRating > 0 ? [{ metric: 'Avg Problem Rating', current: String(avgRating), avg: String(avgRatingSess), better: avgRating >= avgRatingSess }] : []),
                      ];

                      return (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                              {['Metric', 'This Session', 'Your Avg', 'Δ'].map(h => (
                                <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Metric' ? 'left' : 'center', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={row.metric} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
                                <td style={{ padding: '10px 16px', color: T.muted, fontSize: 12 }}>{row.metric}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: T.text }}>{row.current}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'monospace', color: T.dim }}>{row.avg}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: row.better ? T.green : T.red }}>
                                    {row.better ? '▲' : '▼'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: IDLE (DASHBOARD)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: 'sans-serif', color: T.text, maxWidth: 860, margin: '0 auto', paddingBottom: 80, animation: 'fadeSlideUp 0.35s ease' }}>

      {/* ── Rogue AC Banner ─────────────────────────────────────────────────── */}
      {rogueACs.length > 0 && (
        <div style={{
          padding: '14px 18px', marginBottom: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.redDim, border: `1px solid ${T.red}40`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.red, animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.red }}>Untracked Activity</div>
              <div style={{ fontSize: 12, color: T.text, marginTop: 2 }}>Solved <strong style={{ color: T.red }}>{rogueACs.length} problems</strong> outside Grind Mode recently</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setRogueACs([])} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '1px' }}>Dismiss</button>
            <button onClick={logRogueACs} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: T.red, border: 'none', color: '#fff', transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '1px' }}>Log as Session</button>
          </div>
        </div>
      )}

      {/* ── TOP ROW: Hero + Quick Stats ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Hero / Start Card */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
          {/* Subtle grid bg */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.03,
            backgroundImage: 'linear-gradient(#fabd2f 1px, transparent 1px), linear-gradient(90deg, #fabd2f 1px, transparent 1px)',
            backgroundSize: '24px 24px', pointerEvents: 'none',
          }} />
          <button onClick={() => setShowSettings(true)} style={{
            position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 8,
            background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.text; e.currentTarget.style.transform = 'rotate(45deg)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; e.currentTarget.style.transform = 'rotate(0)'; }}
          >⚙</button>

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Focus Session</div>

          {tmrPlan.length > 0 && (
            <div onClick={() => setShowTmrModal(true)} style={{
              marginBottom: 16, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.accent, marginBottom: 6 }}>Today's Intentions</div>
              {tmrPlan.map((t, i) => (
                <div key={t.id} style={{ fontSize: 12, color: T.text, marginBottom: 2, display: 'flex', gap: 6 }}>
                  <span style={{ color: T.accent, fontFamily: 'monospace', fontSize: 10 }}>{i + 1}.</span>{t.text}
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setPhase('INTENT')} style={{
            width: '100%', padding: '14px 0', borderRadius: 10, fontSize: 14, fontWeight: 900,
            cursor: 'pointer', background: T.accent, border: 'none', color: T.bg,
            letterSpacing: '2px', textTransform: 'uppercase', boxShadow: `0 4px 20px ${T.accentGlow}`,
            transition: 'all 0.15s', marginTop: 8,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${T.accentGlow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${T.accentGlow}`; }}
          >⚡ Start Session</button>

          <button onClick={() => setShowTmrModal(true)} style={{
            width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted,
            letterSpacing: '1px', textTransform: 'uppercase', marginTop: 8, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
          >📋 Plan Tomorrow</button>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
          <StatCard label="Total Focus" value={`${(totalMins / 60).toFixed(1)}h`} icon="⏱" color={T.muted} />
          <StatCard label="Today" value={`${(todayMins / 60).toFixed(1)}h`} sub={`${history.filter(h => new Date(h.date).toLocaleDateString() === new Date().toLocaleDateString()).length} sessions`} icon="☀" color={todayMins > 0 ? T.green : T.muted} />
          <StatCard label="Streak" value={`${streak}d`} sub={streak > 2 ? '🔥 on fire' : 'keep going'} icon="⚡" color={streak > 2 ? T.red : T.muted} />
          <StatCard label="This Week" value={`${(weekSecs / 3600).toFixed(1)}h`} sub={`${weekPct}% of ${targetHrs}h goal`} icon="📊" color={weekPct >= 100 ? T.green : T.accent} />
        </div>
      </div>

      {/* ── SECOND ROW: Weekly Progress + Activity ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Weekly progress */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted }}>This Week</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: weekPct >= 100 ? T.green : T.accent }}>{weekPct}%</div>
          </div>
          <WeekBars history={history} />
          <div style={{ marginTop: 14, height: 4, background: T.border, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: weekPct >= 100 ? T.green : T.accent,
              width: `${weekPct}%`, borderRadius: 4, transition: 'width 0.8s ease',
              boxShadow: `0 0 10px ${weekPct >= 100 ? T.greenDim : T.accentGlow}`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: T.dim, fontFamily: 'monospace' }}>
            <span>{(weekSecs / 3600).toFixed(1)}h done</span>
            <span>{targetHrs}h goal</span>
          </div>
        </div>

        {/* Peak hours heatmap */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 16 }}>Peak Hours</div>
          <HourHeatmap grid={peakGrid} />
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {weeklyReviews.slice(0, 1).map(w => (
              <React.Fragment key={w.label}>
                <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: T.card }}>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: T.text }}>{(w.total / 60).toFixed(1)}h</div>
                  <div style={{ fontSize: 9, color: T.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>focus</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: T.card }}>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: T.green }}>{w.acs}</div>
                  <div style={{ fontSize: 9, color: T.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>ACs</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: T.card }}>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: T.accent }}>{w.activeD}</div>
                  <div style={{ fontSize: 9, color: T.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>active days</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Tasks & History tabs ─────────────────────────────────────── */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {/* Tab nav */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
          {(['tasks', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveIdleTab(tab)} style={{
              flex: 1, padding: '14px 0', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px',
              textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: 'none',
              borderBottom: `2px solid ${activeIdleTab === tab ? T.accent : 'transparent'}`,
              color: activeIdleTab === tab ? T.accent : T.muted, transition: 'all 0.15s',
              marginBottom: -1,
            }}>
              {tab === 'tasks' ? `Tasks (${tasks.filter(t => !t.done).length})` : `History (${history.length})`}
            </button>
          ))}
        </div>

        {/* Tasks panel */}
        {activeIdleTab === 'tasks' && (
          <div style={{ padding: 20 }}>
            {/* Add task input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setNewPri(p => p === 'high' ? 'normal' : 'high')}
                style={{
                  width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                  background: newPri === 'high' ? T.redDim : 'transparent',
                  border: `1px solid ${newPri === 'high' ? T.red : T.border}`,
                  color: newPri === 'high' ? T.red : T.dim,
                }}
              >!</button>
              <input
                value={newTask} onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTask.trim()) {
                    saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false, pinned: false, priority: newPri, estMins: parseInt(newEst) || undefined }]);
                    setNewTask(''); setNewEst(''); setNewPri('normal');
                  }
                }}
                placeholder="Add a task…"
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, fontSize: 13, color: T.text, background: T.card, border: `1px solid ${T.border}`, outline: 'none' }}
                onFocus={e => e.target.style.borderColor = T.borderHi}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              <input
                type="number" value={newEst} onChange={e => setNewEst(e.target.value)}
                placeholder="min"
                style={{ width: 64, padding: '10px 8px', borderRadius: 8, fontSize: 12, textAlign: 'center', color: T.text, background: T.card, border: `1px solid ${T.border}`, outline: 'none' }}
              />
              <button
                onClick={() => {
                  if (newTask.trim()) {
                    saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false, pinned: false, priority: newPri, estMins: parseInt(newEst) || undefined }]);
                    setNewTask(''); setNewEst(''); setNewPri('normal');
                  }
                }}
                style={{
                  padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: T.accentDim, border: `1px solid ${T.accent}40`, color: T.accent, transition: 'all 0.15s', letterSpacing: '1px',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}25`; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.accentDim; }}
              >Add</button>
            </div>

            {/* Task list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.filter(t => !t.done).length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: T.dim }}>No open tasks. Add something to work on.</div>
              )}
              {tasks.filter(t => !t.done).sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
                return 0;
              }).map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                  background: T.card, border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${t.priority === 'high' ? T.red : t.pinned ? T.accent : T.border}`,
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
                >
                  <input type="checkbox" onChange={() => saveTasks(tasks.map(x => x.id === t.id ? { ...x, done: true } : x))} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: T.green }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.text}</span>
                  {t.priority === 'high' && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: T.red, background: T.redDim, padding: '2px 6px', borderRadius: 4 }}>urgent</span>}
                  {t.estMins && <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.muted, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4 }}>~{t.estMins}m</span>}
                  <button
                    onClick={() => saveTasks(tasks.map(x => ({ ...x, pinned: x.id === t.id ? !x.pinned : false })))}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, opacity: t.pinned ? 1 : 0.3, transition: 'opacity 0.15s' }}
                    title="Pin as focus target"
                  >📌</button>
                  <button onClick={() => saveTasks(tasks.filter(x => x.id !== t.id))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: T.dim, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = T.red}
                    onMouseLeave={e => e.currentTarget.style.color = T.dim}
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Completed tasks */}
            {tasks.filter(t => t.done).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Completed</span>
                  <span style={{ color: T.green }}>({tasks.filter(t => t.done).length})</span>
                </div>
                {tasks.filter(t => t.done).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', opacity: 0.4 }}>
                    <span style={{ fontSize: 12, color: T.green }}>✓</span>
                    <span style={{ fontSize: 12, color: T.muted, textDecoration: 'line-through' }}>{t.text}</span>
                    <button onClick={() => saveTasks(tasks.filter(x => x.id !== t.id))} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: T.dim }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History panel */}
        {activeIdleTab === 'history' && (
          <div>
            {/* Weekly review tabs */}
            <div style={{ display: 'flex', gap: 0, padding: '16px 20px 0', borderBottom: `1px solid ${T.border}` }}>
              {weeklyReviews.map((w, i) => (
                <button key={i} onClick={() => setWrActiveTab(i)} style={{
                  padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
                  cursor: 'pointer', background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${wrActiveTab === i ? T.accent : 'transparent'}`,
                  color: wrActiveTab === i ? T.accent : T.muted, transition: 'all 0.15s', marginBottom: -1,
                }}>{w.label}</button>
              ))}
            </div>

            {/* Weekly review stats */}
            {weeklyReviews[wrActiveTab] && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: `1px solid ${T.border}` }}>
                {[
                  { l: 'Focus', v: `${(weeklyReviews[wrActiveTab].total / 60).toFixed(1)}h`, c: T.accent },
                  { l: 'ACs', v: String(weeklyReviews[wrActiveTab].acs), c: T.green },
                  { l: 'Peak Day', v: `${(weeklyReviews[wrActiveTab].maxD / 60).toFixed(1)}h`, c: T.text },
                  { l: 'Active Days', v: `${weeklyReviews[wrActiveTab].activeD}/7`, c: T.blue },
                ].map(s => (
                  <div key={s.l} style={{ padding: '16px', textAlign: 'center', borderRight: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Session log */}
            <div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: T.dim }}>No sessions yet. Start grinding!</div>
              ) : (
                history.slice(0, 20).map(h => <SessionRow key={h.id} log={h} />)
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Tomorrow Plan Modal ──────────────────────────────────────────────── */}
      {showTmrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: 32, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent }}>Tomorrow</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>Top Priorities</div>
              </div>
              <button onClick={() => setShowTmrModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', fontSize: 16, transition: 'all 0.15s' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>Set up to 3 priorities. They'll appear as pinned intentions when you start your next session.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {tmrPlan.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: T.accent, minWidth: 16 }}>{i + 1}.</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{t.text}</span>
                  <button onClick={() => saveTmrPlan(tmrPlan.filter(x => x.id !== t.id))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.dim, fontSize: 12 }}
                    onMouseEnter={e => e.currentTarget.style.color = T.red}
                    onMouseLeave={e => e.currentTarget.style.color = T.dim}
                  >✕</button>
                </div>
              ))}
            </div>
            {tmrPlan.length < 3 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={newTmr} onChange={e => setNewTmr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newTmr.trim()) { saveTmrPlan([...tmrPlan, { id: Date.now(), text: newTmr.trim() }]); setNewTmr(''); } }}
                  placeholder="Add a priority…"
                  autoFocus
                  style={{ flex: 1, padding: '11px 14px', borderRadius: 8, fontSize: 13, color: T.text, background: T.card, border: `1px solid ${T.border}`, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = T.accent}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
                <button
                  onClick={() => { if (newTmr.trim()) { saveTmrPlan([...tmrPlan, { id: Date.now(), text: newTmr.trim() }]); setNewTmr(''); } }}
                  style={{ padding: '11px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T.accentDim, border: `1px solid ${T.accent}40`, color: T.accent, transition: 'all 0.15s' }}
                >Add</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Settings Modal ───────────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 720, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, display: 'flex', flexDirection: 'column', maxHeight: '88vh', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '24px 28px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.muted }}>Configuration</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>Settings & Data</div>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', fontSize: 18, transition: 'all 0.15s' }}>×</button>
            </div>
            <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Weekly Goal</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" value={targetHrs} onChange={e => { setTargetHrs(Number(e.target.value)); localStorage.setItem('cf_grind_target', e.target.value); }}
                    style={{ width: 80, padding: '10px 12px', borderRadius: 8, fontSize: 16, fontWeight: 700, fontFamily: 'monospace', textAlign: 'center', background: T.card, border: `1px solid ${T.border}`, color: T.text, outline: 'none' }} />
                  <span style={{ fontSize: 13, color: T.muted }}>hours per week</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Session Ledger</div>
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: T.card }}>
                        {['Date', 'Intent', 'Mins', 'ACs', 'Rating', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Mins' || h === 'ACs' || h === 'Rating' ? 'center' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: T.dim, fontStyle: 'italic' }}>No sessions yet.</td></tr>
                      ) : history.map(h => (
                        <tr key={h.id} style={{ borderTop: `1px solid ${T.border}` }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: T.muted }}>{new Date(h.startTs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                          <td style={{ padding: '10px 14px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>{h.intent || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <input type="number" value={h.workMins} onChange={e => {
                              const v = Number(e.target.value);
                              setHistory(prev => { const next = prev.map(x => x.id === h.id ? { ...x, workMins: v } : x); localStorage.setItem('cf_grind_v4', JSON.stringify(next)); return next; });
                            }} style={{ width: 54, padding: '4px 6px', borderRadius: 6, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.border}`, color: T.text, outline: 'none' }} />
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace', color: T.green }}>{h.problemsSolved}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <input type="number" min="0" max="5" value={h.flowRating || 0} onChange={e => {
                              const v = Number(e.target.value);
                              setHistory(prev => { const next = prev.map(x => x.id === h.id ? { ...x, flowRating: v } : x); localStorage.setItem('cf_grind_v4', JSON.stringify(next)); return next; });
                            }} style={{ width: 40, padding: '4px 6px', borderRadius: 6, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.border}`, color: T.accent, outline: 'none' }} />
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <button onClick={() => saveHistory(history.filter(x => x.id !== h.id))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.dim, fontSize: 12, padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.color = T.red}
                              onMouseLeave={e => e.currentTarget.style.color = T.dim}
                            >✕</button>
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