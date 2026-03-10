"use client";

import { useState } from "react";
import { Line, Bar } from 'react-chartjs-2';
import { SQUAD_COLORS } from "@/lib/constants";
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

const LB_COLS: { key: string; label: string; color: string }[] = [
  { key:'weeklyScore',   label:'7D Score',   color:'#e3b341' },
  { key:'monthlyScore',  label:'30D Score',  color:'#d2a8ff' },
  { key:'weeklyAC',      label:'7D ACs',     color:'#56d364' },
  { key:'monthlyAC',     label:'30D ACs',    color:'#58a6ff' },
  { key:'weeklyAcc',     label:'7D Acc%',    color:'#e879f9' },
  { key:'monthlyAcc',    label:'30D Acc%',   color:'#db6d28' },
  { key:'highestRated',  label:'Best Rated', color:'#f85149' },
  { key:'uniqueAC',      label:'Unique AC',  color:'#8b949e' },
  { key:'activeDays7',   label:'Active 7D',  color:'#56d364' },
  { key:'activeDays30',  label:'Active 30D', color:'#58a6ff' },
  { key:'rating',        label:'Rating',     color:'#e3b341' },
];

export default function SquadOpsTab({ squadMatrix, config, squadCharts, bounties }: SquadOpsTabProps) {
  const [lbSort, setLbSort] = useState<string>('weeklyScore');

  const allPlayers = [config.main, ...config.squad]
    .filter(h => squadMatrix[h])
    .sort((a, b) => (squadMatrix[b].info.rating || 0) - (squadMatrix[a].info.rating || 0));

  const COLORS = allPlayers.map((p, i) => p === config.main ? '#e3b341' : SQUAD_COLORS[i % SQUAD_COLORS.length]);

  const lb = squadCharts?.leaderboard ?? [];
  const sortedLb = [...lb].sort((a, b) => (b[lbSort] ?? 0) - (a[lbSort] ?? 0));
  const cc = squadCharts?.comparisonCharts;

  const renderLeaderboardCell = (key: string, val: any, color: string, isSorted: boolean) => {
    const opacity = isSorted ? '1' : '0.6';
    if (key.includes('Acc')) {
      return (
        <div className="flex items-center justify-end gap-2" style={{ opacity }}>
          <div className="w-12 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden hidden md:block">
            <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: color }} />
          </div>
          <span style={{ color, fontWeight: isSorted ? 700 : 400 }}>{val}%</span>
        </div>
      );
    }
    if (key.includes('Score')) {
      return <span style={{ color, opacity, fontWeight: isSorted ? 700 : 400 }}>{val.toLocaleString()} <span className="text-[9px] opacity-40">XP</span></span>;
    }
    if (key.includes('Days')) {
      return <span style={{ color, opacity, fontWeight: isSorted ? 700 : 400 }}>{val} <span className="text-[9px] opacity-40">D</span></span>;
    }
    return <span style={{ color, opacity, fontWeight: isSorted ? 700 : 400 }}>{val.toLocaleString()}</span>;
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-400">

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

      {/* ── Sprint Leaderboard (Upgraded UI) ── */}
      {lb.length > 0 && (
        <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: '#050505', border: '1px solid #1a1a1a', boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)' }}>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="font-mono text-[0.7rem] font-bold uppercase tracking-[3px] text-[#e3b341] flex items-center gap-2">
              <span className="text-lg">🏆</span> SQUAD LEADERBOARD
            </div>
            <div className="flex flex-wrap gap-1.5 bg-[#0a0a0a] p-1.5 rounded-lg border border-[#1a1a1a]">
              {LB_COLS.map(c => (
                <button key={c.key} onClick={() => setLbSort(c.key)}
                  className="font-mono text-[9px] px-2.5 py-1 rounded-[4px] transition-all cursor-pointer border-none"
                  style={{
                    background: lbSort === c.key ? `${c.color}22` : 'transparent',
                    color: lbSort === c.key ? c.color : '#555',
                    fontWeight: lbSort === c.key ? 'bold' : 'normal'
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar pb-2">
            <table className="w-full font-mono text-[11px] border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-[#1a1a1a]">
                  <th className="text-center py-3 px-2 text-[#444] font-normal w-12">POS</th>
                  <th className="text-left py-3 px-4 text-[#444] font-normal">OPERATIVE</th>
                  {LB_COLS.map(c => (
                    <th key={c.key} className="text-right py-3 px-3 font-normal uppercase tracking-wider" 
                        style={{ color: lbSort === c.key ? c.color : '#444' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLb.map((row, i) => {
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
                        <div className="text-[9px] uppercase tracking-widest text-[#555] mt-0.5">{row.rank}</div>
                      </td>
                      {LB_COLS.map(c => (
                        <td key={c.key} className="py-3 px-3 text-right">
                          {renderLeaderboardCell(c.key, row[c.key] ?? 0, c.color, lbSort === c.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* ── THEME-GROUPED CHARTS ── */}
      {squadCharts && cc && (
        <div className="flex flex-col gap-10 mt-4">
          
          {/* RATING SUPREMACY (All Time Line Chart) */}
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: '#050505', border: '1px solid #1a1a1a' }}>
            <TopLine color="#58a6ff" />
            <div className="font-mono text-[0.7rem] uppercase tracking-[3px] text-[#58a6ff] mb-4 flex items-center gap-2">
              <span className="text-lg">📡</span> RATING WARFARE (ALL TIME)
            </div>
            <div className="h-[300px] w-full">
              <Line data={squadCharts.lineData} options={LINE_OPT} />
            </div>
          </div>

          {/* PHASE I: ACTIVE SPRINT */}
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[3px] text-[#e3b341] mb-4 flex items-center gap-2 pl-2">
              <span className="w-2 h-2 rounded-full bg-[#e3b341] animate-pulse" /> PHASE I: ACTIVE SPRINT (LAST 7 DAYS)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="⚡ Synth Score" color="#e3b341"><Bar data={cc.weeklyScore} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="🎯 Operations (AC)" color="#56d364"><Bar data={cc.weeklyAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="🔬 Strike Accuracy" color="#e879f9"><Bar data={cc.weeklyAccRate} options={CHART_OPT('%')} /></ChartCard>
              <ChartCard title="🗓 Days Deployed" color="#58a6ff"><Bar data={cc.activeDays7} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>

          {/* PHASE II: SUSTAINED CAMPAIGN */}
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[3px] text-[#58a6ff] mb-4 flex items-center gap-2 pl-2">
              <span className="w-2 h-2 rounded-full bg-[#58a6ff]" /> PHASE II: SUSTAINED CAMPAIGN (LAST 30 DAYS)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="📅 Synth Score" color="#d2a8ff"><Bar data={cc.monthlyScore} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="📦 Operations (AC)" color="#58a6ff"><Bar data={cc.monthlyAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="📊 Strike Accuracy" color="#db6d28"><Bar data={cc.monthlyAccRate} options={CHART_OPT('%')} /></ChartCard>
              <ChartCard title="📆 Days Deployed" color="#e3b341"><Bar data={cc.activeDays30} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>

          {/* PHASE III: LIFETIME ARSENAL */}
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[3px] text-[#f85149] mb-4 flex items-center gap-2 pl-2">
              <span className="w-2 h-2 rounded-full bg-[#f85149]" /> PHASE III: LIFETIME SUPREMACY
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ChartCard title="📈 Current Rating" color="#e3b341"><Bar data={cc.rating} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="🏆 Highest Rated Kill" color="#f85149"><Bar data={cc.highestRated} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="🎖️ Total Unique ACs" color="#8b949e"><Bar data={cc.uniqueAC} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>
          
        </div>
      )}

    </div>
  );
}