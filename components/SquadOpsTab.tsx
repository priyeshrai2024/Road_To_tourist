"use client";

import { useState, useMemo } from "react";
import { Line, Bar } from 'react-chartjs-2';
import { CF_SCORE_MAP, SQUAD_COLORS } from "@/lib/constants";
import type { SquadMemberData } from "@/lib/types";

// ── Chart helpers ─────────────────────────────────────────────────────────────
const CHART_OPT = (yLabel?: string): any => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 } } } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#666', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 10 }, callback: yLabel === '%' ? (v: any) => `${v}%` : undefined } },
  },
});

const LINE_OPT: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 } } } },
  scales: {
    x: { display: false },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 10 } } },
  },
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 relative overflow-hidden ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function CardTitle({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-4"
      style={{ color: accent || 'var(--text-muted)' }}>{children}</p>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="h-[180px]">{children}</div>
    </Card>
  );
}

function PhaseHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pl-3" style={{ borderLeft: '2px solid var(--accent)' }}>
      <span className="text-base">{icon}</span>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{label}</p>
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

  const COLORS = allPlayers.map((p, i) => p === config.main ? 'var(--accent)' : SQUAD_COLORS[i % SQUAD_COLORS.length]);
  const cc = squadCharts?.comparisonCharts;

  // ── Contest-style standings ───────────────────────────────────────────────
  const standings = useMemo(() => {
    const days = sprintMode === '7D' ? 7 : 30;
    const now = Date.now() / 1000;
    const cutoffTs = now - (days * 86400);

    const stats = allPlayers.map(p => {
      if (!squadMatrix[p]?.metrics) return null;
      const subs = squadMatrix[p].metrics.rawSubsList
        .filter((s: any) => s.creationTimeSeconds >= cutoffTs)
        .sort((a: any, b: any) => a.creationTimeSeconds - b.creationTimeSeconds);

      let score = 0, penalty = 0, acs = 0;
      const probStats: Record<string, { fails: number; solved: boolean; rating: number }> = {};

      subs.forEach((s: any) => {
        if (!s.problem) return;
        const pid = `${s.problem.contestId}-${s.problem.index}`;
        if (!probStats[pid]) probStats[pid] = { fails: 0, solved: false, rating: s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 800 };
        if (probStats[pid].solved) return;
        if (s.verdict === 'OK') {
          probStats[pid].solved = true; acs++;
          const baseScore = CF_SCORE_MAP[Math.min(2400, probStats[pid].rating)] || 10;
          score += baseScore;
          penalty += (baseScore / 10) * probStats[pid].fails;
        } else if (s.verdict !== 'COMPILATION_ERROR' && s.verdict !== 'SKIPPED') {
          probStats[pid].fails++;
        }
      });

      const acc = subs.length > 0 ? parseFloat(((acs / subs.length) * 100).toFixed(1)) : 0;
      return { handle: p, score, penalty: Math.round(penalty), acs, acc, rankInfo: squadMatrix[p].info?.rank || 'Unrated' };
    }).filter(Boolean);

    return stats.sort((a: any, b: any) => b.score - a.score || a.penalty - b.penalty);
  }, [squadMatrix, config, sprintMode, allPlayers]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">

      {/* ── STANDINGS ── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Sprint Standings</p>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['7D', '30D'] as const).map(m => (
              <button key={m} onClick={() => setSprintMode(m)}
                className="px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  background: sprintMode === m ? 'var(--accent)' : 'transparent',
                  color: sprintMode === m ? 'var(--bg-base)' : 'var(--text-muted)',
                  border: 'none',
                }}>{m}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Handle', 'Score', 'Penalty', 'ACs', 'Acc%'].map(h => (
                  <th key={h} className="pb-3 px-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((row: any, idx: number) => (
                <tr key={row.handle} style={{ borderBottom: '1px solid var(--border)' }}
                  className="transition-colors hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-bold font-mono text-sm" style={{ color: idx === 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{idx + 1}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-semibold" style={{ color: row.handle === config.main ? 'var(--accent)' : 'var(--text-main)' }}>
                      {row.handle === config.main ? `★ ${row.handle}` : row.handle}
                    </span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{row.rankInfo}</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold" style={{ color: 'var(--text-main)' }}>{row.score}</td>
                  <td className="py-3 px-4 font-mono text-sm" style={{ color: row.penalty > 0 ? 'var(--status-wa)' : 'var(--text-muted)' }}>
                    {row.penalty > 0 ? `+${row.penalty}` : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold" style={{ color: 'var(--status-ac)' }}>{row.acs}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${row.acc}%`, background: 'var(--accent)' }} />
                      </div>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-main)' }}>{row.acc}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── BOUNTIES ── */}
      {bounties.length > 0 && (
        <Card>
          <CardTitle>🎯 Squad Bounties</CardTitle>
          <div className="flex flex-col gap-2">
            {bounties.slice(0, 10).map((b: any) => (
              <div key={b.pid} className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>{b.prob.name}</p>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                    {b.prob.rating || '?'} rated · {b.victim} · {b.fails} fails · {b.daysAgo}d ago
                  </p>
                </div>
                <span className="text-sm font-bold font-mono shrink-0" style={{ color: 'var(--accent)' }}>{b.pts} pts</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── RATING WARFARE ── */}
      {squadCharts && (
        <Card>
          <CardTitle>📡 Rating Warfare — All Time</CardTitle>
          <div className="h-[280px]"><Line data={squadCharts.lineData} options={LINE_OPT} /></div>
        </Card>
      )}

      {/* ── COMPARISON CHARTS ── */}
      {cc && (
        <div className="flex flex-col gap-8">
          <div>
            <PhaseHeader icon="⚡" label="Phase I: Active Sprint — 7 Days" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="7-Day Score"><Bar data={cc.weeklyScore} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="7-Day ACs"><Bar data={cc.weeklyAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="7-Day Accepted %"><Bar data={cc.weeklyAccRate} options={CHART_OPT('%')} /></ChartCard>
              <ChartCard title="Active Days (7D)"><Bar data={cc.activeDays7} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>
          <div>
            <PhaseHeader icon="📅" label="Phase II: Sustained Campaign — 30 Days" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="30-Day Score"><Bar data={cc.monthlyScore} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="30-Day ACs"><Bar data={cc.monthlyAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="30-Day Accepted %"><Bar data={cc.monthlyAccRate} options={CHART_OPT('%')} /></ChartCard>
              <ChartCard title="Active Days (30D)"><Bar data={cc.activeDays30} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>
          <div>
            <PhaseHeader icon="🏆" label="Phase III: Lifetime Supremacy" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChartCard title="Current Rating"><Bar data={cc.rating} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="Highest Rated Solved"><Bar data={cc.highestRated} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="Unique ACs (All Time)"><Bar data={cc.uniqueAC} options={CHART_OPT()} /></ChartCard>
              <ChartCard title="Sprint Overview (7D+30D)"><Bar data={squadCharts.sprintData} options={CHART_OPT()} /></ChartCard>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
