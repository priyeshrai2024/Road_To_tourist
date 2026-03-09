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

        {/* 30-Day Active Caliber */}
        <div className="bg-[#050505] border border-[#e3b341]/30 rounded-[4px] p-6 relative overflow-hidden shadow-[0_0_20px_rgba(227,179,65,0.08)] group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#e3b341]/60 to-transparent" />
          <div className="absolute bottom-0 right-0 w-[80px] h-[80px] bg-[#e3b341] blur-[60px] opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity duration-500" />
          <h3 className="text-[#e3b341]/60 font-mono text-[10px] tracking-[3px] uppercase mb-1 flex items-center gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-[#e3b341] animate-pulse" />
            30-Day Active Caliber
          </h3>
          <div className="text-5xl font-mono text-[#e3b341] font-bold tracking-tight mt-3">{metrics.avgRating30D || "N/A"}</div>
          <p className="text-[#4a5568] text-[10px] mt-3 font-mono tracking-[1.5px] uppercase leading-relaxed">Avg rating of problems {targetHandle} is solving nowadays.</p>
        </div>

        {/* Velocity */}
        <div className={`bg-[#050505] border rounded-[4px] p-6 relative overflow-hidden group ${velTrendingUp ? 'border-[#f85149]/30 shadow-[0_0_20px_rgba(248,81,73,0.08)]' : 'border-[#56d364]/30 shadow-[0_0_20px_rgba(86,211,100,0.08)]'}`}>
          <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent ${velTrendingUp ? 'via-[#f85149]/60' : 'via-[#56d364]/60'} to-transparent`} />
          <div className={`absolute bottom-0 right-0 w-[80px] h-[80px] blur-[60px] opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity duration-500 ${velTrendingUp ? 'bg-[#f85149]' : 'bg-[#56d364]'}`} />
          <h3 className="text-[#4a5568] font-mono text-[10px] tracking-[3px] uppercase mb-1 flex items-center gap-2">
            <span className={`inline-block w-1 h-1 rounded-full animate-pulse ${velTrendingUp ? 'bg-[#f85149]' : 'bg-[#56d364]'}`} />
            Velocity // Sprint Rate
          </h3>
          <div className="flex items-baseline gap-2 mt-3">
            <div className={`text-5xl font-mono font-bold tracking-tight ${velTrendingUp ? 'text-[#f85149]' : 'text-[#56d364]'}`}>
              {metrics.scorePerDayCurrent}
              <span className="text-sm font-normal ml-1 tracking-[1px]">pts/day</span>
            </div>
          </div>
          <p className="text-[#4a5568] text-[10px] mt-3 font-mono tracking-[1.5px] uppercase">vs {metrics.avgScorePerWeekPast} pts/week avg (Last 5W)</p>
        </div>

        {/* Current Obsessions */}
        <div className="bg-[#050505] border border-[#58a6ff]/20 rounded-[4px] p-6 relative overflow-hidden shadow-[0_0_20px_rgba(88,166,255,0.06)] group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#58a6ff]/40 to-transparent" />
          <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-[#58a6ff] blur-[80px] opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity duration-500" />
          <h3 className="text-[#4a5568] font-mono text-[10px] tracking-[3px] uppercase mb-1 flex items-center gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-[#58a6ff] animate-pulse" />
            Current Obsessions
          </h3>
          <div className="h-[120px] -mt-4">
            <TagsRadarChart data={metrics.recentTags} handle={targetHandle} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Hit List */}
        <div className="bg-[#050505] border border-[#f85149]/40 border-t-[2px] rounded-[4px] p-6 relative overflow-hidden shadow-[0_0_25px_rgba(248,81,73,0.12)]">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#f85149]/80 via-[#f85149]/20 to-transparent" />
          <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#f85149] blur-[120px] opacity-[0.04] pointer-events-none" />
          <h3 className="text-[#f85149] font-mono text-[11px] tracking-[3px] uppercase mb-1 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f85149] animate-pulse shadow-[0_0_6px_#f85149]" />
            Target Lock // Actionable Hit List
          </h3>
          <p className="text-[#4a5568] text-[10px] font-mono tracking-[1px] mb-5 mt-3 uppercase leading-relaxed border-b border-[#f85149]/10 pb-4">
            Problems {targetHandle} solved recently that match your optimal rating (+200 threshold)
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#f85149]/20">
            {metrics.hitList.length === 0
              ? <div className="text-[#4a5568] italic text-xs font-mono tracking-[1px] py-4 text-center border border-dashed border-[#f85149]/10 rounded-[4px]">// NO OPTIMAL TARGETS AVAILABLE</div>
              : metrics.hitList.map(h => (
                <a key={h.pid} href={`https://codeforces.com/contest/${h.cid}/problem/${h.idx}`} target="_blank"
                  className="flex justify-between items-center bg-[rgba(248,81,73,0.03)] border border-[#f85149]/10 p-3 rounded-[4px] hover:border-[#f85149]/50 hover:bg-[rgba(248,81,73,0.07)] hover:shadow-[0_0_12px_rgba(248,81,73,0.1)] transition-all duration-200 group no-underline"
                >
                  <span className="text-[#c9d1d9] font-mono text-xs tracking-[0.5px] group-hover:text-white transition-colors">{h.name}</span>
                  <span className="bg-[rgba(227,179,65,0.08)] text-[#e3b341] px-2 py-1 rounded-[2px] text-[10px] font-bold font-mono tracking-[1px] border border-[#e3b341]/20 shadow-[0_0_8px_rgba(227,179,65,0.1)] ml-3 shrink-0">{h.rating}</span>
                </a>
              ))
            }
          </div>
        </div>

        {/* Snipe Intel Feed */}
        <div className="bg-[#050505] border border-[#58a6ff]/30 border-t-[2px] rounded-[4px] p-6 relative overflow-hidden shadow-[0_0_25px_rgba(88,166,255,0.10)]">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#58a6ff]/80 via-[#58a6ff]/20 to-transparent" />
          <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#58a6ff] blur-[120px] opacity-[0.05] pointer-events-none" />
          <h3 className="text-[#58a6ff] font-mono text-[11px] tracking-[3px] uppercase mb-1 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse shadow-[0_0_6px_#58a6ff]" />
            Snipe Intel Feed // 30 Days
          </h3>
          <p className="text-[#4a5568] text-[10px] font-mono tracking-[1px] mb-5 mt-3 uppercase leading-relaxed border-b border-[#58a6ff]/10 pb-4">
            Live feed of problems YOU conquered that {targetHandle} recently copied
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#58a6ff]/20">
            {metrics.snipes.length === 0
              ? <div className="text-[#4a5568] italic text-xs font-mono tracking-[1px] py-4 text-center border border-dashed border-[#58a6ff]/10 rounded-[4px]">// TERRITORY SECURE — NO RECENT SNIPES DETECTED</div>
              : metrics.snipes.map((s, i) => (
                <div key={i} className="flex gap-3 text-xs font-mono items-center border-l-2 border-[#58a6ff]/60 pl-3 bg-[rgba(88,166,255,0.03)] hover:bg-[rgba(88,166,255,0.07)] py-2.5 rounded-r-[4px] hover:border-[#58a6ff] transition-all duration-200 group">
                  <span className="text-[#f85149] font-bold tracking-[0.5px] shrink-0">[{targetHandle}]</span>
                  <span className="text-[#4a5568] tracking-[1px] shrink-0">SNIPED</span>
                  <span className="text-[#c9d1d9] truncate max-w-[140px] group-hover:text-white transition-colors">{s.name}</span>
                  <span className="ml-auto text-[10px] text-[#58a6ff] tracking-[1px] shrink-0 bg-[rgba(88,166,255,0.08)] px-2 py-0.5 rounded-[2px] border border-[#58a6ff]/20">({s.rating})</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
