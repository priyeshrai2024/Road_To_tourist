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
const SQUAD_COLORS = ['#58a6ff', '#d2a8ff', '#56d364', '#f85149'];
const TABS = ["COMMAND", "WAR MAP", "ARMORY", "SQUAD OPS", "NEMESIS", "FORGE", "GRIND", "TITAN"];
const TAB_COLORS: Record<string, string> = { COMMAND: "#f0a500", "WAR MAP": "#56d364", ARMORY: "#e879f9", "SQUAD OPS": "#58a6ff", NEMESIS: "#f85149", FORGE: "#db6d28", GRIND: "#f85149", TITAN: "#f85149" };

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
function GlowPulse({ color = "#f0a500" }) {
  return <span className="inline-block w-2 h-2 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" style={{ background: color, boxShadow: `0 0 6px ${color}, 0 0 12px ${color}` }} />;
}

function TopLine({ color }: { color: string }) {
  return <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
}

function StatusLabel({ label, color, icon }: { label: string, color: string, icon?: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-widest" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {icon && <span>{icon}</span>}
      {label}
    </div>
  );
}

function StatCard({ label, value, sub, color = "#f0a500", icon }: any) {
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

// ─── TAB COMPONENTS ─────────────────────────────────────────────────────────
function CommandTab({ metrics, info, filter, config, squadData }: any) {
  let timeAvgData: Record<string, number> = {}; let memAvgData: Record<string, number> = {};
  if (metrics) Object.keys(metrics.tagResourceStress).forEach(t => { timeAvgData[t] = metrics.tagResourceStress[t].timeAvg; memAvgData[t] = metrics.tagResourceStress[t].memAvg; });
  let sortedWeaknesses = metrics ? Object.keys(metrics.weaknessRatios).sort((a,b) => metrics.weaknessRatios[b] - metrics.weaknessRatios[a]) : [];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-400">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        <StatCard label={`${filter==='ALL'?'Lifetime':'Context'} XP`} value={metrics.score.toLocaleString()} color="#f0a500" icon="⚡" />
        <StatCard label="Unique AC" value={metrics.unique.toLocaleString()} color="#58a6ff" icon="🎯" />
        <StatCard label="First-Try Acc" value={`${metrics.acc}%`} color="#d2a8ff" icon="🔬" />
        <StatCard label="Upsolve Rate" value={`${metrics.upsolveRate}%`} color="#db6d28" icon="🔁" />
      </div>

      <div className="rounded-2xl p-6" style={{ background: "rgba(227,179,65,0.05)", border: "1px solid #30363d", borderLeft: "4px solid #e3b341", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div className="font-mono text-[0.65rem] text-[#e3b341] uppercase tracking-[3px] mb-3">👁️ THE ORACLE [TACTICAL DIRECTIVES]</div>
        <div className="font-mono text-[0.95rem] leading-[1.6]">
          {sortedWeaknesses.length > 0 ? (
            <>
              <div className="mb-2"><span className="text-[#f85149] font-bold">[!] CRITICAL VULNERABILITY:</span> Failure rate in <strong className="text-white">{sortedWeaknesses[0]}</strong> is highly inefficient. Upsolve {Math.floor((info.rating || 1200)/100)*100} - {Math.floor((info.rating || 1200)/100)*100 + 200} rated problems.</div>
              {sortedWeaknesses.length > 1 && <div><span className="text-[#e3b341] font-bold">[*] SECONDARY TARGET:</span> <strong className="text-white">{sortedWeaknesses[1]}</strong>. Run drills in this sector.</div>}
            </>
          ) : "Awaiting analysis..."}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#58a6ff] uppercase tracking-[2px] mb-4">📡 RATING TRAJECTORY (MOMENTUM)</div>
          <div className="h-[300px] relative"><RatingLineChart history={squadData[config.main].history} /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#56d364] uppercase tracking-[2px] mb-4">🔥 ACTIVITY HEATMAP</div>
          <div className="h-[300px] flex items-center justify-center overflow-x-auto"><ActivityHeatmap subs={metrics.rawSubsList} /></div>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
        <div className="font-mono text-[0.65rem] text-[#f85149] uppercase tracking-[2px] mb-4">🩸 ALGORITHMIC WEAKNESS MATRIX (FAILS / AC RATIO)</div>
        <div className="h-[400px] relative"><TacticalBarChart data={metrics.weaknessRatios} color="#f85149" horizontal={true} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#e879f9] uppercase tracking-[2px] mb-4">⏳ TIME EXECUTION STRESS (AVG MS)</div>
          <div className="h-[300px] relative"><StressBarChart data={timeAvgData} type="time" /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#d2a8ff] uppercase tracking-[2px] mb-4">💾 MEMORY FOOTPRINT STRESS (AVG MB)</div>
          <div className="h-[300px] relative"><StressBarChart data={memAvgData} type="memory" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#f0a500] uppercase tracking-[2px] mb-4">⚡ RESOURCE DISTRIBUTION</div>
          <div className="h-[300px] relative"><ResourceScatterChart subs={metrics.rawSubsList} /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#58a6ff] uppercase tracking-[2px] mb-4">⏰ CHRONOTYPE ANALYSIS</div>
          <div className="h-[300px] relative"><ChronotypeChart subs={metrics.rawSubsList} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#56d364] uppercase tracking-[2px] mb-4">🕸 ALGORITHMIC MASTERY</div>
          <div className="h-[300px] relative"><TagsRadarChart data={metrics.tagsDist} handle={info.handle} /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#db6d28] uppercase tracking-[2px] mb-4">⏱ TIME-TO-SOLVE (DEBUG SPEED)</div>
          <div className="h-[300px] relative"><TimeToSolveChart data={metrics.timeToSolveDist} /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#58a6ff] uppercase tracking-[2px] mb-4">📊 PROBLEM RATING DISTRIBUTION</div>
          <div className="h-[300px] relative"><TacticalBarChart data={metrics.ratingsDist} color="#58a6ff" /></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
          <div className="font-mono text-[0.65rem] text-[#8b949e] uppercase tracking-[2px] mb-4">🚫 SUBMISSION VERDICTS</div>
          <div className="h-[300px] relative"><VerdictChart data={metrics.verdictsDist} /></div>
        </div>
      </div>
    </div>
  );
}

function SquadOpsTab({ squadMatrix, config, squadCharts, bounties }: any) {
  const allPlayers = [config.main, ...config.squad].filter(h => squadMatrix[h]).sort((a,b) => (squadMatrix[b].info.rating || 0) - (squadMatrix[a].info.rating || 0));
  
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-400">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {allPlayers.map((handle, i) => {
          const p = squadMatrix[handle];
          const color = handle === config.main ? '#f0a500' : SQUAD_COLORS[i % SQUAD_COLORS.length];
          return (
            <div key={handle} className="relative overflow-hidden rounded-2xl p-6" style={{ background: `radial-gradient(ellipse at top left, ${color}08 0%, #050505 70%)`, border: `1px solid ${color}33`, boxShadow: `0 0 24px ${color}0a` }}>
              <TopLine color={color} />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                  {i === 0 ? "👑" : i === 1 ? "⚔️" : "🛡️"}
                </div>
                <div>
                  <div className="font-mono font-bold text-base" style={{ color: color }}>{handle} {handle === config.main && <span className="text-[10px] text-[#444] tracking-widest">[YOU]</span>}</div>
                  <div className="font-mono text-[0.6rem] uppercase tracking-wider" style={{ color: "#555" }}>{p.info.rank || 'Unrated'}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[["Rating", p.info.rating || 0, color],["Unique AC", p.metrics.unique, "#ddd"],["Accuracy", p.metrics.acc + "%", "#ddd"]].map(([l, v, c]) => (
                  <div key={l as string} className="text-center">
                    <div className="font-mono text-base font-black" style={{ color: c as string }}>{v}</div>
                    <div className="font-mono text-[0.55rem] uppercase tracking-wider mt-0.5" style={{ color: "#444" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl p-6" style={{ background: "#050505", border: "1px solid #1a1a1a", borderLeft: "4px solid #f85149" }}>
        <div className="font-mono text-[0.65rem] uppercase tracking-[3px] mb-4 text-[#f85149]">🪦 THE GRAVEYARD [ACTIVE BOUNTIES]</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {bounties.map((b: any) => (
            <div key={b.pid} className={`bg-[rgba(0,0,0,0.3)] border border-[#1a1a1a] rounded-[8px] p-[15px] flex flex-col gap-[10px] border-l-[3px] ${b.isOwn ? 'border-l-[#f85149]' : 'border-l-[#e3b341]'}`}>
              <div className="flex justify-between items-start"><span className="text-[#58a6ff] font-bold text-[1rem] leading-[1.2] pr-[10px]">{b.name}</span><span className="text-[#e3b341] font-mono text-[0.7rem] font-bold bg-[rgba(227,179,65,0.1)] px-[6px] py-[2px] rounded-[4px]">{b.pts} PTS</span></div>
              <p className="text-[0.75rem] text-[#8b949e] m-0 font-mono">Failed {b.fails}x by <span className="text-[#f85149] font-bold">{b.victim}</span></p>
              <a href={`https://codeforces.com/contest/${b.prob.contestId}/problem/${b.prob.index}`} target="_blank" className={`mt-auto text-center font-mono text-[0.7rem] font-bold p-[8px] border rounded-[6px] transition-colors no-underline ${b.btnClass}`}>{b.status}</a>
            </div>
          ))}
          {bounties.length === 0 && <div className="col-span-4 text-[#8b949e] font-mono italic">No active bounties. The squad is clean.</div>}
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
        <div className="font-mono text-[0.65rem] uppercase tracking-[3px] mb-4" style={{ color: "#888" }}>⚔️ THE CRUCIBLE — 1v1 COMBINATORIAL DUELS</div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {allPlayers.map((a, i) => allPlayers.slice(i+1).map(b => {
            const pa = squadMatrix[a]; const pb = squadMatrix[b];
            const ca = a === config.main ? '#f0a500' : '#58a6ff'; const cb = b === config.main ? '#f0a500' : '#58a6ff';
            return (
              <div key={`${a}-${b}`} className="rounded-xl p-5" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
                <div className="flex justify-between mb-3 font-mono">
                  <span className="font-bold" style={{ color: ca }}>{a}</span><span className="text-[0.7rem]" style={{ color: "#333" }}>VS</span><span className="font-bold" style={{ color: cb }}>{b}</span>
                </div>
                {[["Rating", pa.info.rating||0, pb.info.rating||0],["Unique AC", pa.metrics.unique, pb.metrics.unique],["Accuracy", pa.metrics.acc, pb.metrics.acc]].map(([l, v1, v2]) => (
                  <div key={l as string} className="flex justify-between font-mono text-[0.75rem] mb-1.5">
                    <span style={{ color: (v1 as number) >= (v2 as number) ? "#56d364" : "#f85149", fontWeight: (v1 as number) >= (v2 as number) ? 700 : 400 }}>{v1}</span>
                    <span className="uppercase text-[0.6rem]" style={{ color: "#444" }}>{l}</span>
                    <span style={{ color: (v2 as number) >= (v1 as number) ? "#56d364" : "#f85149", fontWeight: (v2 as number) >= (v1 as number) ? 700 : 400 }}>{v2}</span>
                  </div>
                ))}
              </div>
            );
          }))}
        </div>
      </div>

      {squadCharts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}><div className="font-mono text-[0.65rem] text-[#58a6ff] uppercase tracking-[2px] mb-4">RATING WARFARE</div><div className="h-[300px]"><Line data={squadCharts.lineData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#1a1a1a' }, ticks: {font: {family: 'monospace'}}} }, plugins: { legend: { labels: { color: '#e0e6ed', font: { family: 'monospace' } } } } }} /></div></div>
          <div className="rounded-2xl p-5" style={{ background: "#050505", border: "1px solid #1a1a1a" }}><div className="font-mono text-[0.65rem] text-[#f0a500] uppercase tracking-[2px] mb-4">TACTICAL SPRINTS</div><div className="h-[300px]"><Bar data={squadCharts.sprintData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: {font: {family: 'monospace'}} }, y: { grid: { color: '#1a1a1a' } } }, plugins: { legend: { labels: { color: '#e0e6ed', font: { family: 'monospace' } } } } }} /></div></div>
          <div className="rounded-2xl p-5 md:col-span-2" style={{ background: "#050505", border: "1px solid #1a1a1a" }}><div className="font-mono text-[0.65rem] text-[#e879f9] uppercase tracking-[2px] mb-4">THE TRIAD (COMBINED RADAR)</div><div className="h-[400px]"><Radar data={squadCharts.radarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: '#1a1a1a' }, grid: { color: '#1a1a1a' }, ticks: { display: false }, pointLabels: { color: '#8b949e', font: {family: 'monospace'} } } }, plugins: { legend: { position: 'top', labels: { color: '#e0e6ed', font: { family: 'monospace' } } } } }} /></div></div>
        </div>
      )}
    </div>
  );
}

