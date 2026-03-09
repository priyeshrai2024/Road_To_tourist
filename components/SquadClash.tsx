"use client";

import { useState, useEffect } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, RadialLinearScale, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Radar, Scatter } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler);

const CF_SCORE_MAP: Record<number, number> = { 800:15, 900:20, 1000:30, 1100:45, 1200:65, 1300:90, 1400:130, 1500:180, 1600:250, 1700:350, 1800:500, 1900:720, 2000:1050, 2100:1530, 2200:2250, 2300:3300, 2400:4800 };
const SQUAD_COLORS = ['#c5a059', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.18)'];

interface SquadMember {
  handle: string;
  isMain: boolean;
  rating: number;
  peak: number;
  rank: string;
  uniqueAC: number;
  acc: number;
  upsolve: number;
  score7D: number;
  score30D: number;
  fastSolvesPct: number;
  tags: Record<string, number>;
  history: any[];
  solvedSet: Set<string>;
  rawSubs: any[];
}

export default function SquadClash({ mainHandle, squadHandles }: { mainHandle: string, squadHandles: string[] }) {
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [bounties, setBounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSquad = async () => {
      setLoading(true);
      const allHandles = [mainHandle, ...squadHandles].filter(Boolean);
      const now = Date.now() / 1000;

      try {
        const results = await Promise.all(
          allHandles.map(async (h) => {
            try {
              const res = await fetch(`/api/cf?handle=${h}`);
              const data = await res.json();
              if (data.error || !data.submissions) return null;

              let uniqueAC = new Set<string>();
              let attempts = new Set<string>();
              let firstTry = 0;
              let score7D = 0;
              let score30D = 0;
              let fastSolves = 0;
              let tags: Record<string, number> = {};
              let problemTimings: Record<string, { first: number, solved: number | null }> = {};
              let inContestFails = new Set<string>();
              let inContestSolves = new Set<string>();
              let practiceSolves = new Set<string>();

              [...data.submissions].reverse().forEach((s: any) => {
                const pid = s.problem ? `${s.problem.contestId}-${s.problem.index}` : 'unknown';
                const v = s.verdict;

                if (pid !== 'unknown') {
                  if (!problemTimings[pid]) problemTimings[pid] = { first: s.creationTimeSeconds, solved: null };
                  if (!attempts.has(pid)) { attempts.add(pid); if (v === 'OK') firstTry++; }

                  const isContest = (s.author?.participantType === 'CONTESTANT' || s.author?.participantType === 'VIRTUAL');
                  if (isContest) { if (v === 'OK') inContestSolves.add(pid); else inContestFails.add(pid); }
                  else if (s.author?.participantType === 'PRACTICE') { if (v === 'OK') practiceSolves.add(pid); }

                  if (v === 'OK' && !uniqueAC.has(pid)) {
                    uniqueAC.add(pid);
                    problemTimings[pid].solved = s.creationTimeSeconds;

                    let r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 0;
                    let pts = r === 0 ? 10 : (CF_SCORE_MAP[r > 2400 ? 2400 : r] || 0);

                    const daysAgo = (now - s.creationTimeSeconds) / 86400;
                    if (daysAgo <= 7) score7D += pts;
                    if (daysAgo <= 30) score30D += pts;

                    s.problem.tags?.forEach((t: string) => { tags[t] = (tags[t] || 0) + 1; });
                  }
                }
              });

              Object.values(problemTimings).forEach(t => {
                if (t.solved && (t.solved - t.first) / 60 <= 30) fastSolves++;
              });

              const upsolveCandidates = [...inContestFails].filter(p => !inContestSolves.has(p));

              return {
                handle: h,
                isMain: h === mainHandle,
                rating: data.info.rating || 0,
                peak: data.info.maxRating || 0,
                rank: data.info.rank || "Unrated",
                uniqueAC: uniqueAC.size,
                acc: attempts.size > 0 ? parseFloat(((firstTry / attempts.size) * 100).toFixed(1)) : 0,
                upsolve: upsolveCandidates.length > 0 ? parseFloat(((upsolveCandidates.filter(p => practiceSolves.has(p)).length / upsolveCandidates.length) * 100).toFixed(1)) : 0,
                score7D,
                score30D,
                fastSolvesPct: uniqueAC.size > 0 ? parseFloat(((fastSolves / uniqueAC.size) * 100).toFixed(1)) : 0,
                tags,
                history: data.ratingHistory || [],
                solvedSet: uniqueAC,
                rawSubs: data.submissions
              };
            } catch (e) { return null; }
          })
        );

        const validMembers = results.filter((r): r is SquadMember => r !== null);
        setMembers(validMembers.sort((a, b) => b.score30D - a.score30D));

        // Build Graveyard
        const mainUser = validMembers.find(m => m.isMain);
        let grave: any[] = [];

        validMembers.forEach(m => {
          const fails = m.rawSubs.filter((s: any) => s.verdict !== 'OK' && s.verdict !== 'COMPILATION_ERROR');
          const failCounts: Record<string, number> = {};
          fails.forEach((f: any) => {
            if (!f.problem) return;
            const pid = `${f.problem.contestId}-${f.problem.index}`;
            failCounts[pid] = (failCounts[pid] || 0) + 1;

            if (failCounts[pid] === 3 && !m.solvedSet.has(pid)) {
              let status = "INITIATE SNIPE";
              let sColor = "text-[#c5a059]/70 border-[#c5a059]/30";

              if (m.isMain) { status = "UPSOLVE REQUIRED"; sColor = "text-[#f85149]/70 border-[#f85149]/30"; }
              else if (mainUser?.solvedSet.has(pid)) { status = "ALREADY SNIPED"; sColor = "text-white/30 border-white/10"; }

              if (!grave.find(g => g.id === pid)) {
                grave.push({
                  id: pid, name: f.problem.name, rating: f.problem.rating || 800,
                  victim: m.handle, fails: failCounts[pid], tags: f.problem.tags || [],
                  status, sColor, isMain: m.isMain, isSniped: mainUser?.solvedSet.has(pid),
                  link: `https://codeforces.com/contest/${f.problem.contestId}/problem/${f.problem.index}`
                });
              }
            }
          });
        });
        setBounties(grave.sort((a, b) => b.rating - a.rating).slice(0, 12));

      } catch (err) { console.error(err); }
      setLoading(false);
    };

    fetchSquad();
  }, [mainHandle, squadHandles]);

  if (loading) return (
    <div className="font-mono text-[10px] tracking-[5px] uppercase text-[#c5a059]/50 animate-pulse text-center py-32">
      Synthesizing squad telemetry...
    </div>
  );
  if (members.length === 0) return (
    <div className="font-mono text-[10px] tracking-[4px] uppercase text-white/15 text-center py-20">
      No valid squad data generated.
    </div>
  );

  // --- CHART DATA GENERATION ---

  // 1. Tactical Sprints (Bar)
  const sprintData = {
    labels: members.map(m => m.handle),
    datasets: [
      { label: '7-Day Score', data: members.map(m => m.score7D), backgroundColor: 'rgba(248,81,73,0.5)', borderRadius: 2, borderWidth: 0 },
      { label: '30-Day Score', data: members.map(m => m.score30D), backgroundColor: 'rgba(197,160,89,0.45)', borderRadius: 2, borderWidth: 0 }
    ]
  };

  // 2. The Triad (Radar)
  let allTags: Record<string, number> = {};
  members.forEach(m => Object.keys(m.tags).forEach(t => allTags[t] = (allTags[t] || 0) + m.tags[t]));
  const topTags = Object.keys(allTags).sort((a, b) => allTags[b] - allTags[a]).slice(0, 15);

  const radarData = {
    labels: topTags,
    datasets: members.map((m, i) => ({
      label: m.handle,
      data: topTags.map(t => m.tags[t] || 0),
      borderColor: SQUAD_COLORS[i % SQUAD_COLORS.length],
      backgroundColor: m.isMain ? 'rgba(197, 160, 89, 0.04)' : 'transparent',
      borderDash: m.isMain ? [] : [5, 5],
      borderWidth: 1,
      pointRadius: 2,
    }))
  };

  // 3. Rating Warfare (Line)
  let allTimestamps = new Set<number>();
  members.forEach(m => m.history.forEach(h => allTimestamps.add(h.ratingUpdateTimeSeconds)));
  const sortedTS = Array.from(allTimestamps).sort((a, b) => a - b);

  const lineData = {
    labels: sortedTS.map(ts => { const d = new Date(ts * 1000); return `${d.getMonth() + 1}/${d.getFullYear().toString().substr(-2)}`; }),
    datasets: members.map((m, i) => {
      let data: number[] = [];
      let lastRating = m.history.length > 0 ? (m.history[0].oldRating || 1500) : 1500;
      let histMap: Record<number, number> = {};
      m.history.forEach(h => histMap[h.ratingUpdateTimeSeconds] = h.newRating);

      sortedTS.forEach(ts => {
        if (histMap[ts]) lastRating = histMap[ts];
        data.push(lastRating);
      });

      return {
        label: m.handle, data,
        borderColor: SQUAD_COLORS[i % SQUAD_COLORS.length],
        backgroundColor: 'transparent', borderWidth: 1, pointRadius: 0, tension: 0.2,
        borderDash: m.isMain ? [] : [4, 4]
      };
    })
  };

  // 4. Efficiency Scatter
  const scatterData = {
    datasets: members.map((m, i) => ({
      label: m.handle,
      data: [{ x: m.acc, y: m.fastSolvesPct }],
      backgroundColor: SQUAD_COLORS[i % SQUAD_COLORS.length],
      pointRadius: 6,
      pointHoverRadius: 9
    }))
  };

  // Shared chart options fragments
  const sharedScales = {
    x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } }, border: { display: false } },
    y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } }, border: { display: false } }
  };
  const sharedLegend = { labels: { color: 'rgba(255,255,255,0.25)', font: { family: 'monospace', size: 10 }, boxWidth: 8, padding: 14 } };

  return (
    <div className="space-y-16 animate-in fade-in duration-700 pb-20">

      {/* THE VANGUARD */}
      <div>
        <div className="flex items-center gap-6 mb-6">
          <h3 className="font-serif text-lg font-normal text-white/75 tracking-wide">The Vanguard</h3>
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="font-mono text-[8px] tracking-[4px] uppercase text-white/20">Global Leaderboard</span>
        </div>

        <div className="bg-[#020202] border border-white/[0.04] overflow-x-auto">
          <table className="w-full text-left font-mono text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-4 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Operative</th>
                <th className="px-6 py-4 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Rating (Peak)</th>
                <th className="px-6 py-4 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">7-Day Sprint</th>
                <th className="px-6 py-4 font-mono text-[8px] tracking-[3px] uppercase text-[#c5a059]/40 font-normal">30-Day Sprint</th>
                <th className="px-6 py-4 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Lifetime AC</th>
                <th className="px-6 py-4 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">First-Try</th>
                <th className="px-6 py-4 font-mono text-[8px] tracking-[3px] uppercase text-white/20 font-normal">Upsolve</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.handle} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="px-6 py-4">
                    <span className={`font-mono text-xs tracking-wide ${m.isMain ? 'text-[#c5a059]' : 'text-white/45'}`}>
                      {m.isMain && <span className="text-[#c5a059]/40 mr-2">you</span>}{m.handle}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white/55">{m.rating} <span className="text-white/25 text-[10px]">({m.peak})</span></td>
                  <td className="px-6 py-4 text-white/45">{m.score7D.toLocaleString()}</td>
                  <td className="px-6 py-4 text-[#c5a059]/70">{m.score30D.toLocaleString()}</td>
                  <td className="px-6 py-4 text-white/45">{m.uniqueAC.toLocaleString()}</td>
                  <td className="px-6 py-4 text-white/45">{m.acc}%</td>
                  <td className="px-6 py-4 text-white/45">{m.upsolve}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* THE GRAVEYARD */}
      <div>
        <div className="flex items-center gap-6 mb-6">
          <h3 className="font-serif text-lg font-normal text-white/75 tracking-wide">The Graveyard</h3>
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="font-mono text-[8px] tracking-[4px] uppercase text-white/20">Active Bounties</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04]">
          {bounties.length === 0
            ? (
              <div className="col-span-4 bg-[#020202] font-mono text-[9px] tracking-[3px] uppercase text-white/15 py-12 text-center">
                // The graveyard is empty. The squad is clean.
              </div>
            )
            : bounties.map(b => (
              <a
                key={b.id}
                href={b.link}
                target="_blank"
                className={`bg-[#020202] p-5 flex flex-col gap-3 group no-underline transition-all duration-200 hover:bg-white/[0.02] border-l ${
                  b.isMain ? 'border-l-[#f85149]/50' : b.isSniped ? 'border-l-white/10' : 'border-l-[#c5a059]/30'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-mono text-[11px] text-white/55 group-hover:text-white/80 transition-colors duration-200 leading-snug">
                    {b.name}
                  </span>
                  <span className="font-mono text-[9px] text-[#c5a059]/50 shrink-0 mt-0.5">{b.rating}</span>
                </div>

                <p className="font-mono text-[9px] tracking-[1px] uppercase text-white/20">
                  Failed {b.fails}× by <span className={b.isMain ? 'text-[#f85149]/60' : 'text-white/35'}>{b.victim}</span>
                </p>

                <div className="flex flex-wrap gap-1">
                  {b.tags.slice(0, 2).map((t: string) => (
                    <span key={t} className="font-mono text-[8px] tracking-[1px] border border-white/[0.06] text-white/20 px-1.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>

                <div className={`font-mono text-[9px] tracking-[2px] uppercase text-center py-1.5 border ${b.sColor}`}>
                  {b.status}
                </div>
              </a>
            ))
          }
        </div>
      </div>

      {/* THE CRUCIBLE */}
      <div>
        <div className="flex items-center gap-6 mb-6">
          <h3 className="font-serif text-lg font-normal text-white/75 tracking-wide">The Crucible</h3>
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="font-mono text-[8px] tracking-[4px] uppercase text-white/20">1v1 Combinatorial Duels</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.04]">
          {members.map((m1, i) => members.slice(i + 1).map(m2 => {
            const winCls = "text-white/70";
            const loseCls = "text-[#f85149]/60";
            return (
              <div
                key={`${m1.handle}-${m2.handle}`}
                className="bg-[#020202] p-7"
              >
                {/* Header */}
                <div className="flex justify-between items-center pb-5 mb-5 border-b border-white/[0.05]">
                  <span className={`font-mono text-xs tracking-wide ${m1.isMain ? 'text-[#c5a059]' : 'text-white/45'}`}>
                    {m1.handle}
                  </span>
                  <span className="font-mono text-[8px] tracking-[4px] uppercase text-white/15">vs</span>
                  <span className={`font-mono text-xs tracking-wide ${m2.isMain ? 'text-[#c5a059]' : 'text-white/45'}`}>
                    {m2.handle}
                  </span>
                </div>

                {/* Stats */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className={m1.rating >= m2.rating ? winCls : loseCls}>{m1.rating}</span>
                    <span className="text-white/15 text-[8px] tracking-[2px] uppercase">Live Rating</span>
                    <span className={m2.rating >= m1.rating ? winCls : loseCls}>{m2.rating}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={m1.peak >= m2.peak ? winCls : loseCls}>{m1.peak}</span>
                    <span className="text-white/15 text-[8px] tracking-[2px] uppercase">Peak Rating</span>
                    <span className={m2.peak >= m1.peak ? winCls : loseCls}>{m2.peak}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={m1.uniqueAC >= m2.uniqueAC ? winCls : loseCls}>{m1.uniqueAC}</span>
                    <span className="text-white/15 text-[8px] tracking-[2px] uppercase">Unique AC</span>
                    <span className={m2.uniqueAC >= m1.uniqueAC ? winCls : loseCls}>{m2.uniqueAC}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={m1.acc >= m2.acc ? winCls : loseCls}>{m1.acc}%</span>
                    <span className="text-white/15 text-[8px] tracking-[2px] uppercase">First-Try Acc</span>
                    <span className={m2.acc >= m1.acc ? winCls : loseCls}>{m2.acc}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={m1.upsolve >= m2.upsolve ? winCls : loseCls}>{m1.upsolve}%</span>
                    <span className="text-white/15 text-[8px] tracking-[2px] uppercase">Upsolve Rate</span>
                    <span className={m2.upsolve >= m1.upsolve ? winCls : loseCls}>{m2.upsolve}%</span>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* SQUAD TELEMETRY SYNTHESIS */}
      <div>
        <div className="flex items-center gap-6 mb-6">
          <h3 className="font-serif text-lg font-normal text-white/75 tracking-wide">Squad Telemetry</h3>
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="font-mono text-[8px] tracking-[4px] uppercase text-white/20">Synthesis</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04]">

          <div className="bg-[#020202] p-7">
            <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-6">Rating Warfare — Trajectory</p>
            <div className="h-56">
              <Line
                data={lineData}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: {
                    x: { display: false },
                    y: { ...sharedScales.y }
                  },
                  plugins: { legend: sharedLegend }
                }}
              />
            </div>
          </div>

          <div className="bg-[#020202] p-7">
            <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-6">Tactical Sprints — Scores</p>
            <div className="h-56">
              <Bar
                data={sprintData}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: {
                    x: { ...sharedScales.x, grid: { display: false } },
                    y: { ...sharedScales.y }
                  },
                  plugins: { legend: sharedLegend }
                }}
              />
            </div>
          </div>

          <div className="bg-[#020202] p-7">
            <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-1">Efficiency Matrix</p>
            <p className="font-mono text-[8px] tracking-[1px] text-white/15 mb-6">First-Try Accuracy vs % Solves under 30 mins</p>
            <div className="h-56">
              <Scatter
                data={scatterData}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: {
                    x: { ...sharedScales.x, title: { display: true, text: 'First-Try Accuracy (%)', color: 'rgba(255,255,255,0.15)', font: { family: 'monospace', size: 9 } } },
                    y: { ...sharedScales.y, title: { display: true, text: 'Speed (<30m %)', color: 'rgba(255,255,255,0.15)', font: { family: 'monospace', size: 9 } } }
                  },
                  plugins: { legend: sharedLegend }
                }}
              />
            </div>
          </div>

          <div className="bg-[#020202] p-7">
            <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-6">The Triad — Tag Radar</p>
            <div className="h-56">
              <Radar
                data={radarData}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: {
                    r: {
                      angleLines: { display: false },
                      grid: { color: 'rgba(255,255,255,0.03)' },
                      pointLabels: { color: 'rgba(255,255,255,0.18)', font: { family: 'monospace', size: 9 } },
                      ticks: { display: false }
                    }
                  },
                  plugins: { legend: { position: 'bottom', ...sharedLegend } }
                }}
              />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
