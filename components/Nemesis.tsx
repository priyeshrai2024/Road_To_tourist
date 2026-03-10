"use client";
import { useMemo } from 'react';
import { Radar, Line, Bar } from 'react-chartjs-2';
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
  return <span className="inline-block w-1 h-1 rounded-full animate-pulse" style={{ background: color }} />;
}

// Exponential-decay weighted AC count. λ=0.03 → 30d ago ≈ 0.4×, 90d ≈ 0.07×
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
    <div className="relative overflow-hidden rounded-[4px] p-4 flex flex-col gap-2"
      style={{ background: '#050505', border: `1px solid ${color}22` }}>
      <TopLine color={color} />
      <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#444]">{label}</div>
      <div className="flex justify-between items-end gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] text-[#555] uppercase">{myHandle}</span>
          <span className="font-mono text-xl font-black" style={{ color: '#e3b341' }}>{myVal.toLocaleString()}{suffix}</span>
        </div>
        <div className="flex flex-col items-center px-2">
          {diffAbs > 0 && (
            <span className="font-mono text-[10px] font-bold" style={{ color: ahead ? '#56d364' : '#f85149' }}>
              {ahead ? '▲' : '▼'} {diffAbs.toLocaleString()}{suffix}
            </span>
          )}
          {diffAbs === 0 && <span className="font-mono text-[10px] text-[#555]">EVEN</span>}
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] text-[#555] uppercase">{theirHandle}</span>
          <span className="font-mono text-xl font-black" style={{ color: '#f85149' }}>{theirVal.toLocaleString()}{suffix}</span>
        </div>
      </div>
      {note && <div className="font-mono text-[8px] text-[#2a2a2a] mt-0.5">{note}</div>}
    </div>
  );
}

