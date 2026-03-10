"use client";

import {
  VerdictChart, TagsRadarChart, TacticalBarChart, ResourceScatterChart,
  TimeToSolveChart, StressBarChart, RatingLineChart, ActivityHeatmap, ChronotypeChart
} from "@/components/Charts";
import { Bar } from 'react-chartjs-2';
import type { ProcessedMetrics, CFInfo, CFSubmission } from "@/lib/types";

// ── Rating Bucket vs Accepted% bar chart ─────────────────────────────────
function RatingVsAcceptedChart({ subs }: { subs: CFSubmission[] }) {
  // Build per-rating-bucket: total attempts and accepted count
  const buckets: Record<number, { total: number; accepted: number }> = {};
  const RATINGS = [800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2600,2700,2800,2900,3000,3200,3400,3500];

  subs.forEach(s => {
    if (!s.problem?.rating) return;
    const r = Math.floor(s.problem.rating / 100) * 100;
    if (!buckets[r]) buckets[r] = { total: 0, accepted: 0 };
    buckets[r].total++;
    if (s.verdict === 'OK') buckets[r].accepted++;
  });

  // Only show buckets that have at least 1 submission
  const labels = RATINGS.filter(r => buckets[r] && buckets[r].total > 0);
  const values = labels.map(r => parseFloat(((buckets[r].accepted / buckets[r].total) * 100).toFixed(1)));

  // Color by accepted%: green ≥ 70, yellow 40–70, red < 40
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

// ── UI atoms (kept local — only used in this tab) ──────────────────────────
function TopLine({ color }: { color: string }) {
  return <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
}

function StatCard({ label, value, sub, color = "#f0a500", icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
      style={{ background: `linear-gradient(135deg, ${color}06 0%, rgba(0,0,0,0.3) 100%)`, border: `1px solid ${color}28`, boxShadow: `0 2px 12px ${color}0e, inset 0 1px 0 rgba(255,255,255,0.03)` }}>
      <TopLine color={color} />
      <div className="text-xl mb-2 leading-none">{icon}</div>
      <div className="font-mono text-2xl font-black leading-none tabular-nums" style={{ color, letterSpacing: "-0.5px" }}>{value}</div>
      <div className="font-mono text-[0.58rem] uppercase tracking-[2px] mt-1.5 leading-none" style={{ color: "#454558" }}>{label}</div>
      {sub && <div className="font-mono text-[0.68rem] mt-1" style={{ color: "#666" }}>{sub}</div>}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
interface CommandTabProps {
  metrics: ProcessedMetrics;
  info: CFInfo;
  filter: string;
  config: { main: string; squad: string[]; titan: string };
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
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* KPI stat strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        <StatCard label={`${filter === 'ALL' ? 'Lifetime' : 'Context'} XP`} value={metrics.score.toLocaleString()} color="#f0a500" icon="⚡" />
        <StatCard label="Unique AC"     value={metrics.unique.toLocaleString()}   color="#58a6ff" icon="🎯" />
        <StatCard label="First-Try Acc" value={`${metrics.acc}%`}                color="#d2a8ff" icon="🔬" />
        <StatCard label="Upsolve Rate"  value={`${metrics.upsolveRate}%`}         color="#db6d28" icon="🔁" />
      </div>

      {/* Rating vs Accepted% — full-width hero chart */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
        <div className="px-5 pt-4 pb-1 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-[#e3b341]" />
          <span className="font-mono text-[0.6rem] text-[#e3b341] uppercase tracking-[2px] font-semibold">Rating vs Accepted % (per bucket)</span>
        </div>
        <div className="px-5 pb-5 pt-3">
          <RatingVsAcceptedChart subs={metrics.rawSubsList} />
        </div>
      </div>

      {/* Rating trajectory + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#58a6ff]" />
            <span className="font-mono text-[0.6rem] text-[#58a6ff] uppercase tracking-[2px] font-semibold">Rating Trajectory</span>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="h-[260px] relative"><RatingLineChart history={squadData[config.main].history} /></div>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#56d364]" />
            <span className="font-mono text-[0.6rem] text-[#56d364] uppercase tracking-[2px] font-semibold">Activity Heatmap</span>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="h-[260px] flex items-center justify-center overflow-x-auto"><ActivityHeatmap subs={metrics.rawSubsList} /></div>
          </div>
        </div>
      </div>

      {/* Weakness matrix */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
        <div className="px-5 pt-4 pb-1 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-[#f85149]" />
          <span className="font-mono text-[0.6rem] text-[#f85149] uppercase tracking-[2px] font-semibold">Algorithmic Weakness Matrix (Fails / AC ratio)</span>
        </div>
        <div className="px-5 pb-5 pt-3">
          <div className="h-[380px] relative"><TacticalBarChart data={metrics.weaknessRatios} color="#f85149" horizontal={true} /></div>
        </div>
      </div>

      {/* Time + Memory stress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#e879f9]" />
            <span className="font-mono text-[0.6rem] text-[#e879f9] uppercase tracking-[2px] font-semibold">Time Execution Stress (avg ms)</span>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="h-[260px] relative"><StressBarChart data={timeAvgData} type="time" /></div>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#d2a8ff]" />
            <span className="font-mono text-[0.6rem] text-[#d2a8ff] uppercase tracking-[2px] font-semibold">Memory Footprint Stress (avg mb)</span>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="h-[260px] relative"><StressBarChart data={memAvgData} type="memory" /></div>
          </div>
        </div>
      </div>

      {/* Resource scatter + Chronotype */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#f0a500]" />
            <span className="font-mono text-[0.6rem] text-[#f0a500] uppercase tracking-[2px] font-semibold">Resource Distribution</span>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="h-[260px] relative"><ResourceScatterChart subs={metrics.rawSubsList} /></div>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#58a6ff]" />
            <span className="font-mono text-[0.6rem] text-[#58a6ff] uppercase tracking-[2px] font-semibold">Chronotype Analysis</span>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="h-[260px] relative"><ChronotypeChart subs={metrics.rawSubsList} /></div>
          </div>
        </div>
      </div>

      {/* 2×2 mastery grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[
          { color: "#56d364", label: "Algorithmic Mastery", child: <TagsRadarChart data={metrics.tagsDist} handle={info.handle} /> },
          { color: "#db6d28", label: "Time-to-Solve (Debug Speed)", child: <TimeToSolveChart data={metrics.timeToSolveDist} /> },
          { color: "#58a6ff", label: "Problem Rating Distribution", child: <TacticalBarChart data={metrics.ratingsDist} color="#58a6ff" /> },
          { color: "#8b949e", label: "Submission Verdicts", child: <VerdictChart data={metrics.verdictsDist} /> },
        ].map(({ color, label, child }) => (
          <div key={label} className="rounded-xl overflow-hidden" style={{ background: "#06060b", border: "1px solid #14141e" }}>
            <div className="px-5 pt-4 pb-1 flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: color }} />
              <span className="font-mono text-[0.6rem] uppercase tracking-[2px] font-semibold" style={{ color }}>{label}</span>
            </div>
            <div className="px-5 pb-5 pt-3">
              <div className="h-[260px] relative">{child}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
