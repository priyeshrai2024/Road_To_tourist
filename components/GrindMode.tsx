"use client";

import React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CF_SCORE_MAP } from "@/lib/constants";

// ── Types ────────────────────────────────────────────────────────────────────
interface ProbDetail { 
  pid: string; 
  name: string; 
  index?: string; 
  timeTakenSecs: number; 
  rating: number; 
}
interface SessionLog {
  id: string; date: string; startTs: number; endTs: number; workMins: number;
  problemsSolved: number; pointsEarned: number; type: string; avgTimeSecs: number;
  details: ProbDetail[]; flowRating?: number; intent?: string; breakCount: number;
  plannedMins?: number;
  isContest?: boolean;
  contestId?: number;
  contestType?: string;
  ratingChange?: number;
  oldRating?: number;
  newRating?: number;
  rank?: number;
}
interface GrindTask { id: number; text: string; done: boolean; pinned: boolean; priority: 'high' | 'normal'; estMins?: number; }
interface TmrPlan { id: number; text: string; }
type Phase = 'IDLE' | 'INTENT' | 'FLOW' | 'REST' | 'RATE';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  const rs = Math.round(s);
  const h = Math.floor(rs / 3600), m = Math.floor((rs % 3600) / 60), sc = rs % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
}

function getWeekMonday(d: Date) { const day = new Date(d), dow = day.getDay(), diff = dow === 0 ? -6 : 1 - dow; day.setDate(day.getDate() + diff); day.setHours(0, 0, 0, 0); return day; }

// ── Dynamic Theme Mapping ────────────────────────────────────────────────────
const T = {
  bg: 'var(--bg-base)',
  surface: 'var(--bg-card)',
  card: 'color-mix(in srgb, var(--bg-card) 60%, transparent)',
  border: 'var(--border)',
  borderHi: 'color-mix(in srgb, var(--border) 50%, var(--text-main))',
  text: 'var(--text-main)',
  muted: 'var(--text-muted)',
  dim: 'color-mix(in srgb, var(--text-muted) 50%, transparent)',
  accent: 'var(--accent)',
  accentDim: 'var(--accent-10)',
  accentGlow: 'color-mix(in srgb, var(--accent) 25%, transparent)',
  red: '#f85149',
  redDim: 'rgba(248,81,73,0.12)',
  green: 'var(--status-ac, #2ea043)',
  greenDim: 'color-mix(in srgb, var(--status-ac, #2ea043) 15%, transparent)',
  blue: '#58a6ff',
  blueDim: 'rgba(88,166,255,0.12)',
  purple: '#d2a8ff',
};

