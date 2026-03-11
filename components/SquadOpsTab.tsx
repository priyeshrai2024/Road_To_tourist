"use client";

import { useState, useMemo } from "react";
import { Line, Bar } from 'react-chartjs-2';
import { CF_SCORE_MAP, SQUAD_COLORS } from "@/lib/constants";
import type { SquadMemberData } from "@/lib/types";

function TopLine({ color }: { color: string }) {
  return <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
}

const CHART_OPT = (yLabel?: string): any => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 } } } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#555', font: { family: 'JetBrains Mono', size: 10 } } },
    y: { grid: { color: '#0f0f0f' }, ticks: { color: '#555', font: { family: 'JetBrains Mono', size: 10 }, callback: yLabel === '%' ? (v: any) => `${v}%` : undefined } },
  },
});

const LINE_OPT: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 } } } },
  scales: {
    x: { display: false, grid: { display: false } },
    y: { grid: { color: '#0f0f0f' }, ticks: { color: '#555', font: { family: 'JetBrains Mono', size: 10 } } },
  },
};

function ChartCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden transition-transform hover:-translate-y-1" style={{ background: '#050505', border: '1px solid #1a1a1a', boxShadow: `0 4px 20px ${color}08` }}>
      <TopLine color={color} />
      <div className="font-mono text-[0.62rem] uppercase tracking-[2px] mb-4" style={{ color }}>{title}</div>
      <div className="h-[180px]">{children}</div>
    </div>
  );
}

interface SquadOpsTabProps {
  squadMatrix: Record<string, SquadMemberData>;
  config: { main: string; squad: string[]; titans: string[] };
  squadCharts: {
    lineData: any; sprintData: any; radarData: any; players: string[];
    comparisonCharts: Record<string, any>;
    leaderboard: any[];
  } | null;
  bounties: any[];
}

