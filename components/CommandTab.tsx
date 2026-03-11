"use client";

import {
  VerdictChart, TagsRadarChart, TacticalBarChart, ResourceScatterChart,
  TimeToSolveChart, StressBarChart, RatingLineChart, ActivityHeatmap, ChronotypeChart
} from "@/components/Charts";
import { Bar } from 'react-chartjs-2';
import type { ProcessedMetrics, CFInfo, CFSubmission } from "@/lib/types";

// ── Rating Bucket vs Accepted% bar chart ─────────────────────────────────
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

  const labels = RATINGS.filter(r => buckets[r] && buckets[r].total > 0);
  const values = labels.map(r => parseFloat(((buckets[r].accepted / buckets[r].total) * 100).toFixed(1)));
  const bgColors = values.map(v => v >= 70 ? '#56d364' : v >= 40 ? '#e3b341' : '#f85149');

  const chartData = {
    labels: labels.map(r => String(r)),
    datasets: [{
      label: 'Accepted %',
      data: values,
      backgroundColor: bgColors,
      borderRadius: 4,
    }],
  };

  return (
    <div className="h-[300px] relative">
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const r = labels[ctx.dataIndex];
                  const b = buckets[r];
                  return ` ${ctx.parsed.y}%  (${b.accepted} AC / ${b.total} subs)`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 } }
            },
            y: {
              min: 0,
              max: 100,
              grid: { color: '#1a1a1a' },
              ticks: {
                color: '#8b949e',
                font: { family: 'JetBrains Mono', size: 10 },
                callback: (v) => `${v}%`
              }
            }
          }
        }}
      />
    </div>
  );
}

function TopLine({ color }: { color: string }) {
  return <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
}

function StatCard({ label, value, sub, color = "#f0a500", icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 transition-transform hover:-translate-y-1" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)", border: `1px solid ${color}33`, boxShadow: `0 0 24px ${color}15, inset 0 1px 0 rgba(255,255,255,0.05)` }}>
      <TopLine color={color} />
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-mono text-3xl font-black leading-none" style={{ color, letterSpacing: "-0.5px" }}>{value}</div>
      <div className="font-mono text-[0.62rem] uppercase tracking-[2px] mt-1.5" style={{ color: "#666" }}>{label}</div>
      {sub && <div className="font-mono text-[0.72rem] mt-0.5" style={{ color: "#888" }}>{sub}</div>}
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
    <div className="flex flex-col gap-6 animate-in fade-in duration-400">
      
      {/* ── TOP LEVEL STATS ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        <StatCard label={`${filter === 'ALL' ? 'Lifetime' : 'Context'} XP`} value={metrics.score.toLocaleString()} color="#f0a500" icon="⚡" />
        <StatCard label="Unique AC"     value={metrics.unique.toLocaleString()}   color="#58a6ff" icon="🎯" />
        <StatCard label="First-Try Acc" value={`${metrics.acc}%`}                color="#d2a8ff" icon="🔬" />
        <StatCard label="Upsolve Rate"  value={`${metrics.upsolveRate}%`}         color="#db6d28" icon="🔁" />
      </div>

      {/* ── ROW 1: ACTIVITY HEATMAP ── */}
      <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
        <div className="font-mono text-[0.65rem] text-[#56d364] uppercase tracking-[2px] mb-4">🔥 ACTIVITY HEATMAP (365 DAYS)</div>
        <div className="w-full overflow-x-auto pb-2">
          <ActivityHeatmap subs={metrics.rawSubsList} />
        </div>
      </div>

      {/* ── ROW 2: RATING TRAJECTORY ── */}
      <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
        <div className="font-mono text-[0.65rem] text-[#58a6ff] uppercase tracking-[2px] mb-4">📡 RATING TRAJECTORY (MOMENTUM)</div>
        <div className="h-[280px] relative"><RatingLineChart history={squadData[config.main].history} /></div>
      </div>

      {/* ── ROW 3: TARGETING & ACCURACY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 lg:col-span-2" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#58a6ff] uppercase tracking-[2px] mb-4">📊 PROBLEM RATING DISTRIBUTION</div>
          <div className="h-[300px] relative"><TacticalBarChart data={metrics.ratingsDist} color="#58a6ff" /></div>
        </div>
        <div className="rounded-2xl p-5 lg:col-span-1" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#8b949e] uppercase tracking-[2px] mb-4">🚫 SUBMISSION VERDICTS</div>
          <div className="h-[300px] relative"><VerdictChart data={metrics.verdictsDist} /></div>
        </div>
      </div>

      {/* ── ROW 4: WEAKNESS MATRIX ── */}
      <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
        <div className="font-mono text-[0.65rem] text-[#f85149] uppercase tracking-[2px] mb-4">🩸 ALGORITHMIC WEAKNESS MATRIX (FAILS / AC RATIO)</div>
        <div className="h-[350px] relative"><TacticalBarChart data={metrics.weaknessRatios} color="#f85149" horizontal={true} /></div>
      </div>

      {/* ── ROW 5: COMPETENCY PROFILE ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 xl:col-span-1" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#e879f9] uppercase tracking-[2px] mb-4">🕸 ALGORITHMIC MASTERY</div>
          <div className="h-[300px] relative"><TagsRadarChart data={metrics.tagsDist} handle={info.handle} /></div>
        </div>
        <div className="rounded-2xl p-5 xl:col-span-2" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#e3b341] uppercase tracking-[2px] mb-4">📈 RATING VS ACCEPTED % (PER RATING BUCKET)</div>
          <RatingVsAcceptedChart subs={metrics.rawSubsList} />
        </div>
      </div>

      {/* ── ROW 6: EXECUTION PATTERNS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#db6d28] uppercase tracking-[2px] mb-4">⏱ TIME-TO-SOLVE (DEBUG SPEED)</div>
          <div className="h-[280px] relative"><TimeToSolveChart data={metrics.timeToSolveDist} /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#f0a500] uppercase tracking-[2px] mb-4">⏰ CHRONOTYPE ANALYSIS</div>
          <div className="h-[280px] relative"><ChronotypeChart subs={metrics.rawSubsList} /></div>
        </div>
      </div>

      {/* ── ROW 7: DEEP SYSTEM METRICS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#e879f9] uppercase tracking-[2px] mb-4">⏳ TIME STRESS (AVG MS)</div>
          <div className="h-[250px] relative"><StressBarChart data={timeAvgData} type="time" /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#d2a8ff] uppercase tracking-[2px] mb-4">💾 MEMORY STRESS (AVG MB)</div>
          <div className="h-[250px] relative"><StressBarChart data={memAvgData} type="memory" /></div>
        </div>
        <div className="rounded-2xl p-5 md:col-span-2 lg:col-span-1" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#56d364] uppercase tracking-[2px] mb-4">⚡ RESOURCE DISTRIBUTION</div>
          <div className="h-[250px] relative"><ResourceScatterChart subs={metrics.rawSubsList} /></div>
        </div>
      </div>

    </div>
  );
}