function fmtSecs(s: number) {
  const rs = Math.round(s);
  if (rs < 60) return `${rs}s`;
  const m = Math.floor(rs / 60), sc = rs % 60;
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

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: '100%', height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function FlowRing({ phase, targetRest, restSecs }: { phase: Phase; targetRest: number; restSecs: number }) {
  const r = 110, c = 2 * Math.PI * r;
  const pct = phase === 'REST' && targetRest > 0 ? Math.max(0, restSecs / targetRest) : 0;
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 280 280">
      {phase === 'FLOW' && (
        <circle cx="140" cy="140" r={r} fill="none" stroke={T.accent} strokeWidth="2.5" strokeDasharray="4 16" strokeLinecap="round" style={{ transformOrigin: 'center', animation: 'grindRingSpin 45s linear infinite, pulseRing 4s ease-in-out infinite' }} />
      )}
      {phase === 'REST' && (
        <>
          <circle cx="140" cy="140" r={r} fill="none" stroke={T.border} strokeWidth="3" />
          <circle cx="140" cy="140" r={r} fill="none" stroke={T.blue} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * pct} ${c * (1 - pct)}`} style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray 1s linear', filter: `drop-shadow(0 0 6px ${T.blue})`, animation: 'pulseRing 6s ease-in-out infinite' }} />
        </>
      )}
    </svg>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', overflow: 'hidden' }}>
      {color && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, borderRadius: '12px 12px 0 0' }} />}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center', gap: 5 }}>{icon && <span>{icon}</span>}{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'monospace', color: color || T.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted }}>{sub}</div>}
    </div>
  );
}

function HourHeatmap({ grid, rawHours }: { grid: number[], rawHours: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const labels = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];
  
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 36, position: 'relative' }}>
        {grid.map((v, i) => {
          const hrLabel = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`;
          const tipStyle: React.CSSProperties = { position: 'absolute', bottom: '100%', marginBottom: 8, background: T.surface, border: `1px solid ${T.borderHi}`, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', zIndex: 10, boxShadow: `0 8px 24px rgba(0,0,0,0.6)`, pointerEvents: 'none', ...(i < 3 ? { left: 0 } : i > 20 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }) };
          
          return (
            <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
              {hover === i && <div style={tipStyle}>{hrLabel}: <span style={{ color: T.accent }}>{Math.round(rawHours[i])}m</span></div>}
              <div style={{ width: '100%', borderRadius: 2, height: v === 0 ? 3 : 4 + v * 6, background: v === 0 ? T.border : v <= 2 ? `color-mix(in srgb, var(--accent) 40%, transparent)` : v <= 4 ? `color-mix(in srgb, var(--accent) 70%, transparent)` : T.accent, transition: 'height 0.4s ease' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {labels.map(l => <span key={l} style={{ fontSize: 9, color: T.dim, fontFamily: 'monospace' }}>{l}</span>)}
      </div>
    </div>
  );
}

function WeekBars({ history }: { history: SessionLog[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mon = getWeekMonday(new Date());
  const dMap: Record<string, number> = {};
  history.forEach(h => { const d = new Date(h.date).toLocaleDateString(); dMap[d] = (dMap[d] || 0) + h.workMins; });
  const vals = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return dMap[d.toLocaleDateString()] || 0; });
  const max = Math.max(1, ...vals);
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60, position: 'relative' }}>
      {vals.map((v, i) => {
        const tipStyle: React.CSSProperties = { position: 'absolute', bottom: '100%', marginBottom: 8, background: T.surface, border: `1px solid ${T.borderHi}`, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', zIndex: 10, boxShadow: `0 8px 24px rgba(0,0,0,0.6)`, pointerEvents: 'none', ...(i === 0 ? { left: 0 } : i === 6 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }) };
        
        return (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            {hover === i && <div style={tipStyle}>{days[i]}: <span style={{ color: T.accent }}>{v > 0 ? Math.round(v) + 'm' : 'Rest'}</span></div>}
            <div style={{ width: '100%', borderRadius: 3, height: v === 0 ? 3 : Math.max(4, (v / max) * 48), background: i === todayIdx ? T.accent : v > 0 ? `color-mix(in srgb, var(--accent) 55%, transparent)` : T.border, boxShadow: i === todayIdx && v > 0 ? `0 0 8px ${T.accentGlow}` : 'none', transition: 'height 0.5s ease' }} />
            <span style={{ fontSize: 9, color: i === todayIdx ? T.accent : T.dim, fontFamily: 'monospace', fontWeight: i === todayIdx ? 700 : 400 }}>{days[i][0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function SessionRow({ log, onView }: { log: SessionLog, onView: (l: SessionLog) => void }) {
  const date = new Date(log.startTs * 1000);
  const stars = log.flowRating || 0;
  return (
    <div onClick={() => onView(log)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s', borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--text-main) 5%, transparent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div style={{ width: 3, height: 32, borderRadius: 2, background: log.isContest ? T.blue : log.type === 'RETROACTIVE RECON' ? T.purple : T.accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.intent || 'Free Grind'}</div>
        <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', marginTop: 2 }}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: log.isContest ? T.blue : T.accent }}>{Math.round(log.workMins)}m</div><div style={{ fontSize: 10, color: T.muted }}>{log.problemsSolved} ACs</div></div>
        {stars > 0 && <div style={{ display: 'flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 9, color: n <= stars ? (log.isContest ? T.blue : T.accent) : T.dim }}>★</span>)}</div>}
        <span style={{ fontSize: 10, color: T.dim }}>▶</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GrindMode({ handle }: { handle: string }) {
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [viewingSession, setViewingSession] = useState<SessionLog | null>(null);
  const [workSecs, setWorkSecs] = useState(0);
  const [restSecs, setRestSecs] = useState(0);
  const [targetRest, setTargetRest] = useState(0);
  const [intent, setIntent] = useState('');
  const [plannedMins, setPlannedMins] = useState('');
  const [flowRating, setFlowRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [hoverBucket, setHoverBucket] = useState<string | null>(null);
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
  const [untrackedContests, setUntrackedContests] = useState<any[]>([]);
  const [wrActiveTab, setWrActiveTab] = useState(0);
  const [activeIdleTab, setActiveIdleTab] = useState<'tasks' | 'history'>('tasks');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);
  
  const historyRef = useRef<SessionLog[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    try { const h = localStorage.getItem('cf_grind_v4'); if (h) setHistory(JSON.parse(h)); } catch {}
    try { const t = localStorage.getItem('cf_grind_tasks_v4'); if (t) setTasks(JSON.parse(t)); } catch {}
    try { const tp = localStorage.getItem('cf_grind_tmr'); if (tp) setTmrPlan(JSON.parse(tp)); } catch {}
    try { const tg = localStorage.getItem('cf_grind_target'); if (tg) setTargetHrs(parseInt(tg)); } catch {}
    const style = document.createElement('style');
    style.id = 'grind-ring-css';
    style.textContent = `@keyframes grindRingSpin { 100% { transform: rotate(360deg); } } @keyframes pulseRing { 0%, 100% { transform: scale(0.98); opacity: 0.6; } 50% { transform: scale(1.02); opacity: 1; } } @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } } @keyframes pulse-dot { 0%,100%{opacity:1;} 50%{opacity:0.3;} } @keyframes pulseLog { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-ac, #2ea043) 40%, transparent); } 70% { box-shadow: 0 0 0 12px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }`;
    if (!document.getElementById('grind-ring-css')) document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!handle || phase !== 'IDLE') return;
    let isActive = true;
    const checkForRogues = async () => {
      try {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=50`);
        const data = await res.json();
        if (!isActive) return;

        if (data.status === 'OK') {
          const now = Date.now() / 1000;
          const dismissedRogues = JSON.parse(localStorage.getItem('cf_grind_dismissed') || '[]');
          const liveHistory = historyRef.current;

          // 1. Standard Practice Rogues
          const practiceSubs = data.result.filter((s: any) => s.verdict === 'OK' && s.author.participantType === 'PRACTICE' && (now - s.creationTimeSeconds) < 86400 * 2);
          const missingPractice = practiceSubs.filter((s: any) => {
            const pid = s.problem ? `${s.problem.contestId}-${s.problem.index}` : '';
            if (!pid || dismissedRogues.includes(pid)) return false;
            const alreadyLogged = liveHistory.some(h => h.details && h.details.some(d => d.pid === pid));
            if (alreadyLogged) return false;
            const inTimeWindow = liveHistory.some(h => s.creationTimeSeconds >= (h.startTs - 1200) && s.creationTimeSeconds <= (h.endTs + 1200));
            return !inTimeWindow;
          });
          setRogueACs(missingPractice);

          // 2. Untracked Contests (Live, Virtual, Out of Comp)
          const contestSubs = data.result.filter((s: any) => 
            (s.author.participantType === 'CONTESTANT' || s.author.participantType === 'VIRTUAL' || s.author.participantType === 'OUT_OF_COMPETITION') && 
            (now - s.creationTimeSeconds) < 86400 * 7 // Look back a week for contests
          );

          const contestsMap = new Map();
          contestSubs.forEach((s: any) => {
            const cid = s.problem.contestId;
            if (dismissedRogues.includes(`contest-${cid}`)) return;
            // Check if we already logged this contest
            if (liveHistory.some(h => h.contestId === cid)) return;

            if (!contestsMap.has(cid)) {
              contestsMap.set(cid, {
                contestId: cid,
                type: s.author.participantType,
                startTimeSeconds: s.author.startTimeSeconds || (s.creationTimeSeconds - 7200), // Fallback
                subs: []
              });
            }
            if (s.verdict === 'OK') contestsMap.get(cid).subs.push(s);
          });

          // Fetch rating changes if there are live contests
          const pendingContests = Array.from(contestsMap.values());
          for (const c of pendingContests) {
             if (c.type === 'CONTESTANT') {
                try {
                   const rRes = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
                   const rData = await rRes.json();
                   if (rData.status === 'OK') {
                      const change = rData.result.find((r: any) => r.contestId === c.contestId);
                      if (change) {
                         c.ratingChange = change.newRating - change.oldRating;
                         c.oldRating = change.oldRating;
                         c.newRating = change.newRating;
                         c.rank = change.rank;
                      }
                   }
                } catch(e) {}
             }
          }
          setUntrackedContests(pendingContests);
        }
      } catch {}
    };
    checkForRogues();
    return () => { isActive = false; };
  }, [handle, phase]);

  const dismissRogues = useCallback(() => {
    try {
      const existing = JSON.parse(localStorage.getItem('cf_grind_dismissed') || '[]');
      const toDismiss = rogueACs.map(s => s.problem ? `${s.problem.contestId}-${s.problem.index}` : '').filter(Boolean);
      localStorage.setItem('cf_grind_dismissed', JSON.stringify([...existing, ...toDismiss]));
    } catch {}
    setRogueACs([]);
  }, [rogueACs]);

  const logUntrackedContest = useCallback((contest: any) => {
    const details: ProbDetail[] = contest.subs.map((s: any) => ({
      pid: `${s.problem.contestId}-${s.problem.index}`,
      name: s.problem.name,
      index: s.problem.index,
      timeTakenSecs: s.creationTimeSeconds - contest.startTimeSeconds,
      rating: s.problem.rating || 0
    })).sort((a: any, b: any) => a.timeTakenSecs - b.timeTakenSecs);

    const pts = details.reduce((sum, d) => sum + (CF_SCORE_MAP[d.rating ? Math.floor(d.rating / 100) * 100 : 800] || 10), 0);
    const durationMins = details.length > 0 ? Math.ceil(details[details.length - 1].timeTakenSecs / 60) : 120;
    
    const typeLabel = contest.type === 'CONTESTANT' ? 'LIVE CONTEST' : contest.type === 'VIRTUAL' ? 'VIRTUAL CONTEST' : 'OUT OF COMP';

    const report: SessionLog = {
      id: `contest-${contest.contestId}`, 
      date: new Date(contest.startTimeSeconds * 1000).toISOString(), 
      startTs: contest.startTimeSeconds, 
      endTs: contest.startTimeSeconds + (durationMins * 60),
      workMins: durationMins, 
      problemsSolved: details.length, 
      pointsEarned: pts, 
      type: typeLabel,
      avgTimeSecs: details.length > 0 ? Math.round(details.reduce((a, p) => a + p.timeTakenSecs, 0) / details.length) : 0, 
      details, 
      flowRating: 5, 
      intent: `Codeforces Round #${contest.contestId}`, 
      breakCount: 0,
      isContest: true,
      contestId: contest.contestId,
      contestType: contest.type,
      ratingChange: contest.ratingChange,
      oldRating: contest.oldRating,
      newRating: contest.newRating,
      rank: contest.rank
    };

    saveHistory([report, ...history].sort((a, b) => b.endTs - a.endTs)); 
    setUntrackedContests(prev => prev.filter(c => c.contestId !== contest.contestId));
  }, [history]);

  const dismissContest = useCallback((cid: number) => {
    try {
      const existing = JSON.parse(localStorage.getItem('cf_grind_dismissed') || '[]');
      localStorage.setItem('cf_grind_dismissed', JSON.stringify([...existing, `contest-${cid}`]));
      setUntrackedContests(prev => prev.filter(c => c.contestId !== cid));
    } catch {}
  }, []);

  const saveTasks = useCallback((t: GrindTask[]) => { setTasks(t); try { localStorage.setItem('cf_grind_tasks_v4', JSON.stringify(t)); } catch {} }, []);
  const saveHistory = useCallback((h: SessionLog[]) => { setHistory(h); try { localStorage.setItem('cf_grind_v4', JSON.stringify(h)); } catch {} }, []);
  const saveTmrPlan = useCallback((tp: TmrPlan[]) => { setTmrPlan(tp); try { localStorage.setItem('cf_grind_tmr', JSON.stringify(tp)); } catch {} }, []);

  const startTick = useCallback((field: 'work' | 'rest') => {
    if (timerRef.current) clearInterval(timerRef.current);
    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const delta = Math.floor((Date.now() - lastTickRef.current) / 1000);
      if (delta >= 1) {
        lastTickRef.current += delta * 1000;
        if (field === 'work') setWorkSecs(p => p + delta);
        else setRestSecs(p => { if (p - delta <= 0) { if (timerRef.current) clearInterval(timerRef.current); return 0; } return p - delta; });
      }
    }, 500);
  }, []);

  const startFlow = useCallback(() => {
    if (phase === 'IDLE' || phase === 'INTENT') { setSessionStartTS(Date.now() / 1000); setWorkSecs(0); setBreakCount(0); }
    setPhase('FLOW'); startTick('work');
  }, [phase, startTick]);

  const initiateRest = useCallback(() => {
    let shiftTotalSec = parseInt(localStorage.getItem('cf_grind_shiftTotal') || '0');
    let lastEnd = parseInt(localStorage.getItem('cf_grind_lastEnd') || '0');
    if (Date.now() - lastEnd > 7200000) shiftTotalSec = 0;
    shiftTotalSec += workSecs;
    localStorage.setItem('cf_grind_shiftTotal', shiftTotalSec.toString());
    localStorage.setItem('cf_grind_lastEnd', Date.now().toString());

    const shiftHours = shiftTotalSec / 3600;
    const volMult = 1 + (0.15 * Math.max(0, shiftHours - 4));
    const hour = new Date().getHours();
    let circMult = 1.0;
    if (hour >= 22 || hour < 2) circMult = 1.2; else if (hour >= 2 && hour < 6) circMult = 1.5; else if (hour >= 6 && hour < 8) circMult = 1.15;
    
    const rec = Math.max(60, Math.min(Math.floor((workSecs / 5) * volMult * circMult * 1.25), 2700));
    setTargetRest(rec); setRestSecs(rec); setBreakCount(b => b + 1); setPhase('REST'); startTick('rest');
  }, [workSecs, startTick]);

  const resumeFlow = useCallback(() => { setPhase('FLOW'); startTick('work'); }, [startTick]);

  const terminate = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('RATE'); setSyncing(true); setHoverRating(0);
    let points = 0; const details: ProbDetail[] = [];
    try {
      if (sessionStartTS && handle) {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=100`);
        const data = await res.json();
        if (data.status === 'OK') {
          const subs = data.result.filter((s: any) => s.creationTimeSeconds >= sessionStartTS).reverse();
          let mark = sessionStartTS; const seen = new Set<string>();
          subs.forEach((s: any) => {
            if (s.verdict === 'OK' && s.problem && s.author.participantType === 'PRACTICE') {
              const pid = `${s.problem.contestId}-${s.problem.index}`;
              if (!seen.has(pid)) {
                seen.add(pid);
                const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
                points += CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;
                details.push({ pid, name: s.problem.name, index: s.problem.index, timeTakenSecs: s.creationTimeSeconds - mark, rating: s.problem.rating || 800 });
                mark = s.creationTimeSeconds;
              }
            }
          });
        }
      }
    } catch {}
    const avg = details.length > 0 ? Math.round(details.reduce((a, p) => a + p.timeTakenSecs, 0) / details.length) : 0;
    const report: SessionLog = {
      id: Date.now().toString(), date: new Date().toISOString(), startTs: sessionStartTS || (Date.now() / 1000 - workSecs), endTs: Date.now() / 1000,
      workMins: parseFloat((workSecs / 60).toFixed(1)), problemsSolved: details.length, pointsEarned: points, type: 'PRACTICE GRIND',
      avgTimeSecs: avg, details, flowRating: 0, intent: intent || undefined, plannedMins: parseInt(plannedMins) || undefined, breakCount,
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
    const details = rogueACs.map(s => ({ pid: `${s.problem.contestId}-${s.problem.index}`, name: s.problem.name, index: s.problem.index, timeTakenSecs: 0, rating: s.problem.rating || 800 }));
    const assumedMins = rogueACs.length * 20; const ts = rogueACs[rogueACs.length - 1].creationTimeSeconds;
    const report: SessionLog = {
      id: Date.now().toString(), date: new Date(ts * 1000).toISOString(), startTs: ts - (assumedMins * 60), endTs: ts,
      workMins: assumedMins, problemsSolved: rogueACs.length, pointsEarned: pts, type: 'RETROACTIVE RECON',
      avgTimeSecs: 0, details, flowRating: 3, intent: 'Logged retroactively', breakCount: 0,
    };
    saveHistory([report, ...history].sort((a, b) => b.endTs - a.endTs)); setRogueACs([]);
  };

  const { totalMins, todayMins, streak, weekSecs, peakGrid, rawHours, weeklyReviews } = useMemo(() => {
    let tMins = 0, tdyMins = 0; const dMap: Record<string, number> = {}; const hSecs = new Array(24).fill(0);
    const now = new Date(), todayStr = now.toLocaleDateString(), mon = getWeekMonday(now);
    history.forEach(h => {
      tMins += h.workMins; const dStr = new Date(h.date).toLocaleDateString();
      if (dStr === todayStr) tdyMins += h.workMins;
      dMap[dStr] = (dMap[dStr] || 0) + h.workMins;
      hSecs[new Date(h.startTs * 1000).getHours()] += h.workMins;
    });
    let s = 0, c = new Date();
    while (true) { if (dMap[c.toLocaleDateString()] > 0) s++; else if (c.toLocaleDateString() !== todayStr) break; c.setDate(c.getDate() - 1); }
    let wSecs = 0; for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(d.getDate() + i); wSecs += (dMap[d.toLocaleDateString()] || 0) * 60; }
    const reviews = [];
    for (let w = 0; w < 4; w++) {
      const wMon = new Date(mon); wMon.setDate(wMon.getDate() - w * 7); const wSun = new Date(wMon); wSun.setDate(wSun.getDate() + 6);
      let wTotal = 0, wAcs = 0, maxD = 0, activeD = 0;
      for (let i = 0; i < 7; i++) { const d = new Date(wMon); d.setDate(d.getDate() + i); const dStr = d.toLocaleDateString(); if (dMap[dStr] > 0) { wTotal += dMap[dStr]; activeD++; if (dMap[dStr] > maxD) maxD = dMap[dStr]; } }
      history.filter(h => { const d = new Date(h.date); return d >= wMon && d <= wSun; }).forEach(h => wAcs += h.problemsSolved);
      reviews.push({ label: w === 0 ? 'This Week' : `${wMon.getDate()}/${wMon.getMonth() + 1}`, total: wTotal, acs: wAcs, maxD, activeD });
    }
    const maxH = Math.max(1, ...hSecs);
    return { totalMins: tMins, todayMins: tdyMins, streak: s, weekSecs: wSecs, peakGrid: hSecs.map(sec => sec === 0 ? 0 : Math.ceil((sec / maxH) * 5)), rawHours: hSecs, weeklyReviews: reviews };
  }, [history]);
  const weekPct = Math.min(100, Math.round((weekSecs / (targetHrs * 3600)) * 100));

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: INTENT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'INTENT') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--bg-base) 96%, transparent)', backdropFilter: 'blur(12px)', padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 460, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: 36, boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${T.border}`, animation: 'fadeSlideUp 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentDim, border: `1px solid color-mix(in srgb, var(--accent) 40%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div><div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent }}>Pre-Session Brief</div><div style={{ fontSize: 18, fontWeight: 900, color: T.text, marginTop: 1 }}>Set your target</div></div></div>
        <div style={{ marginBottom: 16 }}><label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 8 }}>Session intent</label><input value={intent} onChange={e => setIntent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') startFlow(); if (e.key === 'Escape') setPhase('IDLE'); }} placeholder="e.g. Clear 3 Div2 D's…" autoFocus style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, color: T.text, background: 'color-mix(in srgb, var(--bg-base) 40%, transparent)', border: `1px solid ${T.borderHi}`, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.borderHi} /></div>
        <div style={{ marginBottom: 28 }}><label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, display: 'block', marginBottom: 8 }}>Planned duration</label><div style={{ display: 'flex', gap: 8 }}>{[60, 90, 120].map(m => (<button key={m} onClick={() => setPlannedMins(String(m))} style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: plannedMins === String(m) ? T.accentDim : 'color-mix(in srgb, var(--bg-base) 40%, transparent)', border: `1px solid ${plannedMins === String(m) ? T.accent : T.border}`, color: plannedMins === String(m) ? T.accent : T.muted }}>{m}m</button>))}<input type="number" placeholder="custom" value={[60, 90, 120].includes(Number(plannedMins)) ? '' : plannedMins} onChange={e => setPlannedMins(e.target.value)} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: 12, textAlign: 'center', background: 'color-mix(in srgb, var(--bg-base) 40%, transparent)', border: `1px solid ${T.border}`, color: T.text, outline: 'none' }} /></div></div>
        {tmrPlan.length > 0 && (<div style={{ marginBottom: 24, padding: '12px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}` }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Today's priorities</div>{tmrPlan.map((t, i) => (<div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}><span style={{ fontSize: 10, fontFamily: 'monospace', color: T.accent, minWidth: 14 }}>{i + 1}.</span><span style={{ fontSize: 12, color: T.text }}>{t.text}</span></div>))}</div>)}
        <div style={{ display: 'flex', gap: 10 }}><button onClick={() => setPhase('IDLE')} style={{ padding: '13px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, transition: 'all 0.15s', letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.text; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>Abort</button><button onClick={startFlow} style={{ flex: 1, padding: '13px 0', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: 'pointer', background: T.accent, border: 'none', color: T.bg, letterSpacing: '2px', textTransform: 'uppercase', boxShadow: `0 4px 20px ${T.accentGlow}`, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${T.accentGlow}`; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${T.accentGlow}`; }}>⚡ Engage</button></div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: FLOW / REST
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'FLOW' || phase === 'REST') {
    const isFlow = phase === 'FLOW'; const accent = isFlow ? T.accent : T.blue;
    const restPct = targetRest > 0 ? Math.min(100, Math.round(((targetRest - restSecs) / targetRest) * 100)) : 0;
    const pinned = tasks.find(t => t.pinned && !t.done);
    const todayACs = history.filter(h => new Date(h.date).toLocaleDateString() === new Date().toLocaleDateString()).reduce((a, h) => a + h.problemsSolved, 0);

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', fontFamily: 'sans-serif', overflow: 'hidden', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: `1px solid ${T.border}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'pulse-dot 2s ease-in-out infinite' }} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: accent }}>{isFlow ? 'Flow State Active' : 'Recovery Protocol'}</span></div><div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>{intent && <span style={{ fontSize: 11, color: T.muted, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {intent}</span>}<div style={{ display: 'flex', gap: 16 }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.dim }}>breaks</div><div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: T.muted }}>{breakCount}</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: T.dim }}>today ACs</div><div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: T.green }}>{todayACs}</div></div></div></div></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 }}>
          <div style={{ position: 'relative', width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FlowRing phase={phase} targetRest={targetRest} restSecs={restSecs} /><div style={{ zIndex: 10, textAlign: 'center' }}><div style={{ fontSize: '5.5rem', fontFamily: 'monospace', fontWeight: 200, lineHeight: 1, color: accent, letterSpacing: '-3px', textShadow: `0 0 30px color-mix(in srgb, var(--accent) 40%, transparent)`, transition: 'color 0.7s ease' }}>{isFlow ? fmt(workSecs) : fmt(restSecs)}</div>{!isFlow && targetRest > 0 && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: accent }}>{restSecs === 0 ? 'Ready' : `${Math.round((restSecs / targetRest) * 100)}% remaining`}</div>}{isFlow && plannedMins && (<div style={{ marginTop: 8 }}><div style={{ fontSize: 10, color: T.dim, marginBottom: 4, letterSpacing: '1px' }}>target</div><MiniBar value={workSecs / 60} max={Number(plannedMins)} color={T.accent} /><div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontFamily: 'monospace' }}>{Math.round(workSecs / 60)}/{plannedMins}m</div></div>)}</div></div>
          {isFlow && pinned && (<div style={{ width: '100%', maxWidth: 520, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, background: `color-mix(in srgb, var(--accent) 5%, transparent)`, border: `1px solid color-mix(in srgb, var(--accent) 30%, transparent)` }}><div style={{ width: 3, height: 36, borderRadius: 2, background: accent, flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: accent, marginBottom: 3 }}>Locked On</div><div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{pinned.text}</div>{pinned.estMins && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>est. {pinned.estMins}m</div>}</div><button onClick={() => saveTasks(tasks.map(t => t.id === pinned.id ? { ...t, done: true } : t))} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${accent}`, color: accent, letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, var(--accent) 20%, transparent)`; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>Done ✓</button></div>)}
          {!isFlow && targetRest > 0 && (<div style={{ width: '100%', maxWidth: 520 }}><div style={{ height: 4, background: T.border, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', background: T.blue, borderRadius: 4, width: `${restPct}%`, transition: 'width 1s ease', boxShadow: `0 0 12px color-mix(in srgb, var(--blue) 60%, transparent)` }} /></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: T.muted, fontFamily: 'monospace' }}><span>{fmt(targetRest - restSecs)} elapsed</span><span>{fmt(targetRest)} target</span></div></div>)}
        </div>
        <div style={{ padding: '20px 28px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 12, justifyContent: 'center' }}>
          {isFlow ? (<button onClick={initiateRest} style={{ padding: '12px 28px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T.blueDim, border: `1px solid color-mix(in srgb, var(--blue) 50%, transparent)`, color: T.blue, letterSpacing: '1.5px', textTransform: 'uppercase', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, var(--blue) 25%, transparent)`; e.currentTarget.style.borderColor = T.blue; }} onMouseLeave={e => { e.currentTarget.style.background = T.blueDim; e.currentTarget.style.borderColor = `color-mix(in srgb, var(--blue) 50%, transparent)`; }}>⏸ Rest</button>) : (<button onClick={resumeFlow} style={{ padding: '12px 28px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T.accentDim, border: `1px solid color-mix(in srgb, var(--accent) 50%, transparent)`, color: T.accent, letterSpacing: '1.5px', textTransform: 'uppercase', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, var(--accent) 25%, transparent)`; e.currentTarget.style.borderColor = T.accent; }} onMouseLeave={e => { e.currentTarget.style.background = T.accentDim; e.currentTarget.style.borderColor = `color-mix(in srgb, var(--accent) 50%, transparent)`; }}>⚡ Resume</button>)}
          <button onClick={terminate} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, letterSpacing: '1.5px', textTransform: 'uppercase', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.color = T.red; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>■ Extract</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RATE OR VIEWING A PAST SESSION
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'RATE' || viewingSession !== null) {
    // ── Update Missing Problem Ratings Automatically ──
    useEffect(() => {
      if (viewingSession && viewingSession.isContest) {
         const hasMissingRatings = viewingSession.details.some(d => !d.rating || d.rating === 0);
         if (hasMissingRatings) {
            fetch(`https://codeforces.com/api/contest.status?contestId=${viewingSession.contestId}&handle=${handle}&from=1&count=50`)
              .then(res => res.json())
              .then(data => {
                 if (data.status === 'OK') {
                    let updated = false;
                    const newDetails = viewingSession.details.map(d => {
                       const sub = data.result.find((s: any) => s.verdict === 'OK' && s.problem.index === d.index);
                       if (sub && sub.problem.rating && (!d.rating || d.rating === 0)) {
                          updated = true;
                          return { ...d, rating: sub.problem.rating };
                       }
                       return d;
                    });
                    if (updated) {
                       const updatedSession = { ...viewingSession, details: newDetails };
                       setViewingSession(updatedSession);
                       saveHistory(history.map(h => h.id === updatedSession.id ? updatedSession : h));
                    }
                 }
              }).catch(() => {});
         }
      }
   }, [viewingSession, handle, history, saveHistory]);

    const isRate = phase === 'RATE'; const r = isRate ? lastReport : viewingSession; const solvedDetails = r?.details ?? [];
    const focusMins = r ? Math.round(r.workMins) : 0;
    const eff = focusMins > 0 && (r?.problemsSolved || 0) > 0 ? Math.round(focusMins / r!.problemsSolved) : 0;
    const xpPerHour = focusMins > 0 ? Math.round(((r?.pointsEarned || 0) / focusMins) * 60) : 0;
    const acRate = focusMins > 0 ? parseFloat(((r?.problemsSolved || 0) / (focusMins / 60)).toFixed(1)) : 0;
    
    const ratedProblems = solvedDetails.filter(d => d.rating > 0);
    const avgRating = ratedProblems.length > 0 ? Math.round(ratedProblems.reduce((a, d) => a + d.rating, 0) / ratedProblems.length) : 0;
    const maxRating = ratedProblems.length > 0 ? Math.max(...ratedProblems.map(d => d.rating)) : 0;
    const minRating = ratedProblems.length > 0 ? Math.min(...ratedProblems.map(d => d.rating)) : 0;
    
    const timedProblems = solvedDetails.filter(d => d.timeTakenSecs > 30);
    const avgTimeSecs = timedProblems.length > 0 ? Math.round(timedProblems.reduce((a, d) => a + d.timeTakenSecs, 0) / timedProblems.length) : 0;
    const maxTimeSecs = timedProblems.length > 0 ? Math.max(...timedProblems.map(d => d.timeTakenSecs)) : 0;
    const minTimeSecs = timedProblems.length > 0 ? Math.min(...timedProblems.map(d => d.timeTakenSecs)) : 0;
    const fastestProblem = timedProblems.find(d => d.timeTakenSecs === minTimeSecs);
    const slowestProblem = timedProblems.find(d => d.timeTakenSecs === maxTimeSecs);
    
    const plannedM = r?.plannedMins ?? 0;
    const planAccuracy = plannedM > 0 ? Math.min(200, Math.round((focusMins / plannedM) * 100)) : null;

    const ratingBuckets: Record<number, number> = {};
    ratedProblems.forEach(d => { const bucket = Math.floor(d.rating / 100) * 100; ratingBuckets[bucket] = (ratingBuckets[bucket] || 0) + 1; });
    const bucketEntries = Object.entries(ratingBuckets).sort((a, b) => Number(a[0]) - Number(b[0]));
    const maxBucketCount = Math.max(1, ...Object.values(ratingBuckets), 1);
    const ratingColor = (rt: number) => rt >= 2400 ? '#ff0000' : rt >= 2100 ? '#ff8c00' : rt >= 1900 ? '#aa00aa' : rt >= 1600 ? '#0000ff' : rt >= 1400 ? '#03a89e' : rt >= 1200 ? T.green : T.muted;

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'stretch', background: 'var(--bg-base)', fontFamily: 'sans-serif', overflow: 'hidden' }}>
        
        <div style={{ width: 280, flexShrink: 0, background: `linear-gradient(160deg, ${T.surface} 0%, var(--bg-base) 100%)`, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', padding: 32 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isRate ? T.green : (r?.isContest ? T.blue : T.accent), boxShadow: `0 0 12px ${isRate ? T.green : (r?.isContest ? T.blue : T.accent)}` }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: isRate ? T.green : (r?.isContest ? T.blue : T.accent) }}>{isRate ? 'Extraction Complete' : 'Session Record'}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: T.text, lineHeight: 1.1, letterSpacing: '-0.5px' }}>Session<br/>Debrief</div>
            {r?.intent && <div style={{ marginTop: 10, fontSize: 12, color: T.muted, fontStyle: 'italic', borderLeft: `2px solid ${T.borderHi}`, paddingLeft: 10 }}>"{r.intent}"</div>}
            {!isRate && r && <div style={{ marginTop: 8, fontSize: 11, color: T.dim, fontFamily: 'monospace' }}>{new Date(r.startTs * 1000).toLocaleDateString()}</div>}
          </div>

          {syncing ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, marginBottom: 12 }}>⚙️</div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>Syncing…</div></div></div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                {[
                  { l: r?.isContest ? 'Duration' : 'Focus Time', v: `${focusMins}m`, sub: plannedM > 0 ? `of ${plannedM}m planned` : undefined, c: r?.isContest ? T.blue : T.accent },
                  { l: 'Problems AC\'d', v: String(r?.problemsSolved ?? 0), sub: (r?.problemsSolved ?? 0) > 0 ? `${acRate}/hr rate` : 'none this session', c: T.green },
                  { l: 'XP Earned', v: `+${r?.pointsEarned ?? 0}`, sub: xpPerHour > 0 ? `${xpPerHour} xp/hr` : undefined, c: T.text },
                ].map(s => (
                  <div key={s.l} style={{ padding: '14px 16px', borderRadius: 12, background: 'color-mix(in srgb, var(--bg-base) 40%, transparent)', border: `1px solid ${T.border}`, transition: 'transform 0.2s, background 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--text-main) 5%, transparent)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-base) 40%, transparent)'; }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', color: s.c, lineHeight: 1 }}>{s.v}</div>
                    {s.sub && <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>{s.sub}</div>}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Flow Rating</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const active = isRate ? n <= (hoverRating || flowRating) : n <= (r?.flowRating || 0);
                    const color = r?.isContest ? T.blue : T.accent;
                    return (
                      <button key={n} onClick={() => isRate && setFlowRating(n)} onMouseEnter={() => isRate && setHoverRating(n)} onMouseLeave={() => isRate && setHoverRating(0)} style={{
                        fontSize: 28, background: 'transparent', border: 'none', cursor: isRate ? 'pointer' : 'default', padding: 0,
                        transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        transform: active ? 'scale(1.25)' : 'scale(1)', filter: active ? `drop-shadow(0 0 8px ${color})` : 'none',
                        opacity: active ? 1 : 0.2, color,
                      }}>★</button>
                    )
                  })}
                </div>
              </div>

              {isRate ? (
                <button onClick={confirmRate} style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 13, fontWeight: 900, cursor: 'pointer', background: T.green, border: 'none', color: 'var(--bg-base)', letterSpacing: '2px', textTransform: 'uppercase', boxShadow: `0 4px 16px ${T.greenDim}`, transition: 'all 0.2s', marginTop: 'auto', animation: 'pulseLog 2s infinite' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.filter = 'brightness(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'brightness(1)'; }}>Log Session →</button>
              ) : (
                <button onClick={() => setViewingSession(null)} style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 13, fontWeight: 900, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.borderHi}`, color: T.muted, letterSpacing: '2px', textTransform: 'uppercase', transition: 'all 0.2s', marginTop: 'auto' }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.muted; }}>Close Briefing ✕</button>
              )}
            </>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {syncing ? null : (
            <>
              {r?.isContest && (
                <div>
                  <SectionLabel>Contest Performance</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <MiniStatCard label="Contest Type" value={r.contestType === 'CONTESTANT' ? 'LIVE' : r.contestType === 'VIRTUAL' ? 'VIRTUAL' : 'OUT OF COMP'} color={r.contestType === 'CONTESTANT' ? T.accent : T.blue} />
                    <MiniStatCard label="Problems Solved" value={`${r.problemsSolved}`} color={T.green} />
                    {r.rank && <MiniStatCard label="Rank" value={`#${r.rank}`} color={T.text} icon="🏆" />}
                    {r.ratingChange !== undefined ? (
                      <MiniStatCard 
                        label="Rating Change" 
                        value={`${r.ratingChange > 0 ? '+' : ''}${r.ratingChange}`} 
                        sub={`${r.oldRating} → ${r.newRating}`}
                        color={r.ratingChange > 0 ? T.green : r.ratingChange < 0 ? T.red : T.muted} 
                        icon={r.ratingChange > 0 ? '▲' : r.ratingChange < 0 ? '▼' : '—'} 
                      />
                    ) : (
                      <MiniStatCard label="Rating Change" value="N/A" sub="Unrated/Virtual" color={T.muted} />
                    )}
                  </div>
                </div>
              )}

              <div>
                <SectionLabel>Time & Pace</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <MiniStatCard label="Avg Time/Prob" value={avgTimeSecs > 0 ? fmtSecs(avgTimeSecs) : '—'} color={T.accent} icon="⏱" />
                  <MiniStatCard label="Fastest Solve" value={minTimeSecs > 0 ? fmtSecs(minTimeSecs) : '—'} sub={fastestProblem?.name.slice(0, 14)} color={T.green} icon="⚡" />
                  <MiniStatCard label="Slowest Solve" value={maxTimeSecs > 0 ? fmtSecs(maxTimeSecs) : '—'} sub={slowestProblem?.name.slice(0, 14)} color={T.red} icon="🐢" />
                  <MiniStatCard label="Mins/Problem" value={eff > 0 ? `${eff}m` : '—'} sub="focus efficiency" color={T.blue} icon="📐" />
                </div>
              </div>

              <div>
                <SectionLabel>Rating Breakdown</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <MiniStatCard label="Avg Rating" value={avgRating > 0 ? String(avgRating) : '—'} color={ratingColor(avgRating)} icon="★" />
                  <MiniStatCard label="Hardest AC" value={maxRating > 0 ? String(maxRating) : '—'} color={ratingColor(maxRating)} icon="🏆" />
                  <MiniStatCard label="Easiest AC" value={minRating > 0 ? String(minRating) : '—'} color={ratingColor(minRating)} icon="✓" />
                  <MiniStatCard label="Rated Solved" value={`${ratedProblems.length}/${solvedDetails.length}`} color={T.muted} icon="📊" />
                </div>
                {bucketEntries.length > 0 && (
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, marginBottom: 12 }}>Distribution</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 52, position: 'relative' }}>
                      {bucketEntries.map(([bucket, count]) => (
                        <div key={bucket} onMouseEnter={() => setHoverBucket(bucket)} onMouseLeave={() => setHoverBucket(null)} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          {hoverBucket === bucket && (
                            <div style={{ position: 'absolute', bottom: '100%', marginBottom: 8, background: T.surface, border: `1px solid ${ratingColor(Number(bucket))}`, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', zIndex: 10, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                              Rating {bucket}: <span style={{ color: ratingColor(Number(bucket)) }}>{count} problems</span>
                            </div>
                          )}
                          <div style={{ width: '100%', borderRadius: 3, height: Math.max(4, (count / maxBucketCount) * 40), background: ratingColor(Number(bucket)), opacity: hoverBucket === bucket ? 1 : 0.85, transition: 'all 0.2s' }} />
                          <span style={{ fontSize: 9, color: T.dim, fontFamily: 'monospace' }}>{bucket}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!r?.isContest && (
                <div>
                  <SectionLabel>Session Health</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <MiniStatCard label="Breaks Taken" value={String(r?.breakCount ?? 0)} sub={r && r.breakCount > 3 ? 'consider fewer' : 'solid focus'} color={r && (r.breakCount ?? 0) > 3 ? T.red : T.green} icon="⏸" />
                    <MiniStatCard label="Plan Accuracy" value={planAccuracy !== null ? `${planAccuracy}%` : '—'} sub={planAccuracy !== null ? (planAccuracy > 110 ? 'overran' : planAccuracy < 80 ? 'underran' : 'on target') : 'no plan set'} color={planAccuracy !== null ? (planAccuracy >= 80 && planAccuracy <= 110 ? T.green : T.accent) : T.dim} icon="🎯" />
                    <MiniStatCard label="XP / Hour" value={xpPerHour > 0 ? String(xpPerHour) : '—'} sub="grind intensity" color={xpPerHour > 80 ? T.green : xpPerHour > 40 ? T.accent : T.muted} icon="⚡" />
                    <MiniStatCard label="AC Rate" value={acRate > 0 ? `${acRate}/hr` : '—'} sub="problems per hour" color={acRate >= 2 ? T.green : acRate >= 1 ? T.accent : T.muted} icon="📈" />
                  </div>
                </div>
              )}

              {solvedDetails.length > 0 && (
                <div>
                  <SectionLabel>{r?.isContest ? 'Solve Progression' : 'Problem Log'}</SectionLabel>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}`, background: 'color-mix(in srgb, var(--bg-base) 40%, transparent)' }}>
                          {['#', 'Problem', 'Rating', r?.isContest ? 'Time from Start' : 'Time Taken', 'Speed'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: h === '#' || h === 'Rating' || h === 'Time Taken' || h === 'Time from Start' || h === 'Speed' ? 'center' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, fontFamily: 'monospace' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {solvedDetails.map((d, i) => {
                          const isMax = d.timeTakenSecs === maxTimeSecs && timedProblems.length > 1;
                          const isMin = d.timeTakenSecs === minTimeSecs && timedProblems.length > 1;
                          const tRange = maxTimeSecs - minTimeSecs;
                          const speedPct = timedProblems.length > 0 && d.timeTakenSecs > 30 ? (tRange > 0 ? Math.round((1 - (d.timeTakenSecs - minTimeSecs) / tRange) * 100) : 100) : null;
                            
                          return (
                            <tr key={d.pid} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-main) 5%, transparent)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: r?.isContest ? T.blue : T.dim }}>
                                {r?.isContest ? (d.index || '—') : (i + 1)}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <a href={`https://codeforces.com/problemset/problem/${d.pid.replace('-', '/')}`} target="_blank" rel="noreferrer" style={{ color: T.text, textDecoration: 'none', fontWeight: 600, fontSize: 13 }} onMouseEnter={e => e.currentTarget.style.color = T.accent} onMouseLeave={e => e.currentTarget.style.color = T.text}>{d.name}</a>
                                <div style={{ fontSize: 11, color: T.dim, fontFamily: 'monospace', marginTop: 2 }}>{d.pid}</div>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                {d.rating > 0 ? <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: ratingColor(d.rating) }}>{d.rating}</span> : <span style={{ color: T.dim, fontSize: 11 }}>pending</span>}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', fontSize: 13 }}>
                                {d.timeTakenSecs > 30 ? (
                                  <span style={{ color: isMin ? T.green : isMax ? T.red : T.text }}>
                                    {fmtSecs(d.timeTakenSecs)}
                                    {isMin && <span style={{ marginLeft: 6, fontSize: 9, color: T.green, background: T.greenDim, padding: '2px 6px', borderRadius: 4 }}>fastest</span>}
                                    {isMax && <span style={{ marginLeft: 6, fontSize: 9, color: T.red, background: T.redDim, padding: '2px 6px', borderRadius: 4 }}>slowest</span>}
                                  </span>
                                ) : <span style={{ color: T.dim }}>—</span>}
                              </td>
                              <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                {speedPct !== null ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${speedPct}%`, background: speedPct > 60 ? T.green : speedPct > 30 ? T.accent : T.red, borderRadius: 2 }} /></div>
                                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.muted, minWidth: 32 }}>{speedPct}%</span>
                                  </div>
                                ) : <span style={{ color: T.dim, fontSize: 12 }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {history.length > 0 && r && (
                <div>
                  <SectionLabel>vs. Your Average</SectionLabel>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    {(() => {
                      const prevSessions = isRate ? history.slice(1) : history.filter(h => h.id !== r.id && h.startTs < r.startTs);
                      const pLen = prevSessions.length > 0 ? prevSessions.length : 1; 
                      const avgFocusMins = prevSessions.reduce((a, h) => a + h.workMins, 0) / pLen;
                      const avgACs = prevSessions.reduce((a, h) => a + h.problemsSolved, 0) / pLen;
                      const avgXP = prevSessions.reduce((a, h) => a + h.pointsEarned, 0) / pLen;
                      const avgRatingHist = prevSessions.flatMap(h => h.details.filter(d => d.rating > 0).map(d => d.rating));
                      const avgRatingSess = avgRatingHist.length > 0 ? Math.round(avgRatingHist.reduce((a, b) => a + b, 0) / avgRatingHist.length) : 0;

                      const rows = [
                        { metric: 'Focus Time', current: `${focusMins}m`, avg: `${Math.round(avgFocusMins)}m`, better: focusMins >= avgFocusMins },
                        { metric: 'Problems AC\'d', current: String(r.problemsSolved), avg: avgACs.toFixed(1), better: r.problemsSolved >= avgACs },
                        { metric: 'XP Earned', current: String(r.pointsEarned), avg: Math.round(avgXP).toString(), better: r.pointsEarned >= avgXP },
                        ...(avgRatingSess > 0 && avgRating > 0 ? [{ metric: 'Avg Problem Rating', current: String(avgRating), avg: String(avgRatingSess), better: avgRating >= avgRatingSess }] : []),
                      ];

                      return (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${T.border}`, background: 'color-mix(in srgb, var(--bg-base) 40%, transparent)' }}>
                              {['Metric', 'This Session', 'Your Avg', 'Δ'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Metric' ? 'left' : 'center', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim }}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={row.metric} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-main) 5%, transparent)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding: '12px 16px', color: T.muted, fontSize: 13 }}>{row.metric}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: T.text }}>{row.current}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', color: T.dim }}>{row.avg}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  {prevSessions.length === 0 ? <span style={{ fontSize: 12, color: T.dim }}>—</span> : (
                                    <span style={{ fontSize: 12, fontWeight: 900, color: row.better ? T.green : T.red }}>{row.better ? '▲' : '▼'}</span>
                                  )}
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

      {rogueACs.length > 0 && (
        <div style={{ padding: '14px 18px', marginBottom: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.redDim, border: `1px solid color-mix(in srgb, ${T.red} 40%, transparent)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: T.red, animation: 'pulse-dot 1.5s ease-in-out infinite' }} /><div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.red }}>Untracked Activity</div><div style={{ fontSize: 12, color: T.text, marginTop: 2 }}>Solved <strong style={{ color: T.red }}>{rogueACs.length} problems</strong> outside Grind Mode recently</div></div></div>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={dismissRogues} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '1px' }}>Dismiss</button><button onClick={logRogueACs} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: T.red, border: 'none', color: '#fff', transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '1px' }}>Log as Session</button></div>
        </div>
      )}

      {untrackedContests.length > 0 && untrackedContests.map(c => (
        <div key={c.contestId} style={{ padding: '14px 18px', marginBottom: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(88,166,255,0.12)', border: `1px solid color-mix(in srgb, #58a6ff 40%, transparent)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#58a6ff', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#58a6ff' }}>Untracked {c.type}</div>
              <div style={{ fontSize: 12, color: T.text, marginTop: 2 }}>We detected participation in <strong>Contest #{c.contestId}</strong>. Log it to update your stats?</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => dismissContest(c.contestId)} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '1px' }}>Dismiss</button>
            <button onClick={() => logUntrackedContest(c)} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#58a6ff', border: 'none', color: '#fff', transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '1px' }}>Log Contest</button>
          </div>
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: `linear-gradient(${T.accent} 1px, transparent 1px), linear-gradient(90deg, ${T.accent} 1px, transparent 1px)`, backgroundSize: '24px 24px', pointerEvents: 'none' }} />
          <button onClick={() => setShowSettings(true)} style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.text; e.currentTarget.style.transform = 'rotate(45deg)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; e.currentTarget.style.transform = 'rotate(0)'; }}>⚙</button>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Focus Session</div>
          {tmrPlan.length > 0 && (
            <div onClick={() => setShowTmrModal(true)} style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.accent, marginBottom: 6 }}>Today's Intentions</div>
              {tmrPlan.map((t, i) => <div key={t.id} style={{ fontSize: 12, color: T.text, marginBottom: 2, display: 'flex', gap: 6 }}><span style={{ color: T.accent, fontFamily: 'monospace', fontSize: 10 }}>{i + 1}.</span>{t.text}</div>)}
            </div>
          )}
          <button onClick={() => setPhase('INTENT')} style={{ width: '100%', padding: '14px 0', borderRadius: 10, fontSize: 14, fontWeight: 900, cursor: 'pointer', background: T.accent, border: 'none', color: 'var(--bg-base)', letterSpacing: '2px', textTransform: 'uppercase', boxShadow: `0 4px 20px ${T.accentGlow}`, transition: 'all 0.15s', marginTop: 8 }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${T.accentGlow}`; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${T.accentGlow}`; }}>⚡ Start Session</button>
          <button onClick={() => setShowTmrModal(true)} style={{ width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, letterSpacing: '1px', textTransform: 'uppercase', marginTop: 8, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.text; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>📋 Plan Tomorrow</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
          <StatCard label="Total Focus" value={`${(totalMins / 60).toFixed(1)}h`} icon="⏱" color={T.muted} />
          <StatCard label="Today" value={`${(todayMins / 60).toFixed(1)}h`} sub={`${history.filter(h => new Date(h.date).toLocaleDateString() === new Date().toLocaleDateString()).length} sessions`} icon="☀" color={todayMins > 0 ? T.green : T.muted} />
          <StatCard label="Streak" value={`${streak}d`} sub={streak > 2 ? '🔥 on fire' : 'keep going'} icon="⚡" color={streak > 2 ? T.red : T.muted} />
          <StatCard label="This Week" value={`${(weekSecs / 3600).toFixed(1)}h`} sub={`${weekPct}% of ${targetHrs}h goal`} icon="📊" color={weekPct >= 100 ? T.green : T.accent} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted }}>This Week</div><div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: weekPct >= 100 ? T.green : T.accent }}>{weekPct}%</div></div>
          <WeekBars history={history} />
          <div style={{ marginTop: 14, height: 4, background: T.border, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', background: weekPct >= 100 ? T.green : T.accent, width: `${weekPct}%`, borderRadius: 4, transition: 'width 0.8s ease', boxShadow: `0 0 10px ${weekPct >= 100 ? T.greenDim : T.accentGlow}` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: T.dim, fontFamily: 'monospace' }}><span>{(weekSecs / 3600).toFixed(1)}h done</span><span>{targetHrs}h goal</span></div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 16 }}>Peak Hours</div>
          <HourHeatmap grid={peakGrid} rawHours={rawHours} />
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {weeklyReviews.slice(0, 1).map(w => (
              <React.Fragment key={w.label}>
                <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: T.card }}><div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: T.text }}>{(w.total / 60).toFixed(1)}h</div><div style={{ fontSize: 9, color: T.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>focus</div></div>
                <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: T.card }}><div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: T.green }}>{w.acs}</div><div style={{ fontSize: 9, color: T.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>ACs</div></div>
                <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: T.card }}><div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: T.accent }}>{w.activeD}</div><div style={{ fontSize: 9, color: T.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>active days</div></div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
          {(['tasks', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveIdleTab(tab)} style={{ flex: 1, padding: '14px 0', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeIdleTab === tab ? T.accent : 'transparent'}`, color: activeIdleTab === tab ? T.accent : T.muted, transition: 'all 0.15s', marginBottom: -1 }}>
              {tab === 'tasks' ? `Tasks (${tasks.filter(t => !t.done).length})` : `History (${history.length})`}
            </button>
          ))}
        </div>

        {activeIdleTab === 'tasks' && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setNewPri(p => p === 'high' ? 'normal' : 'high')} style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, background: newPri === 'high' ? T.redDim : 'transparent', border: `1px solid ${newPri === 'high' ? T.red : T.border}`, color: newPri === 'high' ? T.red : T.dim }}>!</button>
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false, pinned: false, priority: newPri, estMins: parseInt(newEst) || undefined }]); setNewTask(''); setNewEst(''); setNewPri('normal'); } }} placeholder="Add a task…" style={{ flex: 1, padding: '10px 14px', borderRadius: 8, fontSize: 13, color: T.text, background: T.card, border: `1px solid ${T.border}`, outline: 'none' }} onFocus={e => e.target.style.borderColor = T.borderHi} onBlur={e => e.target.style.borderColor = T.border} />
              <input type="number" value={newEst} onChange={e => setNewEst(e.target.value)} placeholder="min" style={{ width: 64, padding: '10px 8px', borderRadius: 8, fontSize: 12, textAlign: 'center', color: T.text, background: T.card, border: `1px solid ${T.border}`, outline: 'none' }} />
              <button onClick={() => { if (newTask.trim()) { saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), done: false, pinned: false, priority: newPri, estMins: parseInt(newEst) || undefined }]); setNewTask(''); setNewEst(''); setNewPri('normal'); } }} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T.accentDim, border: `1px solid color-mix(in srgb, var(--accent) 40%, transparent)`, color: T.accent, transition: 'all 0.15s', letterSpacing: '1px' }} onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, var(--accent) 25%, transparent)`; }} onMouseLeave={e => { e.currentTarget.style.background = T.accentDim; }}>Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.filter(t => !t.done).length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: T.dim }}>No open tasks. Add something to work on.</div>}
              {tasks.filter(t => !t.done).sort((a, b) => { if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1; return 0; }).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${t.priority === 'high' ? T.red : t.pinned ? T.accent : T.border}`, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}>
                  <input type="checkbox" onChange={() => saveTasks(tasks.map(x => x.id === t.id ? { ...x, done: true } : x))} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: T.green }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.text}</span>
                  {t.priority === 'high' && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: T.red, background: T.redDim, padding: '2px 6px', borderRadius: 4 }}>urgent</span>}
                  {t.estMins && <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.muted, background: 'color-mix(in srgb, var(--text-main) 5%, transparent)', padding: '2px 6px', borderRadius: 4 }}>~{t.estMins}m</span>}
                  <button onClick={() => saveTasks(tasks.map(x => ({ ...x, pinned: x.id === t.id ? !x.pinned : false })))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, opacity: t.pinned ? 1 : 0.3, transition: 'opacity 0.15s' }} title="Pin as focus target">📌</button>
                  <button onClick={() => saveTasks(tasks.filter(x => x.id !== t.id))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: T.dim, transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = T.red} onMouseLeave={e => e.currentTarget.style.color = T.dim}>✕</button>
                </div>
              ))}
            </div>
            {tasks.filter(t => t.done).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><span>Completed</span><span style={{ color: T.green }}>({tasks.filter(t => t.done).length})</span></div>
                {tasks.filter(t => t.done).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', opacity: 0.4 }}><span style={{ fontSize: 12, color: T.green }}>✓</span><span style={{ fontSize: 12, color: T.muted, textDecoration: 'line-through' }}>{t.text}</span><button onClick={() => saveTasks(tasks.filter(x => x.id !== t.id))} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: T.dim }}>✕</button></div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeIdleTab === 'history' && (
          <div>
            <div style={{ display: 'flex', gap: 0, padding: '16px 20px 0', borderBottom: `1px solid ${T.border}` }}>
              {weeklyReviews.map((w, i) => <button key={i} onClick={() => setWrActiveTab(i)} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: `2px solid ${wrActiveTab === i ? T.accent : 'transparent'}`, color: wrActiveTab === i ? T.accent : T.muted, transition: 'all 0.15s', marginBottom: -1 }}>{w.label}</button>)}
            </div>
            {weeklyReviews[wrActiveTab] && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: `1px solid ${T.border}` }}>
                {[{ l: 'Focus', v: `${(weeklyReviews[wrActiveTab].total / 60).toFixed(1)}h`, c: T.accent }, { l: 'ACs', v: String(weeklyReviews[wrActiveTab].acs), c: T.green }, { l: 'Peak Day', v: `${(weeklyReviews[wrActiveTab].maxD / 60).toFixed(1)}h`, c: T.text }, { l: 'Active Days', v: `${weeklyReviews[wrActiveTab].activeD}/7`, c: T.blue }].map(s => (
                  <div key={s.l} style={{ padding: '16px', textAlign: 'center', borderRight: `1px solid ${T.border}` }}><div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: s.c }}>{s.v}</div><div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim, marginTop: 4 }}>{s.l}</div></div>
                ))}
              </div>
            )}
            <div>
              {history.length === 0 ? <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: T.dim }}>No sessions yet. Start grinding!</div> : history.slice(0, 20).map(h => <SessionRow key={h.id} log={h} onView={(log) => setViewingSession(log)} />)}
            </div>
          </div>
        )}
      </div>

      {showTmrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--bg-base) 80%, transparent)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: 32, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent }}>Tomorrow</div><div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>Top Priorities</div></div>
              <button onClick={() => setShowTmrModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', fontSize: 16, transition: 'all 0.15s' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>Set up to 3 priorities. They'll appear as pinned intentions when you start your next session.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {tmrPlan.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: T.accent, minWidth: 16 }}>{i + 1}.</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{t.text}</span>
                  <button onClick={() => saveTmrPlan(tmrPlan.filter(x => x.id !== t.id))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.dim, fontSize: 12 }} onMouseEnter={e => e.currentTarget.style.color = T.red} onMouseLeave={e => e.currentTarget.style.color = T.dim}>✕</button>
                </div>
              ))}
            </div>
            {tmrPlan.length < 3 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newTmr} onChange={e => setNewTmr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTmr.trim()) { saveTmrPlan([...tmrPlan, { id: Date.now(), text: newTmr.trim() }]); setNewTmr(''); } }} placeholder="Add a priority…" autoFocus style={{ flex: 1, padding: '11px 14px', borderRadius: 8, fontSize: 13, color: T.text, background: T.card, border: `1px solid ${T.border}`, outline: 'none' }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
                <button onClick={() => { if (newTmr.trim()) { saveTmrPlan([...tmrPlan, { id: Date.now(), text: newTmr.trim() }]); setNewTmr(''); } }} style={{ padding: '11px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T.accentDim, border: `1px solid color-mix(in srgb, var(--accent) 40%, transparent)`, color: T.accent, transition: 'all 0.15s' }}>Add</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--bg-base) 85%, transparent)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 720, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, display: 'flex', flexDirection: 'column', maxHeight: '88vh', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '24px 28px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.muted }}>Configuration</div><div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>Settings & Data</div></div>
              <button onClick={() => setShowSettings(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', fontSize: 18, transition: 'all 0.15s' }}>×</button>
            </div>
            <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Weekly Goal</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" value={targetHrs} onChange={e => { setTargetHrs(Number(e.target.value)); localStorage.setItem('cf_grind_target', e.target.value); }} style={{ width: 80, padding: '10px 12px', borderRadius: 8, fontSize: 16, fontWeight: 700, fontFamily: 'monospace', textAlign: 'center', background: T.card, border: `1px solid ${T.border}`, color: T.text, outline: 'none' }} />
                  <span style={{ fontSize: 13, color: T.muted }}>hours per week</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Session Ledger</div>
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: T.card }}>
                        {['Date', 'Intent', 'Mins', 'ACs', 'Rating', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Mins' || h === 'ACs' || h === 'Rating' ? 'center' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.dim }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0 ? <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: T.dim, fontStyle: 'italic' }}>No sessions yet.</td></tr> : history.map(h => (
                        <tr key={h.id} style={{ borderTop: `1px solid ${T.border}` }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: T.muted }}>{new Date(h.startTs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                          <td style={{ padding: '10px 14px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>{h.intent || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><input type="number" value={h.workMins} onChange={e => { const v = Number(e.target.value); setHistory(prev => { const next = prev.map(x => x.id === h.id ? { ...x, workMins: v } : x); localStorage.setItem('cf_grind_v4', JSON.stringify(next)); return next; }); }} style={{ width: 54, padding: '4px 6px', borderRadius: 6, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, background: 'color-mix(in srgb, var(--bg-base) 40%, transparent)', border: `1px solid ${T.border}`, color: T.text, outline: 'none' }} /></td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace', color: T.green }}>{h.problemsSolved}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><input type="number" min="0" max="5" value={h.flowRating || 0} onChange={e => { const v = Number(e.target.value); setHistory(prev => { const next = prev.map(x => x.id === h.id ? { ...x, flowRating: v } : x); localStorage.setItem('cf_grind_v4', JSON.stringify(next)); return next; }); }} style={{ width: 40, padding: '4px 6px', borderRadius: 6, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, background: 'color-mix(in srgb, var(--bg-base) 40%, transparent)', border: `1px solid ${T.border}`, color: T.accent, outline: 'none' }} /></td>
                          <td style={{ padding: '10px 14px' }}><button onClick={() => saveHistory(history.filter(x => x.id !== h.id))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.dim, fontSize: 12, padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = T.red} onMouseLeave={e => e.currentTarget.style.color = T.dim}>✕</button></td>
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