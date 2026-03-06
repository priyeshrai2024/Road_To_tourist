"use client";
import { useMemo } from 'react';
import { TagsRadarChart } from './Charts';

const CF_SCORE_MAP: Record<number, number> = { 800:15, 900:20, 1000:30, 1100:45, 1200:65, 1300:90, 1400:130, 1500:180, 1600:250, 1700:350, 1800:500, 1900:720, 2000:1050, 2100:1530, 2200:2250, 2300:3300, 2400:4800 };

export default function Nemesis({ mySubs, targetSubs, targetHandle, myRating }: { mySubs: any[], targetSubs: any[], targetHandle: string, myRating: number }) {
  
  const metrics = useMemo(() => {
    if (!mySubs || !targetSubs) return null;
    const now = Date.now() / 1000;
    
    // My Solved Map (PID -> Timestamp)
    const mySolved: Record<string, number> = {};
    [...mySubs].reverse().forEach(s => { if (s.verdict === 'OK' && s.problem) mySolved[`${s.problem.contestId}-${s.problem.index}`] = s.creationTimeSeconds; });

    let currentSum = 0; let currentCount = 0;
    const recentTags: Record<string, number> = {};
    let week0Score = 0; let week1to5Score = 0;
    
    const snipes: any[] = [];
    const hitList: any[] = [];

    const tSolved = new Set<string>();

    [...targetSubs].reverse().forEach(s => {
      if (s.verdict === 'OK' && s.problem) {
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        if (!tSolved.has(pid)) {
          tSolved.add(pid);
          const daysAgo = (now - s.creationTimeSeconds) / 86400;
          const r = s.problem.rating ? Math.floor(s.problem.rating/100)*100 : 800;
          const pts = CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;

          // 1. Nowadays Logic (Last 30 Days)
          if (daysAgo <= 30 && s.problem.rating) {
            currentSum += s.problem.rating; currentCount++;
            s.problem.tags?.forEach((t:string) => recentTags[t] = (recentTags[t] || 0) + 1);
          }

          // 2. Velocity Logic
          if (daysAgo <= 7) week0Score += pts;
          else if (daysAgo <= 42) week1to5Score += pts;

          // 3. Recon & Snipes
          if (daysAgo <= 30) {
            if (mySolved[pid] && mySolved[pid] < s.creationTimeSeconds) {
              snipes.push({ pid, name: s.problem.name, rating: s.problem.rating || 800, time: s.creationTimeSeconds });
            } else if (!mySolved[pid] && s.problem.rating && s.problem.rating >= myRating && s.problem.rating <= myRating + 200) {
              hitList.push({ pid, name: s.problem.name, rating: s.problem.rating, cid: s.problem.contestId, idx: s.problem.index });
            }
          }
        }
      }
    });

    return {
      avgRating30D: currentCount > 0 ? Math.round(currentSum / currentCount) : 0,
      recentTags,
      scorePerDayCurrent: (week0Score / 7).toFixed(1),
      avgScorePerWeekPast: (week1to5Score / 5).toFixed(1),
      snipes: snipes.sort((a,b) => b.time - a.time),
      hitList: hitList.sort((a,b) => b.rating - a.rating)
    };
  }, [mySubs, targetSubs, myRating]);

  if (!metrics) return null;

  const velTrendingUp = parseFloat(metrics.scorePerDayCurrent) * 7 > parseFloat(metrics.avgScorePerWeekPast);

  return (
    <div className="space-y-6 animate-in fade-in duration-400">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6">
          <h3 className="text-[#8b949e] font-mono text-xs uppercase mb-2">30-Day Active Caliber</h3>
          <div className="text-4xl font-mono text-[#e3b341] font-bold">{metrics.avgRating30D || "N/A"}</div>
          <p className="text-[#8b949e] text-xs mt-2 uppercase">Average rating of problems {targetHandle} is actually solving nowadays.</p>
        </div>
        <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6">
          <h3 className="text-[#8b949e] font-mono text-xs uppercase mb-2">Velocity (Sprint Rate)</h3>
          <div className="flex items-baseline gap-2">
            <div className={`text-4xl font-mono font-bold ${velTrendingUp ? 'text-[#f85149]' : 'text-[#56d364]'}`}>{metrics.scorePerDayCurrent} <span className="text-sm">pts/day</span></div>
          </div>
          <p className="text-[#8b949e] text-xs mt-2 uppercase">vs {metrics.avgScorePerWeekPast} pts/week avg (Last 5W).</p>
        </div>
        <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6">
          <h3 className="text-[#8b949e] font-mono text-xs uppercase mb-2">Current Obsessions</h3>
          <div className="h-[120px] -mt-4"><TagsRadarChart data={metrics.recentTags} handle={targetHandle} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e2024] border border-[#f85149] border-t-[3px] rounded-[12px] p-6">
          <h3 className="text-[#f85149] font-mono text-sm uppercase tracking-[1px] mb-4 border-b border-[#30363d] pb-2">Target Lock: Actionable Hit List</h3>
          <p className="text-[#8b949e] text-xs font-mono mb-4">Problems {targetHandle} solved recently that perfectly match your optimal rating (+200 threshold).</p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {metrics.hitList.length === 0 ? <div className="text-[#8b949e] italic text-sm font-mono">No optimal targets available.</div> : 
              metrics.hitList.map(h => (
                <a key={h.pid} href={`https://codeforces.com/contest/${h.cid}/problem/${h.idx}`} target="_blank" className="flex justify-between items-center bg-black/40 border border-[#30363d] p-3 rounded-[6px] hover:border-[#e3b341] transition-colors group no-underline">
                  <span className="text-white font-mono text-sm group-hover:text-[#58a6ff]">{h.name}</span>
                  <span className="bg-[rgba(227,179,65,0.1)] text-[#e3b341] px-2 py-1 rounded text-xs font-bold font-mono border border-[#e3b341]/30">{h.rating}</span>
                </a>
              ))
            }
          </div>
        </div>

        <div className="bg-[#1e2024] border border-[#58a6ff] border-t-[3px] rounded-[12px] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[#58a6ff] blur-[120px] opacity-10 pointer-events-none"></div>
          <h3 className="text-[#58a6ff] font-mono text-sm uppercase tracking-[1px] mb-4 border-b border-[#30363d] pb-2">Snipe Intel Feed (30 Days)</h3>
          <p className="text-[#8b949e] text-xs font-mono mb-4">Live feed of problems YOU conquered that {targetHandle} recently copied.</p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {metrics.snipes.length === 0 ? <div className="text-[#8b949e] italic text-sm font-mono">Territory secure. No recent snipes detected.</div> : 
              metrics.snipes.map((s, i) => (
                <div key={i} className="flex gap-3 text-sm font-mono items-center border-l-2 border-[#58a6ff] pl-3 bg-[rgba(88,166,255,0.05)] py-2">
                  <span className="text-[#f85149] font-bold">[{targetHandle}]</span>
                  <span className="text-[#8b949e]">sniped</span>
                  <span className="text-white truncate max-w-[150px]">{s.name}</span>
                  <span className="ml-auto text-xs text-[#58a6ff]">({s.rating})</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}