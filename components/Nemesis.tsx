"use client";
import { useMemo } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { CF_SCORE_MAP } from "@/lib/constants";

interface NemesisProps {
  mySubs: any[]; targetSubs: any[]; targetHandle: string; myRating: number;
  myHandle: string; myHistory: any[]; targetHistory: any[]; myInfo: any; targetInfo: any;
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
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="flex justify-between items-end gap-1 mt-1">
        <div>
          <p className="text-[10px] font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{myHandle}</p>
          <p className="text-2xl font-bold font-mono leading-none" style={{ color: 'var(--accent)' }}>{myVal.toLocaleString()}{suffix}</p>
        </div>
        {diffAbs > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded font-mono"
            style={{ color: ahead ? 'var(--status-ac)' : 'var(--status-wa)', background: ahead ? 'rgba(62,207,142,0.1)' : 'rgba(248,81,73,0.1)' }}>
            {ahead ? '▲' : '▼'} {diffAbs.toLocaleString()}{suffix}
          </span>
        )}
        <div className="text-right">
          <p className="text-[10px] font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{theirHandle}</p>
          <p className="text-2xl font-bold font-mono leading-none" style={{ color: 'var(--status-wa)' }}>{theirVal.toLocaleString()}{suffix}</p>
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

export default function Nemesis({ mySubs, targetSubs, targetHandle, myRating, myHandle, myHistory, targetHistory, myInfo, targetInfo }: NemesisProps) {

  const metrics = useMemo(() => {
    if (!mySubs || !targetSubs) return null;
    const now = Date.now() / 1000;
    const myTagsAll: Record<string, number> = {}; const targetTagsAll: Record<string, number> = {};
    const myACSet = new Set<string>(); const myAttempts = new Set<string>(); let myFirstTryCount = 0; let myWeek0Score = 0;
    const mySpeed: Record<string, number> = {};

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

    const tACSet = new Set<string>(); const tAttempts = new Set<string>(); let tFirstTryCount = 0;
    let currentSum = 0; let currentCount = 0; let week0Score = 0;
    const weekScores = [0, 0, 0, 0, 0]; const theirSpeed: Record<string, number> = {};

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
    myHistory.forEach((h: any) => allTS.add(h.ratingUpdateTimeSeconds));
    targetHistory.forEach((h: any) => allTS.add(h.ratingUpdateTimeSeconds));
    const sortedTS = Array.from(allTS).sort((a, b) => a - b);
    const buildLine = (hist: any[]) => { const hMap: Record<number, number> = {}; hist.forEach((h: any) => hMap[h.ratingUpdateTimeSeconds] = h.newRating); let last: number | null = null; return sortedTS.map(ts => { if (hMap[ts]) last = hMap[ts]; return last; }); };
    const ratingLineData = {
      labels: sortedTS.map(ts => { const d = new Date(ts * 1000); return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`; }),
      datasets: [
        { label: myHandle, data: buildLine(myHistory), borderColor: 'var(--accent)', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2, spanGaps: false },
        { label: targetHandle, data: buildLine(targetHistory), borderColor: 'var(--status-wa)', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2, spanGaps: false },
      ],
    };

    const overlapPids = [...myACSet].filter(p => theirSpeed[p] && mySpeed[p]);
    const overlapPoints = overlapPids.map(pid => ({ x: mySpeed[pid], y: theirSpeed[pid], pid }));
    const maxSpeed = Math.max(3000, ...overlapPoints.map((p: any) => Math.max(p.x, p.y)));
    const mySpeedWins = overlapPoints.filter((p: any) => p.x < p.y).length;
    const theirSpeedWins = overlapPoints.filter((p: any) => p.x > p.y).length;
    const velTrendingUp = (week0Score / 7) * 7 > avgPastWeekScore;

    return {
      avgRating30D: currentCount > 0 ? Math.round(currentSum / currentCount) : 0,
      sortedTags, myTagData, theirTagData, theirTagColors,
      ratingLineData, overlapPoints, mySpeedWins, theirSpeedWins, maxSpeed,
      scorePerDayCurrent: parseFloat((week0Score / 7).toFixed(1)),
      avgScorePerWeekPast: parseFloat(avgPastWeekScore.toFixed(1)),
      myRatingNow, theirRatingNow, myWeightedAC, theirWeightedAC,
      myWeekScore: myWeek0Score, theirWeekScore: week0Score,
      myAccuracy, tAccuracy, threatScore, winProb: 1 - eloExpected, velTrendingUp,
    };
  }, [mySubs, targetSubs, myRating, myHandle, myHistory, targetHistory, targetInfo]);

  if (!metrics) return null;

  const velColor = metrics.velTrendingUp ? 'var(--status-wa)' : 'var(--status-ac)';
  const lineOpts: any = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 }, boxWidth: 10 } } }, scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 10 } } } } };
  const dynamicTagHeight = Math.max(400, metrics.sortedTags.length * 28);
  const scatterData = {
    datasets: [
      { type: 'line' as const, label: 'Tie Line', data: [{ x: 0, y: 0 }, { x: metrics.maxSpeed, y: metrics.maxSpeed }], borderColor: 'var(--border)', borderWidth: 1, borderDash: [5, 5], pointRadius: 0, fill: false },
      { type: 'scatter' as const, label: 'Head-to-Head', data: metrics.overlapPoints, backgroundColor: metrics.overlapPoints.map((p: any) => p.x < p.y ? 'var(--accent)' : (p.x > p.y ? 'var(--status-wa)' : '#555')), pointRadius: 4, pointHoverRadius: 6 },
    ],
  };
  const scatterOpts: any = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ` [${ctx.raw.pid}] You: ${ctx.raw.x}ms | Them: ${ctx.raw.y}ms` } } }, scales: { x: { title: { display: true, text: `Your Time (ms)`, color: '#8b949e', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666' }, min: 0, max: metrics.maxSpeed }, y: { title: { display: true, text: `${targetHandle} Time (ms)`, color: '#8b949e', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666' }, min: 0, max: metrics.maxSpeed } } };
  const tagOpts: any = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 }, boxWidth: 10 } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b949e', font: { size: 10 } } }, y: { grid: { display: false }, ticks: { color: 'var(--text-main)', font: { size: 10 } } } } };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">

      {/* ── VS HEADER ── */}
      <div className="flex items-center justify-center gap-8 py-8 px-6 rounded-xl relative overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, var(--accent), transparent, var(--status-wa))' }} />
        <div className="text-right flex-1">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>You</p>
          <p className="text-3xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{myHandle}</p>
        </div>
        <p className="text-2xl font-black italic" style={{ color: 'var(--border)' }}>VS</p>
        <div className="text-left flex-1">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--status-wa)' }}>Nemesis</p>
          <p className="text-3xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{targetHandle}</p>
        </div>
      </div>

      {/* ── HEAD-TO-HEAD STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatDiffCard label="Rating" myVal={metrics.myRatingNow} theirVal={metrics.theirRatingNow} myHandle={myHandle} theirHandle={targetHandle} />
        <StatDiffCard label="Weighted ACs" myVal={metrics.myWeightedAC} theirVal={metrics.theirWeightedAC} myHandle={myHandle} theirHandle={targetHandle} />
        <StatDiffCard label="7-Day Score" myVal={metrics.myWeekScore} theirVal={metrics.theirWeekScore} myHandle={myHandle} theirHandle={targetHandle} />
        <StatDiffCard label="First-Try Acc." myVal={metrics.myAccuracy} theirVal={metrics.tAccuracy} myHandle={myHandle} theirHandle={targetHandle} suffix="%" />
      </div>

      {/* ── CALIBER + VELOCITY + THREAT ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardTitle>30-Day Caliber</CardTitle>
          <p className="text-4xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{metrics.avgRating30D || '—'}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Avg rating {targetHandle} is clearing lately</p>
        </Card>
        <Card>
          <CardTitle>Velocity / Week</CardTitle>
          <p className="text-4xl font-bold font-mono" style={{ color: velColor }}>
            {(metrics.scorePerDayCurrent * 7).toFixed(0)}
            <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>pts</span>
          </p>
          <p className="text-xs mt-2 font-semibold" style={{ color: velColor }}>
            {metrics.velTrendingUp ? '▲ Accelerating' : '▼ Slowing'} vs {metrics.avgScorePerWeekPast.toFixed(0)} pts avg
          </p>
        </Card>
        <ThreatMeter score={metrics.threatScore} winProb={metrics.winProb} />
      </div>

      {/* ── RATING HISTORY ── */}
      <Card>
        <CardTitle>📡 Rating History</CardTitle>
        <div className="h-[280px]"><Line data={metrics.ratingLineData} options={lineOpts} /></div>
      </Card>

      {/* ── TAG COMPARISON ── */}
      <Card>
        <CardTitle>🏷 Tag Mastery Comparison</CardTitle>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--status-wa)' }}>Red</span> = they beat you. <span style={{ color: 'var(--status-ac)' }}>Green</span> = you hold the line.
        </p>
        <div className="overflow-y-auto pr-2" style={{ maxHeight: '600px' }}>
          <div style={{ height: `${dynamicTagHeight}px`, position: 'relative' }}>
            <Bar data={{ labels: metrics.sortedTags, datasets: [{ label: myHandle, data: metrics.myTagData, backgroundColor: 'var(--accent)', borderRadius: 4 }, { label: targetHandle, data: metrics.theirTagData, backgroundColor: metrics.theirTagColors, borderRadius: 4 }] }} options={tagOpts} />
          </div>
        </div>
      </Card>

      {/* ── EXECUTION SPEED ── */}
      {metrics.overlapPoints.length > 0 && (
        <Card>
          <CardTitle>⚡ Execution Speed — Shared problems</CardTitle>
          <div className="flex gap-6 mb-4 text-sm">
            <span style={{ color: 'var(--accent)' }}>You faster: {metrics.mySpeedWins}</span>
            <span style={{ color: 'var(--status-wa)' }}>{targetHandle} faster: {metrics.theirSpeedWins}</span>
          </div>
          <div className="h-[280px]"><Scatter data={scatterData as any} options={scatterOpts} /></div>
        </Card>
      )}

    </div>
  );
}
