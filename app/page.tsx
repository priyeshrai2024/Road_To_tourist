"use client";

import { useState, useEffect, useMemo } from "react";
import { VerdictChart, TagsRadarChart, TacticalBarChart, ResourceScatterChart, TimeToSolveChart, StressBarChart, RatingLineChart, ActivityHeatmap, ChronotypeChart } from "@/components/Charts";
import WarMap, { T_NODES } from "@/components/WarMap";
import SettingsModal from "@/components/SettingsModal";
import Armory, { BadgeDef } from "@/components/Armory";
import GrindMode from "@/components/GrindMode";
import Nemesis from "@/components/Nemesis";
import Forge from "@/components/Forge";
import { Line, Bar, Radar } from 'react-chartjs-2';

// ─── STRICT TYPESCRIPT INTERFACES ─────────────────────────────────────────────
interface CFSubmission { verdict: string; creationTimeSeconds: number; timeConsumedMillis: number; memoryConsumedBytes: number; author: { participantType: string }; problem: { contestId: number; index: string; name: string; rating?: number; tags?: string[] }; }
interface CFInfo { handle: string; rating?: number; maxRating?: number; rank?: string; titlePhoto: string; contribution?: number; }
interface CFRating { ratingUpdateTimeSeconds: number; oldRating: number; newRating: number; }
interface ProcessedMetrics { score: number; weeklyScore: number; monthlyScore: number; unique: number; acc: number; upsolveRate: number; verdictsDist: Record<string, number>; tagsDist: Record<string, number>; ratingsDist: Record<string, number>; weaknessRatios: Record<string, number>; timeToSolveDist: Record<string, number>; tagResourceStress: Record<string, { timeAvg: number; memAvg: number }>; rawSubsList: CFSubmission[]; }
interface SquadMemberData { info: CFInfo; metrics: ProcessedMetrics; history: CFRating[]; }

const CF_SCORE_MAP: Record<number, number> = { 800:15, 900:20, 1000:30, 1100:45, 1200:65, 1300:90, 1400:130, 1500:180, 1600:250, 1700:350, 1800:500, 1900:720, 2000:1050, 2100:1530, 2200:2250, 2300:3300, 2400:4800 };
const SQUAD_COLORS = ['#c5a059', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.18)'];
const TABS = ["COMMAND", "WAR MAP", "ARMORY", "SQUAD OPS", "NEMESIS", "FORGE", "GRIND", "TITAN"];
const TAB_COLORS: Record<string, string> = { COMMAND: "#c5a059", "WAR MAP": "rgba(255,255,255,0.5)", ARMORY: "rgba(255,255,255,0.4)", "SQUAD OPS": "rgba(255,255,255,0.45)", NEMESIS: "#f85149", FORGE: "#c5a059", GRIND: "#f85149", TITAN: "#f85149" };

// ─── CORE ENGINE LOGIC ────────────────────────────────────────────────────────
function processMetrics(subs: CFSubmission[]): ProcessedMetrics {
  let attempts = new Set<string>(); let solved = new Set<string>(); let firstTryOk = 0; let score = 0;
  let verdictsDist: Record<string, number> = {}; let tagsDist: Record<string, number> = {}; let ratingsDist: Record<string, number> = {};
  let tagFails: Record<string, number> = {}; let tagSolves: Record<string, number> = {};
  let problemTimings: Record<string, { firstAttempt: number, solved: number | null }> = {};
  let tagTimeSum: Record<string, number> = {}; let tagMemSum: Record<string, number> = {}; let tagResourceCount: Record<string, number> = {};
  let inContestFails = new Set<string>(); let inContestSolves = new Set<string>(); let practiceSolves = new Set<string>();
  let weeklyScore = 0; let monthlyScore = 0;

  const rawSubsList = [...subs].reverse();
  const now = Date.now() / 1000;

  rawSubsList.forEach(sub => {
    const pid = sub.problem ? `${sub.problem.contestId}-${sub.problem.index}` : 'unknown';
    const v = sub.verdict || 'UNKNOWN';
    const isContest = (sub.author?.participantType === 'CONTESTANT' || sub.author?.participantType === 'VIRTUAL');
    const isPractice = (sub.author?.participantType === 'PRACTICE');
    const daysAgo = (now - sub.creationTimeSeconds) / 86400;
    let decayWeight = daysAgo > 180 ? 0.4 : (daysAgo > 90 ? 0.6 : (daysAgo > 30 ? 0.8 : 1.0));
    
    verdictsDist[v] = (verdictsDist[v] || 0) + 1;

    if (pid !== 'unknown') {
      if (!problemTimings[pid]) problemTimings[pid] = { firstAttempt: sub.creationTimeSeconds, solved: null };
      if (!attempts.has(pid)) { attempts.add(pid); if (v === 'OK') firstTryOk++; }
      if (isContest) { if (v === 'OK') inContestSolves.add(pid); else inContestFails.add(pid); }
      else if (isPractice) { if (v === 'OK') practiceSolves.add(pid); }

      if (v !== 'OK' && v !== 'COMPILATION_ERROR' && sub.problem.tags) sub.problem.tags.forEach((tag: string) => { tagFails[tag] = (tagFails[tag] || 0) + decayWeight; });

      if (v === 'OK') {
        if (sub.problem.tags && sub.timeConsumedMillis !== undefined && sub.memoryConsumedBytes !== undefined) {
          sub.problem.tags.forEach((tag: string) => { tagTimeSum[tag] = (tagTimeSum[tag] || 0) + sub.timeConsumedMillis; tagMemSum[tag] = (tagMemSum[tag] || 0) + (sub.memoryConsumedBytes / 1048576); tagResourceCount[tag] = (tagResourceCount[tag] || 0) + 1; });
        }
        if (!solved.has(pid)) {
          solved.add(pid); problemTimings[pid].solved = sub.creationTimeSeconds;
          let pts = 10;
          if (sub.problem.rating) {
            let r = Math.floor(sub.problem.rating / 100) * 100; r = r < 800 ? 800 : (r > 3500 ? 3500 : r);
            ratingsDist[r] = (ratingsDist[r] || 0) + 1; pts = CF_SCORE_MAP[r > 2400 ? 2400 : r] || 0;
          } else ratingsDist['Unrated'] = (ratingsDist['Unrated'] || 0) + 1;
          
          score += pts; if (daysAgo <= 7) weeklyScore += pts; if (daysAgo <= 30) monthlyScore += pts;
          if (sub.problem.tags) sub.problem.tags.forEach((tag: string) => { tagsDist[tag] = (tagsDist[tag] || 0) + 1; tagSolves[tag] = (tagSolves[tag] || 0) + decayWeight; });
        }
      }
    }
  });

  const acc = attempts.size > 0 ? parseFloat(((firstTryOk / attempts.size) * 100).toFixed(1)) : 0;
  let upsolveCandidates = [...inContestFails].filter(p => !inContestSolves.has(p)); 
  let upsolveRate = upsolveCandidates.length > 0 ? parseFloat(((upsolveCandidates.filter(p => practiceSolves.has(p)).length / upsolveCandidates.length) * 100).toFixed(1)) : 0;
  let weaknessRatios: Record<string, number> = {};
  Object.keys(tagSolves).forEach(tag => { if (tagSolves[tag] >= 2.5) weaknessRatios[tag] = parseFloat(((tagFails[tag] || 0) / tagSolves[tag]).toFixed(2)); });

  let timeToSolveDist = { "First Try (0m)": 0, "< 30m": 0, "1h - 5h": 0, "> 5h (Grind)": 0 };
  Object.values(problemTimings).forEach(t => {
    if (t.solved) {
      let diffMins = (t.solved - t.firstAttempt) / 60;
      if (diffMins <= 1) timeToSolveDist["First Try (0m)"]++; else if (diffMins <= 30) timeToSolveDist["< 30m"]++; else if (diffMins <= 300) timeToSolveDist["1h - 5h"]++; else timeToSolveDist["> 5h (Grind)"]++;
    }
  });

  let tagResourceStress: Record<string, {timeAvg: number, memAvg: number}> = {}; 
  Object.keys(tagResourceCount).forEach(tag => { if (tagResourceCount[tag] >= 3) tagResourceStress[tag] = { timeAvg: tagTimeSum[tag] / tagResourceCount[tag], memAvg: tagMemSum[tag] / tagResourceCount[tag] }; });

  return { score, weeklyScore, monthlyScore, unique: solved.size, acc, upsolveRate, verdictsDist, tagsDist, ratingsDist, weaknessRatios, timeToSolveDist, tagResourceStress, rawSubsList };
}

