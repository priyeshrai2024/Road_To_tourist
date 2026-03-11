"use client";
import { useMemo } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { CF_SCORE_MAP } from "@/lib/constants";

interface NemesisProps {
  mySubs: any[];
  targetSubs: any[];
  targetHandle: string;
  myRating: number;
  myHandle: string;
  myHistory: any[];
  targetHistory: any[];
  myInfo: any;
  targetInfo: any;
}

function TopLine({ color }: { color: string }) {
  return <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
}

function PulseDot({ color }: { color: string }) {
  return <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ background: color, color }} />;
}

function recencyWeightedAC(subs: any[], now: number): number {
  const λ = 0.03;
  const seen = new Set<string>();
  let score = 0;
  [...subs].reverse().forEach(s => {
    if (s.verdict === 'OK' && s.problem) {
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (!seen.has(pid)) {
        seen.add(pid);
        const daysAgo = (now - s.creationTimeSeconds) / 86400;
        score += Math.exp(-λ * daysAgo);
      }
    }
  });
  return parseFloat(score.toFixed(1));
}

function StatDiffCard({
  label, myVal, theirVal, myHandle, theirHandle, higherIsBetter = true, suffix = '', color, note,
}: {
  label: string; myVal: number; theirVal: number; myHandle: string; theirHandle: string;
  higherIsBetter?: boolean; suffix?: string; color: string; note?: string;
}) {
  const diff = myVal - theirVal;
  const ahead = higherIsBetter ? diff > 0 : diff < 0;
  const diffAbs = Math.abs(diff);
  return (
    <div className="relative overflow-hidden rounded-xl p-5 flex flex-col gap-2 transition-transform hover:-translate-y-1"
      style={{ background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 100%)', border: `1px solid ${color}22`, boxShadow: `0 4px 20px ${color}08` }}>
      <TopLine color={color} />
      <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#555] font-bold">{label}</div>
      <div className="flex justify-between items-end gap-2 mt-1">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] text-[#666] uppercase tracking-widest">{myHandle}</span>
          <span className="font-mono text-2xl font-black" style={{ color: '#e3b341' }}>{myVal.toLocaleString()}{suffix}</span>
        </div>
        <div className="flex flex-col items-center px-2 pb-1">
          {diffAbs > 0 && (
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-black/50 border border-white/5" style={{ color: ahead ? '#56d364' : '#f85149' }}>
              {ahead ? '▲' : '▼'} {diffAbs.toLocaleString()}{suffix}
            </span>
          )}
          {diffAbs === 0 && <span className="font-mono text-[10px] text-[#555] font-bold tracking-widest">TIE</span>}
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] text-[#666] uppercase tracking-widest">{theirHandle}</span>
          <span className="font-mono text-2xl font-black" style={{ color: '#f85149' }}>{theirVal.toLocaleString()}{suffix}</span>
        </div>
      </div>
      {note && <div className="font-mono text-[9px] text-[#333] mt-1 italic">{note}</div>}
    </div>
  );
}

function ThreatMeter({ score, winProb }: { score: number, winProb: number }) {
  const level = score >= 80 ? 'CRITICAL THREAT' : score >= 60 ? 'HIGH THREAT' : score >= 40 ? 'MODERATE' : score >= 20 ? 'LOW' : 'MINIMAL';
  const color = score >= 80 ? '#f85149' : score >= 60 ? '#db6d28' : score >= 40 ? '#e3b341' : '#56d364';
  const bars = 10;
  const filled = Math.round((score / 100) * bars);
  return (
    <div className="relative overflow-hidden rounded-xl p-6 flex flex-col gap-4"
      style={{ background: '#050505', border: `1px solid ${color}44`, boxShadow: `inset 0 0 40px ${color}08, 0 0 20px ${color}15` }}>
      <TopLine color={color} />
      <div className="font-mono text-[10px] uppercase tracking-[3px] flex items-center gap-3 font-bold" style={{ color }}>
        <PulseDot color={color} /> TACTICAL THREAT ASSESSMENT
      </div>
      <div className="flex items-center gap-5">
        <div>
          <div className="font-mono text-5xl font-black tracking-tighter" style={{ color, textShadow: `0 0 20px ${color}44` }}>{score}</div>
          <div className="font-mono text-[10px] uppercase tracking-[3px] mt-1" style={{ color }}>{level}</div>
        </div>
        <div className="flex-1 flex flex-col gap-[3px]">
          {Array.from({ length: bars }).map((_, i) => (
            <div key={i} className="w-full h-1.5 rounded-full"
              style={{ background: i < filled ? color : '#111', boxShadow: i < filled ? `0 0 8px ${color}66` : 'none' }} />
          )).reverse()}
        </div>
      </div>
      <div className="font-mono text-[9px] text-[#444] uppercase tracking-widest leading-relaxed border-t border-[#1a1a1a] pt-3 mt-1">
        <span className="text-[#888]">Elo Win Prob: {(winProb*100).toFixed(1)}%</span> // Velocity & Elo weighted
      </div>
    </div>
  );
}

export default function Nemesis({
  mySubs, targetSubs, targetHandle, myRating,
  myHandle, myHistory, targetHistory, myInfo, targetInfo
}: NemesisProps) {

  const metrics = useMemo(() => {
    if (!mySubs || !targetSubs) return null;
    const now = Date.now() / 1000;

    const myTagsAll: Record<string, number> = {};
    const targetTagsAll: Record<string, number> = {};
    
    // Process My Subs
    const myACSet = new Set<string>();
    const myAttempts = new Set<string>();
    let myFirstTryCount = 0;
    let myWeek0Score = 0;
    const mySpeed: Record<string, number> = {};

    [...mySubs].reverse().forEach(s => {
      if (!s.problem) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      
      if (!myAttempts.has(pid)) {
        myAttempts.add(pid);
        if (s.verdict === 'OK') myFirstTryCount++;
      }

      if (s.verdict === 'OK') {
        if (!myACSet.has(pid)) {
          myACSet.add(pid);
          s.problem.tags?.forEach((t: string) => { myTagsAll[t] = (myTagsAll[t] || 0) + 1; });
          const daysAgo = (now - s.creationTimeSeconds) / 86400;
          if (daysAgo <= 7) {
            const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
            myWeek0Score += CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;
          }
        }
        if (s.timeConsumedMillis !== undefined) {
          if (!mySpeed[pid] || s.timeConsumedMillis < mySpeed[pid]) mySpeed[pid] = s.timeConsumedMillis;
        }
      }
    });

    // Process Target Subs
    const tACSet = new Set<string>();
    const tAttempts = new Set<string>();
    let tFirstTryCount = 0;
    let currentSum = 0; let currentCount = 0;
    let week0Score = 0;
    const weekScores = [0, 0, 0, 0, 0];
    const theirSpeed: Record<string, number> = {};

    [...targetSubs].reverse().forEach(s => {
      if (!s.problem) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      
      if (!tAttempts.has(pid)) {
        tAttempts.add(pid);
        if (s.verdict === 'OK') tFirstTryCount++;
      }

      if (s.verdict === 'OK') {
        if (!tACSet.has(pid)) {
          tACSet.add(pid);
          const daysAgo = (now - s.creationTimeSeconds) / 86400;
          const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
          const pts = CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;

          s.problem.tags?.forEach((t: string) => { targetTagsAll[t] = (targetTagsAll[t] || 0) + 1; });

          if (daysAgo <= 30 && s.problem.rating) { currentSum += s.problem.rating; currentCount++; }

          if (daysAgo <= 7) week0Score += pts;
          else if (daysAgo <= 14) weekScores[0] += pts;
          else if (daysAgo <= 21) weekScores[1] += pts;
          else if (daysAgo <= 28) weekScores[2] += pts;
          else if (daysAgo <= 35) weekScores[3] += pts;
          else if (daysAgo <= 42) weekScores[4] += pts;
        }
        if (s.timeConsumedMillis !== undefined) {
          if (!theirSpeed[pid] || s.timeConsumedMillis < theirSpeed[pid]) theirSpeed[pid] = s.timeConsumedMillis;
        }
      }
    });

    // Head to head speed overlaps
    const overlapPoints: any[] = [];
    let mySpeedWins = 0;
    let theirSpeedWins = 0;
    let maxSpeed = 0;

    Object.keys(mySpeed).forEach(pid => {
      if (theirSpeed[pid] !== undefined) {
        const x = mySpeed[pid];
        const y = theirSpeed[pid];
        overlapPoints.push({ x, y, pid });
        if (x < y) mySpeedWins++;
        else if (y < x) theirSpeedWins++;
        if (x > maxSpeed) maxSpeed = x;
        if (y > maxSpeed) maxSpeed = y;
      }
    });
    maxSpeed = Math.min(maxSpeed + 100, 3000); // Cap graph so outliers don't break the UI

    const activePastWeeks = weekScores.filter(s => s > 0);
    const avgPastWeekScore = activePastWeeks.length > 0 ? activePastWeeks.reduce((a, b) => a + b, 0) / activePastWeeks.length : 0;

    const myRatingNow = myRating || 1200;
    const theirRatingNow = targetInfo?.rating || 1200;
    const myWeightedAC = recencyWeightedAC(mySubs, now);
    const theirWeightedAC = recencyWeightedAC(targetSubs, now);
    const myAccuracy = myAttempts.size > 0 ? parseFloat(((myFirstTryCount / myAttempts.size) * 100).toFixed(1)) : 0;
    const tAccuracy = tAttempts.size > 0 ? parseFloat(((tFirstTryCount / tAttempts.size) * 100).toFixed(1)) : 0;

    const eloExpected = 1 / (1 + Math.pow(10, (myRatingNow - theirRatingNow) / 400));
    const eloThreat = eloExpected * 100;

    const momentumRatio = theirWeightedAC / Math.max(0.1, myWeightedAC);
    let momentumThreat = 50;
    if (momentumRatio > 2) momentumThreat = 100;
    else if (momentumRatio > 1) momentumThreat = 50 + ((momentumRatio - 1) * 50);
    else momentumThreat = momentumRatio * 50;

    const threatScore = Math.min(100, Math.max(1, Math.round((eloThreat * 0.7) + (momentumThreat * 0.3))));

    const allTags = Array.from(new Set([...Object.keys(targetTagsAll), ...Object.keys(myTagsAll)]));
    const sortedTags = allTags.sort((a, b) => (targetTagsAll[b] || 0) + (myTagsAll[b] || 0) - ((targetTagsAll[a] || 0) + (myTagsAll[a] || 0)));
    
    const myTagData = sortedTags.map(t => myTagsAll[t] || 0);
    const theirTagData = sortedTags.map(t => targetTagsAll[t] || 0);
    const theirTagColors = theirTagData.map((val, i) => val > myTagData[i] ? '#f85149' : '#2ea043');

    let allTS = new Set<number>();
    myHistory.forEach((h: any) => allTS.add(h.ratingUpdateTimeSeconds));
    targetHistory.forEach((h: any) => allTS.add(h.ratingUpdateTimeSeconds));
    const sortedTS = Array.from(allTS).sort((a, b) => a - b);

    const buildLine = (hist: any[]) => {
      const hMap: Record<number, number> = {};
      hist.forEach((h: any) => hMap[h.ratingUpdateTimeSeconds] = h.newRating);
      let last: number | null = null;
      return sortedTS.map(ts => { if (hMap[ts]) last = hMap[ts]; return last; });
    };

    const ratingLineData = {
      labels: sortedTS.map(ts => { const d = new Date(ts * 1000); return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`; }),
      datasets: [
        { label: myHandle, data: buildLine(myHistory), borderColor: '#e3b341', backgroundColor: 'rgba(227,179,65,0.05)', borderWidth: 2, pointRadius: 1, tension: 0.2, spanGaps: false },
        { label: targetHandle, data: buildLine(targetHistory), borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.05)', borderWidth: 2, pointRadius: 1, tension: 0.2, spanGaps: false },
      ],
    };

    return {
      avgRating30D: currentCount > 0 ? Math.round(currentSum / currentCount) : 0,
      sortedTags, myTagData, theirTagData, theirTagColors,
      ratingLineData, overlapPoints, mySpeedWins, theirSpeedWins, maxSpeed,
      scorePerDayCurrent: parseFloat((week0Score / 7).toFixed(1)),
      avgScorePerWeekPast: parseFloat(avgPastWeekScore.toFixed(1)),
      myRatingNow, theirRatingNow,
      myWeightedAC, theirWeightedAC,
      myWeekScore: myWeek0Score, theirWeekScore: week0Score,
      myAccuracy, tAccuracy, threatScore, winProb: 1 - eloExpected
    };
  }, [mySubs, targetSubs, myRating, myHandle, myHistory, targetHistory, targetInfo]);

  if (!metrics) return null;

  const velTrendingUp = metrics.scorePerDayCurrent * 7 > metrics.avgScorePerWeekPast;
  const velColor = velTrendingUp ? '#f85149' : '#56d364';

  const lineOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10 } } },
    scales: { x: { display: false }, y: { grid: { color: '#0f0f0f' }, ticks: { color: '#555', font: { family: 'JetBrains Mono', size: 10 } } } },
  };

  const horizontalTagOpts: any = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10 } } },
    scales: {
      x: { grid: { color: '#1a1a1a' }, ticks: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 } } },
      y: { grid: { display: false }, ticks: { color: '#c9d1d9', font: { family: 'JetBrains Mono', size: 10 } } }
    }
  };
  const dynamicTagHeight = Math.max(400, metrics.sortedTags.length * 28);

  const scatterData = {
    datasets: [
      {
        type: 'line' as const,
        label: 'Tie Line',
        data: [{ x: 0, y: 0 }, { x: metrics.maxSpeed, y: metrics.maxSpeed }],
        borderColor: '#333',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        type: 'scatter' as const,
        label: 'Head-to-Head',
        data: metrics.overlapPoints,
        backgroundColor: metrics.overlapPoints.map((p: any) => p.x < p.y ? '#e3b341' : (p.x > p.y ? '#f85149' : '#555')),
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  };

  const scatterOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` [${ctx.raw.pid}] You: ${ctx.raw.x}ms | Them: ${ctx.raw.y}ms`
        }
      }
    },
    scales: {
      x: { title: { display: true, text: `Your Execution Time (ms) - ${myHandle}`, color: '#e3b341', font: {family: 'JetBrains Mono', size: 10} }, grid: { color: '#1a1a1a' }, ticks: { color: '#555' }, min: 0, max: metrics.maxSpeed },
      y: { title: { display: true, text: `Nemesis Execution Time (ms) - ${targetHandle}`, color: '#f85149', font: {family: 'JetBrains Mono', size: 10} }, grid: { color: '#1a1a1a' }, ticks: { color: '#555' }, min: 0, max: metrics.maxSpeed }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* ── AGGRESSIVE WAR ROOM VS HEADER ─────────────────────────────── */}
      <div className="flex items-center justify-center gap-6 py-8 px-4 rounded-xl relative overflow-hidden" 
           style={{ background: 'linear-gradient(90deg, rgba(227,179,65,0.05) 0%, rgba(5,5,5,1) 50%, rgba(248,81,73,0.05) 100%)', border: '1px solid #1a1a1a' }}>
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#e3b341] via-[#111] to-[#f85149]" />
        <div className="text-right flex-1">
          <div className="text-[10px] uppercase tracking-[4px] text-[#e3b341] font-bold mb-1">YOU</div>
          <div className="text-3xl md:text-4xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_15px_rgba(227,179,65,0.4)]">{myHandle}</div>
        </div>
        <div className="text-4xl font-black italic text-[#333] px-2" style={{ textShadow: '2px 2px 0 #000' }}>VS</div>
        <div className="text-left flex-1">
          <div className="text-[10px] uppercase tracking-[4px] text-[#f85149] font-bold mb-1">NEMESIS</div>
          <div className="text-3xl md:text-4xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_15px_rgba(248,81,73,0.4)]">{targetHandle}</div>
        </div>
      </div>

      {/* ── ROW 1: HEAD-TO-HEAD STATS ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatDiffCard label="Current Rating" myVal={metrics.myRatingNow} theirVal={metrics.theirRatingNow} myHandle={myHandle} theirHandle={targetHandle} color="#e3b341" />
        <StatDiffCard label="Weighted ACs" myVal={metrics.myWeightedAC} theirVal={metrics.theirWeightedAC} myHandle={myHandle} theirHandle={targetHandle} color="#58a6ff" note="Recent solves weighted heavily" />
        <StatDiffCard label="7-Day Score (pts)" myVal={metrics.myWeekScore} theirVal={metrics.theirWeekScore} myHandle={myHandle} theirHandle={targetHandle} color="#56d364" />
        <StatDiffCard label="First-Try Acc." myVal={metrics.myAccuracy} theirVal={metrics.tAccuracy} myHandle={myHandle} theirHandle={targetHandle} suffix="%" color="#d2a8ff" note="One-shot solve percentage" />
      </div>

      {/* ── ROW 2: CALIBER + VELOCITY + THREAT ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#050505] border border-[#e3b341]/30 rounded-xl p-6 relative overflow-hidden shadow-[0_0_20px_rgba(227,179,65,0.07)]">
          <TopLine color="#e3b341" />
          <div className="font-mono text-[10px] tracking-[3px] uppercase text-[#e3b341] font-bold mb-2 flex items-center gap-2">
            <PulseDot color="#e3b341" /> 30-Day Caliber
          </div>
          <div className="text-5xl font-mono text-white font-black tracking-tight mt-2">{metrics.avgRating30D || 'N/A'}</div>
          <p className="text-[#666] text-[9px] mt-3 font-mono tracking-[1.5px] uppercase leading-relaxed">
            Avg rating {targetHandle} is clearing right now
          </p>
        </div>

        <div className="bg-[#050505] rounded-xl p-6 relative overflow-hidden transition-all"
          style={{ border: `1px solid ${velColor}44`, boxShadow: `0 0 20px ${velColor}10` }}>
          <TopLine color={velColor} />
          <div className="font-mono text-[10px] tracking-[3px] uppercase font-bold mb-2 flex items-center gap-2" style={{ color: velColor }}>
            <PulseDot color={velColor} /> Velocity / Week
          </div>
          <div className="font-mono font-black text-5xl tracking-tight mt-2 text-white">
            {(metrics.scorePerDayCurrent * 7).toFixed(0)}
            <span className="text-sm font-normal ml-1.5" style={{ color: velColor }}>pts</span>
          </div>
          <div className="mt-3 font-mono text-[9px] tracking-[1.5px] uppercase font-bold" style={{ color: velColor }}>
            {velTrendingUp ? '⚠ ACCELERATING — GRIND HARDER' : '✓ DECELERATING — PUSH NOW'}
          </div>
          <p className="text-[#666] text-[9px] mt-1 font-mono uppercase">
            vs {metrics.avgScorePerWeekPast} pts/wk historical avg
          </p>
        </div>

        <ThreatMeter score={metrics.threatScore} winProb={metrics.winProb} />
      </div>

      {/* ── ROW 3: DIRECT OVERLAP BATTLES (EXECUTION SPEED) ─────────────────────── */}
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[3px] text-[#56d364] flex items-center gap-2">
            <span className="text-lg">⚔️</span> ALGORITHMIC EFFICIENCY (OVERLAPS)
          </div>
          <div className="flex gap-4 font-mono text-[10px] uppercase">
            <span className="text-[#e3b341] bg-[#e3b341]/10 px-3 py-1 rounded border border-[#e3b341]/20">You Coded Faster: {metrics.mySpeedWins}</span>
            <span className="text-[#f85149] bg-[#f85149]/10 px-3 py-1 rounded border border-[#f85149]/20">They Coded Faster: {metrics.theirSpeedWins}</span>
          </div>
        </div>
        <div className="h-[350px] w-full"><Scatter data={scatterData} options={scatterOpts} /></div>
        <p className="text-[#666] font-mono text-[9px] uppercase mt-4 text-center">
          Plots execution time (ms) for every problem you both solved. Dots above the line mean your algorithm was faster.
        </p>
      </div>

      {/* ── ROW 4: RATING TRAJECTORY ─────────────────────── */}
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-xl p-6">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[3px] text-[#58a6ff] mb-6 flex items-center gap-2">
          <span className="text-lg">📈</span> RATING TRAJECTORY WARFARE
        </div>
        <div className="h-[280px] w-full"><Line data={metrics.ratingLineData} options={lineOpts} /></div>
      </div>

      {/* ── ROW 5: ALGORITHMIC MASTERY ───────────────────────── */}
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-xl p-6 flex flex-col">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[3px] text-[#e879f9] mb-2 flex items-center gap-2">
          <span className="text-lg">🕸</span> ALGORITHMIC MASTERY SHOWDOWN
        </div>
        <p className="text-[#666] font-mono text-[10px] uppercase mb-6">
          Every tag ever solved. <span className="text-[#f85149] font-bold">Red</span> indicates they are beating you. <span className="text-[#56d364] font-bold">Green</span> indicates you hold the line.
        </p>
        
        <div className="w-full overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: '600px' }}>
          <div style={{ height: `${dynamicTagHeight}px`, position: 'relative' }}>
            <Bar
              data={{ 
                labels: metrics.sortedTags, 
                datasets: [
                  { label: myHandle, data: metrics.myTagData, backgroundColor: '#e3b341', borderRadius: 4 }, 
                  { label: targetHandle, data: metrics.theirTagData, backgroundColor: metrics.theirTagColors, borderRadius: 4 }
                ] 
              }}
              options={horizontalTagOpts}
            />
          </div>
        </div>
      </div>

    </div>
  );
}