export default function SquadOpsTab({ squadMatrix, config, squadCharts, bounties }: SquadOpsTabProps) {
  const [sprintMode, setSprintMode] = useState<'7D' | '30D'>('7D');

  const allPlayers = [config.main, ...config.squad]
    .filter(h => squadMatrix[h])
    .sort((a, b) => (squadMatrix[b].info.rating || 0) - (squadMatrix[a].info.rating || 0));

  const COLORS = allPlayers.map((p, i) => p === config.main ? '#e3b341' : SQUAD_COLORS[i % SQUAD_COLORS.length]);
  const cc = squadCharts?.comparisonCharts;

  // ─── CONTEST-STYLE STANDINGS CALCULATIONS ──────────────────────────────
  const standings = useMemo(() => {
    const days = sprintMode === '7D' ? 7 : 30;
    const now = Date.now() / 1000;
    const cutoffTs = now - (days * 86400);

    const stats = allPlayers.map(p => {
      if (!squadMatrix[p] || !squadMatrix[p].metrics) return null;
      
      // Sort submissions chronologically to track attempts before AC
      const subs = squadMatrix[p].metrics.rawSubsList
        .filter((s: any) => s.creationTimeSeconds >= cutoffTs)
        .sort((a: any, b: any) => a.creationTimeSeconds - b.creationTimeSeconds);

      let score = 0;
      let penalty = 0;
      let acs = 0;
      const probStats: Record<string, { fails: number, solved: boolean, rating: number }> = {};

      subs.forEach((s: any) => {
        if (!s.problem) return;
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        
        if (!probStats[pid]) {
          probStats[pid] = { 
            fails: 0, 
            solved: false, 
            rating: s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800 
          };
        }
        
        // If already solved, ignore further submissions for penalty
        if (probStats[pid].solved) return;

        if (s.verdict === 'OK') {
          probStats[pid].solved = true;
          acs++;
          
          // Calculate score
          const baseScore = CF_SCORE_MAP[Math.min(2400, probStats[pid].rating)] || 10;
          score += baseScore;
          
          // Add penalty: (Problem Score / 10) * Number of fails
          penalty += (baseScore / 10) * probStats[pid].fails;
        } 
        else if (s.verdict !== 'COMPILATION_ERROR' && s.verdict !== 'SKIPPED') {
          probStats[pid].fails++;
        }
      });

      const acc = subs.length > 0 ? parseFloat(((acs / subs.length) * 100).toFixed(1)) : 0;

      return { 
        handle: p, 
        score, 
        penalty: Math.round(penalty), 
        acs, 
        acc, 
        rankInfo: squadMatrix[p].info?.rank || 'Unrated' 
      };
    }).filter(Boolean);

    // Primary sort: Score (Descending). Secondary sort: Penalty (Ascending).
    stats.sort((a: any, b: any) => b.score - a.score || a.penalty - b.penalty);
    return stats;
  }, [squadMatrix, allPlayers, sprintMode]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-400">

      {/* ── Player Cards ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {allPlayers.map((handle, i) => {
          const p = squadMatrix[handle];
          const color = COLORS[i];
          return (
            <div key={handle} className="relative overflow-hidden rounded-2xl p-5" style={{ background: `radial-gradient(ellipse at top left, ${color}08 0%, #050505 70%)`, border: `1px solid ${color}33` }}>
              <TopLine color={color} />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                  {i === 0 ? '👑' : i === 1 ? '⚔️' : '🛡️'}
                </div>
                <div>
                  <div className="font-mono font-bold text-sm" style={{ color }}>
                    {handle} {handle === config.main && <span className="text-[9px] text-[#444]">[YOU]</span>}
                  </div>
                  <div className="font-mono text-[0.58rem] uppercase tracking-wider text-[#555]">{p.info.rank || 'Unrated'}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['Rating',    p.info.rating || 0,  color],
                  ['Unique AC', p.metrics.unique,     '#ddd'],
                  ['Accuracy',  p.metrics.acc + '%',  '#ddd'],
                ] as [string, string|number, string][]).map(([l, v, c]) => (
                  <div key={l} className="text-center">
                    <div className="font-mono text-sm font-black" style={{ color: c }}>{v}</div>
                    <div className="font-mono text-[0.52rem] uppercase tracking-wider mt-0.5 text-[#444]">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Graveyard ── */}
      <div className="rounded-2xl p-6" style={{ background: '#050505', border: '1px solid #1a1a1a', borderLeft: '4px solid #f85149' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="font-mono text-[0.65rem] uppercase tracking-[3px] text-[#f85149]">🪦 THE GRAVEYARD [LAST 30 DAYS — 3+ FAILS, UNSOLVED]</div>
          {bounties.length > 0 && (
            <div className="font-mono text-[0.6rem] text-[#555]">
              {bounties.length} active &middot; {bounties.reduce((s: number, b: any) => s + b.pts, 0).toLocaleString()} total pts at stake
            </div>
          )}
        </div>
        {bounties.length === 0
          ? <div className="text-[#555] font-mono italic text-sm">No active graves. The squad is clean.</div>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {bounties.map((b: any) => (
                <div key={b.pid} className={`rounded-xl p-4 flex flex-col gap-2 border border-l-[3px] ${b.isOwn ? 'border-[#1a1a1a] border-l-[#f85149] bg-[rgba(248,81,73,0.03)]' : 'border-[#1a1a1a] border-l-[#e3b341] bg-[rgba(227,179,65,0.02)]'}`}>
                  <a href={`https://codeforces.com/contest/${b.prob.contestId}/problem/${b.prob.index}`} target="_blank"
                    className="font-bold text-[0.8rem] text-[#58a6ff] hover:underline leading-tight no-underline">
                    {b.prob.name || b.pid}
                  </a>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[rgba(248,81,73,0.1)] text-[#f85149]">R: {b.prob.rating || 'N/A'}</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[rgba(227,179,65,0.1)] text-[#e3b341]">{b.fails} fails</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[rgba(88,166,255,0.1)] text-[#58a6ff]">{b.daysAgo}d ago</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#0f0f0f]">
                    <span className="font-mono text-[9px] text-[#555]">
                      failed by <span style={{ color: b.isOwn ? '#f85149' : '#e3b341' }}>{b.victim}</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#e3b341]">{b.pts} pts</span>
                  </div>
                  <a href={`https://codeforces.com/contest/${b.prob.contestId}/problem/${b.prob.index}`} target="_blank"
                    className={`text-center font-mono text-[0.65rem] font-bold py-1.5 border rounded-md transition-colors no-underline ${b.btnClass}`}>
                    {b.status}
                  </a>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* ── SQUAD STANDINGS [LIVE CONTEST STYLE] ── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: '#050505', border: '1px solid #1a1a1a', boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="font-mono text-[0.7rem] font-bold uppercase tracking-[3px] text-[#e3b341] flex items-center gap-2">
            <span className="text-lg">🏆</span> SQUAD STANDINGS [LIVE]
          </div>
          <div className="flex bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-1">
            {['7D', '30D'].map(mode => (
              <button key={mode} onClick={() => setSprintMode(mode as any)}
                className={`font-mono text-[9px] px-4 py-1.5 rounded-[4px] transition-all cursor-pointer border-none uppercase tracking-wider ${sprintMode === mode ? 'bg-[#e3b341] text-black font-bold' : 'bg-transparent text-[#555] hover:text-[#888]'}`}>
                {mode === '7D' ? '7-Day Sprint' : '30-Day Campaign'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="w-full font-mono text-[11px] border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-[#1a1a1a]">
                <th className="text-center py-3 px-2 text-[#444] font-normal w-12">RNK</th>
                <th className="text-left py-3 px-4 text-[#444] font-normal">OPERATIVE</th>
                <th className="text-right py-3 px-4 text-[#e3b341] font-bold tracking-widest">SCORE</th>
                <th className="text-right py-3 px-4 text-[#f85149] font-normal tracking-widest">PENALTY</th>
                <th className="text-right py-3 px-4 text-[#56d364] font-normal tracking-widest">ACs</th>
                <th className="text-right py-3 px-4 text-[#58a6ff] font-normal tracking-widest">ACCURACY</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row: any, i: number) => {
                const isMe = row.handle === config.main;
                const idx = allPlayers.indexOf(row.handle);
                const rowColor = idx >= 0 ? COLORS[idx] : '#8b949e';
                const rankBadge = i === 0 ? { bg: '#ffd70015', text: '#ffd700', icon: '🥇' } : 
                                  i === 1 ? { bg: '#c0c0c015', text: '#c0c0c0', icon: '🥈' } : 
                                  i === 2 ? { bg: '#cd7f3215', text: '#cd7f32', icon: '🥉' } : 
                                            { bg: '#111', text: '#555', icon: `${i+1}` };
                return (
                  <tr key={row.handle} className={`border-b border-[#0f0f0f] transition-colors group ${isMe ? 'bg-[rgba(227,179,65,0.03)] hover:bg-[rgba(227,179,65,0.06)]' : 'hover:bg-[#0a0a0a]'}`}>
                    <td className="py-3 px-2">
                      <div className="mx-auto w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs" 
                           style={{ background: rankBadge.bg, color: rankBadge.text }}>
                        {rankBadge.icon}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-sm" style={{ color: rowColor }}>{row.handle}</div>
                      <div className="text-[9px] uppercase tracking-widest text-[#555] mt-0.5">{row.rankInfo}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-lg font-black" style={{ color: '#e3b341' }}>{row.score.toLocaleString()}</span>
                      <span className="text-[9px] text-[#e3b341] opacity-50 ml-1">XP</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold" style={{ color: row.penalty > 0 ? '#f85149' : '#444' }}>{row.penalty > 0 ? `+${row.penalty}` : '0'}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-[#56d364] font-bold">{row.acs}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden hidden sm:block">
                          <div className="h-full rounded-full bg-[#58a6ff]" style={{ width: `${row.acc}%` }} />
                        </div>
                        <span className="text-[#58a6ff] font-bold">{row.acc}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Rating Warfare (All Time) ── */}
      {squadCharts && (
        <ChartCard title="📡 Rating Warfare (All Time)" color="#58a6ff">
          <Line data={squadCharts.lineData} options={LINE_OPT} />
        </ChartCard>
      )}

      {/* ── STRUCTURED COMPARISON CHARTS ── */}
      {cc && (
        <div className="flex flex-col gap-10 mt-4">
          
          {/* PHASE I: ACTIVE SPRINT */}
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[3px] text-[#e3b341] mb-4 flex items-center gap-2 pl-3 border-l-2 border-[#e3b341]">
              <span className="text-lg leading-none">⚡</span> PHASE I: ACTIVE SPRINT (7 DAYS)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="7-Day Synth Score" color="#e3b341"><Bar data={cc.weeklyScore} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="7-Day ACs" color="#56d364"><Bar data={cc.weeklyAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="7-Day Accepted Rate" color="#e879f9"><Bar data={cc.weeklyAccRate} options={CHART_OPT('%')} /></ChartCard>
              <ChartCard title="Active Days (7D)" color="#58a6ff"><Bar data={cc.activeDays7} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>

          {/* PHASE II: SUSTAINED CAMPAIGN */}
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[3px] text-[#58a6ff] mb-4 flex items-center gap-2 pl-3 border-l-2 border-[#58a6ff]">
              <span className="text-lg leading-none">📅</span> PHASE II: SUSTAINED CAMPAIGN (30 DAYS)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="30-Day Synth Score" color="#d2a8ff"><Bar data={cc.monthlyScore} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="30-Day ACs" color="#58a6ff"><Bar data={cc.monthlyAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="30-Day Accepted Rate" color="#db6d28"><Bar data={cc.monthlyAccRate} options={CHART_OPT('%')} /></ChartCard>
              <ChartCard title="Active Days (30D)" color="#e3b341"><Bar data={cc.activeDays30} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>

          {/* PHASE III: LIFETIME SUPREMACY & OVERVIEW */}
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[3px] text-[#f85149] mb-4 flex items-center gap-2 pl-3 border-l-2 border-[#f85149]">
              <span className="text-lg leading-none">🏆</span> PHASE III: LIFETIME SUPREMACY
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="Current Rating" color="#e3b341"><Bar data={cc.rating} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="Highest Rated Solved" color="#f85149"><Bar data={cc.highestRated} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="Unique ACs (All Time)" color="#8b949e"><Bar data={cc.uniqueAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="Sprint Overview (7D+30D)" color="#f0a500"><Bar data={squadCharts.sprintData} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}