function TitanTab({ squadData, config }: any) {
  if (!squadData[config.titan]) return <div className="text-center py-20 text-[#8b949e] font-mono animate-in fade-in">NO TITAN CONFIGURED. Access settings to lock target.</div>;
  const tData = squadData[config.titan].info;
  const myRating = squadData[config.main].info.rating || 0;
  const tRating = tData.rating || 0;
  const gap = tRating - myRating;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-400">
      <div className="relative overflow-hidden rounded-[20px] p-8" style={{ background: "radial-gradient(ellipse at top, #1a0000 0%, #050505 70%)", border: "1px solid #f8514944", boxShadow: "0 0 40px #f8514915" }}>
        <TopLine color="#f85149" />
        <div className="absolute bottom-0 right-0 text-[8rem] opacity-[0.03] leading-none">💀</div>
        <div className="flex items-center gap-8">
          <img src={tData.titlePhoto} alt="Titan" className="w-20 h-20 rounded-2xl border-2 object-cover" style={{ borderColor: "#f8514966" }} />
          <div>
            <div className="font-mono text-[1.8rem] font-black tracking-tight text-[#f85149]">{tData.handle}</div>
            <div className="font-mono text-[0.6rem] uppercase tracking-[3px]" style={{ color: "#666" }}>DESIGNATED TITAN — ASSASSINATION TARGET</div>
            <div className="font-mono text-[1.4rem] font-bold text-[#f0a500] mt-1">
              {tRating} <span className="text-[0.7rem]" style={{ color: "#666" }}>CURRENT RATING</span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl p-6" style={{ background: "#050505", borderLeft: "4px solid #f85149", border: "1px solid #f8514922" }}>
        <div className="font-mono text-[0.65rem] text-[#f85149] uppercase tracking-[3px] mb-4">📋 ASSASSINATION PROTOCOL</div>
        <div className="font-mono text-base leading-relaxed" style={{ color: "#e0e6ed" }}>
          {gap <= 0 ? (
            <>Target neutralized. You surpassed <span className="text-[#f0a500] font-bold">{config.titan}</span> by {Math.abs(gap)} points. Find a new Titan.</>
          ) : (
            <>
              Titan <span className="text-[#f0a500] font-bold">{config.titan}</span> is <span className="text-[#f85149] font-black text-xl">{gap}</span> points ahead.<br />
              Target protocol: Sustain First-Try ACs on <span className="text-[#f0a500] font-bold">{Math.floor((tRating || 1500)/100)*100}+</span> rated problems.<br />
              Estimated intercept: <span className="text-[#56d364]">~{Math.ceil(gap/15)} contest cycles</span> at current velocity.
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
    setLoading(true); setLoadingMsg(`ESTABLISHING SECURE UPLINK...`);
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
        setLoadingMsg(`SYNCING OPERATIVE: ${h.toUpperCase()}...`);
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
        let btnClass = isOwn ? 'bg-[rgba(248,81,73,0.1)] border-[#f85149] text-[#f85149]' : (isSniped ? 'bg-[rgba(46,160,67,0.1)] border-[#2ea043] text-[#2ea043] pointer-events-none' : 'bg-[rgba(227,179,65,0.1)] border-[#e3b341] text-[#e3b341] hover:bg-[#e3b341] hover:text-black');
        let status = isOwn ? '🛠️ UPSOLVE REQUIRED' : (isSniped ? '🎯 ALREADY SNIPED' : '🔫 INITIATE SNIPE');
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
    const sprintData = { labels: players, datasets: [ { label: '7-Day Score', data: players.map(p => squadMatrix[p].metrics.weeklyScore), backgroundColor: '#f85149', borderRadius: 4 }, { label: '30-Day Score', data: players.map(p => squadMatrix[p].metrics.monthlyScore), backgroundColor: '#d2a8ff', borderRadius: 4 } ] };
    let allTags: Record<string, number> = {}; players.forEach(p => Object.keys(squadMatrix[p].metrics.tagsDist).forEach(t => allTags[t] = (allTags[t] || 0) + squadMatrix[p].metrics.tagsDist[t]));
    const topTags = Object.keys(allTags).sort((a,b) => allTags[b] - allTags[a]).slice(0, 15);
    const radarData = { labels: topTags, datasets: players.map((p, i) => ({ label: p, data: topTags.map(t => squadMatrix[p].metrics.tagsDist[t] || 0), borderColor: p === config.main ? '#e3b341' : SQUAD_COLORS[i % SQUAD_COLORS.length], backgroundColor: p === config.main ? 'rgba(227, 179, 65, 0.2)' : 'transparent', borderDash: p === config.main ? [] : [5, 5], borderWidth: 2 })) };
    let allTS = new Set<number>(); players.forEach(p => Object.values(squadMatrix[p].history).forEach((h:any) => allTS.add(h.ratingUpdateTimeSeconds)));
    const sortedTS = Array.from(allTS).sort((a,b) => a-b);
    const lineData = { labels: sortedTS.map(ts => { const d = new Date(ts*1000); return `${d.getMonth()+1}/${d.getFullYear().toString().substring(2)}`; }), datasets: players.map((p, i) => { let data: number[] = []; let lastR = squadMatrix[p].history.length ? (squadMatrix[p].history[0].oldRating || 1500) : 1500; let hMap: Record<number, number> = {}; squadMatrix[p].history.forEach((h:CFRating) => hMap[h.ratingUpdateTimeSeconds] = h.newRating); sortedTS.forEach(ts => { if(hMap[ts]) lastR = hMap[ts]; data.push(lastR); }); return { label: p, data, borderColor: p === config.main ? '#e3b341' : SQUAD_COLORS[i % SQUAD_COLORS.length], backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: 0.2 } }) };
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
    <div className="min-h-screen bg-[#030305] text-[#e0e6ed] selection:bg-[#f0a500] font-sans">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSave={(newCfg) => { setConfig(newCfg); setHandle(newCfg.main); setShowSettings(false); fetchGlobalTelemetry(newCfg.main, newCfg.squad, newCfg.titan); }} />}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.8} 94%{opacity:1} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{width:4px;background:#050505} ::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
      `}</style>

      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)" }} />

      <header className="sticky top-0 z-50 border-b border-[#1a1a2a] px-8" style={{ background: "rgba(3,3,5,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: "linear-gradient(135deg,#f0a500,#f85149)", boxShadow: "0 0 16px #f0a50044" }}>⚡</div>
              <div>
                <div className="font-mono font-black text-base tracking-[3px] text-[#f0a500] uppercase animate-[flicker_4s_infinite]">CODEFORCES SYNTHESIS ENGINE</div>
                <div className="font-mono text-[0.55rem] tracking-[2px] text-[#444]">TACTICAL COMPETITIVE INTELLIGENCE PLATFORM v4.2.1</div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Context Filters */}
              <div className="flex bg-[#050505] rounded-[6px] border border-[#1a1a1a] overflow-hidden">
                {['ALL', 'CONTEST', 'PRACTICE', 'RECON'].map(ctx => (
                  <button key={ctx} onClick={() => setContextFilter(ctx)} className={`px-3 py-1 border-r border-[#1a1a1a] last:border-0 font-mono text-[0.65rem] transition-colors cursor-pointer ${contextFilter === ctx ? 'bg-[#f0a500] text-black font-bold' : 'bg-transparent text-[#888] hover:bg-white/5'}`}>{ctx}</button>
                ))}
              </div>
              
              {/* Time Filters */}
              <div className="flex bg-[#050505] rounded-[6px] border border-[#1a1a1a] overflow-hidden mr-4">
                {['ALL', '30', '7'].map(tf => (
                  <button key={tf} onClick={() => setTimeFilter(tf)} className={`px-3 py-1 border-r border-[#1a1a1a] last:border-0 font-mono text-[0.65rem] transition-colors cursor-pointer ${timeFilter === tf ? 'bg-[#58a6ff] text-black font-bold' : 'bg-transparent text-[#888] hover:bg-white/5'}`}>{tf === 'ALL' ? 'ALL TIME' : tf + ' DAYS'}</button>
                ))}
              </div>
              
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-[#f0a500] tracking-wider">{handle || "OFFLINE"}</div>
                {mainMetrics && <div className="font-mono text-[0.6rem] tracking-wider text-[#56d364]">{squadData[config.main]?.info.rank || "Unrated"} · {squadData[config.main]?.info.rating || 0}</div>}
              </div>
              <img src={squadData[config.main]?.info.titlePhoto || "/api/placeholder/44/44"} alt="Avatar" className="w-11 h-11 rounded-xl object-cover" style={{ border: "1px solid #f0a50033" }} />
              <div className="text-right font-mono hidden md:block">
                <div className="text-[0.85rem] text-[#58a6ff] tracking-wider">{timeStr}</div>
                <div className="text-[0.55rem] tracking-wider text-[#333]">UTC SYSTEM CLOCK</div>
              </div>
              <button onClick={() => setShowSettings(true)} className="bg-[#050505] border border-[#1a1a1a] text-[#888] px-3 py-2 rounded-lg cursor-pointer transition-colors hover:text-[#f0a500] hover:border-[#f0a500]">⚙️</button>
            </div>
          </div>

          <div className="flex gap-0.5 overflow-x-auto pb-0">
            {TABS.map(tab => {
              const isActive = activeTab === tab; const tabColor = TAB_COLORS[tab] || "#888";
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} className="relative font-mono text-[0.62rem] font-bold tracking-[2px] uppercase px-4 py-2.5 cursor-pointer transition-all duration-150 rounded-t-md border-0 whitespace-nowrap"
                  style={{ background: isActive ? `${tabColor}12` : "transparent", color: isActive ? tabColor : "#444", borderBottom: `2px solid ${isActive ? tabColor : "transparent"}`, borderTop: `1px solid ${isActive ? tabColor + "44" : "transparent"}`, borderLeft: `1px solid ${isActive ? tabColor + "22" : "transparent"}`, borderRight: `1px solid ${isActive ? tabColor + "22" : "transparent"}`, boxShadow: isActive ? `0 0 12px ${tabColor}22, inset 0 1px 0 ${tabColor}22` : "none" }}>
                  {isActive && <div className="absolute top-0 left-[20%] right-[20%] h-px" style={{ background: `linear-gradient(90deg, transparent, ${tabColor}, transparent)` }} />}
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 pt-6 pb-16 relative z-10 min-h-[70vh]">
        <div className="flex items-center gap-3 mb-6 font-mono text-[0.6rem] text-[#333] flex-wrap">
          <GlowPulse color="#56d364" />
          <span className="text-[#444]">MODULE:</span><span className="text-[#56d364] tracking-[2px]">{activeTab}</span><span className="text-[#1a1a1a]">|</span>
          <span className="text-[#444]">OPERATOR:</span><span className="text-[#f0a500]">{handle || "N/A"}</span><span className="text-[#1a1a1a]">|</span>
          <span className="text-[#444]">UPTIME:</span><span className="text-[#58a6ff]">{tick}s</span>
          <div className="flex-1" />
          <span className="text-[#1a1a1a]">SYS.INTEGRITY: </span><span className="text-[#56d364]">■■■■■■■■■■ 100%</span>
        </div>

        {loading && <div className="text-center my-20 font-mono text-[#f0a500] text-[1.2rem] animate-pulse">{loadingMsg}</div>}

        {!loading && mainMetrics && squadData[config.main] && (
          <>
            {/* The Guillotine */}
            {activeTab === "COMMAND" && (guillotineStatus.isDecay || guillotineStatus.isWarning) && (
              <div className={`mb-8 p-6 rounded-2xl border flex justify-between items-center ${guillotineStatus.isDecay ? 'bg-[rgba(248,81,73,0.05)] border-[#f85149] animate-[pulse_2s_ease-in-out_infinite]' : 'bg-[rgba(227,179,65,0.05)] border-[#e3b341]'}`}>
                <div>
                  <h2 className={`font-black uppercase tracking-widest m-0 font-mono ${guillotineStatus.isDecay ? 'text-[#f85149]' : 'text-[#e3b341]'}`}>{guillotineStatus.isDecay ? 'CRITICAL DECAY DETECTED' : 'RUST FORMING'}</h2>
                  <p className="text-[#888] font-mono text-xs mt-1 mb-0">Inactive for {guillotineStatus.hoursInactive} hours.</p>
                </div>
                {guillotineStatus.isDecay && <div className="text-right"><div className="text-3xl font-black text-[#f85149] font-mono">-{guillotineStatus.bleed} PTS</div><div className="text-[10px] text-[#f85149] uppercase tracking-widest font-mono">Simulated Elo Bleed</div></div>}
              </div>
            )}

            {activeTab === "COMMAND" && <CommandTab metrics={mainMetrics} info={squadData[config.main].info} filter={contextFilter} config={config} squadData={squadData} />}
            {activeTab === "WAR MAP" && <WarMap subs={mainMetrics.rawSubsList} />}
            {activeTab === "ARMORY" && <div className="animate-in fade-in"><Armory badges={computedBadges} mainHandle={config.main} variant="full" /></div>}
            {activeTab === "SQUAD OPS" && <SquadOpsTab squadMatrix={squadMatrix} config={config} squadCharts={squadCharts} bounties={bounties} />}
            {activeTab === "NEMESIS" && (
              <div className="animate-in fade-in">
                <div className="mb-6 flex gap-4 items-center">
                  <span className="text-[#888] font-mono text-xs uppercase">Select Target:</span>
                  {config.squad.map(h => (
                    <button key={h} onClick={() => setNemesisTarget(h)} className={`px-4 py-2 rounded-lg font-mono uppercase text-xs transition-colors cursor-pointer border ${nemesisTarget === h ? 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]' : 'bg-[#050505] text-[#888] border-[#1a1a1a] hover:bg-white/5'}`}>{h}</button>
                  ))}
                </div>
                {nemesisTarget && squadData[nemesisTarget] ? <Nemesis mySubs={squadData[config.main].rawSubs} targetSubs={squadData[nemesisTarget].rawSubs} targetHandle={nemesisTarget} myRating={squadData[config.main].info.rating || 1200} /> : <div className="text-center py-20 text-[#888] font-mono">Select a valid squad target to initiate Nemesis protocol.</div>}
              </div>
            )}
            {activeTab === "FORGE" && <Forge rawSubsList={mainMetrics.rawSubsList} />}
            {activeTab === "GRIND" && <GrindMode handle={config.main} />}
            {activeTab === "TITAN" && <TitanTab squadData={squadData} config={config} />}
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-7 flex items-center px-8 gap-8 z-50 hidden md:flex" style={{ background: "rgba(3,3,5,0.98)", borderTop: "1px solid #0f0f1a" }}>
        {[["CF API","#56d364"],["SQUAD SYNC","#56d364"],["NEMESIS ENGINE","#f0a500"],["FORGE MODULE","#58a6ff"]].map(([l, col]) => <StatusLabel key={l} label={l as string} color={col as string} />)}
        <div className="flex-1" />
        <div className="font-mono text-[0.55rem] text-[#1a1a2a]">{"<<<"} CODEFORCES SYNTHESIS ENGINE · TACTICAL EDGE {">>>"}</div>
      </div>
    </div>
  );
}