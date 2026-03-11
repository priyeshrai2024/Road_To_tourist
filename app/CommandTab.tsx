"use client";

import {
  VerdictChart, TagsRadarChart, TacticalBarChart, ResourceScatterChart,
  TimeToSolveChart, StressBarChart, RatingLineChart, ActivityHeatmap, ChronotypeChart
} from "@/components/Charts";
import { Bar } from 'react-chartjs-2';
import type { ProcessedMetrics, CFInfo, CFSubmission } from "@/lib/types";

// ── Rating Bucket vs Accepted% ────────────────────────────────────────────────
function RatingVsAcceptedChart({ subs }: { subs: CFSubmission[] }) {
  const buckets: Record<number, { total: number; accepted: number }> = {};
  const RATINGS = [800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2600,2700,2800,2900,3000,3200,3400,3500];
  subs.forEach(s => {
    if (!s.problem?.rating) return;
    const r = Math.floor(s.problem.rating / 100) * 100;
    if (!buckets[r]) buckets[r] = { total: 0, accepted: 0 };
    buckets[r].total++;
    if (s.verdict === 'OK') buckets[r].accepted++;
  });
  const labels = RATINGS.filter(r => buckets[r]?.total > 0);
  const values = labels.map(r => parseFloat(((buckets[r].accepted / buckets[r].total) * 100).toFixed(1)));
  const bgColors = values.map(v => v >= 70 ? 'var(--status-ac)' : v >= 40 ? 'var(--accent)' : 'var(--status-wa)');
  return (
    <div className="h-[300px] relative">
      <Bar data={{ labels: labels.map(String), datasets: [{ label: 'Accepted %', data: values, backgroundColor: bgColors, borderRadius: 4 }] }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const r = labels[ctx.dataIndex]; const b = buckets[r]; return ` ${ctx.parsed.y}%  (${b.accepted} AC / ${b.total} subs)`; } } } }, scales: { x: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 10 } } }, y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b949e', font: { size: 10 }, callback: (v) => `${v}%` } } } }} />
    </div>
  );
}

// ── Shared card primitives ────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>{children}</p>
  );
}

function StatCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-3xl font-bold leading-none mt-1" style={{ color: accent ? 'var(--accent)' : 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

interface CommandTabProps {
  metrics: ProcessedMetrics;
  info: CFInfo;
  filter: string;
  config: { main: string; squad: string[]; titans: string[] };
  squadData: Record<string, any>;
}

export default function CommandTab({ metrics, info, filter, config, squadData }: CommandTabProps) {
  const timeAvgData: Record<string, number> = {};
  const memAvgData: Record<string, number> = {};
  Object.keys(metrics.tagResourceStress).forEach(t => {
    timeAvgData[t] = metrics.tagResourceStress[t].timeAvg;
    memAvgData[t] = metrics.tagResourceStress[t].memAvg;
  });

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">

      {/* ── STAT STRIP ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <StatCard label={filter === 'ALL' ? 'Lifetime XP' : 'Context XP'} value={metrics.score.toLocaleString()} accent />
        <StatCard label="Unique ACs"     value={metrics.unique.toLocaleString()} />
        <StatCard label="First-Try Rate" value={`${metrics.acc}%`} />
        <StatCard label="Upsolve Rate"   value={`${metrics.upsolveRate}%`} />
      </div>

      {/* ── ACTIVITY HEATMAP ── */}
      <Card>
        <CardTitle>🔥 Activity Heatmap — 365 days</CardTitle>
        <div className="w-full overflow-x-auto pb-1">
          <ActivityHeatmap subs={metrics.rawSubsList} />
        </div>
      </Card>

      {/* ── RATING TRAJECTORY ── */}
      <Card>
        <CardTitle>📡 Rating Trajectory</CardTitle>
        <div className="h-[280px]">
          <RatingLineChart history={squadData[config.main].history} />
        </div>
      </Card>

      {/* ── DISTRIBUTION + VERDICTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle>📊 Problem Rating Distribution</CardTitle>
          <div className="h-[300px]"><TacticalBarChart data={metrics.ratingsDist} color="var(--accent)" /></div>
        </Card>
        <Card>
          <CardTitle>🚫 Submission Verdicts</CardTitle>
          <div className="h-[300px]"><VerdictChart data={metrics.verdictsDist} /></div>
        </Card>
      </div>

      {/* ── WEAKNESS MATRIX ── */}
      <Card>
        <CardTitle>🩸 Weakness Matrix — Fails / AC ratio</CardTitle>
        <div className="h-[350px]"><TacticalBarChart data={metrics.weaknessRatios} color="var(--status-wa)" horizontal /></div>
      </Card>

      {/* ── MASTERY RADAR + RATING VS ACC ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1">
          <CardTitle>🕸 Algorithmic Mastery</CardTitle>
          <div className="h-[300px]"><TagsRadarChart data={metrics.tagsDist} handle={info.handle} /></div>
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle>📈 Rating vs Accepted % per bucket</CardTitle>
          <RatingVsAcceptedChart subs={metrics.rawSubsList} />
        </Card>
      </div>

      {/* ── EXECUTION PATTERNS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle>⏱ Time-to-Solve</CardTitle>
          <div className="h-[280px]"><TimeToSolveChart data={metrics.timeToSolveDist} /></div>
        </Card>
        <Card>
          <CardTitle>⏰ Chronotype — Hour of day</CardTitle>
          <div className="h-[280px]"><ChronotypeChart subs={metrics.rawSubsList} /></div>
        </Card>
      </div>

      {/* ── RESOURCE STRESS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardTitle>⏳ Time Stress (avg ms)</CardTitle>
          <div className="h-[250px]"><StressBarChart data={timeAvgData} type="time" /></div>
        </Card>
        <Card>
          <CardTitle>💾 Memory Stress (avg MB)</CardTitle>
          <div className="h-[250px]"><StressBarChart data={memAvgData} type="memory" /></div>
        </Card>
        <Card className="md:col-span-2 lg:col-span-1">
          <CardTitle>⚡ Resource Distribution</CardTitle>
          <div className="h-[250px]"><ResourceScatterChart subs={metrics.rawSubsList} /></div>
        </Card>
      </div>

    </div>
  );
}
