"use client";

import React, { useEffect } from 'react';
import {
  VerdictChart, TagsRadarChart, TacticalBarChart, ResourceScatterChart,
  TimeToSolveChart, StressBarChart, RatingLineChart, ActivityHeatmap, ChronotypeChart
} from "@/components/Charts";
import { Bar } from 'react-chartjs-2';
import type { ProcessedMetrics, CFInfo, CFSubmission } from "@/lib/types";

// ── Theme Palette (Royal Academic) ───────────────────────────────────────────
const theme = {
  bg:      '#0b090a',       // Deep obsidian
  surface: '#151314',       // Dark charcoal velvet
  sh:      '#3a2e24',       // Tarnished bronze/gold border
  text:    '#f0e6d2',       // Ivory/Parchment
  muted:   '#9c8973',       // Antique gold
  accent:  '#d4af37',       // Royal Gold
  stop:    '#8b0000',       // Crimson
  ok:      '#2e8b57',       // Emerald
};

// ── Rating Bucket vs Accepted% (Themed) ──────────────────────────────────────
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
  
  // Custom royal colors for the bars
  const bgColors = values.map(v => v >= 70 ? theme.ok : v >= 40 ? theme.accent : theme.stop);
  
  return (
    <div className="h-[300px] relative mt-4">
      <Bar data={{ 
          labels: labels.map(String), 
          datasets: [{ label: 'Accepted %', data: values, backgroundColor: bgColors, borderRadius: 2 }] 
        }}
        options={{ 
          responsive: true, 
          maintainAspectRatio: false, 
          plugins: { 
            legend: { display: false }, 
            tooltip: { 
              backgroundColor: 'rgba(21, 19, 20, 0.95)',
              titleColor: theme.accent,
              bodyColor: theme.text,
              borderColor: theme.sh,
              borderWidth: 1,
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
            x: { grid: { display: false }, ticks: { color: theme.muted, font: { family: 'monospace', size: 10 } } }, 
            y: { min: 0, max: 100, grid: { color: 'rgba(212, 175, 55, 0.05)' }, ticks: { color: theme.muted, font: { family: 'monospace', size: 10 }, callback: (v) => `${v}%` } } 
          } 
        }} />
    </div>
  );
}

