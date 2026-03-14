"use client";
import { useState, useEffect, useMemo } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { CF_SCORE_MAP } from "@/lib/constants";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface NemesisProps {
  mySubs: any[]; myHistory: any[]; myRating: number; myHandle: string; myInfo: any;
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
function recencyWeightedAC(subs: any[], now: number): number {
  const λ = 0.03; const seen = new Set<string>(); let score = 0;
  [...subs].reverse().forEach(s => {
    if (s.verdict === 'OK' && s.problem) {
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (!seen.has(pid)) { seen.add(pid); score += Math.exp(-λ * (now - s.creationTimeSeconds) / 86400); }
    }
  });
  return parseFloat(score.toFixed(1));
}

function getStreak(subs: any[]): number {
  if (!subs || subs.length === 0) return 0;
  const days = new Set<string>();
  subs.forEach(s => { if (s.verdict === 'OK') days.add(new Date(s.creationTimeSeconds * 1000).toLocaleDateString()); });
  let streak = 0; const d = new Date();
  if (days.has(d.toLocaleDateString())) streak++;
  d.setDate(d.getDate() - 1);
  while(days.has(d.toLocaleDateString())) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function getPeakTime(subs: any[]): string {
  const hours = new Array(24).fill(0);
  subs.forEach(s => { if (s.verdict === 'OK') hours[new Date(s.creationTimeSeconds * 1000).getHours()]++; });
  let maxWindow = 0; let startHour = 0;
  for (let i = 0; i < 24; i++) {
    const sum = hours[i] + hours[(i+1)%24] + hours[(i+2)%24] + hours[(i+3)%24];
    if (sum > maxWindow) { maxWindow = sum; startHour = i; }
  }
  const endHour = (startHour + 3) % 24;
  const fmt = (h: number) => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
  return `${fmt(startHour)} - ${fmt(endHour)}`;
}

function getMeta(subs: any[]): string {
  const recent = subs.filter(s => s.verdict === 'OK').slice(0, 30);
  if(recent.length === 0) return "Dormant / No recent activity";
  const tags: Record<string, number> = {}; const ratings: Record<string, number> = {};
  recent.forEach(s => {
      s.problem.tags?.forEach((t: string) => tags[t] = (tags[t] || 0) + 1);
      if (s.problem.rating) ratings[s.problem.rating] = (ratings[s.problem.rating] || 0) + 1;
  });
  const topTag = Object.keys(tags).sort((a,b) => tags[b] - tags[a])[0];
  const topRating = Object.keys(ratings).sort((a,b) => ratings[b] - ratings[a])[0];
  return `Spamming ${topRating ? topRating + '-rated' : 'unrated'} ${topTag || 'problems'}`;
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>{children}</p>;
}

function StatDiffCard({ label, myVal, theirVal, myHandle, theirHandle, higherIsBetter = true, suffix = '' }: {
  label: string; myVal: number; theirVal: number; myHandle: string; theirHandle: string;
  higherIsBetter?: boolean; suffix?: string;
}) {
  const diff = myVal - theirVal;
  const ahead = higherIsBetter ? diff > 0 : diff < 0;
  const diffAbs = Math.abs(diff);
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group transition-all" style={{ background: 'var(--bg-card)', border: `1px solid ${ahead ? 'rgba(62,207,142,0.3)' : 'var(--border)'}` }}>
      {ahead && <div className="absolute top-0 right-0 w-16 h-16 bg-green-500 opacity-5 blur-xl rounded-full" />}
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="flex justify-between items-end gap-1 mt-1 relative z-10">
        <div>
          <p className="text-[9px] font-mono mb-1 uppercase" style={{ color: 'var(--accent)' }}>{myHandle}</p>
          <p className="text-xl font-black font-mono leading-none" style={{ color: 'var(--text-main)' }}>{myVal.toLocaleString()}{suffix}</p>
        </div>
        {diffAbs > 0 && (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded font-mono mb-0.5"
            style={{ color: ahead ? 'var(--status-ac)' : 'var(--status-wa)', background: ahead ? 'rgba(62,207,142,0.1)' : 'rgba(248,81,73,0.1)' }}>
            {ahead ? '▲' : '▼'} {diffAbs.toLocaleString()}{suffix}
          </span>
        )}
        <div className="text-right">
          <p className="text-[9px] font-mono mb-1 uppercase" style={{ color: 'var(--status-wa)' }}>{theirHandle}</p>
          <p className="text-xl font-black font-mono leading-none" style={{ color: 'var(--text-muted)' }}>{theirVal.toLocaleString()}{suffix}</p>
        </div>
      </div>
    </div>
  );
}

function ThreatMeter({ score, winProb }: { score: number; winProb: number }) {
  const level = score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Moderate' : 'Low';
  const color = score >= 80 ? 'var(--status-wa)' : score >= 60 ? '#fb923c' : score >= 40 ? 'var(--accent)' : 'var(--status-ac)';
  const bars = 10;
  const filled = Math.round((score / 100) * bars);
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Threat Assessment</p>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-5xl font-bold font-mono" style={{ color }}>{score}</p>
          <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color }}>{level}</p>
        </div>
        <div className="flex-1 flex flex-col gap-[3px] pb-1">
          {Array.from({ length: bars }).map((_, i) => (
            <div key={i} className="w-full h-1.5 rounded-full"
              style={{ background: i < filled ? color : 'var(--border)' }} />
          )).reverse()}
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Elo win probability: {(winProb * 100).toFixed(1)}%</p>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Nemesis({ mySubs, myRating, myHandle, myHistory, myInfo }: NemesisProps) {
  const [nemeses, setNemeses] = useState<string[]>([]);
  const [activeNemesis, setActiveNemesis] = useState<string | null>(null);
  const [newNemesis, setNewNemesis] = useState('');
  
  // We now use a cache to hold loaded targets so switching is instant!
  const [nemesisCache, setNemesisCache] = useState<Record<string, {subs: any[], history: any[], info: any}>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Load saved nemeses
  useEffect(() => {
    try { const saved = localStorage.getItem('cf_nemeses'); if (saved) setNemeses(JSON.parse(saved)); } catch {}
  }, []);

  const addNemesis = () => {
    if (!newNemesis.trim()) return;
    const handle = newNemesis.trim().toLowerCase();
    if (!nemeses.includes(handle) && handle !== myHandle.toLowerCase()) {
      const updated = [...nemeses, handle];
      setNemeses(updated);
      localStorage.setItem('cf_nemeses', JSON.stringify(updated));
    }
    setNewNemesis('');
    setActiveNemesis(handle);
  };

  const removeNemesis = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = nemeses.filter(n => n !== handle);
    setNemeses(updated);
    localStorage.setItem('cf_nemeses', JSON.stringify(updated));
    if (activeNemesis === handle) { setActiveNemesis(null); }
  };

  // Fetch target data independently and update the cache
  useEffect(() => {
    if (!activeNemesis) return;
    let isMounted = true;
    const fetchData = async () => {
      setIsSyncing(true);
      try {
        const [subsRes, histRes, infoRes] = await Promise.all([
          fetch(`https://codeforces.com/api/user.status?handle=${activeNemesis}&from=1&count=2000`),
          fetch(`https://codeforces.com/api/user.rating?handle=${activeNemesis}`),
          fetch(`https://codeforces.com/api/user.info?handles=${activeNemesis}`)
        ]);
        const subs = await subsRes.json(); const hist = await histRes.json(); const info = await infoRes.json();
        if (isMounted && subs.status === 'OK' && info.status === 'OK') {
          setNemesisCache(prev => ({
            ...prev,
            [activeNemesis]: { subs: subs.result, history: hist.result || [], info: info.result[0] }
          }));
        }
      } catch (e) { console.error("Error fetching nemesis", e); }
      if (isMounted) setIsSyncing(false);
    };
    fetchData();
    return () => { isMounted = false; };
  }, [activeNemesis]);

  // Point to the active target's cached data
  const targetData = activeNemesis ? nemesisCache[activeNemesis] : null;

  // ─── METRICS CALCULATION ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!mySubs || !targetData) return null;
    const now = Date.now() / 1000;
    const { subs: targetSubs, history: targetHistory, info: targetInfo } = targetData;
    const targetHandle = targetInfo.handle;

    // --- My Stats (Original) ---
    const myTagsAll: Record<string, number> = {}; 
    const myAttempts = new Set<string>(); let myFirstTryCount = 0; let myWeek0Score = 0;
    const mySpeed: Record<string, number> = {}; const myACSet = new Set<string>();

    [...mySubs].reverse().forEach(s => {
      if (!s.problem) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (!myAttempts.has(pid)) { myAttempts.add(pid); if (s.verdict === 'OK') myFirstTryCount++; }
      if (s.verdict === 'OK') {
        if (!myACSet.has(pid)) {
          myACSet.add(pid);
          s.problem.tags?.forEach((t: string) => { myTagsAll[t] = (myTagsAll[t] || 0) + 1; });
          const daysAgo = (now - s.creationTimeSeconds) / 86400;
          if (daysAgo <= 7) { const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800; myWeek0Score += CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10; }
        }
        if (s.timeConsumedMillis !== undefined) { if (!mySpeed[pid] || s.timeConsumedMillis < mySpeed[pid]) mySpeed[pid] = s.timeConsumedMillis; }
      }
    });

    // --- Target Stats (Original) ---
    const tACSet = new Set<string>(); const tAttempts = new Set<string>(); let tFirstTryCount = 0;
    let currentSum = 0; let currentCount = 0; let week0Score = 0;
    const weekScores = [0, 0, 0, 0, 0]; const theirSpeed: Record<string, number> = {};
    const targetTagsAll: Record<string, number> = {};

    [...targetSubs].reverse().forEach(s => {
      if (!s.problem) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (!tAttempts.has(pid)) { tAttempts.add(pid); if (s.verdict === 'OK') tFirstTryCount++; }
      if (s.verdict === 'OK') {
        if (!tACSet.has(pid)) {
          tACSet.add(pid);
          const daysAgo = (now - s.creationTimeSeconds) / 86400;
          const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
          const pts = CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;
          s.problem.tags?.forEach((t: string) => { targetTagsAll[t] = (targetTagsAll[t] || 0) + 1; });
          if (daysAgo <= 7) { week0Score += pts; weekScores[0] += pts; }
          else if (daysAgo <= 14) weekScores[1] += pts;
          else if (daysAgo <= 21) weekScores[2] += pts;
          else if (daysAgo <= 28) weekScores[3] += pts;
          else if (daysAgo <= 35) weekScores[4] += pts;
          if (daysAgo <= 30 && s.problem.rating) { currentSum += s.problem.rating; currentCount++; }
        }
        if (s.timeConsumedMillis !== undefined) { if (!theirSpeed[pid] || s.timeConsumedMillis < theirSpeed[pid]) theirSpeed[pid] = s.timeConsumedMillis; }
      }
    });

    const activePastWeeks = weekScores.slice(1).filter(w => w > 0);
    const avgPastWeekScore = activePastWeeks.length > 0 ? activePastWeeks.reduce((a, b) => a + b, 0) / activePastWeeks.length : 0;

    const myRatingNow = myRating || 1200; const theirRatingNow = targetInfo?.rating || 1200;
    const myWeightedAC = recencyWeightedAC(mySubs, now); const theirWeightedAC = recencyWeightedAC(targetSubs, now);
    const myAccuracy = myAttempts.size > 0 ? parseFloat(((myFirstTryCount / myAttempts.size) * 100).toFixed(1)) : 0;
    const tAccuracy = tAttempts.size > 0 ? parseFloat(((tFirstTryCount / tAttempts.size) * 100).toFixed(1)) : 0;
    const eloExpected = 1 / (1 + Math.pow(10, (myRatingNow - theirRatingNow) / 400));
    const momentumRatio = theirWeightedAC / Math.max(0.1, myWeightedAC);
    let momentumThreat = 50;
    if (momentumRatio > 2) momentumThreat = 100;
    else if (momentumRatio > 1) momentumThreat = 50 + ((momentumRatio - 1) * 50);
    else momentumThreat = momentumRatio * 50;
    const threatScore = Math.min(100, Math.max(1, Math.round((eloExpected * 100 * 0.7) + (momentumThreat * 0.3))));

    const allTags = Array.from(new Set([...Object.keys(targetTagsAll), ...Object.keys(myTagsAll)]));
    const sortedTags = allTags.sort((a, b) => (targetTagsAll[b] || 0) + (myTagsAll[b] || 0) - ((targetTagsAll[a] || 0) + (myTagsAll[a] || 0)));
    const myTagData = sortedTags.map(t => myTagsAll[t] || 0);
    const theirTagData = sortedTags.map(t => targetTagsAll[t] || 0);
    const theirTagColors = theirTagData.map((val, i) => val > myTagData[i] ? '#f85149' : '#3ecf8e');

    let allTS = new Set<number>();
    if (myHistory) myHistory.forEach((h: any) => allTS.add(h.ratingUpdateTimeSeconds));
    if (targetHistory) targetHistory.forEach((h: any) => allTS.add(h.ratingUpdateTimeSeconds));
    const sortedTS = Array.from(allTS).sort((a, b) => a - b);
    const buildLine = (hist: any[]) => { 
        if (!hist) return [];
        const hMap: Record<number, number> = {}; hist.forEach((h: any) => hMap[h.ratingUpdateTimeSeconds] = h.newRating); let last: number | null = null; return sortedTS.map(ts => { if (hMap[ts]) last = hMap[ts]; return last; }); 
    };
    
    const ratingLineData = {
      labels: sortedTS.map(ts => { const d = new Date(ts * 1000); return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`; }),
      datasets: [
        { label: myHandle, data: buildLine(myHistory), borderColor: 'var(--accent)', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2, spanGaps: false },
        { label: targetHandle, data: buildLine(targetHistory), borderColor: 'var(--status-wa)', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2, spanGaps: false },
      ],
    };

    const overlapPids = [...myACSet].filter(p => theirSpeed[p] && mySpeed[p]);
    const overlapPoints = overlapPids.map(pid => ({ x: mySpeed[pid], y: theirSpeed[pid], pid }));
    const maxSpeed = overlapPoints.length > 0 ? Math.max(3000, ...overlapPoints.map((p: any) => Math.max(p.x, p.y))) : 3000;
    const mySpeedWins = overlapPoints.filter((p: any) => p.x < p.y).length;
    const theirSpeedWins = overlapPoints.filter((p: any) => p.x > p.y).length;
    const velTrendingUp = (week0Score / 7) * 7 > avgPastWeekScore;

    // --- New Stats (Streaks, Peaks, Clashes, Meta) ---
    const myStreak = getStreak(mySubs);
    const theirStreak = getStreak(targetSubs);
    const myPeak = getPeakTime(mySubs);
    const theirPeak = getPeakTime(targetSubs);
    const theirMeta = getMeta(targetSubs);

    let wins = 0, losses = 0, ties = 0;
    const clashes: any[] = [];
    const myContests: Record<number, any> = {};
    if (myHistory) myHistory.forEach(h => myContests[h.contestId] = h);
    if (targetHistory) targetHistory.forEach(th => {
      if (myContests[th.contestId]) {
        const mh = myContests[th.contestId];
        clashes.push({ id: th.contestId, name: th.contestName, myRank: mh.rank, theirRank: th.rank, date: th.ratingUpdateTimeSeconds });
        if (mh.rank < th.rank) wins++; else if (mh.rank > th.rank) losses++; else ties++;
      }
    });
    clashes.sort((a, b) => b.date - a.date);

    return {
      targetHandle, avgRating30D: currentCount > 0 ? Math.round(currentSum / currentCount) : 0,
      sortedTags, myTagData, theirTagData, theirTagColors,
      ratingLineData, overlapPoints, mySpeedWins, theirSpeedWins, maxSpeed,
      scorePerDayCurrent: parseFloat((week0Score / 7).toFixed(1)),
      avgScorePerWeekPast: parseFloat(avgPastWeekScore.toFixed(1)),
      myRatingNow, theirRatingNow, myWeightedAC, theirWeightedAC,
      myWeekScore: myWeek0Score, theirWeekScore: week0Score,
      myAccuracy, tAccuracy, threatScore, winProb: 1 - eloExpected, velTrendingUp,
      myStreak, theirStreak, myPeak, theirPeak, theirMeta, wins, losses, ties, clashes
    };
  }, [mySubs, myHistory, myRating, targetData, myHandle]);

  // ─── CHART CONFIGS ────────────────────────────────────────────────────────────
  const lineOpts = useMemo(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 }, boxWidth: 10 } } }, scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 10 } } } } }), []);
  const tagOpts = useMemo(() => ({ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 }, boxWidth: 10 } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b949e', font: { size: 10 } } }, y: { grid: { display: false }, ticks: { color: 'var(--text-main)', font: { size: 10 } } } } }), []);
  
  const scatterDataObj = useMemo(() => {
    if (!metrics || metrics.overlapPoints.length === 0) return null;
    return {
      datasets: [
        { type: 'line' as const, label: 'Tie Line', data: [{ x: 0, y: 0 }, { x: metrics.maxSpeed, y: metrics.maxSpeed }], borderColor: 'var(--border)', borderWidth: 1, borderDash: [5, 5], pointRadius: 0, fill: false },
        { type: 'scatter' as const, label: 'Head-to-Head', data: metrics.overlapPoints, backgroundColor: metrics.overlapPoints.map((p: any) => p.x < p.y ? 'var(--accent)' : (p.x > p.y ? 'var(--status-wa)' : '#555')), pointRadius: 4, pointHoverRadius: 6 },
      ],
    };
  }, [metrics]);

  const scatterOptsObj = useMemo(() => {
    if (!metrics) return null;
    return { 
        responsive: true, maintainAspectRatio: false, 
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ` [${ctx.raw.pid}] You: ${ctx.raw.x}ms | Them: ${ctx.raw.y}ms` } } }, 
        scales: { 
            x: { title: { display: true, text: `Your Time (ms)`, color: '#8b949e', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666' }, min: 0, max: metrics.maxSpeed }, 
            y: { title: { display: true, text: `${metrics.targetHandle} Time (ms)`, color: '#8b949e', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666' }, min: 0, max: metrics.maxSpeed } 
        } 
    };
  }, [metrics]);

  const barData = useMemo(() => {
      if (!metrics) return null;
      return { 
          labels: metrics.sortedTags, 
          datasets: [
              { label: myHandle, data: metrics.myTagData, backgroundColor: 'var(--accent)', borderRadius: 4 }, 
              { label: metrics.targetHandle, data: metrics.theirTagData, backgroundColor: metrics.theirTagColors, borderRadius: 4 }
          ] 
      };
  }, [metrics, myHandle]);


  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">

      {/* ── INDEPENDENT ROSTER SELECTION ── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black italic tracking-tight" style={{ color: 'var(--text-main)' }}>RIVALRY ROSTER</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add independent targets. Scout their strategies. Crush them.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <input value={newNemesis} onChange={e => setNewNemesis(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNemesis()} placeholder="Enter CF handle..." className="px-4 py-2 rounded-lg text-sm w-full md:w-48 outline-none" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
            <button onClick={addNemesis} className="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all" style={{ background: 'var(--status-wa)', color: '#fff' }}>Add Target</button>
          </div>
        </div>
        
        {nemeses.length === 0 ? (
          <div className="text-center py-6 text-sm italic" style={{ color: 'var(--text-muted)' }}>No targets acquired. Add a handle above to begin scouting.</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {nemeses.map(handle => (
              <div key={handle} onClick={() => setActiveNemesis(handle)} className={`px-4 py-2 rounded-lg text-sm font-mono font-bold cursor-pointer transition-all flex items-center gap-2 border ${activeNemesis === handle ? 'scale-105 shadow-lg' : 'opacity-70 hover:opacity-100'}`} style={{ background: activeNemesis === handle ? 'rgba(248,81,73,0.1)' : 'var(--bg-base)', borderColor: activeNemesis === handle ? 'var(--status-wa)' : 'var(--border)', color: activeNemesis === handle ? 'var(--status-wa)' : 'var(--text-muted)' }}>
                {handle}
                <button onClick={(e) => removeNemesis(handle, e)} className="opacity-50 hover:opacity-100 ml-1">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ONLY show full-page loading if we don't have the target cached yet */}
      {isSyncing && !targetData && activeNemesis && (
        <div className="text-center py-20 font-bold uppercase tracking-widest animate-pulse" style={{ color: 'var(--status-wa)' }}>
          Acquiring Target Intel...
        </div>
      )}

      {/* ── SCOUTING REPORT ── */}
      {metrics && targetData && (
        <div className="flex flex-col gap-5 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* VS HEADER with Stealthy Background Sync Ping */}
          <div className="flex items-center justify-center gap-8 py-8 px-6 rounded-xl relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            
            {isSyncing && (
              <div className="absolute top-3 right-4 flex items-center gap-2 opacity-70">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-wa)] animate-ping" />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--status-wa)' }}>Syncing</span>
              </div>
            )}

            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, var(--accent), transparent, var(--status-wa))' }} />
            <div className="text-right flex-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>You</p>
              <p className="text-3xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{myHandle}</p>
            </div>
            <p className="text-2xl font-black italic" style={{ color: 'var(--border)' }}>VS</p>
            <div className="text-left flex-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--status-wa)' }}>Nemesis</p>
              <p className="text-3xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{metrics.targetHandle}</p>
            </div>
          </div>

          {/* HEAD-TO-HEAD STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatDiffCard label="Rating" myVal={metrics.myRatingNow} theirVal={metrics.theirRatingNow} myHandle={myHandle} theirHandle={metrics.targetHandle} />
            <StatDiffCard label="Weighted ACs" myVal={metrics.myWeightedAC} theirVal={metrics.theirWeightedAC} myHandle={myHandle} theirHandle={metrics.targetHandle} />
            <StatDiffCard label="7-Day Score" myVal={metrics.myWeekScore} theirVal={metrics.theirWeekScore} myHandle={myHandle} theirHandle={metrics.targetHandle} />
            <StatDiffCard label="First-Try Acc." myVal={metrics.myAccuracy} theirVal={metrics.tAccuracy} myHandle={myHandle} theirHandle={metrics.targetHandle} suffix="%" />
          </div>

          {/* CALIBER + VELOCITY + THREAT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardTitle>30-Day Caliber</CardTitle>
              <p className="text-4xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{metrics.avgRating30D || '—'}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Avg rating {metrics.targetHandle} is clearing lately</p>
            </Card>
            <Card>
              <CardTitle>Velocity / Week</CardTitle>
              <p className="text-4xl font-bold font-mono" style={{ color: metrics.velTrendingUp ? 'var(--status-wa)' : 'var(--status-ac)' }}>
                {(metrics.scorePerDayCurrent * 7).toFixed(0)}
                <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>pts</span>
              </p>
              <p className="text-xs mt-2 font-semibold" style={{ color: metrics.velTrendingUp ? 'var(--status-wa)' : 'var(--status-ac)' }}>
                {metrics.velTrendingUp ? '▲ Accelerating' : '▼ Slowing'} vs {metrics.avgScorePerWeekPast.toFixed(0)} pts avg
              </p>
            </Card>
            <ThreatMeter score={metrics.threatScore} winProb={metrics.winProb} />
          </div>

          {/* RATING HISTORY */}
          <Card>
            <CardTitle>📡 Rating History</CardTitle>
            <div className="h-[280px]"><Line data={metrics.ratingLineData} options={lineOpts} /></div>
          </Card>

          {/* TAG COMPARISON */}
          <Card>
            <CardTitle>🏷 Tag Mastery Comparison</CardTitle>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--status-wa)' }}>Red</span> = they beat you. <span style={{ color: 'var(--status-ac)' }}>Green</span> = you hold the line.
            </p>
            <div className="overflow-y-auto pr-2" style={{ maxHeight: '600px' }}>
              <div style={{ height: `${Math.max(400, metrics.sortedTags.length * 28)}px`, position: 'relative' }}>
                {barData && <Bar data={barData} options={tagOpts} />}
              </div>
            </div>
          </Card>

          {/* EXECUTION SPEED */}
          {scatterDataObj && scatterOptsObj && (
            <Card>
              <CardTitle>⚡ Execution Speed — Shared problems</CardTitle>
              <div className="flex gap-6 mb-4 text-sm">
                <span style={{ color: 'var(--accent)' }}>You faster: {metrics.mySpeedWins}</span>
                <span style={{ color: 'var(--status-wa)' }}>{metrics.targetHandle} faster: {metrics.theirSpeedWins}</span>
              </div>
              <div className="h-[280px]"><Scatter data={scatterDataObj as any} options={scatterOptsObj as any} /></div>
            </Card>
          )}

          {/* ── TACTICAL INTEL & DIRECT CLASHES ── */}
          <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
            <h3 className="text-xl font-black italic tracking-tight mb-6" style={{ color: 'var(--text-main)' }}>TACTICAL INTEL & HEAD-TO-HEAD CLASHES</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Direct Clashes List */}
              <Card className="md:col-span-1 relative overflow-hidden border-none" style={{ background: 'linear-gradient(145deg, var(--bg-card), var(--bg-base))' }}>
                <div className="absolute inset-0 opacity-5" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, var(--status-wa) 10px, var(--status-wa) 20px)' }}/>
                <CardTitle>Shared Contests Record</CardTitle>
                <div className="flex justify-center items-center gap-4 mb-4 relative z-10">
                  <div className="text-center"><p className="text-4xl font-black" style={{ color: 'var(--status-ac)' }}>{metrics.wins}</p><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Wins</p></div>
                  <div className="text-center text-3xl font-black" style={{ color: 'var(--text-muted)' }}>-</div>
                  <div className="text-center"><p className="text-4xl font-black" style={{ color: 'var(--status-wa)' }}>{metrics.losses}</p><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Losses</p></div>
                  <div className="text-center text-3xl font-black" style={{ color: 'var(--text-muted)' }}>-</div>
                  <div className="text-center"><p className="text-4xl font-black" style={{ color: 'var(--text-muted)' }}>{metrics.ties}</p><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Ties</p></div>
                </div>
                <div className="h-[120px] overflow-y-auto pr-2 relative z-10 space-y-2">
                  {metrics.clashes.length === 0 ? <p className="text-xs text-center italic mt-6" style={{ color: 'var(--text-muted)' }}>No shared contests yet. Cowards.</p> : 
                    metrics.clashes.map(c => (
                      <div key={c.id} className="flex justify-between items-center text-xs p-2 rounded" style={{ background: 'var(--bg-base)' }}>
                        <span className="truncate w-32" style={{ color: 'var(--text-main)' }}>#{c.id}</span>
                        <div className="flex gap-3 font-mono">
                          <span style={{ color: c.myRank < c.theirRank ? 'var(--status-ac)' : 'var(--text-muted)' }}>{c.myRank}</span>
                          <span style={{ color: 'var(--border)' }}>vs</span>
                          <span style={{ color: c.myRank > c.theirRank ? 'var(--status-wa)' : 'var(--text-muted)' }}>{c.theirRank}</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </Card>

              {/* Meta & Endurance */}
              <Card className="md:col-span-2 grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <CardTitle>Current Target Meta</CardTitle>
                  <div className="p-4 rounded-lg font-mono text-sm border-l-4" style={{ background: 'rgba(248,81,73,0.05)', borderColor: 'var(--status-wa)', color: 'var(--text-main)' }}>
                    " {metrics.theirMeta} "
                  </div>
                </div>
                
                <div>
                  <CardTitle>Endurance (Daily Streak)</CardTitle>
                  <div className="flex items-end justify-between">
                    <div><p className="text-xs uppercase mb-1" style={{ color: 'var(--accent)' }}>You</p><p className="text-2xl font-black font-mono" style={{ color: 'var(--text-main)' }}>{metrics.myStreak} <span className="text-sm font-normal text-gray-500">days</span></p></div>
                    <p className="text-lg font-black" style={{ color: 'var(--border)' }}>vs</p>
                    <div className="text-right"><p className="text-xs uppercase mb-1" style={{ color: 'var(--status-wa)' }}>Target</p><p className="text-2xl font-black font-mono" style={{ color: 'var(--text-main)' }}>{metrics.theirStreak} <span className="text-sm font-normal text-gray-500">days</span></p></div>
                  </div>
                </div>

                <div>
                  <CardTitle>Time of Day Clash</CardTitle>
                  <div className="flex items-end justify-between">
                    <div><p className="text-xs uppercase mb-1" style={{ color: 'var(--accent)' }}>You</p><p className="text-sm font-bold font-mono" style={{ color: 'var(--text-main)' }}>{metrics.myPeak}</p></div>
                    <p className="text-lg font-black" style={{ color: 'var(--border)' }}>vs</p>
                    <div className="text-right"><p className="text-xs uppercase mb-1" style={{ color: 'var(--status-wa)' }}>Target</p><p className="text-sm font-bold font-mono" style={{ color: 'var(--text-main)' }}>{metrics.theirPeak}</p></div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}