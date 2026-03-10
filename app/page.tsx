"use client";

import { useState, useEffect, useMemo } from "react";
import { VerdictChart, TagsRadarChart, TacticalBarChart, ResourceScatterChart, TimeToSolveChart, StressBarChart, RatingLineChart, ActivityHeatmap, ChronotypeChart } from "@/components/Charts";
import WarMap, { T_NODES } from "@/components/WarMap";
import SettingsModal from "@/components/SettingsModal";
import Armory, { BadgeDef } from "@/components/Armory";
import GrindMode from "@/components/GrindMode";
import Nemesis from "@/components/Nemesis";
import Forge from "@/components/Forge";
import CommandTab from "@/components/CommandTab";
import SquadOpsTab from "@/components/SquadOpsTab";
import TitanTab from "@/components/TitanTab";
import ContestTracker from "@/components/ContestTracker";
import { Line, Bar, Radar } from 'react-chartjs-2';
import { CF_SCORE_MAP, SQUAD_COLORS } from "@/lib/constants";
import { computeBadges } from "@/lib/badges";
import type { CFSubmission, CFInfo, CFRating, ProcessedMetrics, SquadMemberData } from "@/lib/types";

// ─── CONSTANTS & TYPES imported from @/lib/constants and @/lib/types ──────────
const TABS = ["COMMAND", "WAR MAP", "ARMORY", "SQUAD OPS", "NEMESIS", "FORGE", "GRIND", "TITAN", "CONTESTS"];
const TAB_COLORS: Record<string, string> = { COMMAND: "#f0a500", "WAR MAP": "#56d364", ARMORY: "#e879f9", "SQUAD OPS": "#58a6ff", NEMESIS: "#f85149", FORGE: "#db6d28", GRIND: "#f85149", TITAN: "#f85149", CONTESTS: "#e3b341" };

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
  const state: Record<string, any> = {};
  const nodeSolvedPids: Record<string, Set<string>> = {};
  const nodeFailedPids: Record<string, Set<string>> = {};
  const now = Date.now() / 1000;
  Object.values(T_NODES).forEach(n => {
    state[n.id] = { ac: 0, fail: 0, maxR: 0, lastAC: 0 };
    nodeSolvedPids[n.id] = new Set();
    nodeFailedPids[n.id] = new Set();
  });
  subs.forEach(s => {
    if (!s.problem || !s.problem.tags) return;
    const isAC = s.verdict === 'OK'; const r = s.problem.rating || 800;
    const pid = `${s.problem.contestId}-${s.problem.index}`;
    Object.values(T_NODES).forEach(n => {
      if (s.problem.tags!.includes(n.tag)) {
        if (isAC) {
          if (!nodeSolvedPids[n.id].has(pid)) {
            nodeSolvedPids[n.id].add(pid);
            state[n.id].ac++;
            if (r > state[n.id].maxR) state[n.id].maxR = r;
            if (s.creationTimeSeconds > state[n.id].lastAC) state[n.id].lastAC = s.creationTimeSeconds;
          }
        } else if (s.verdict !== 'COMPILATION_ERROR') {
          if (!nodeFailedPids[n.id].has(pid)) {
            nodeFailedPids[n.id].add(pid);
            state[n.id].fail++;
          }
        }
      }
    });
  });
  Object.values(T_NODES).forEach(n => {
    let m = state[n.id];
    if (m.ac === 0) metrics.scouted++;
    if (m.ac >= 25) metrics.conquered++; else if (m.ac >= 1) metrics.occupied++;
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


// ─── TAB COMPONENTS imported from @/components/CommandTab, SquadOpsTab, TitanTab ──

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
  const [config, setConfig] = useState({ main: "", squad: [] as string[], titans: [] as string[] });
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); const iv = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cf_config_v6');
    if (saved) { 
      const parsed = JSON.parse(saved); 
      setConfig(parsed); setHandle(parsed.main || "");
      if (parsed.squad && parsed.squad.length > 0) setNemesisTarget(parsed.squad[0]);
      if (parsed.main) fetchGlobalTelemetry(parsed.main, parsed.squad || []);
    } else setShowSettings(true);
  }, []);

  const fetchGlobalTelemetry = async (mainH: string, squadH: string[]) => {
    if (!mainH) return;
    setLoading(true); setLoadingMsg(`ESTABLISHING SECURE UPLINK...`);
    const newSquadData: Record<string, any> = {};
    const allHandles = [mainH, ...squadH].filter(Boolean);

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
        if (!pMap[pid]) pMap[pid] = { fails: 0, solved: false, prob: s.problem, lastAttemptTs: 0 };
        if (s.verdict === 'OK') pMap[pid].solved = true;
        else if (s.verdict !== 'COMPILATION_ERROR') {
          pMap[pid].fails++;
          if (s.creationTimeSeconds > pMap[pid].lastAttemptTs) pMap[pid].lastAttemptTs = s.creationTimeSeconds;
        }
      });
      bMatrix[p] = { active: Object.keys(pMap).filter(pid => pMap[pid].fails >= 3 && !pMap[pid].solved), resurrected: Object.keys(pMap).filter(pid => pMap[pid].fails >= 3 && pMap[pid].solved).length, solvedSet: new Set(Object.keys(pMap).filter(pid => pMap[pid].solved)) };
      // Graveyard: only problems attempted in last 30 days (last attempt within 30d), 3+ fails, unsolved
      const now30 = Date.now() / 1000;
      Object.keys(pMap).forEach(pid => {
        const pm = pMap[pid];
        const daysAgo = (now30 - pm.lastAttemptTs) / 86400;
        if (pm.fails >= 3 && !pm.solved && daysAgo <= 30) {
          const basePts = CF_SCORE_MAP[pm.prob.rating > 2400 ? 2400 : (pm.prob.rating || 800)] || 10;
          const attemptPts = Math.round(basePts * (1 + Math.min(pm.fails, 10) * 0.05));
          globalBounties.push({ victim: p, pid, prob: pm.prob, fails: pm.fails, pts: attemptPts, basePts, daysAgo: Math.floor(daysAgo), lastAttemptTs: pm.lastAttemptTs });
        }
      });
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

    const badges: BadgeDef[] = computeBadges(allPlayers, sMatrix, bMatrix, reconMetrics, mapMetrics, config.main, now);

    return { mainMetrics, squadMatrix: sMatrix, bounties: uniqueBounties.slice(0,30), computedBadges: badges, absoluteMySolves: absSolves };
  }, [squadData, config, contextFilter, timeFilter]);

  const squadCharts = useMemo(() => {
    if (!squadMatrix[config.main]) return null;

    if (!squadMatrix[config.main]) return null;
    const players = Object.keys(squadMatrix).sort((a,b) => (squadMatrix[b].info.rating||0) - (squadMatrix[a].info.rating||0));
    const sprintData = { labels: players, datasets: [ { label: '7-Day Score', data: players.map(p => squadMatrix[p].metrics.weeklyScore), backgroundColor: '#f85149', borderRadius: 4 }, { label: '30-Day Score', data: players.map(p => squadMatrix[p].metrics.monthlyScore), backgroundColor: '#d2a8ff', borderRadius: 4 } ] };
    let allTags: Record<string, number> = {}; players.forEach(p => Object.keys(squadMatrix[p].metrics.tagsDist).forEach(t => allTags[t] = (allTags[t] || 0) + squadMatrix[p].metrics.tagsDist[t]));
    const topTags = Object.keys(allTags).sort((a,b) => allTags[b] - allTags[a]).slice(0, 15);
    const radarData = { labels: topTags, datasets: players.map((p, i) => ({ label: p, data: topTags.map(t => squadMatrix[p].metrics.tagsDist[t] || 0), borderColor: p === config.main ? '#e3b341' : SQUAD_COLORS[i % SQUAD_COLORS.length], backgroundColor: p === config.main ? 'rgba(227, 179, 65, 0.2)' : 'transparent', borderDash: p === config.main ? [] : [5, 5], borderWidth: 2 })) };
    let allTS = new Set<number>(); players.forEach(p => Object.values(squadMatrix[p].history).forEach((h:any) => allTS.add(h.ratingUpdateTimeSeconds)));
    const sortedTS = Array.from(allTS).sort((a,b) => a-b);
    const lineData = { labels: sortedTS.map(ts => { const d = new Date(ts*1000); return `${d.getMonth()+1}/${d.getFullYear().toString().substring(2)}`; }), datasets: players.map((p, i) => { let data: (number|null)[] = []; let lastR: number|null = null; let hMap: Record<number, number> = {}; squadMatrix[p].history.forEach((h:CFRating) => hMap[h.ratingUpdateTimeSeconds] = h.newRating); sortedTS.forEach(ts => { if(hMap[ts]) lastR = hMap[ts]; data.push(lastR); }); return { label: p, data, borderColor: p === config.main ? '#e3b341' : SQUAD_COLORS[i % SQUAD_COLORS.length], backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: 0.2, spanGaps: false } }) };
    // Per-player computed stats for comparison charts
    const now2 = Date.now() / 1000;
    const acD = (p: string, d: number) => squadMatrix[p].metrics.rawSubsList.filter((s:CFSubmission) => s.verdict==='OK' && (now2 - s.creationTimeSeconds)/86400 <= d);
    const subsD = (p: string, d: number) => squadMatrix[p].metrics.rawSubsList.filter((s:CFSubmission) => (now2 - s.creationTimeSeconds)/86400 <= d);
    const ptsD = (p: string, d: number) => acD(p,d).reduce((sum:number, s:CFSubmission) => sum + (CF_SCORE_MAP[Math.min(2400, Math.floor((s.problem.rating||800)/100)*100)] || 10), 0);
    const accD = (p: string, d: number) => { const a = subsD(p,d); return a.length > 0 ? parseFloat(((acD(p,d).length / a.length)*100).toFixed(1)) : 0; };
    const maxRD = (p: string, d: number) => Math.max(0, ...acD(p,d).map((s:CFSubmission) => s.problem.rating || 0));
    const activeDaysD = (p: string, d: number) => new Set(acD(p,d).map((s:CFSubmission) => new Date(s.creationTimeSeconds*1000).toDateString())).size;

    const CHART_COLORS = players.map((p,i) => p === config.main ? '#e3b341' : SQUAD_COLORS[i % SQUAD_COLORS.length]);

    const mkBar = (label: string, fn: (p:string)=>number, color?: string) => ({
      labels: players,
      datasets: [{ label, data: players.map(fn), backgroundColor: color ? players.map((p,i) => p===config.main ? color : SQUAD_COLORS[i%SQUAD_COLORS.length]+'bb') : CHART_COLORS.map(c=>c+'bb'), borderColor: CHART_COLORS, borderWidth: 1, borderRadius: 4 }]
    });

    const comparisonCharts = {
      weeklyScore:   mkBar('7D Synth Score',   p => ptsD(p,7)),
      monthlyScore:  mkBar('30D Synth Score',  p => ptsD(p,30)),
      weeklyAC:      mkBar('7D ACs',           p => acD(p,7).length),
      monthlyAC:     mkBar('30D ACs',          p => acD(p,30).length),
      weeklyAccRate: mkBar('7D Accepted %',    p => accD(p,7)),
      monthlyAccRate:mkBar('30D Accepted %',   p => accD(p,30)),
      highestRated:  mkBar('Highest Rated Solved', p => maxRD(p,36500)),
      uniqueAC:      mkBar('Unique ACs (All)',  p => squadMatrix[p].metrics.unique),
      activeDays7:   mkBar('Active Days (7D)', p => activeDaysD(p,7)),
      activeDays30:  mkBar('Active Days (30D)',p => activeDaysD(p,30)),
      rating:        mkBar('Current Rating',   p => squadMatrix[p].info.rating || 0),
    };

    // Leaderboard rows
    const leaderboard = players.map(p => ({
      handle: p,
      rating: squadMatrix[p].info.rating || 0,
      rank: squadMatrix[p].info.rank || 'unrated',
      uniqueAC: squadMatrix[p].metrics.unique,
      weeklyScore: ptsD(p,7),
      monthlyScore: ptsD(p,30),
      weeklyAC: acD(p,7).length,
      monthlyAC: acD(p,30).length,
      weeklyAcc: accD(p,7),
      monthlyAcc: accD(p,30),
      highestRated: maxRD(p,36500),
      activeDays7: activeDaysD(p,7),
      activeDays30: activeDaysD(p,30),
    }));

    return { sprintData, radarData, lineData, players, comparisonCharts, leaderboard };
  }, [squadMatrix, config.main]);

  const guillotineStatus = useMemo(() => {
    if (!mainMetrics || mainMetrics.rawSubsList.length === 0) return { hoursInactive: 0, bleedHours: 0, pointsLost: 0, isRed: false, isBlue: false };
    // rawSubsList is oldest-first after processMetrics reverse(), so last element = newest submission
    const allSubs = mainMetrics.rawSubsList;
    const lastSub = allSubs[allSubs.length - 1].creationTimeSeconds;
    const hoursInactive = (Date.now() / 1000 - lastSub) / 3600;
    const isBlue = hoursInactive >= 1 && hoursInactive < 24;
    const isRed = hoursInactive >= 24;
    const bleedHours = isRed ? Math.floor(hoursInactive - 24) : 0;
    const pointsLost = bleedHours;
    return { hoursInactive: parseFloat(hoursInactive.toFixed(1)), bleedHours, pointsLost, isRed, isBlue };
  }, [mainMetrics, tick]);

  const timeStr = mounted ? new Date().toTimeString().slice(0, 8) : '--:--:--';

  return (
    <div className="min-h-screen bg-[#030305] text-[#e0e6ed] font-sans">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSave={(newCfg) => { setConfig(newCfg); setHandle(newCfg.main); setShowSettings(false); fetchGlobalTelemetry(newCfg.main, newCfg.squad); }} />}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(0.8)} }
        @keyframes flicker { 0%,89%,91%,93%,100%{opacity:1} 90%,92%{opacity:0.7} }
        @keyframes fade-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .animate-fade-up { animation: fade-up 0.3s ease forwards; }
        ::-webkit-scrollbar{width:4px;height:4px;background:transparent} ::-webkit-scrollbar-thumb{background:#1c1c2a;border-radius:3px}
      `}</style>

      {/* Scanline texture */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.02) 3px, rgba(0,0,0,0.02) 4px)" }} />
      {/* Ambient top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-px pointer-events-none z-0" style={{ background: "linear-gradient(90deg, transparent, #f0a50015, transparent)" }} />

      <header className="sticky top-0 z-50" style={{ background: "rgba(3,3,5,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid #12121e" }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          {/* Top bar */}
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Brand */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: "linear-gradient(135deg, #f0a500 0%, #f85149 100%)", boxShadow: "0 0 16px rgba(240,165,0,0.25)" }}>⚡</div>
              <div className="hidden sm:block leading-none">
                <div className="font-mono font-black text-[0.78rem] tracking-[2px] text-[#f0a500] uppercase animate-[flicker_5s_infinite]">CF SYNTHESIS ENGINE</div>
                <div className="font-mono text-[0.46rem] tracking-[2.5px] text-[#252535] uppercase mt-1">TACTICAL INTELLIGENCE PLATFORM</div>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2.5">
              {/* Context filter */}
              <div className="flex rounded overflow-hidden text-[0.58rem]" style={{ border: "1px solid #1a1a28" }}>
                {['ALL', 'CONTEST'].map(ctx => (
                  <button key={ctx} onClick={() => setContextFilter(ctx)} className="px-2.5 py-1.5 font-mono tracking-wider transition-all cursor-pointer border-r last:border-0" style={{ borderColor: "#1a1a28", background: contextFilter === ctx ? "#f0a500" : "transparent", color: contextFilter === ctx ? "#000" : "#454558", fontWeight: contextFilter === ctx ? 700 : 400 }}>{ctx}</button>
                ))}
              </div>
              {/* Time filter */}
              <div className="flex rounded overflow-hidden text-[0.58rem]" style={{ border: "1px solid #1a1a28" }}>
                {['ALL', '30', '7'].map(tf => (
                  <button key={tf} onClick={() => setTimeFilter(tf)} className="px-2.5 py-1.5 font-mono tracking-wider transition-all cursor-pointer border-r last:border-0" style={{ borderColor: "#1a1a28", background: timeFilter === tf ? "#58a6ff" : "transparent", color: timeFilter === tf ? "#000" : "#454558", fontWeight: timeFilter === tf ? 700 : 400 }}>{tf === 'ALL' ? 'ALL' : tf + 'D'}</button>
                ))}
              </div>

              <div className="w-px h-5 hidden md:block" style={{ background: "#1a1a28" }} />

              {/* User info */}
              {squadData[config.main]?.info.titlePhoto && (
                <img src={squadData[config.main].info.titlePhoto} alt="Avatar" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 hidden sm:block" style={{ border: "1px solid rgba(240,165,0,0.2)" }} />
              )}
              <div className="hidden md:block text-right leading-none">
                <div className="font-mono text-[0.8rem] font-bold text-[#f0a500]">{handle || "OFFLINE"}</div>
                {mainMetrics && <div className="font-mono text-[0.5rem] tracking-wider text-[#56d364] mt-0.5">{squadData[config.main]?.info.rank || "Unrated"} · {squadData[config.main]?.info.rating || 0}</div>}
              </div>

              {/* Clock */}
              <div className="hidden lg:block text-right leading-none">
                <div className="font-mono text-[0.72rem] text-[#58a6ff] tabular-nums">{timeStr}</div>
                <div className="font-mono text-[0.43rem] tracking-widest text-[#1e1e2e] uppercase mt-0.5">UTC Clock</div>
              </div>

              <button onClick={() => setShowSettings(true)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all hover:scale-105 flex-shrink-0" style={{ background: "#080810", border: "1px solid #1a1a28", color: "#454558" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f0a50066'; (e.currentTarget as HTMLButtonElement).style.color = '#f0a500'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a1a28'; (e.currentTarget as HTMLButtonElement).style.color = '#454558'; }}>⚙️</button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab;
              const tabColor = TAB_COLORS[tab] || "#888";
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} className="relative font-mono text-[0.57rem] font-bold tracking-[1.5px] uppercase px-4 py-2.5 cursor-pointer transition-all duration-150 whitespace-nowrap flex-shrink-0"
                  style={{ background: isActive ? `${tabColor}0e` : "transparent", color: isActive ? tabColor : "#303042", borderBottom: `2px solid ${isActive ? tabColor : "transparent"}`, borderTop: `1px solid ${isActive ? tabColor + "25" : "transparent"}` }}>
                  {isActive && <div className="absolute top-0 left-[20%] right-[20%] h-px" style={{ background: `linear-gradient(90deg, transparent, ${tabColor}77, transparent)` }} />}
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 lg:px-8 pt-5 pb-20 relative z-10 min-h-[70vh]">
        {/* Module breadcrumb */}
        <div className="flex items-center gap-2.5 mb-5 font-mono text-[0.56rem] flex-wrap" style={{ color: "#2a2a3a" }}>
          <GlowPulse color="#56d364" />
          <span className="text-[#303042]">MODULE</span>
          <span className="text-[#56d364] tracking-[1.5px] font-bold">{activeTab}</span>
          <span className="text-[#1a1a2a]">·</span>
          <span className="text-[#303042]">OP</span>
          <span className="text-[#f0a500]">{handle || "N/A"}</span>
          <span className="text-[#1a1a2a]">·</span>
          <span className="text-[#303042]">UPTIME</span>
          <span className="text-[#58a6ff] tabular-nums">{tick}s</span>
          <div className="flex-1 hidden sm:block" />
          <span className="text-[#1a1a2a] hidden sm:inline">SYS.INTEGRITY </span>
          <span className="text-[#252535] hidden sm:inline">■■■■■■■■■■ 100%</span>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center my-24 gap-4">
            <div className="font-mono text-[#f0a500] text-sm animate-pulse tracking-[2px]">{loadingMsg}</div>
            <div className="flex gap-1.5">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-1 h-6 rounded-full bg-[#f0a500] animate-pulse" style={{ animationDelay: `${i * 0.12}s`, opacity: 0.4 + i * 0.12 }} />
              ))}
            </div>
          </div>
        )}

        {!loading && mainMetrics && squadData[config.main] && (
          <>
            {/* The Guillotine */}
            {activeTab === "COMMAND" && (guillotineStatus.isBlue || guillotineStatus.isRed) && (
              <div className={`mb-6 px-5 py-4 rounded-xl border flex justify-between items-center gap-4 ${guillotineStatus.isRed ? 'animate-[pulse_2.5s_ease-in-out_infinite]' : ''}`}
                style={{ background: guillotineStatus.isRed ? 'rgba(248,81,73,0.04)' : 'rgba(88,166,255,0.04)', borderColor: guillotineStatus.isRed ? '#f8514944' : '#58a6ff33', borderLeft: `3px solid ${guillotineStatus.isRed ? '#f85149' : '#58a6ff'}` }}>
                <div>
                  <div className="font-mono font-black uppercase tracking-widest text-sm" style={{ color: guillotineStatus.isRed ? '#f85149' : '#58a6ff' }}>
                    {guillotineStatus.isRed ? '⚠ CRITICAL DECAY' : '◉ RUST FORMING'}
                  </div>
                  <div className="font-mono text-[0.65rem] mt-1" style={{ color: guillotineStatus.isRed ? '#f8514988' : '#58a6ff88' }}>
                    No submissions for <span className="font-bold">{guillotineStatus.hoursInactive}h</span>.
                    {guillotineStatus.isRed && ` Bleed active for ${guillotineStatus.bleedHours}h.`}
                  </div>
                </div>
                {guillotineStatus.isRed && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black text-[#f85149] font-mono tabular-nums">−{guillotineStatus.pointsLost} PTS</div>
                    <div className="text-[9px] text-[#f8514966] uppercase tracking-widest font-mono mt-0.5">Simulated Elo Bleed</div>
                  </div>
                )}
                {guillotineStatus.isBlue && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black text-[#58a6ff] font-mono tabular-nums">{guillotineStatus.hoursInactive}h</div>
                    <div className="text-[9px] text-[#58a6ff66] uppercase tracking-widest font-mono mt-0.5">Hours Inactive</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "COMMAND" && <CommandTab metrics={mainMetrics} info={squadData[config.main].info} filter={contextFilter} config={config} squadData={squadData} />}
            {activeTab === "WAR MAP" && <WarMap subs={mainMetrics.rawSubsList} />}
            {activeTab === "ARMORY" && <div className="animate-in fade-in"><Armory badges={computedBadges} mainHandle={config.main} variant="full" players={[config.main, ...config.squad].filter(h => squadData[h])} /></div>}
            {activeTab === "SQUAD OPS" && <SquadOpsTab squadMatrix={squadMatrix} config={config} squadCharts={squadCharts} bounties={bounties} />}
            {activeTab === "NEMESIS" && (
              <div className="animate-in fade-in">
                <div className="mb-5 flex gap-2 items-center flex-wrap">
                  <span className="text-[#454558] font-mono text-[0.6rem] uppercase tracking-widest">Target:</span>
                  {config.squad.map(h => (
                    <button key={h} onClick={() => setNemesisTarget(h)}
                      className="px-3 py-1.5 rounded-lg font-mono uppercase text-[0.6rem] tracking-wider transition-all cursor-pointer border"
                      style={{
                        background: nemesisTarget === h ? 'rgba(248,81,73,0.08)' : '#070710',
                        color: nemesisTarget === h ? '#f85149' : '#454558',
                        borderColor: nemesisTarget === h ? '#f8514944' : '#1a1a28',
                      }}>{h}</button>
                  ))}
                </div>
                {nemesisTarget && squadData[nemesisTarget] ? <Nemesis mySubs={squadData[config.main].rawSubs} targetSubs={squadData[nemesisTarget].rawSubs} targetHandle={nemesisTarget} myRating={squadData[config.main].info.rating || 1200} myHandle={config.main} myHistory={squadData[config.main].history || []} targetHistory={squadData[nemesisTarget].history || []} myInfo={squadData[config.main].info} targetInfo={squadData[nemesisTarget].info} /> : <div className="text-center py-20 text-[#2a2a3a] font-mono text-sm">Select a squad target to initiate Nemesis protocol.</div>}
              </div>
            )}
            {activeTab === "FORGE" && <Forge rawSubsList={mainMetrics.rawSubsList} />}
            {activeTab === "GRIND" && <GrindMode handle={config.main} />}
            {activeTab === "TITAN" && <TitanTab squadData={squadData} config={config} />}
            {activeTab === "CONTESTS" && mainMetrics && (
              <ContestTracker handle={config.main} rawSubs={squadData[config.main].rawSubs} />
            )}
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-7 hidden md:flex items-center px-8 gap-6 z-50" style={{ background: "rgba(3,3,5,0.98)", borderTop: "1px solid #0e0e18" }}>
        {[["CF API","#56d364"],["SQUAD SYNC","#56d364"],["NEMESIS","#f0a500"],["FORGE","#58a6ff"]].map(([l, col]) => <StatusLabel key={l} label={l as string} color={col as string} />)}
        <div className="flex-1" />
        <div className="font-mono text-[0.5rem] tracking-[2px] text-[#161622]">CODEFORCES SYNTHESIS ENGINE · TACTICAL EDGE</div>
      </div>
    </div>
  );
}