// ── Royal Card Primitives ────────────────────────────────────────────────────
function OrnateLine() {
  return (
    <div className="absolute top-0 left-0 right-0 h-[2px] opacity-70" 
         style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-6 transition-all duration-500 hover:-translate-y-1 ${className}`} 
         style={{ 
           background: `linear-gradient(145deg, ${theme.surface} 0%, #0a090a 100%)`, 
           border: `1px solid ${theme.sh}`,
           boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 0 20px rgba(212, 175, 55, 0.02)`
         }}>
      <OrnateLine />
      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l opacity-50" style={{ borderColor: theme.accent }} />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r opacity-50" style={{ borderColor: theme.accent }} />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l opacity-50" style={{ borderColor: theme.accent }} />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r opacity-50" style={{ borderColor: theme.accent }} />
      
      {children}
    </div>
  );
}

function CardTitle({ icon, children }: { icon?: string, children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-3 border-b" style={{ borderColor: 'rgba(156, 137, 115, 0.1)' }}>
      {icon && <span className="text-xl drop-shadow-lg">{icon}</span>}
      <h3 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: theme.muted, fontFamily: 'Georgia, serif' }}>
        {children}
      </h3>
    </div>
  );
}

function StatPlaque({ label, value, sub, icon, accent = false }: { label: string; value: string | number; sub?: string; icon: string; accent?: boolean }) {
  const color = accent ? theme.accent : theme.text;
  return (
    <div className="relative overflow-hidden rounded-xl p-6 transition-all duration-500 hover:scale-[1.02] group" 
         style={{ 
           background: `linear-gradient(180deg, rgba(21,19,20,0.8) 0%, rgba(10,9,10,0.9) 100%)`, 
           border: `1px solid ${accent ? 'rgba(212,175,55,0.4)' : theme.sh}`,
           boxShadow: accent ? `0 0 20px rgba(212, 175, 55, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)` : 'none'
         }}>
      {accent && <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />}
      
      <div className="flex justify-between items-start mb-2 relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.muted }}>{label}</p>
        <span className="text-lg opacity-80 filter drop-shadow-md">{icon}</span>
      </div>
      
      <p className="text-4xl font-black mt-2 tracking-tight relative z-10" style={{ color, fontFamily: 'Georgia, serif' }}>
        {value}
      </p>
      
      {sub && <p className="text-[10px] mt-2 uppercase tracking-wider relative z-10" style={{ color: theme.sh }}>{sub}</p>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
interface CommandTabProps {
  metrics: ProcessedMetrics;
  info: CFInfo;
  filter: string;
  config: { main: string; squad: string[]; titans: string[] };
  squadData: Record<string, any>;
}

export default function CommandTab({ metrics, info, filter, config, squadData }: CommandTabProps) {
  
  useEffect(() => {
    // Add custom royal typography via class
    document.body.classList.add('royal-theme');
    return () => document.body.classList.remove('royal-theme');
  }, []);

  const timeAvgData: Record<string, number> = {};
  const memAvgData: Record<string, number> = {};
  Object.keys(metrics.tagResourceStress).forEach(t => {
    timeAvgData[t] = metrics.tagResourceStress[t].timeAvg;
    memAvgData[t] = metrics.tagResourceStress[t].memAvg;
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700" style={{ backgroundColor: theme.bg, color: theme.text }}>

      {/* ── HIGH COMMAND STATS ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <StatPlaque icon="⚜️" label={filter === 'ALL' ? 'Lifetime Glory' : 'Context Glory'} value={metrics.score.toLocaleString()} accent />
        <StatPlaque icon="🎯" label="Unique Conquered" value={metrics.unique.toLocaleString()} />
        <StatPlaque icon="🗡️" label="First-Strike Rate" value={`${metrics.acc}%`} />
        <StatPlaque icon="🛡️" label="Retaliation (Upsolve)" value={`${metrics.upsolveRate}%`} />
      </div>

      {/* ── THE GRAND ARCHIVE (HEATMAP) ── */}
      <Card>
        <CardTitle icon="📜">Campaign History — 365 Days</CardTitle>
        <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#3a2e24] scrollbar-track-transparent">
          <div className="min-w-[800px]">
            <ActivityHeatmap subs={metrics.rawSubsList} />
          </div>
        </div>
      </Card>

      {/* ── ASCENSION TRAJECTORY ── */}
      <Card>
        <CardTitle icon="👑">Ascension Trajectory</CardTitle>
        <div className="h-[280px]">
          <RatingLineChart history={squadData[config.main].history} />
        </div>
      </Card>

      {/* ── TACTICAL DISTRIBUTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardTitle icon="⚖️">Difficulty Distribution</CardTitle>
          <div className="h-[300px]"><TacticalBarChart data={metrics.ratingsDist} color={theme.accent} /></div>
        </Card>
        <Card>
          <CardTitle icon="⚖️">Verdict Judgments</CardTitle>
          <div className="h-[300px]"><VerdictChart data={metrics.verdictsDist} /></div>
        </Card>
      </div>

      {/* ── WEAKNESS MATRIX ── */}
      <Card>
        <CardTitle icon="🩸">The Blood Ledger — Fails to AC Ratio</CardTitle>
        <p className="text-[10px] text-center mb-4 uppercase tracking-widest" style={{ color: theme.muted }}>Identify where the line breaks</p>
        <div className="h-[350px]"><TacticalBarChart data={metrics.weaknessRatios} color={theme.stop} horizontal /></div>
      </Card>

      {/* ── MASTERY & YIELD ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-1">
          <CardTitle icon="🕸️">Web of Mastery</CardTitle>
          <div className="h-[300px]"><TagsRadarChart data={metrics.tagsDist} handle={info.handle} /></div>
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle icon="⚖️">Yield by Tier</CardTitle>
          <RatingVsAcceptedChart subs={metrics.rawSubsList} />
        </Card>
      </div>

      {/* ── TEMPORAL MECHANICS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle icon="⏳">Time-to-Solve Analytics</CardTitle>
          <div className="h-[280px]"><TimeToSolveChart data={metrics.timeToSolveDist} /></div>
        </Card>
        <Card>
          <CardTitle icon="🌙">Chronotype Analysis</CardTitle>
          <div className="h-[280px]"><ChronotypeChart subs={metrics.rawSubsList} /></div>
        </Card>
      </div>

      {/* ── SYSTEM STRESS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardTitle icon="⚡">Execution Time Stress</CardTitle>
          <div className="h-[250px]"><StressBarChart data={timeAvgData} type="time" /></div>
        </Card>
        <Card>
          <CardTitle icon="💾">Memory Constraint Stress</CardTitle>
          <div className="h-[250px]"><StressBarChart data={memAvgData} type="memory" /></div>
        </Card>
        <Card className="md:col-span-2 lg:col-span-1">
          <CardTitle icon="🌌">Resource Matrix</CardTitle>
          <div className="h-[250px]"><ResourceScatterChart subs={metrics.rawSubsList} /></div>
        </Card>
      </div>

    </div>
  );
}