const evaluateMapMetrics = (subs: CFSubmission[]) => {
  let metrics = { conquered: 0, citadel: 0, rebellion: 0, occupied: 0, decaying: 0, scouted: 0 };
  const state: Record<string, any> = {}; const now = Date.now() / 1000;
  Object.values(T_NODES).forEach(n => { state[n.id] = { ac: 0, fail: 0, maxR: 0, lastAC: 0 }; });
  subs.forEach(s => {
    if (!s.problem || !s.problem.tags) return;
    const isAC = s.verdict === 'OK'; const r = s.problem.rating || 800;
    Object.values(T_NODES).forEach(n => {
      if (s.problem.tags!.includes(n.tag)) {
        if (isAC) { state[n.id].ac++; if (r > state[n.id].maxR) state[n.id].maxR = r; if (s.creationTimeSeconds > state[n.id].lastAC) state[n.id].lastAC = s.creationTimeSeconds; }
        else if (s.verdict !== 'COMPILATION_ERROR') state[n.id].fail++;
      }
    });
  });
  Object.values(T_NODES).forEach(n => {
    let m = state[n.id];
    if (m.ac === 0) metrics.scouted++;
    if (m.ac >= 25) metrics.conquered++; else if (m.ac >= 5) metrics.occupied++; else if (m.ac >= 1) metrics.occupied++;
    if (m.ac > 0 && m.maxR >= 2200) metrics.citadel++;
    if (m.ac > 0 && m.fail / m.ac > 2.0) metrics.rebellion++;
    if (m.ac > 0 && (now - m.lastAC) / 86400 > 30) metrics.decaying++;
  });
  return metrics;
};

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────

// Sharp 1px blinking square — no glow, no blur, no rounded corners
function GlowPulse({ color = "#c5a059" }: { color?: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 animate-[blink_1.2s_step-start_infinite]"
      style={{ background: color }}
    />
  );
}

function TopLine({ color }: { color: string }) {
  return <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color, opacity: 0.5 }} />;
}

function StatusLabel({ label, color }: { label: string; color: string; icon?: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[0.55rem] uppercase tracking-[3px]" style={{ color }}>
      <span className="w-1 h-1 inline-block" style={{ background: color }} />
      {label}
    </div>
  );
}

function StatCard({ label, value, sub, color = "#c5a059", icon }: any) {
  return (
    <div className="relative overflow-hidden p-5 bg-[#020202] border border-white/[0.05] transition-all duration-200 hover:bg-white/[0.02]">
      <TopLine color={color} />
      <div className="text-xl mb-2 opacity-50">{icon}</div>
      <div className="font-mono text-3xl font-light leading-none tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="font-mono text-[0.6rem] uppercase tracking-[3px] mt-2 text-white/20">{label}</div>
      {sub && <div className="font-mono text-[0.7rem] mt-1 text-white/25">{sub}</div>}
    </div>
  );
}