function ThreatMeter({ score }: { score: number }) {
  const level = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MODERATE' : score >= 20 ? 'LOW' : 'MINIMAL';
  const color = score >= 80 ? '#f85149' : score >= 60 ? '#e3b341' : score >= 40 ? '#db6d28' : '#56d364';
  const bars = 10;
  const filled = Math.round((score / 100) * bars);
  return (
    <div className="relative overflow-hidden rounded-[4px] p-5 flex flex-col gap-3"
      style={{ background: '#050505', border: `1px solid ${color}33`, boxShadow: `0 0 20px ${color}10` }}>
      <TopLine color={color} />
      <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#444] flex items-center gap-2">
        <PulseDot color={color} /> Threat Level Assessment
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-[3px]">
          {Array.from({ length: bars }).map((_, i) => (
            <div key={i} className="w-3 h-6 rounded-[2px]"
              style={{ background: i < filled ? color : '#111', boxShadow: i < filled ? `0 0 6px ${color}66` : 'none' }} />
          ))}
        </div>
        <div>
          <div className="font-mono text-2xl font-black" style={{ color }}>{score}</div>
          <div className="font-mono text-[9px] uppercase tracking-[2px]" style={{ color }}>{level}</div>
        </div>
      </div>
      <div className="font-mono text-[9px] text-[#2a2a2a] leading-relaxed">
        Composite: velocity · rating delta · tag gaps · recent solves
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

    // ── My solved map & tags ──
    const mySolved: Record<string, number> = {};
    const myTags30: Record<string, number> = {};
    const myTagsAll: Record<string, number> = {};

    [...mySubs].reverse().forEach(s => {
      if (s.verdict === 'OK' && s.problem) {
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        if (!mySolved[pid]) {
          mySolved[pid] = s.creationTimeSeconds;
          const daysAgo = (now - s.creationTimeSeconds) / 86400;
          s.problem.tags?.forEach((t: string) => {
            myTagsAll[t] = (myTagsAll[t] || 0) + 1;
            if (daysAgo <= 30) myTags30[t] = (myTags30[t] || 0) + 1;
          });
        }
      }
    });

    // ── Target pass ──
    const tSolved = new Set<string>();
    const targetTags30: Record<string, number> = {};
    const targetTagsAll: Record<string, number> = {};
    let currentSum = 0; let currentCount = 0;
    let week0Score = 0;
    const weekScores = [0, 0, 0, 0, 0];
    const snipesAllTime: any[] = [];

    [...targetSubs].reverse().forEach(s => {
      if (s.verdict === 'OK' && s.problem) {
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        if (!tSolved.has(pid)) {
          tSolved.add(pid);
          const daysAgo = (now - s.creationTimeSeconds) / 86400;
          const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
          const pts = CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;

          s.problem.tags?.forEach((t: string) => {
            targetTagsAll[t] = (targetTagsAll[t] || 0) + 1;
            if (daysAgo <= 30) targetTags30[t] = (targetTags30[t] || 0) + 1;
          });

          if (daysAgo <= 30 && s.problem.rating) { currentSum += s.problem.rating; currentCount++; }

          if (daysAgo <= 7) week0Score += pts;
          else if (daysAgo <= 14) weekScores[0] += pts;
          else if (daysAgo <= 21) weekScores[1] += pts;
          else if (daysAgo <= 28) weekScores[2] += pts;
          else if (daysAgo <= 35) weekScores[3] += pts;
          else if (daysAgo <= 42) weekScores[4] += pts;

          // Snipe: I solved before them
          if (mySolved[pid] && mySolved[pid] < s.creationTimeSeconds) {
            snipesAllTime.push({
              pid, name: s.problem.name, rating: s.problem.rating || 800,
              theirSolveTs: s.creationTimeSeconds,
              daysAgo: Math.floor(daysAgo),
              daysBetween: Math.round((s.creationTimeSeconds - mySolved[pid]) / 86400),
            });
          }
        }
      }
    });

    const activePastWeeks = weekScores.filter(s => s > 0);
    const avgPastWeekScore = activePastWeeks.length > 0
      ? activePastWeeks.reduce((a, b) => a + b, 0) / activePastWeeks.length : 0;

    // ── Tag gaps ──
    const tagGaps: { tag: string; myCount: number; theirCount: number; gap: number }[] = [];
    new Set([...Object.keys(targetTagsAll), ...Object.keys(myTagsAll)]).forEach(tag => {
      const mine = myTagsAll[tag] || 0;
      const theirs = targetTagsAll[tag] || 0;
      if (theirs > mine + 3 && theirs >= 5) tagGaps.push({ tag, myCount: mine, theirCount: theirs, gap: theirs - mine });
    });
    tagGaps.sort((a, b) => b.gap - a.gap);

    // ── Head-to-head ──
    const myRatingNow = myRating;
    const theirRatingNow = targetInfo?.rating || 0;
    const myWeightedAC = recencyWeightedAC(mySubs, now);
    const theirWeightedAC = recencyWeightedAC(targetSubs, now);

    let myWeek0Score = 0;
    mySubs.forEach((s: any) => {
      if (s.verdict === 'OK' && s.problem) {
        const daysAgo = (now - s.creationTimeSeconds) / 86400;
        if (daysAgo <= 7) {
          const r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800;
          myWeek0Score += CF_SCORE_MAP[r > 2400 ? 2400 : r] || 10;
        }
      }
    });

    const myAttempts = new Set<string>(); const myACSet = new Set<string>();
    mySubs.forEach((s: any) => { if (!s.problem) return; const pid = `${s.problem.contestId}-${s.problem.index}`; myAttempts.add(pid); if (s.verdict === 'OK') myACSet.add(pid); });
    const myAccuracy = myAttempts.size > 0 ? parseFloat(((myACSet.size / myAttempts.size) * 100).toFixed(1)) : 0;
    const tAttempts = new Set<string>();
    targetSubs.forEach((s: any) => { if (!s.problem) return; tAttempts.add(`${s.problem.contestId}-${s.problem.index}`); });
    const tAccuracy = tAttempts.size > 0 ? parseFloat(((tSolved.size / tAttempts.size) * 100).toFixed(1)) : 0;

    // ── Threat score ──
    const ratingDelta = Math.max(0, theirRatingNow - myRatingNow);
    const velRatio = avgPastWeekScore > 0 ? week0Score / avgPastWeekScore : 1;
    const threatScore = Math.min(100, Math.round(
      (ratingDelta / 20) * 0.35 +
      Math.min(velRatio * 30, 30) * 0.3 +
      Math.min(tagGaps.length, 10) * 3 * 0.2 +
      (tSolved.size > myACSet.size ? Math.min((tSolved.size - myACSet.size) / 5, 20) : 0) * 0.15
    ));

    // ── Radar tags (30D) ──
    const radarTags = Array.from(new Set([
      ...Object.keys(targetTags30).sort((a, b) => targetTags30[b] - targetTags30[a]).slice(0, 10),
      ...Object.keys(myTags30).sort((a, b) => myTags30[b] - myTags30[a]).slice(0, 10),
    ])).slice(0, 12);

    // ── Dual rating line ──
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

    const snipesSorted = snipesAllTime.sort((a, b) => b.theirSolveTs - a.theirSolveTs);

    return {
      avgRating30D: currentCount > 0 ? Math.round(currentSum / currentCount) : 0,
      targetTags30, myTags30, radarTags, ratingLineData,
      scorePerDayCurrent: parseFloat((week0Score / 7).toFixed(1)),
      avgScorePerWeekPast: parseFloat(avgPastWeekScore.toFixed(1)),
      snipesAllTime: snipesSorted,
      snipesRecent30: snipesSorted.filter(s => s.daysAgo <= 30).length,
      tagGaps: tagGaps.slice(0, 12),
      myRatingNow, theirRatingNow,
      myWeightedAC, theirWeightedAC,
      myWeekScore: myWeek0Score, theirWeekScore: week0Score,
      myAccuracy, tAccuracy, threatScore,
    };
  }, [mySubs, targetSubs, myRating, myHandle, myHistory, targetHistory, targetInfo]);

  if (!metrics) return null;

  const velTrendingUp = metrics.scorePerDayCurrent * 7 > metrics.avgScorePerWeekPast;
  const velColor = velTrendingUp ? '#f85149' : '#56d364';

  const radarData = {
    labels: metrics.radarTags,
    datasets: [
      { label: myHandle, data: metrics.radarTags.map(t => metrics.myTags30[t] || 0), backgroundColor: 'rgba(227,179,65,0.15)', borderColor: '#e3b341', pointBackgroundColor: '#e3b341', borderWidth: 2 },
      { label: targetHandle, data: metrics.radarTags.map(t => metrics.targetTags30[t] || 0), backgroundColor: 'rgba(248,81,73,0.10)', borderColor: '#f85149', pointBackgroundColor: '#f85149', borderWidth: 2 },
    ],
  };

  const radarOpts: any = {
    responsive: true, maintainAspectRatio: false,
    scales: { r: { angleLines: { color: '#1a1a1a' }, grid: { color: '#1a1a1a' }, ticks: { display: false }, pointLabels: { color: '#555', font: { family: 'JetBrains Mono', size: 9 } } } },
    plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10 } } },
  };

  const lineOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10 } } },
    scales: {
      x: { display: false },
      y: { grid: { color: '#0f0f0f' }, ticks: { color: '#555', font: { family: 'JetBrains Mono', size: 10 } } },
    },
  };

  const tagGapOpts: any = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 9 }, boxWidth: 8 } } },
    scales: {
      x: { grid: { color: '#0f0f0f' }, ticks: { color: '#555', font: { family: 'JetBrains Mono', size: 9 } } },
      y: { grid: { display: false }, ticks: { color: '#777', font: { family: 'JetBrains Mono', size: 9 } } },
    },
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-400">

      {/* ── ROW 1: Head-to-head stat cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatDiffCard label="Current Rating" myVal={metrics.myRatingNow} theirVal={metrics.theirRatingNow} myHandle={myHandle} theirHandle={targetHandle} color="#e3b341" />
        <StatDiffCard label="Recency-Weighted ACs" myVal={metrics.myWeightedAC} theirVal={metrics.theirWeightedAC} myHandle={myHandle} theirHandle={targetHandle} color="#58a6ff" note="Exp. decay — recent solves count more" />
        <StatDiffCard label="7-Day Score (pts)" myVal={metrics.myWeekScore} theirVal={metrics.theirWeekScore} myHandle={myHandle} theirHandle={targetHandle} color="#56d364" />
        <StatDiffCard label="Accuracy (All Time)" myVal={metrics.myAccuracy} theirVal={metrics.tAccuracy} myHandle={myHandle} theirHandle={targetHandle} suffix="%" color="#d2a8ff" />
      </div>

      {/* ── ROW 2: Caliber + Velocity + Threat ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#050505] border border-[#e3b341]/30 rounded-[4px] p-6 relative overflow-hidden shadow-[0_0_20px_rgba(227,179,65,0.07)]">
          <TopLine color="#e3b341" />
          <div className="font-mono text-[9px] tracking-[3px] uppercase text-[#555] mb-1 flex items-center gap-2">
            <PulseDot color="#e3b341" /> 30-Day Active Caliber
          </div>
          <div className="text-5xl font-mono text-[#e3b341] font-black tracking-tight mt-2">{metrics.avgRating30D || 'N/A'}</div>
          <p className="text-[#2a2a2a] text-[9px] mt-3 font-mono tracking-[1.5px] uppercase leading-relaxed">
            Avg rating {targetHandle} is solving this month
          </p>
        </div>

        <div className="bg-[#050505] rounded-[4px] p-6 relative overflow-hidden"
          style={{ border: `1px solid ${velColor}33`, boxShadow: `0 0 20px ${velColor}08` }}>
          <TopLine color={velColor} />
          <div className="font-mono text-[9px] tracking-[3px] uppercase text-[#555] mb-1 flex items-center gap-2">
            <PulseDot color={velColor} /> Velocity // pts/week
          </div>
          <div className="font-mono font-black text-5xl tracking-tight mt-2" style={{ color: velColor }}>
            {(metrics.scorePerDayCurrent * 7).toFixed(0)}
            <span className="text-sm font-normal ml-1.5">pts/wk</span>
          </div>
          <div className="mt-3 font-mono text-[9px] tracking-[1.5px] uppercase" style={{ color: velColor }}>
            {velTrendingUp ? '⚠ ACCELERATING — THREAT RISING' : '✓ DECELERATING — WINDOW OPENING'}
          </div>
          <p className="text-[#2a2a2a] text-[9px] mt-1 font-mono uppercase">
            vs {metrics.avgScorePerWeekPast} pts/wk avg (prior 5 weeks)
          </p>
        </div>

        <ThreatMeter score={metrics.threatScore} />
      </div>

      {/* ── ROW 3: Rating trajectory + Tag radar ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#050505] border border-[#1a1a1a] rounded-[4px] p-5">
          <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#58a6ff] mb-4">📈 Rating Trajectory — Head to Head</div>
          <div className="h-[240px]"><Line data={metrics.ratingLineData} options={lineOpts} /></div>
        </div>
        <div className="bg-[#050505] border border-[#1a1a1a] rounded-[4px] p-5">
          <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#d2a8ff] mb-4">🕸 Tag Mastery — 30D (You vs Nemesis)</div>
          <div className="h-[240px]"><Radar data={radarData} options={radarOpts} /></div>
        </div>
      </div>

      {/* ── ROW 4: Danger Zone ───────────────────────────────────────── */}
      {metrics.tagGaps.length > 0 && (
        <div className="bg-[#050505] border border-[#f85149]/20 border-l-[3px] border-l-[#f85149] rounded-[4px] p-5">
          <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#f85149] mb-1">⚠ Danger Zone — Tag Coverage Gaps</div>
          <p className="text-[#2a2a2a] font-mono text-[9px] uppercase mb-4">
            Algorithms where {targetHandle} has significantly more ACs than you
          </p>
          <div className="h-[280px]">
            <Bar
              data={{ labels: metrics.tagGaps.map(g => g.tag), datasets: [{ label: myHandle, data: metrics.tagGaps.map(g => g.myCount), backgroundColor: '#e3b341bb', borderRadius: 3 }, { label: targetHandle, data: metrics.tagGaps.map(g => g.theirCount), backgroundColor: '#f85149bb', borderRadius: 3 }] }}
              options={tagGapOpts}
            />
          </div>
        </div>
      )}

      {/* ── ROW 5: Snipe Intel — full width ─────────────────────────── */}
      <div className="bg-[#050505] border border-[#58a6ff]/30 border-t-[2px] rounded-[4px] p-6 relative overflow-hidden shadow-[0_0_25px_rgba(88,166,255,0.07)]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#58a6ff]/80 via-[#58a6ff]/20 to-transparent" />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#58a6ff] blur-[180px] opacity-[0.025] pointer-events-none" />

        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h3 className="text-[#58a6ff] font-mono text-[10px] tracking-[3px] uppercase flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse shadow-[0_0_6px_#58a6ff]" />
              Snipe Intel — All Time
            </h3>
            <p className="text-[#2a2a2a] text-[9px] font-mono uppercase mt-1.5">
              Problems you solved first that {targetHandle} later copied
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col items-center px-4 py-2 rounded-[4px]" style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)' }}>
              <span className="font-mono text-2xl font-black text-[#58a6ff]">{metrics.snipesAllTime.length}</span>
              <span className="font-mono text-[8px] uppercase tracking-[2px] text-[#444] mt-0.5">All Time</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 rounded-[4px]" style={{ background: 'rgba(86,211,100,0.06)', border: '1px solid rgba(86,211,100,0.2)' }}>
              <span className="font-mono text-2xl font-black text-[#56d364]">{metrics.snipesRecent30}</span>
              <span className="font-mono text-[8px] uppercase tracking-[2px] text-[#444] mt-0.5">Last 30D</span>
            </div>
          </div>
        </div>

        <div className="border-b border-[#58a6ff]/10 mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-1">
          {metrics.snipesAllTime.length === 0
            ? (
              <div className="col-span-2 text-[#2a2a2a] italic text-[10px] font-mono py-6 text-center border border-dashed border-[#58a6ff]/10 rounded-[4px]">
                // NO SNIPES ON RECORD — {targetHandle.toUpperCase()} HAS NOT FOLLOWED YOUR TRAIL
              </div>
            )
            : metrics.snipesAllTime.map((s, i) => {
              const isRecent = s.daysAgo <= 30;
              return (
                <div key={i}
                  className="flex gap-3 font-mono items-center pl-3 py-2.5 rounded-r-[4px] transition-all group border-l-2"
                  style={{
                    borderLeftColor: isRecent ? '#58a6ff' : '#111',
                    background: isRecent ? 'rgba(88,166,255,0.04)' : 'transparent',
                  }}>
                  {isRecent && (
                    <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-[2px]"
                      style={{ background: 'rgba(86,211,100,0.15)', color: '#56d364', border: '1px solid rgba(86,211,100,0.3)' }}>
                      NEW
                    </span>
                  )}
                  <span className="text-[#c9d1d9] text-[11px] truncate group-hover:text-white transition-colors flex-1 min-w-0">{s.name}</span>
                  <span className="shrink-0 text-[9px] text-[#333]">
                    {s.daysBetween === 0 ? 'same day' : `${s.daysBetween}d after you`}
                  </span>
                  <span className="shrink-0 text-[10px] text-[#58a6ff] bg-[rgba(88,166,255,0.08)] px-2 py-0.5 rounded-[2px] border border-[#58a6ff]/20">
                    {s.rating}
                  </span>
                  <span className="shrink-0 text-[9px] text-[#333] w-10 text-right">{s.daysAgo}d ago</span>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
