"use client";
import { useState, useEffect, useMemo } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { CF_SCORE_MAP } from "@/lib/constants";

// Types
interface NemesisProps {
  mySubs: any[]; myHistory: any[]; myRating: number; myHandle: string; myInfo: any;
}

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

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl p-5 ${className}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>{children}</p>;
}

export default function Nemesis({ mySubs, myRating, myHandle, myHistory, myInfo }: NemesisProps) {
  const [nemeses, setNemeses] = useState<string[]>([]);
  const [activeNemesis, setActiveNemesis] = useState<string | null>(null);
  const [newNemesis, setNewNemesis] = useState('');
  const [targetData, setTargetData] = useState<{subs: any[], history: any[], info: any} | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (activeNemesis === handle) { setActiveNemesis(null); setTargetData(null); }
  };

  // Fetch target data independently
  useEffect(() => {
    if (!activeNemesis) { setTargetData(null); return; }
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [subsRes, histRes, infoRes] = await Promise.all([
          fetch(`https://codeforces.com/api/user.status?handle=${activeNemesis}&from=1&count=2000`),
          fetch(`https://codeforces.com/api/user.rating?handle=${activeNemesis}`),
          fetch(`https://codeforces.com/api/user.info?handles=${activeNemesis}`)
        ]);
        const subs = await subsRes.json(); const hist = await histRes.json(); const info = await infoRes.json();
        if (isMounted && subs.status === 'OK' && info.status === 'OK') {
          setTargetData({ subs: subs.result, history: hist.result || [], info: info.result[0] });
        }
      } catch (e) { console.error("Error fetching nemesis", e); }
      if (isMounted) setLoading(false);
    };
    fetchData();
    return () => { isMounted = false; };
  }, [activeNemesis]);

  const metrics = useMemo(() => {
    if (!mySubs || !targetData) return null;
    const now = Date.now() / 1000;
    const { subs: targetSubs, history: targetHistory, info: targetInfo } = targetData;
    const targetHandle = targetInfo.handle;
    
    // Base Stats
    const myWeightedAC = recencyWeightedAC(mySubs, now); 
    const theirWeightedAC = recencyWeightedAC(targetSubs, now);
    const myRatingNow = myRating || 1200; 
    const theirRatingNow = targetInfo.rating || 1200;
    
    // Streaks & Meta
    const myStreak = getStreak(mySubs);
    const theirStreak = getStreak(targetSubs);
    const myPeak = getPeakTime(mySubs);
    const theirPeak = getPeakTime(targetSubs);
    const theirMeta = getMeta(targetSubs);

    // Direct Clashes (Shared Contests)
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

    // Speed & Tags Overlap
    const myTagsAll: Record<string, number> = {}; const targetTagsAll: Record<string, number> = {};
    const mySpeed: Record<string, number> = {}; const theirSpeed: Record<string, number> = {};
    const myACSet = new Set<string>(); const tACSet = new Set<string>();

    mySubs.forEach(s => {
      if (s.verdict === 'OK' && s.problem) {
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        if (!myACSet.has(pid)) { myACSet.add(pid); s.problem.tags?.forEach((t: string) => { myTagsAll[t] = (myTagsAll[t] || 0) + 1; }); }
        if (s.timeConsumedMillis !== undefined) { if (!mySpeed[pid] || s.timeConsumedMillis < mySpeed[pid]) mySpeed[pid] = s.timeConsumedMillis; }
      }
    });
    targetSubs.forEach(s => {
      if (s.verdict === 'OK' && s.problem) {
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        if (!tACSet.has(pid)) { tACSet.add(pid); s.problem.tags?.forEach((t: string) => { targetTagsAll[t] = (targetTagsAll[t] || 0) + 1; }); }
        if (s.timeConsumedMillis !== undefined) { if (!theirSpeed[pid] || s.timeConsumedMillis < theirSpeed[pid]) theirSpeed[pid] = s.timeConsumedMillis; }
      }
    });

    const overlapPids = [...myACSet].filter(p => theirSpeed[p] && mySpeed[p]);
    const overlapPoints = overlapPids.map(pid => ({ x: mySpeed[pid], y: theirSpeed[pid], pid }));
    const maxSpeed = overlapPoints.length > 0 ? Math.max(3000, ...overlapPoints.map((p: any) => Math.max(p.x, p.y))) : 3000;
    const mySpeedWins = overlapPoints.filter((p: any) => p.x < p.y).length;
    const theirSpeedWins = overlapPoints.filter((p: any) => p.x > p.y).length;

    // Tags
    const allTags = Array.from(new Set([...Object.keys(targetTagsAll), ...Object.keys(myTagsAll)]));
    const sortedTags = allTags.sort((a, b) => (targetTagsAll[b] || 0) + (myTagsAll[b] || 0) - ((targetTagsAll[a] || 0) + (myTagsAll[a] || 0)));
    const myTagData = sortedTags.map(t => myTagsAll[t] || 0);
    const theirTagData = sortedTags.map(t => targetTagsAll[t] || 0);
    const theirTagColors = theirTagData.map((val, i) => val > myTagData[i] ? '#f85149' : '#3ecf8e');

    // Threat Logic
    const eloExpected = 1 / (1 + Math.pow(10, (myRatingNow - theirRatingNow) / 400));
    const momentumRatio = theirWeightedAC / Math.max(0.1, myWeightedAC);
    const momentumThreat = momentumRatio > 2 ? 100 : momentumRatio > 1 ? 50 + ((momentumRatio - 1) * 50) : momentumRatio * 50;
    const threatScore = Math.min(100, Math.max(1, Math.round((eloExpected * 100 * 0.7) + (momentumThreat * 0.3))));

    return {
      targetHandle, myRatingNow, theirRatingNow, myWeightedAC, theirWeightedAC,
      myStreak, theirStreak, myPeak, theirPeak, theirMeta,
      wins, losses, ties, clashes,
      threatScore, winProb: 1 - eloExpected,
      sortedTags, myTagData, theirTagData, theirTagColors,
      overlapPoints, mySpeedWins, theirSpeedWins, maxSpeed
    };
  }, [mySubs, myHistory, myRating, targetData]);

  // Clean Chart Configurations
  const scatterData = useMemo(() => {
    if (!metrics || metrics.overlapPoints.length === 0) return null;
    return {
      datasets: [
        { 
          type: 'line' as const, 
          label: 'Tie', 
          data: [{ x: 0, y: 0 }, { x: metrics.maxSpeed, y: metrics.maxSpeed }], 
          borderColor: 'var(--border)', 
          borderWidth: 1, 
          borderDash: [5, 5], 
          pointRadius: 0, 
          fill: false 
        },
        { 
          type: 'scatter' as const, 
          label: 'H2H', 
          data: metrics.overlapPoints, 
          backgroundColor: metrics.overlapPoints.map((p: any) => p.x < p.y ? 'var(--accent)' : (p.x > p.y ? 'var(--status-wa)' : '#555')), 
          pointRadius: 4 
        }
      ]
    };
  }, [metrics]);

  const scatterOptions = useMemo(() => {
    if (!metrics) return {};
    return {
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { 
        legend: { display: false }, 
        tooltip: { callbacks: { label: (ctx: any) => ` [${ctx.raw.pid}] You: ${ctx.raw.x}ms | Them: ${ctx.raw.y}ms` } } 
      }, 
      scales: { 
        x: { 
          title: { display: true, text: `Your Time (ms)`, color: '#8b949e', font: { size: 10 } }, 
          grid: { color: 'rgba(255,255,255,0.04)' }, 
          ticks: { color: '#666' }, 
          min: 0, 
          max: metrics.maxSpeed 
        }, 
        y: { 
          title: { display: true, text: `${metrics.targetHandle} Time (ms)`, color: '#8b949e', font: { size: 10 } }, 
          grid: { color: 'rgba(255,255,255,0.04)' }, 
          ticks: { color: '#666' }, 
          min: 0, 
          max: metrics.maxSpeed 
        } 
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

  const barOptions = { 
      indexAxis: 'y' as const, 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 } } } }, 
      scales: { 
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b949e', font: { size: 10 } } }, 
          y: { grid: { display: false }, ticks: { color: 'var(--text-main)', font: { size: 10 } } } 
      } 
  };


  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 relative">
      
      {/* --- INDEPENDENT ROSTER SELECTION --- */}
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

      {loading && <div className="text-center py-20 font-bold uppercase tracking-widest animate-pulse" style={{ color: 'var(--status-wa)' }}>Acquiring Target Intel...</div>}

      {/* --- SCOUTING REPORT --- */}
      {metrics && !loading && (
        <div className="flex flex-col gap-5 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex items-center justify-center gap-8 py-8 px-6 rounded-xl relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--status-wa)' }}>
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, var(--accent), var(--status-wa))' }} />
            <div className="text-right flex-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>You</p>
              <p className="text-3xl font-black font-mono" style={{ color: 'var(--text-main)' }}>{myHandle}</p>
            </div>
            <p className="text-3xl font-black italic" style={{ color: 'var(--text-muted)' }}>VS</p>
            <div className="text-left flex-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-1 animate-pulse" style={{ color: 'var(--status-wa)' }}>Target</p>
              <p className="text-3xl font-black font-mono" style={{ color: 'var(--text-main)' }}>{metrics.targetHandle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Direct Clashes */}
            <Card className="md:col-span-1 relative overflow-hidden border-none" style={{ background: 'linear-gradient(145deg, var(--bg-card), var(--bg-base))' }}>
              <div className="absolute inset-0 opacity-5" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, var(--status-wa) 10px, var(--status-wa) 20px)' }}/>
              <CardTitle>Direct Clashes (Shared Contests)</CardTitle>
              <div className="flex justify-center items-center gap-4 mb-4 relative z-10">
                <div className="text-center"><p className="text-4xl font-black" style={{ color: 'var(--status-ac)' }}>{metrics.wins}</p><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Wins</p></div>
                <div className="text-center text-3xl font-black" style={{ color: 'var(--text-muted)' }}>-</div>
                <div className="text-center"><p className="text-4xl font-black" style={{ color: 'var(--status-wa)' }}>{metrics.losses}</p><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Losses</p></div>
                <div className="text-center text-3xl font-black" style={{ color: 'var(--text-muted)' }}>-</div>
                <div className="text-center"><p className="text-4xl font-black" style={{ color: 'var(--text-muted)' }}>{metrics.ties}</p><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Ties</p></div>
              </div>
              <div className="h-[120px] overflow-y-auto pr-2 relative z-10 space-y-2">
                {metrics.clashes.length === 0 ? <p className="text-xs text-center italic" style={{ color: 'var(--text-muted)' }}>No shared contests yet. Cowards.</p> : 
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

            {/* Tactical Intel */}
            <Card className="md:col-span-2 grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <CardTitle>Tactical Intel: Current Meta</CardTitle>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Card className="flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Rating Differential</p>
                <div className="flex justify-between items-end">
                  <div><p className="text-2xl font-black font-mono" style={{ color: 'var(--accent)' }}>{metrics.myRatingNow}</p></div>
                  {metrics.myRatingNow !== metrics.theirRatingNow && (
                     <span className="text-xs font-black px-2 py-1 rounded font-mono mb-1" style={{ color: metrics.myRatingNow > metrics.theirRatingNow ? 'var(--status-ac)' : 'var(--status-wa)', background: metrics.myRatingNow > metrics.theirRatingNow ? 'rgba(62,207,142,0.1)' : 'rgba(248,81,73,0.1)' }}>
                        {metrics.myRatingNow > metrics.theirRatingNow ? '▲' : '▼'} {Math.abs(metrics.myRatingNow - metrics.theirRatingNow)}
                     </span>
                  )}
                  <div><p className="text-2xl font-black font-mono" style={{ color: 'var(--status-wa)' }}>{metrics.theirRatingNow}</p></div>
                </div>
             </Card>
             <Card className="flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Weighted Activity Score</p>
                <div className="flex justify-between items-end">
                  <div><p className="text-2xl font-black font-mono" style={{ color: 'var(--accent)' }}>{metrics.myWeightedAC}</p></div>
                  <div><p className="text-2xl font-black font-mono" style={{ color: 'var(--status-wa)' }}>{metrics.theirWeightedAC}</p></div>
                </div>
             </Card>
             <div className="rounded-xl p-5 relative overflow-hidden flex flex-col justify-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
               <p className="text-[10px] font-bold uppercase tracking-widest relative z-10" style={{ color: 'var(--text-muted)' }}>Expected Win Rate vs Target</p>
               <p className="text-4xl font-black font-mono mt-2 relative z-10" style={{ color: metrics.winProb >= 0.5 ? 'var(--status-ac)' : 'var(--status-wa)' }}>{(metrics.winProb * 100).toFixed(1)}%</p>
               <div className="absolute -right-4 -bottom-4 opacity-10 blur-2xl" style={{ width: 100, height: 100, background: metrics.winProb >= 0.5 ? 'var(--status-ac)' : 'var(--status-wa)', borderRadius: '50%' }} />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {metrics.overlapPoints.length > 0 && scatterData && (
              <Card>
                <CardTitle>⚡ Speed — Shared Problems</CardTitle>
                <div className="flex justify-between text-sm mb-4 font-bold font-mono">
                  <span style={{ color: 'var(--accent)' }}>You faster: {metrics.mySpeedWins}</span>
                  <span style={{ color: 'var(--status-wa)' }}>Target faster: {metrics.theirSpeedWins}</span>
                </div>
                <div className="h-[250px]">
                  <Scatter data={scatterData as any} options={scatterOptions as any} />
                </div>
              </Card>
            )}
            <Card className={metrics.overlapPoints.length > 0 ? '' : 'md:col-span-2'}>
              <CardTitle>🏷 Tag Mastery</CardTitle>
              <div className="overflow-y-auto pr-2 h-[285px]">
                <div style={{ height: `${Math.max(400, metrics.sortedTags.length * 28)}px`, position: 'relative' }}>
                  {barData && <Bar data={barData} options={barOptions} />}
                </div>
              </div>
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}