// ─── TAB COMPONENTS ─────────────────────────────────────────────────────────
function CommandTab({ metrics, info, filter, config, squadData }: any) {
  let timeAvgData: Record<string, number> = {}; let memAvgData: Record<string, number> = {};
  if (metrics) Object.keys(metrics.tagResourceStress).forEach(t => { timeAvgData[t] = metrics.tagResourceStress[t].timeAvg; memAvgData[t] = metrics.tagResourceStress[t].memAvg; });
  let sortedWeaknesses = metrics ? Object.keys(metrics.weaknessRatios).sort((a,b) => metrics.weaknessRatios[b] - metrics.weaknessRatios[a]) : [];

  const panelCls = "bg-[#020202] border border-white/[0.04] p-6";

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-400">

      {/* Stat row */}
      <div className="grid gap-px bg-white/[0.04]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        <StatCard label={`${filter==='ALL'?'Lifetime':'Context'} XP`} value={metrics.score.toLocaleString()} color="#c5a059" icon="⚡" />
        <StatCard label="Unique AC" value={metrics.unique.toLocaleString()} color="rgba(255,255,255,0.6)" icon="◎" />
        <StatCard label="First-Try Acc" value={`${metrics.acc}%`} color="rgba(255,255,255,0.5)" icon="◈" />
        <StatCard label="Upsolve Rate" value={`${metrics.upsolveRate}%`} color="rgba(255,255,255,0.4)" icon="↺" />
      </div>

      {/* The Oracle */}
      <div className="bg-[#020202] border border-white/[0.04] p-7 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-[#c5a059]/40" />
        <div className="absolute top-0 left-0 w-px h-full bg-[#c5a059]/20" />
        <p className="font-serif text-base font-normal text-white/70 tracking-wide mb-1">The Oracle</p>
        <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-6">Tactical Directives</p>
        <div className="font-mono text-sm leading-relaxed text-white/50">
          {sortedWeaknesses.length > 0 ? (
            <>
              <div className="mb-3">
                <span className="text-[#f85149]/80 font-mono text-[9px] tracking-[2px] uppercase">Critical Vulnerability — </span>
                <span className="text-white/60">Failure rate in <strong className="text-white/80 font-normal">{sortedWeaknesses[0]}</strong> is highly inefficient. Upsolve {Math.floor((info.rating || 1200)/100)*100}–{Math.floor((info.rating || 1200)/100)*100 + 200} rated problems.</span>
              </div>
              {sortedWeaknesses.length > 1 && (
                <div>
                  <span className="text-[#c5a059]/70 font-mono text-[9px] tracking-[2px] uppercase">Secondary Target — </span>
                  <span className="text-white/60"><strong className="text-white/80 font-normal">{sortedWeaknesses[1]}</strong>. Run drills in this sector.</span>
                </div>
              )}
            </>
          ) : <span className="text-white/20 font-mono text-[10px] tracking-[2px] uppercase">Awaiting analysis...</span>}
        </div>
      </div>

      {/* Rating trajectory + heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.04]">
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Rating Trajectory</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Momentum</p>
          <div className="h-[280px] relative"><RatingLineChart history={squadData[config.main].history} /></div>
        </div>
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Activity Heatmap</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">6-month cadence</p>
          <div className="h-[280px] flex items-center justify-center overflow-x-auto"><ActivityHeatmap subs={metrics.rawSubsList} /></div>
        </div>
      </div>

      {/* Algorithmic Weakness Matrix */}
      <div className={panelCls}>
        <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Algorithmic Weakness Matrix</p>
        <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Fails / AC ratio</p>
        <div className="h-[380px] relative"><TacticalBarChart data={metrics.weaknessRatios} color="#f85149" horizontal={true} /></div>
      </div>

      {/* Time + Memory stress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.04]">
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Time Execution Stress</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Avg ms per tag</p>
          <div className="h-[280px] relative"><StressBarChart data={timeAvgData} type="time" /></div>
        </div>
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Memory Footprint Stress</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Avg MB per tag</p>
          <div className="h-[280px] relative"><StressBarChart data={memAvgData} type="memory" /></div>
        </div>
      </div>

      {/* Resource scatter + Chronotype */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.04]">
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Resource Distribution</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Time vs Memory scatter</p>
          <div className="h-[280px] relative"><ResourceScatterChart subs={metrics.rawSubsList} /></div>
        </div>
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Chronotype Analysis</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Peak solve hours</p>
          <div className="h-[280px] relative"><ChronotypeChart subs={metrics.rawSubsList} /></div>
        </div>
      </div>

      {/* Bottom 4-chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.04]">
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Algorithmic Mastery</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Tag radar</p>
          <div className="h-[280px] relative"><TagsRadarChart data={metrics.tagsDist} handle={info.handle} /></div>
        </div>
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Time-to-Solve</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Debug speed distribution</p>
          <div className="h-[280px] relative"><TimeToSolveChart data={metrics.timeToSolveDist} /></div>
        </div>
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Problem Rating Distribution</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">AC by difficulty</p>
          <div className="h-[280px] relative"><TacticalBarChart data={metrics.ratingsDist} color="#c5a059" /></div>
        </div>
        <div className={panelCls}>
          <p className="font-serif text-sm font-normal text-white/55 tracking-wide mb-1">Submission Verdicts</p>
          <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-5">Outcome distribution</p>
          <div className="h-[280px] relative"><VerdictChart data={metrics.verdictsDist} /></div>
        </div>
      </div>
    </div>
  );
}

function SquadOpsTab({ squadMatrix, config, squadCharts, bounties }: any) {
  const allPlayers = [config.main, ...config.squad].filter(h => squadMatrix[h]).sort((a,b) => (squadMatrix[b].info.rating || 0) - (squadMatrix[a].info.rating || 0));
  const panelCls = "bg-[#020202] border border-white/[0.04] p-6";

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-400">

      {/* Player cards */}
      <div className="grid gap-px bg-white/[0.04]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {allPlayers.map((handle, i) => {
          const p = squadMatrix[handle];
          const color = handle === config.main ? '#c5a059' : SQUAD_COLORS[i % SQUAD_COLORS.length];
          return (
            <div key={handle} className="relative bg-[#020202] p-7 hover:bg-white/[0.02] transition-all duration-200">
              <TopLine color={color} />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-8 h-8 flex items-center justify-center text-base border border-white/[0.07] bg-[#020202] text-white/30">
                  {i === 0 ? "◈" : i === 1 ? "◇" : "○"}
                </div>
                <div>
                  <div className="font-mono text-sm tracking-wide" style={{ color }}>
                    {handle}
                    {handle === config.main && <span className="text-[9px] text-white/20 tracking-[3px] ml-2">you</span>}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[2px] text-white/20 mt-0.5">{p.info.rank || 'Unrated'}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[["Rating", p.info.rating || 0, color], ["Unique AC", p.metrics.unique, "rgba(255,255,255,0.5)"], ["Accuracy", p.metrics.acc + "%", "rgba(255,255,255,0.4)"]].map(([l, v, c]) => (
                  <div key={l as string} className="text-center">
                    <div className="font-mono text-base font-light" style={{ color: c as string }}>{v}</div>
                    <div className="font-mono text-[8px] uppercase tracking-[2px] mt-1 text-white/20">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* The Graveyard */}
      <div className="bg-[#020202] border border-white/[0.04] p-7 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-[#f85149]/40" />
        <div className="absolute top-0 left-0 w-px h-full bg-[#f85149]/20" />
        <p className="font-serif text-base font-normal text-white/70 tracking-wide mb-1">The Graveyard</p>
        <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-7">Active Bounties</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04]">
          {bounties.map((b: any) => (
            <div key={b.pid} className={`bg-[#020202] p-4 flex flex-col gap-3 border-l hover:bg-white/[0.02] transition-all duration-200 ${b.isOwn ? 'border-l-[#f85149]/50' : 'border-l-[#c5a059]/30'}`}>
              <div className="flex justify-between items-start gap-2">
                <span className="font-mono text-xs text-white/55 leading-snug">{b.name}</span>
                <span className="font-mono text-[9px] text-[#c5a059]/60 shrink-0 tabular-nums">{b.pts}</span>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-[1px] text-white/20 m-0">
                Failed {b.fails}× by <span className={b.isOwn ? "text-[#f85149]/60" : "text-white/35"}>{b.victim}</span>
              </p>
              <a
                href={`https://codeforces.com/contest/${b.prob.contestId}/problem/${b.prob.index}`}
                target="_blank"
                className={`mt-auto text-center font-mono text-[9px] tracking-[2px] uppercase py-2 border transition-all duration-200 no-underline ${b.isOwn ? 'border-[#f85149]/40 text-[#f85149]/60 hover:border-[#f85149]/70 hover:text-[#f85149]' : b.isSniped ? 'border-white/10 text-white/20 pointer-events-none' : 'border-[#c5a059]/35 text-[#c5a059]/60 hover:border-[#c5a059]/70 hover:text-[#c5a059]'}`}
              >
                {b.isSniped ? 'Sniped' : b.isOwn ? 'Upsolve' : 'Engage'}
              </a>
            </div>
          ))}
          {bounties.length === 0 && (
            <div className="col-span-4 font-mono text-[9px] tracking-[3px] uppercase text-white/15 py-10 text-center">
              // No active bounties. The squad is clean.
            </div>
          )}
        </div>
      </div>

      {/* The Crucible */}
      <div className="bg-[#020202] border border-white/[0.04] p-7">
        <p className="font-serif text-base font-normal text-white/70 tracking-wide mb-1">The Crucible</p>
        <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-7">1v1 Combinatorial Duels</p>
        <div className="grid gap-px bg-white/[0.04]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {allPlayers.map((a, i) => allPlayers.slice(i+1).map(b => {
            const pa = squadMatrix[a]; const pb = squadMatrix[b];
            const ca = a === config.main ? '#c5a059' : 'rgba(255,255,255,0.45)';
            const cb = b === config.main ? '#c5a059' : 'rgba(255,255,255,0.45)';
            return (
              <div key={`${a}-${b}`} className="bg-[#020202] p-6">
                <div className="flex justify-between mb-5 font-mono">
                  <span className="text-xs" style={{ color: ca }}>{a}</span>
                  <span className="font-mono text-[8px] tracking-[3px] uppercase text-white/15">vs</span>
                  <span className="text-xs" style={{ color: cb }}>{b}</span>
                </div>
                {[["Rating", pa.info.rating||0, pb.info.rating||0], ["Unique AC", pa.metrics.unique, pb.metrics.unique], ["Accuracy", pa.metrics.acc, pb.metrics.acc]].map(([l, v1, v2]) => (
                  <div key={l as string} className="flex justify-between font-mono text-xs mb-3">
                    <span style={{ color: (v1 as number) >= (v2 as number) ? "rgba(255,255,255,0.7)" : "#f85149", fontWeight: (v1 as number) >= (v2 as number) ? 500 : 400 }}>{v1}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[2px] text-white/20">{l}</span>
                    <span style={{ color: (v2 as number) >= (v1 as number) ? "rgba(255,255,255,0.7)" : "#f85149", fontWeight: (v2 as number) >= (v1 as number) ? 500 : 400 }}>{v2}</span>
                  </div>
                ))}
              </div>
            );
          }))}
        </div>
      </div>

      {squadCharts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04]">
          <div className={panelCls}>
            <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-5">Rating Warfare</p>
            <div className="h-[280px]">
              <Line data={squadCharts.lineData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { font: { family: 'monospace' }, color: 'rgba(255,255,255,0.2)' }, border: { display: false } } }, plugins: { legend: { labels: { color: 'rgba(255,255,255,0.25)', font: { family: 'monospace', size: 10 }, boxWidth: 8 } } } }} />
            </div>
          </div>
          <div className={panelCls}>
            <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-5">Tactical Sprints</p>
            <div className="h-[280px]">
              <Bar data={squadCharts.sprintData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { font: { family: 'monospace' }, color: 'rgba(255,255,255,0.2)' }, border: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: 'rgba(255,255,255,0.2)' }, border: { display: false } } }, plugins: { legend: { labels: { color: 'rgba(255,255,255,0.25)', font: { family: 'monospace', size: 10 }, boxWidth: 8 } } } }} />
            </div>
          </div>
          <div className={`${panelCls} md:col-span-2`}>
            <p className="font-mono text-[9px] tracking-[3px] uppercase text-white/20 mb-5">The Triad — Combined Radar</p>
            <div className="h-[380px]">
              <Radar data={squadCharts.radarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display: false }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { display: false }, pointLabels: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } } } }, plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.25)', font: { family: 'monospace', size: 10 }, boxWidth: 8 } } } }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TitanTab({ squadData, config }: any) {
  if (!squadData[config.titan]) return (
    <div className="text-center py-20 font-mono text-[9px] tracking-[4px] uppercase text-white/15 animate-in fade-in">
      // No Titan configured. Access settings to lock target.
    </div>
  );
  const tData = squadData[config.titan].info;
  const myRating = squadData[config.main].info.rating || 0;
  const tRating = tData.rating || 0;
  const gap = tRating - myRating;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-400">

      {/* Titan profile card */}
      <div className="bg-[#020202] border border-white/[0.05] p-8 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-[#f85149]/50" />
        <div className="absolute top-0 left-0 w-px h-full bg-[#f85149]/20" />
        <div className="flex items-center gap-8">
          <img src={tData.titlePhoto} alt="Titan" className="w-16 h-16 object-cover border border-[#f85149]/20" />
          <div>
            <div className="font-serif text-2xl font-normal text-[#f85149]/80 tracking-wide">{tData.handle}</div>
            <div className="font-mono text-[9px] uppercase tracking-[4px] text-white/20 mt-1 mb-3">Designated Titan — Assassination Target</div>
            <div className="font-mono text-2xl font-light text-[#c5a059]/80">
              {tRating} <span className="font-mono text-[9px] tracking-[2px] uppercase text-white/25">current rating</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assassination Protocol */}
      <div className="bg-[#020202] border border-white/[0.04] p-7 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-[#f85149]/30" />
        <div className="absolute top-0 left-0 w-px h-full bg-[#f85149]/15" />
        <p className="font-serif text-base font-normal text-white/70 tracking-wide mb-1">Assassination Protocol</p>
        <p className="font-mono text-[8px] tracking-[3px] uppercase text-white/20 mb-6">Intercept analysis</p>
        <div className="font-mono text-sm leading-loose text-white/50">
          {gap <= 0 ? (
            <>Target neutralized. You surpassed <span className="text-[#c5a059]/80">{config.titan}</span> by {Math.abs(gap)} points. Find a new Titan.</>
          ) : (
            <>
              Titan <span className="text-[#c5a059]/80">{config.titan}</span> is{" "}
              <span className="text-[#f85149] font-mono text-lg font-light">{gap}</span> points ahead.<br />
              Target protocol: Sustain First-Try ACs on{" "}
              <span className="text-[#c5a059]/80">{Math.floor((tRating || 1500)/100)*100}+</span> rated problems.<br />
              Estimated intercept:{" "}
              <span className="text-white/60">~{Math.ceil(gap/15)} contest cycles</span> at current velocity.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function Home() {
  const [handle, setHandle] = useState("");
  const [squadData, setSquadData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [activeTab, setActiveTab] = useState("COMMAND");
  const [nemesisTarget, setNemesisTarget] = useState("");
  const [contextFilter, setContextFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({ main: "", squad: [] as string[], titan: "" });
  const [tick, setTick] = useState(0);

  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cf_config_v6');
    if (saved) { 
      const parsed = JSON.parse(saved); 
      setConfig(parsed); setHandle(parsed.main || "");
      if (parsed.squad && parsed.squad.length > 0) setNemesisTarget(parsed.squad[0]);
      if (parsed.main) fetchGlobalTelemetry(parsed.main, parsed.squad, parsed.titan); 
    } else setShowSettings(true);
  }, []);

  const fetchGlobalTelemetry = async (mainH: string, squadH: string[], titanH: string) => {
    if (!mainH) return;
    setLoading(true); setLoadingMsg(`Establishing secure uplink...`);
    const newSquadData: Record<string, any> = {};
    const allHandles = [mainH, ...squadH, titanH].filter(Boolean);

    const fetchCF = async (url: string, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try { await new Promise(res => setTimeout(res, 1500)); const res = await fetch(url); const data = await res.json(); if (data.status === 'OK') return data.result; if (data.comment && data.comment.includes("not found")) return null; } 
        catch (e) { console.warn(`Fetch glitch for ${url}, retrying...`); }
      }
      throw new Error("API Timeout");
    };

    try {
      const infoResult = await fetchCF(`https://codeforces.com/api/user.info?handles=${allHandles.join(';')}`);
      if (infoResult) allHandles.forEach(h => { const info = infoResult.find((u: any) => u.handle.toLowerCase() === h.toLowerCase()); if (info) newSquadData[h] = { handle: h, info: info, rawSubs: [], history: [] }; });
      for (const h of allHandles) {
        if (!newSquadData[h]) continue; 
        setLoadingMsg(`Syncing operative: ${h.toUpperCase()}...`);
        const subs = await fetchCF(`https://codeforces.com/api/user.status?handle=${h}`); if (subs) newSquadData[h].rawSubs = subs;
        const history = await fetchCF(`https://codeforces.com/api/user.rating?handle=${h}`); if (history) newSquadData[h].history = history;
      }
      setSquadData(newSquadData);
    } catch (err) { alert("Engine Failure: Codeforces API is overwhelmed. Please wait 60 seconds and try again."); setShowSettings(true); }
    setLoading(false);
  };

  const getFilteredSubs = (subs: CFSubmission[]) => {
    if (!subs) return []; let filtered = subs;
    if (contextFilter === 'RECON' && squadData[config.main]) { const userR = squadData[config.main].info?.rating || 1000; filtered = filtered.filter(s => s.problem?.rating && s.problem.rating >= (userR + 200)); }
    else if (contextFilter === 'CONTEST') filtered = filtered.filter(s => s.author?.participantType === 'CONTESTANT' || s.author?.participantType === 'VIRTUAL');
    else if (contextFilter === 'PRACTICE') filtered = filtered.filter(s => s.author?.participantType === 'PRACTICE');
    if (timeFilter !== 'ALL') { const now = Date.now() / 1000; const limitDays = parseInt(timeFilter); filtered = filtered.filter(s => ((now - s.creationTimeSeconds) / 86400) <= limitDays); }
    return filtered;
  };

  const { mainMetrics, squadMatrix, bounties, computedBadges, absoluteMySolves } = useMemo(() => {
    if (!squadData[config.main] || !squadData[config.main].rawSubs) return { mainMetrics: null, squadMatrix: {} as Record<string, SquadMemberData>, bounties: [], computedBadges: [], absoluteMySolves: new Set() };
    
    const mainSubsFiltered = getFilteredSubs(squadData[config.main].rawSubs);
    const mainMetrics = processMetrics(mainSubsFiltered);
    let absSolves = new Set(); squadData[config.main].rawSubs.forEach((s: CFSubmission) => { if (s.verdict === 'OK' && s.problem) absSolves.add(`${s.problem.contestId}-${s.problem.index}`); });

    let sMatrix: Record<string, SquadMemberData> = {}; let bMatrix: Record<string, any> = {}; let globalBounties: any[] = [];
    const allPlayers = [config.main, ...config.squad].filter(h => squadData[h] && squadData[h].rawSubs);

    allPlayers.forEach(p => {
      const metrics = processMetrics(getFilteredSubs(squadData[p].rawSubs));
      sMatrix[p] = { info: squadData[p].info, metrics, history: squadData[p].history };
      let pMap: Record<string, any> = {};
      metrics.rawSubsList.forEach((s: CFSubmission) => {
        const pid = s.problem ? `${s.problem.contestId}-${s.problem.index}` : null; if (!pid) return;
        if (!pMap[pid]) pMap[pid] = { fails: 0, solved: false, prob: s.problem };
        if (s.verdict === 'OK') pMap[pid].solved = true; else if (s.verdict !== 'COMPILATION_ERROR') pMap[pid].fails++;
      });
      bMatrix[p] = { active: Object.keys(pMap).filter(pid => pMap[pid].fails >= 3 && !pMap[pid].solved), resurrected: Object.keys(pMap).filter(pid => pMap[pid].fails >= 3 && pMap[pid].solved).length, solvedSet: new Set(Object.keys(pMap).filter(pid => pMap[pid].solved)) };
      Object.keys(pMap).forEach(pid => { if (pMap[pid].fails >= 3 && !pMap[pid].solved) globalBounties.push({ victim: p, pid, prob: pMap[pid].prob, fails: pMap[pid].fails, pts: CF_SCORE_MAP[pMap[pid].prob.rating > 2400 ? 2400 : (pMap[pid].prob.rating || 800)] || 10 }); });
    });

    allPlayers.forEach(p => { bMatrix[p].snipes = 0; allPlayers.forEach(target => { if (target !== p) bMatrix[target].active.forEach((pid: string) => { if (bMatrix[p].solvedSet.has(pid)) bMatrix[p].snipes++; }); }); });

    let uniqueBounties: any[] = [];
    globalBounties.sort((a, b) => b.pts - a.pts || b.fails - a.fails).forEach(b => {
      if (!uniqueBounties.find(ub => ub.pid === b.pid)) {
        const isOwn = b.victim === config.main; const isSniped = absSolves.has(b.pid) && !isOwn;
        let btnClass = isOwn ? 'border-[#f85149]/40 text-[#f85149]/60' : (isSniped ? 'border-white/10 text-white/20 pointer-events-none' : 'border-[#c5a059]/35 text-[#c5a059]/60 hover:border-[#c5a059]/70 hover:text-[#c5a059]');
        let status = isOwn ? 'Upsolve Required' : (isSniped ? 'Already Sniped' : 'Initiate Snipe');
        uniqueBounties.push({ ...b, status, btnClass, isOwn, isSniped });
      }
    });

    const reconMetrics = processMetrics(getFilteredSubs(squadData[config.main].rawSubs)); 
    const mapMetrics = evaluateMapMetrics(squadData[config.main].rawSubs);
    const now = Date.now() / 1000;

    const findWinner = (pathFn: (p: string) => number, min = 0, isMin = false) => { let best: string | null = null; let bestVal = isMin ? Infinity : -Infinity; allPlayers.forEach(p => { let v = pathFn(p); if (!isMin && v > bestVal && v >= min) { bestVal = v; best = p; } else if (isMin && v < bestVal && v <= min) { bestVal = v; best = p; } }); return best; };
    const ac = (p: string, d: number) => sMatrix[p].metrics.rawSubsList.filter((s:CFSubmission) => s.verdict==='OK' && (now - s.creationTimeSeconds)/86400 <= d);
    const subs = (p: string, d: number) => sMatrix[p].metrics.rawSubsList.filter((s:CFSubmission) => (now - s.creationTimeSeconds)/86400 <= d);
    const tags = (p: string, d: number, t: string) => ac(p, d).filter((s:CFSubmission) => s.problem.tags?.includes(t)).length;
    const maxR = (p: string, d: number) => Math.max(0, ...ac(p, d).map((s:CFSubmission) => s.problem.rating || 0));
    const pts = (p: string, d: number) => ac(p, d).reduce((sum, s) => sum + (CF_SCORE_MAP[Math.min(2400, Math.floor((s.problem.rating||800)/100)*100)] || 10), 0);
    const activeDays = (p: string, d: number) => new Set(ac(p, d).map((s:CFSubmission) => new Date(s.creationTimeSeconds*1000).toDateString())).size;
    const acc = (p: string, d: number) => { let a = subs(p, d); let oks = ac(p, d); return a.length > 0 ? oks.length / a.length : 0; };

    let badges: BadgeDef[] = [
      { id: 'd_hero', icon: '🔥', name: 'Daily Hero', desc: 'Highest Score (24h)', owner: findWinner(p => pts(p, 1), 0) },
      { id: 'd_berserker', icon: '🩸', name: 'Bloodlust', desc: 'Most ACs today', owner: findWinner(p => ac(p, 1).length, 2) },
      { id: 'd_titan', icon: '🗡️', name: 'Daily Slayer', desc: 'Max Rating AC (24h)', owner: findWinner(p => maxR(p, 1), 800) },
      { id: 'd_owl', icon: '🦉', name: 'Midnight Oil', desc: 'Most ACs 12AM-5AM (24h)', owner: findWinner(p => ac(p, 1).filter((s:any) => { let h=new Date(s.creationTimeSeconds*1000).getHours(); return h>=0 && h<=5; }).length, 1) },
      { id: 'w_vanguard', icon: '⚡', name: 'Vanguard', desc: 'Highest Score (7D)', owner: findWinner(p => pts(p, 7), 50) },
      { id: 'w_marathon', icon: '🏃', name: 'Weekly Marathon', desc: 'Active days (7D)', owner: findWinner(p => activeDays(p, 7), 4) },
      { id: 'w_architect', icon: '📐', name: 'Flawless', desc: 'Best Accuracy (7D, Min 5)', owner: findWinner(p => subs(p,7).length>=5 ? acc(p,7) : 0, 0) },
      { id: 'w_tilter', icon: '🤡', name: 'Tilter', desc: '[NEGATIVE] Most WAs (7D)', owner: findWinner(p => subs(p, 7).filter((s:any) => s.verdict === 'WRONG_ANSWER').length, 5), isNegative: true },
      { id: 'w_math', icon: '∑', name: 'Math Prodigy', desc: 'Most Math ACs (7D)', owner: findWinner(p => tags(p, 7, 'math') + tags(p, 7, 'number theory'), 1) },
      { id: 'w_dp', icon: '🧠', name: 'DP Crown', desc: 'Most DP ACs (7D)', owner: findWinner(p => tags(p, 7, 'dp'), 1) },
      { id: 'w_graph', icon: '🕸️', name: 'Graph Monarch', desc: 'Most Graph ACs (7D)', owner: findWinner(p => tags(p, 7, 'graphs') + tags(p, 7, 'trees'), 1) },
      { id: 'w_greedy', icon: '🤑', name: 'Greedy God', desc: 'Most Greedy ACs (7D)', owner: findWinner(p => tags(p, 7, 'greedy'), 1) },
      { id: 'w_ds', icon: '🗄️', name: 'Data Structurist', desc: 'Most DS ACs (7D)', owner: findWinner(p => tags(p, 7, 'data structures'), 1) },
      { id: 'w_geom', icon: '◬', name: 'Geometry Master', desc: 'Most Geom ACs (7D)', owner: findWinner(p => tags(p, 7, 'geometry'), 1) },
      { id: 'w_string', icon: '🔤', name: 'String Theorist', desc: 'Most String ACs (7D)', owner: findWinner(p => tags(p, 7, 'strings'), 1) },
      { id: 'w_construct', icon: '🏗️', name: 'Builder', desc: 'Most Constructive ACs (7D)', owner: findWinner(p => tags(p, 7, 'constructive algorithms'), 1) },
      { id: 'w_brute', icon: '🦍', name: 'Brute', desc: 'Most Brute Force ACs (7D)', owner: findWinner(p => tags(p, 7, 'brute force'), 1) },
      { id: 'w_sort', icon: '📶', name: 'Sorter', desc: 'Most Sorting ACs (7D)', owner: findWinner(p => tags(p, 7, 'sortings'), 1) },
      { id: 'w_bs', icon: '🔍', name: 'Searcher', desc: 'Most Binary Search ACs (7D)', owner: findWinner(p => tags(p, 7, 'binary search'), 1) },
      { id: 'w_titan', icon: '⚔️', name: 'Weekly Slayer', desc: 'Highest Rated AC (7D)', owner: findWinner(p => maxR(p, 7), 1000) },
      { id: 'w_volume', icon: '📦', name: 'Volume', desc: 'Most Total ACs (7D)', owner: findWinner(p => ac(p, 7).length, 5) },
      { id: 'w_bird', icon: '🌅', name: 'Early Bird', desc: 'Most ACs 6AM-12PM (7D)', owner: findWinner(p => ac(p, 7).filter((s:any) => { let h=new Date(s.creationTimeSeconds*1000).getHours(); return h>=6 && h<12; }).length, 1) },
      { id: 'w_vampire', icon: '🧛', name: 'Vampire', desc: 'Most ACs 12AM-6AM (7D)', owner: findWinner(p => ac(p, 7).filter((s:any) => { let h=new Date(s.creationTimeSeconds*1000).getHours(); return h>=0 && h<6; }).length, 1) },
      { id: 'w_grinder', icon: '⏳', name: 'Grinder', desc: 'Most TLEs (7D)', owner: findWinner(p => subs(p, 7).filter((s:any) => s.verdict === 'TIME_LIMIT_EXCEEDED').length, 2) },
      { id: 'w_headhunter', icon: '🦅', name: 'Headhunter', desc: 'Most Snipes (7D)', owner: findWinner(p => bMatrix[p].snipes, 0) },
      { id: 'w_necro', icon: '🧟', name: 'Necromancer', desc: 'Most Resurrected (7D)', owner: findWinner(p => bMatrix[p].resurrected, 0) },
      { id: 'w_explorer', icon: '🗺️', name: 'Explorer', desc: 'Most distinct tags (7D)', owner: findWinner(p => { let t=new Set(); ac(p,7).forEach((s:any)=>s.problem.tags?.forEach((x:string)=>t.add(x))); return t.size; }, 5) },
      { id: 'w_contest', icon: '🏆', name: 'Gladiator', desc: 'Most in-contest ACs (7D)', owner: findWinner(p => ac(p, 7).filter((s:any) => s.author?.participantType === 'CONTESTANT').length, 1) },
      { id: 'w_upsolve', icon: '🛠️', name: 'Mechanic', desc: 'Most upsolves (7D)', owner: findWinner(p => ac(p, 7).filter((s:any) => s.author?.participantType === 'PRACTICE').length, 5) },
      { id: 'w_slacker', icon: '💤', name: 'Slacker', desc: '[NEGATIVE] Zero ACs (7D)', owner: findWinner(p => ac(p, 7).length === 0 ? 1 : 0, 0), isNegative: true },
      { id: 'm_overlord', icon: '👑', name: 'Overlord', desc: 'Highest Score (30D)', owner: findWinner(p => pts(p, 30), 100) },
      { id: 'm_marathon', icon: '🏃‍♂️', name: 'Monthly Marathon', desc: 'Active days (30D)', owner: findWinner(p => activeDays(p, 30), 10) },
      { id: 'm_architect', icon: '🏛️', name: 'Architect', desc: 'Best Accuracy (30D, Min 20)', owner: findWinner(p => subs(p,30).length>=20 ? acc(p,30) : 0, 0) },
      { id: 'm_polymath', icon: '🌐', name: 'Polymath', desc: 'Distinct Tags (30D)', owner: findWinner(p => { let t=new Set(); ac(p,30).forEach((s:any)=>s.problem.tags?.forEach((x:string)=>t.add(x))); return t.size; }, 10) },
      { id: 'm_titan', icon: '🗡️', name: 'Titan Slayer', desc: 'Max Rating AC (30D)', owner: findWinner(p => maxR(p, 30), 1200) },
      { id: 'm_math', icon: '∑', name: 'Math Lord', desc: 'Most Math ACs (30D)', owner: findWinner(p => tags(p, 30, 'math') + tags(p, 30, 'number theory'), 5) },
      { id: 'm_dp', icon: '🧠', name: 'DP God', desc: 'Most DP ACs (30D)', owner: findWinner(p => tags(p, 30, 'dp'), 5) },
      { id: 'm_graph', icon: '🕸️', name: 'Graph Lord', desc: 'Most Graph ACs (30D)', owner: findWinner(p => tags(p, 30, 'graphs') + tags(p, 30, 'trees'), 5) },
      { id: 'm_ds', icon: '🗄️', name: 'DS Lord', desc: 'Most DS ACs (30D)', owner: findWinner(p => tags(p, 30, 'data structures'), 5) },
      { id: 'm_geom', icon: '◬', name: 'Geom Lord', desc: 'Most Geom ACs (30D)', owner: findWinner(p => tags(p, 30, 'geometry'), 2) },
      { id: 'm_string', icon: '🔤', name: 'String Lord', desc: 'Most String ACs (30D)', owner: findWinner(p => tags(p, 30, 'strings'), 2) },
      { id: 'm_greedy', icon: '🤑', name: 'Greedy Lord', desc: 'Most Greedy ACs (30D)', owner: findWinner(p => tags(p, 30, 'greedy'), 5) },
      { id: 'm_construct', icon: '🏗️', name: 'Construct Lord', desc: 'Most Constructive ACs (30D)', owner: findWinner(p => tags(p, 30, 'constructive algorithms'), 5) },
      { id: 'm_headhunter', icon: '🦅', name: 'Bounty Hunter', desc: 'Most Snipes (30D)', owner: findWinner(p => bMatrix[p].snipes, 0) },
      { id: 'm_necro', icon: '🧟‍♂️', name: 'High Necromancer', desc: 'Most Resurrected (30D)', owner: findWinner(p => bMatrix[p].resurrected, 0) },
      { id: 'm_untouch', icon: '🕴️', name: 'Untouchable', desc: 'Zero active bounties, 20+ ACs', owner: findWinner(p => (bMatrix[p].active.length === 0 && ac(p,30).length >= 20) ? 1 : 0, 0) },
      { id: 'm_wanted', icon: '🚨', name: 'Most Wanted', desc: '[NEGATIVE] Most active bounties', owner: findWinner(p => bMatrix[p].active.length, 2), isNegative: true },
      { id: 'm_tilter', icon: '🤡', name: 'Monthly Tilter', desc: '[NEGATIVE] Most WAs (30D)', owner: findWinner(p => subs(p, 30).filter((s:any) => s.verdict === 'WRONG_ANSWER').length, 15), isNegative: true },
      { id: 'm_volume', icon: '📈', name: 'Grind Master', desc: 'Most Total ACs (30D)', owner: findWinner(p => ac(p, 30).length, 20) },
      { id: 'h_emperor', icon: '👑', name: 'Emperor', desc: 'Highest Score (180D)', owner: findWinner(p => pts(p, 180), 500) },
      { id: 'h_marathon', icon: '🏃‍♀️', name: 'Ironman', desc: 'Active days (180D)', owner: findWinner(p => activeDays(p, 180), 30) },
      { id: 'h_architect', icon: '🏛️', name: 'Grand Architect', desc: 'Best Accuracy (180D, Min 50)', owner: findWinner(p => subs(p,180).length>=50 ? acc(p,180) : 0, 0) },
      { id: 'h_polymath', icon: '🌌', name: 'Grand Polymath', desc: 'Distinct Tags (180D)', owner: findWinner(p => { let t=new Set(); ac(p,180).forEach((s:any)=>s.problem.tags?.forEach((x:string)=>t.add(x))); return t.size; }, 20) },
      { id: 'h_titan', icon: '🗡️', name: 'God Slayer', desc: 'Max Rating AC (180D)', owner: findWinner(p => maxR(p, 180), 1500) },
      { id: 'h_math', icon: '∑', name: 'Math Sage', desc: 'Most Math ACs (180D)', owner: findWinner(p => tags(p, 180, 'math') + tags(p, 180, 'number theory'), 15) },
      { id: 'h_dp', icon: '🧠', name: 'DP Sage', desc: 'Most DP ACs (180D)', owner: findWinner(p => tags(p, 180, 'dp'), 15) },
      { id: 'h_graph', icon: '🕸️', name: 'Graph Sage', desc: 'Most Graph ACs (180D)', owner: findWinner(p => tags(p, 180, 'graphs') + tags(p, 180, 'trees'), 15) },
      { id: 'h_ds', icon: '🗄️', name: 'DS Sage', desc: 'Most DS ACs (180D)', owner: findWinner(p => tags(p, 180, 'data structures'), 15) },
      { id: 'h_geom', icon: '◬', name: 'Geom Sage', desc: 'Most Geom ACs (180D)', owner: findWinner(p => tags(p, 180, 'geometry'), 5) },
      { id: 'h_string', icon: '🔤', name: 'String Sage', desc: 'Most String ACs (180D)', owner: findWinner(p => tags(p, 180, 'strings'), 5) },
      { id: 'h_greedy', icon: '🤑', name: 'Greedy Sage', desc: 'Most Greedy ACs (180D)', owner: findWinner(p => tags(p, 180, 'greedy'), 15) },
      { id: 'h_construct', icon: '🏗️', name: 'Construct Sage', desc: 'Most Constructive ACs (180D)', owner: findWinner(p => tags(p, 180, 'constructive algorithms'), 15) },
      { id: 'h_brute', icon: '🦍', name: 'Brute Sage', desc: 'Most Brute Force ACs (180D)', owner: findWinner(p => tags(p, 180, 'brute force'), 10) },
      { id: 'h_headhunter', icon: '🦅', name: 'Apex Predator', desc: 'Most Snipes (180D)', owner: findWinner(p => bMatrix[p].snipes, 0) },
      { id: 'h_necro', icon: '🧟‍♀️', name: 'Lich King', desc: 'Most Resurrected (180D)', owner: findWinner(p => bMatrix[p].resurrected, 0) },
      { id: 'h_volume', icon: '📚', name: 'Library', desc: 'Most Total ACs (180D)', owner: findWinner(p => ac(p, 180).length, 50) },
      { id: 'h_tilter', icon: '🤡', name: 'Grand Tilter', desc: '[NEGATIVE] Most WAs (180D)', owner: findWinner(p => subs(p, 180).filter((s:any) => s.verdict === 'WRONG_ANSWER').length, 50), isNegative: true },
      { id: 'h_speed', icon: '🏎️', name: 'Speedster', desc: 'Most Sub-30m Solves (180D)', owner: findWinner(p => { let c=0; Object.entries(sMatrix[p].metrics.timeToSolveDist).forEach(([k,v])=> {if(k==='First Try (0m)'||k==='< 30m') c+=(v as number);}); return c; }, 10) },
      { id: 'a_recon', icon: '🥷', name: 'Recon Ghost', desc: 'Acquired at least 5 ACs +200 rating.', owner: reconMetrics.unique >= 5 ? config.main : null },
      { id: 'a_emperor', icon: '🏰', name: 'The Emperor', desc: 'Constructed 5+ Citadels on Map.', owner: mapMetrics.citadel >= 5 ? config.main : null },
      { id: 'a_warlord', icon: '⚔️', name: 'The Warlord', desc: 'Conquered 10+ territories on Map.', owner: mapMetrics.conquered >= 10 ? config.main : null },
      { id: 'a_tactician', icon: '♟️', name: 'Grand Tactician', desc: 'Maintained 0 Rebellions.', owner: (mapMetrics.rebellion === 0 && (mapMetrics.occupied > 0 || mapMetrics.conquered > 0)) ? config.main : null },
      { id: 'a_preserver', icon: '🏺', name: 'The Preservationist', desc: 'Zero decaying territories.', owner: (mapMetrics.decaying === 0 && mapMetrics.occupied >= 10) ? config.main : null },
      { id: 'a_pathfinder', icon: '🗺️', name: 'Pathfinder', desc: 'Scouted 10+ Incognito Nodes.', owner: mapMetrics.scouted >= 10 ? config.main : null },
      { id: 'a_pyro', icon: '🔥', name: 'The Pyromancer', desc: '[NEGATIVE] Allowed 3+ Rebellions.', owner: mapMetrics.rebellion >= 3 ? config.main : null, isNegative: true },
      { id: 'a_ruined', icon: '🏚️', name: 'Fallen Kingdom', desc: '[NEGATIVE] Allowed 5+ map ruins.', owner: mapMetrics.decaying >= 5 ? config.main : null, isNegative: true },
    ];

    return { mainMetrics, squadMatrix: sMatrix, bounties: uniqueBounties.slice(0,30), computedBadges: badges, absoluteMySolves: absSolves };
  }, [squadData, config, contextFilter, timeFilter]);

  const squadCharts = useMemo(() => {
    if (!squadMatrix[config.main]) return null;
    const players = Object.keys(squadMatrix).sort((a,b) => (squadMatrix[b].info.rating||0) - (squadMatrix[a].info.rating||0));
    const sprintData = { labels: players, datasets: [ { label: '7-Day Score', data: players.map(p => squadMatrix[p].metrics.weeklyScore), backgroundColor: 'rgba(248,81,73,0.5)', borderRadius: 2, borderWidth: 0 }, { label: '30-Day Score', data: players.map(p => squadMatrix[p].metrics.monthlyScore), backgroundColor: 'rgba(197,160,89,0.45)', borderRadius: 2, borderWidth: 0 } ] };
    let allTags: Record<string, number> = {}; players.forEach(p => Object.keys(squadMatrix[p].metrics.tagsDist).forEach(t => allTags[t] = (allTags[t] || 0) + squadMatrix[p].metrics.tagsDist[t]));
    const topTags = Object.keys(allTags).sort((a,b) => allTags[b] - allTags[a]).slice(0, 15);
    const radarData = { labels: topTags, datasets: players.map((p, i) => ({ label: p, data: topTags.map(t => squadMatrix[p].metrics.tagsDist[t] || 0), borderColor: p === config.main ? '#c5a059' : SQUAD_COLORS[i % SQUAD_COLORS.length], backgroundColor: p === config.main ? 'rgba(197,160,89,0.04)' : 'transparent', borderDash: p === config.main ? [] : [5, 5], borderWidth: 1, pointRadius: 2 })) };
    let allTS = new Set<number>(); players.forEach(p => Object.values(squadMatrix[p].history).forEach((h:any) => allTS.add(h.ratingUpdateTimeSeconds)));
    const sortedTS = Array.from(allTS).sort((a,b) => a-b);
    const lineData = { labels: sortedTS.map(ts => { const d = new Date(ts*1000); return `${d.getMonth()+1}/${d.getFullYear().toString().substring(2)}`; }), datasets: players.map((p, i) => { let data: number[] = []; let lastR = squadMatrix[p].history.length ? (squadMatrix[p].history[0].oldRating || 1500) : 1500; let hMap: Record<number, number> = {}; squadMatrix[p].history.forEach((h:CFRating) => hMap[h.ratingUpdateTimeSeconds] = h.newRating); sortedTS.forEach(ts => { if(hMap[ts]) lastR = hMap[ts]; data.push(lastR); }); return { label: p, data, borderColor: p === config.main ? '#c5a059' : SQUAD_COLORS[i % SQUAD_COLORS.length], backgroundColor: 'transparent', borderWidth: 1, pointRadius: 0, tension: 0.2 } }) };
    return { sprintData, radarData, lineData, players };
  }, [squadMatrix, config.main]);

  const guillotineStatus = useMemo(() => {
    if (!mainMetrics || mainMetrics.rawSubsList.length === 0) return { hoursInactive: 0, bleed: 0, isDecay: false, isWarning: false };
    const okSubs = mainMetrics.rawSubsList.filter(s => s.verdict === 'OK');
    const lastAC = okSubs.length > 0 ? okSubs[0].creationTimeSeconds : 0;
    const hoursInactive = lastAC > 0 ? (Date.now() / 1000 - lastAC) / 3600 : 0;
    const isDecay = hoursInactive > 48;
    const isWarning = hoursInactive > 24 && hoursInactive <= 48;
    const bleed = isDecay ? Math.floor((hoursInactive - 48) / 24) * 10 + 10 : 0;
    return { hoursInactive: Math.floor(hoursInactive), bleed, isDecay, isWarning };
  }, [mainMetrics]);

  const timeStr = new Date().toTimeString().slice(0, 8);

  return (
    <div className="min-h-screen bg-[#000000] text-[#d1d5db] selection:bg-[#c5a059]/30 font-mono">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSave={(newCfg) => { setConfig(newCfg); setHandle(newCfg.main); setShowSettings(false); fetchGlobalTelemetry(newCfg.main, newCfg.squad, newCfg.titan); }} />}

      <style>{`
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.6} 94%{opacity:1} }
        * { box-sizing: border-box; }
      `}</style>

      {/* Header — flat black, no blur */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#000000] px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between py-4">

            {/* Brand */}
            <div className="flex items-center gap-5">
              <div className="w-1 h-6 bg-[#c5a059]/60" />
              <div>
                <div className="font-mono text-sm tracking-[4px] text-[#c5a059]/80 uppercase animate-[flicker_5s_infinite]">
                  CF Synthesis Engine
                </div>
                <div className="font-mono text-[9px] tracking-[2px] text-white/15 uppercase">
                  Tactical Intelligence Platform v4.2.1
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-5">
              {/* Context Filters */}
              <div className="flex border border-white/[0.06] overflow-hidden">
                {['ALL', 'CONTEST', 'PRACTICE', 'RECON'].map(ctx => (
                  <button
                    key={ctx}
                    onClick={() => setContextFilter(ctx)}
                    className={`px-3 py-1.5 border-r border-white/[0.05] last:border-0 font-mono text-[9px] tracking-[2px] uppercase transition-all duration-200 cursor-pointer ${contextFilter === ctx ? 'bg-[#c5a059]/10 text-[#c5a059]/80' : 'bg-transparent text-white/20 hover:text-white/40'}`}
                  >
                    {ctx}
                  </button>
                ))}
              </div>

              {/* Time Filters */}
              <div className="flex border border-white/[0.06] overflow-hidden">
                {['ALL', '30', '7'].map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeFilter(tf)}
                    className={`px-3 py-1.5 border-r border-white/[0.05] last:border-0 font-mono text-[9px] tracking-[2px] uppercase transition-all duration-200 cursor-pointer ${timeFilter === tf ? 'bg-white/[0.06] text-white/70' : 'bg-transparent text-white/20 hover:text-white/40'}`}
                  >
                    {tf === 'ALL' ? 'All Time' : tf + 'D'}
                  </button>
                ))}
              </div>

              {/* User info */}
              <div className="text-right">
                <div className="font-mono text-sm text-[#c5a059]/80 tracking-wide">{handle || "Offline"}</div>
                {mainMetrics && <div className="font-mono text-[9px] tracking-[2px] uppercase text-white/25">{squadData[config.main]?.info.rank || "Unrated"} · {squadData[config.main]?.info.rating || 0}</div>}
              </div>

              <img
                src={squadData[config.main]?.info.titlePhoto || "/api/placeholder/40/40"}
                alt="Avatar"
                className="w-9 h-9 object-cover border border-white/[0.08]"
              />

              <div className="text-right font-mono hidden md:block">
                <div className="text-xs text-white/40 tracking-wider">{timeStr}</div>
                <div className="text-[8px] tracking-[2px] uppercase text-white/15">UTC</div>
              </div>

              <button
                onClick={() => setShowSettings(true)}
                className="bg-transparent border border-white/[0.07] text-white/25 px-3 py-2 font-mono text-xs cursor-pointer transition-all duration-200 hover:border-[#c5a059]/40 hover:text-[#c5a059]/60"
              >
                ⚙
              </button>
            </div>
          </div>

          {/* Tabs — minimalist text toggles, 1px bottom accent only */}
          <div className="flex gap-0 overflow-x-auto border-b border-white/[0.04] -mb-px">
            {TABS.map(tab => {
              const isActive = activeTab === tab;
              const tabColor = TAB_COLORS[tab] || "rgba(255,255,255,0.3)";
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative font-mono text-[9px] tracking-[3px] uppercase px-5 py-3 cursor-pointer transition-all duration-200 bg-transparent border-none whitespace-nowrap"
                  style={{
                    color: isActive ? tabColor : 'rgba(255,255,255,0.2)',
                    borderBottom: `1px solid ${isActive ? tabColor : 'transparent'}`,
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 pt-8 pb-20 relative z-10 min-h-[70vh]">

        {/* Breadcrumb / status bar */}
        <div className="flex items-center gap-3 mb-8 font-mono text-[9px] text-white/15 flex-wrap">
          <GlowPulse color="#c5a059" />
          <span className="tracking-[2px] uppercase">Module</span>
          <span className="text-[#c5a059]/50 tracking-[2px] uppercase">{activeTab}</span>
          <span className="text-white/[0.06]">|</span>
          <span className="tracking-[2px] uppercase">Operator</span>
          <span className="text-white/30">{handle || "N/A"}</span>
          <span className="text-white/[0.06]">|</span>
          <span className="tracking-[2px] uppercase">Uptime</span>
          <span className="text-white/25">{tick}s</span>
          <div className="flex-1" />
          <span className="text-white/[0.08] tracking-[2px]">sys.integrity</span>
          <span className="text-white/15">■■■■■■■■■■ 100%</span>
        </div>

        {loading && (
          <div className="text-center my-20 font-mono text-[10px] tracking-[5px] uppercase text-[#c5a059]/50 animate-pulse">
            {loadingMsg}
          </div>
        )}

        {!loading && mainMetrics && squadData[config.main] && (
          <>
            {/* The Guillotine */}
            {activeTab === "COMMAND" && (guillotineStatus.isDecay || guillotineStatus.isWarning) && (
              <div className={`mb-8 p-6 flex justify-between items-center border-l ${guillotineStatus.isDecay ? 'bg-[rgba(248,81,73,0.02)] border-l-[#f85149]/60 border border-[#f85149]/10 animate-[blink_2s_step-start_infinite]' : 'bg-transparent border-l-[#c5a059]/40 border border-white/[0.05]'}`}>
                <div>
                  <h2 className={`font-mono text-xs tracking-[4px] uppercase m-0 ${guillotineStatus.isDecay ? 'text-[#f85149]/70' : 'text-[#c5a059]/70'}`}>
                    {guillotineStatus.isDecay ? 'Critical Decay Detected' : 'Rust Forming'}
                  </h2>
                  <p className="font-mono text-[9px] tracking-[2px] uppercase text-white/20 mt-1 mb-0">
                    Inactive for {guillotineStatus.hoursInactive} hours.
                  </p>
                </div>
                {guillotineStatus.isDecay && (
                  <div className="text-right">
                    <div className="font-mono text-2xl font-light text-[#f85149]/70">-{guillotineStatus.bleed}</div>
                    <div className="font-mono text-[8px] tracking-[3px] uppercase text-[#f85149]/40">Simulated Elo Bleed</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "COMMAND" && <CommandTab metrics={mainMetrics} info={squadData[config.main].info} filter={contextFilter} config={config} squadData={squadData} />}
            {activeTab === "WAR MAP" && <WarMap subs={mainMetrics.rawSubsList} />}
            {activeTab === "ARMORY" && <div className="animate-in fade-in"><Armory badges={computedBadges} mainHandle={config.main} variant="full" /></div>}
            {activeTab === "SQUAD OPS" && <SquadOpsTab squadMatrix={squadMatrix} config={config} squadCharts={squadCharts} bounties={bounties} />}
            {activeTab === "NEMESIS" && (
              <div className="animate-in fade-in">
                <div className="mb-8 flex gap-3 items-center">
                  <span className="font-mono text-[9px] tracking-[3px] uppercase text-white/20">Select Target</span>
                  {config.squad.map(h => (
                    <button
                      key={h}
                      onClick={() => setNemesisTarget(h)}
                      className={`px-4 py-2 font-mono text-[9px] tracking-[2px] uppercase transition-all duration-200 cursor-pointer border bg-transparent ${nemesisTarget === h ? 'border-[#f85149]/50 text-[#f85149]/70' : 'border-white/[0.07] text-white/20 hover:border-white/20 hover:text-white/40'}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                {nemesisTarget && squadData[nemesisTarget]
                  ? <Nemesis mySubs={squadData[config.main].rawSubs} targetSubs={squadData[nemesisTarget].rawSubs} targetHandle={nemesisTarget} myRating={squadData[config.main].info.rating || 1200} />
                  : <div className="text-center py-20 font-mono text-[9px] tracking-[4px] uppercase text-white/15">Select a valid squad target to initiate Nemesis protocol.</div>
                }
              </div>
            )}
            {activeTab === "FORGE" && <Forge rawSubsList={mainMetrics.rawSubsList} />}
            {activeTab === "GRIND" && <GrindMode handle={config.main} />}
            {activeTab === "TITAN" && <TitanTab squadData={squadData} config={config} />}
          </>
        )}
      </main>

      {/* Status bar */}
      <div className="fixed bottom-0 left-0 right-0 h-7 hidden md:flex items-center px-8 gap-8 z-50 bg-[#000000] border-t border-white/[0.04]">
        {[["CF API", "#c5a059"], ["Squad Sync", "#c5a059"], ["Nemesis Engine", "rgba(255,255,255,0.3)"], ["Forge Module", "rgba(255,255,255,0.25)"]].map(([l, col]) => (
          <StatusLabel key={l} label={l as string} color={col as string} />
        ))}
        <div className="flex-1" />
        <div className="font-mono text-[8px] tracking-[3px] text-white/[0.08] uppercase">
          CF Synthesis Engine · Tactical Edge
        </div>
      </div>
    </div>
  );
}
