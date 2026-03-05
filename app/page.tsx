"use client";

import { useState, useEffect, useMemo } from "react";
import { VerdictChart, TagsRadarChart, TacticalBarChart, ResourceScatterChart, TimeToSolveChart, StressBarChart, RatingLineChart, ActivityHeatmap } from "@/components/Charts";
import WarMap, { T_NODES } from "@/components/WarMap";
import SettingsModal from "@/components/SettingsModal";
import Armory, { BadgeDef } from "@/components/Armory";
import { Line, Bar, Radar } from 'react-chartjs-2';

// --- STRICT TYPESCRIPT INTERFACES ---
interface CFSubmission { verdict: string; creationTimeSeconds: number; timeConsumedMillis: number; memoryConsumedBytes: number; author: { participantType: string }; problem: { contestId: number; index: string; name: string; rating?: number; tags?: string[] }; }
interface CFInfo { handle: string; rating?: number; maxRating?: number; rank?: string; titlePhoto: string; contribution?: number; }
interface CFRating { ratingUpdateTimeSeconds: number; oldRating: number; newRating: number; }
interface ProcessedMetrics { score: number; weeklyScore: number; monthlyScore: number; unique: number; acc: number; upsolveRate: number; verdictsDist: Record<string, number>; tagsDist: Record<string, number>; ratingsDist: Record<string, number>; weaknessRatios: Record<string, number>; timeToSolveDist: Record<string, number>; tagResourceStress: Record<string, { timeAvg: number; memAvg: number }>; rawSubsList: CFSubmission[]; }
interface SquadMemberData { info: CFInfo; metrics: ProcessedMetrics; history: CFRating[]; }

const CF_SCORE_MAP: Record<number, number> = { 800:15, 900:20, 1000:30, 1100:45, 1200:65, 1300:90, 1400:130, 1500:180, 1600:250, 1700:350, 1800:500, 1900:720, 2000:1050, 2100:1530, 2200:2250, 2300:3300, 2400:4800 };
const SQUAD_COLORS = ['#58a6ff', '#d2a8ff', '#56d364', '#f85149'];

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

export default function Home() {
  const [handle, setHandle] = useState("");
  const [squadData, setSquadData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [activeTab, setActiveTab] = useState("TELEMETRY");
  const [contextFilter, setContextFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({ main: "", squad: [] as string[], titan: "" });

  useEffect(() => {
    const saved = localStorage.getItem('cf_config_v6');
    if (saved) { 
      const parsed = JSON.parse(saved); 
      setConfig(parsed); 
      setHandle(parsed.main || ""); 
      if (parsed.main) fetchGlobalTelemetry(parsed.main, parsed.squad, parsed.titan); 
    }
    else setShowSettings(true);
  }, []);

  const fetchGlobalTelemetry = async (mainH: string, squadH: string[], titanH: string) => {
    if (!mainH) return;
    setLoading(true);
    setLoadingMsg(`SYNCHRONIZING GLOBAL TELEMETRY... [||||||||||]`);
    
    const newSquadData: Record<string, any> = {};
    const allHandles = [mainH, ...squadH, titanH].filter(Boolean);

    try {
      for (const h of allHandles) {
        const res = await fetch(`/api/cf?handle=${h}`);
        const data = await res.json();
        
        if (!data.error && data.submissions) {
          newSquadData[h] = { handle: h, info: data.info, rawSubs: data.submissions, history: data.ratingHistory || [] };
        }
      }
      setSquadData(newSquadData);
    } catch (err) { 
      console.error(err); 
      alert("Engine Failure: Network error. Please check backend connection.");
      setShowSettings(true);
    }
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

  const { mainMetrics, squadMatrix, bounties, computedBadges } = useMemo(() => {
    if (!squadData[config.main]) return { mainMetrics: null, squadMatrix: {} as Record<string, SquadMemberData>, bounties: [], computedBadges: [] };
    
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

    const findWinner = (pathFn: any, min = 0, isMin = false) => { let best = null; let bestVal = isMin ? Infinity : -Infinity; allPlayers.forEach(p => { let v = pathFn(sMatrix[p], bMatrix[p]); if (!isMin && v > bestVal && v > min) { bestVal = v; best = p; } else if (isMin && v < bestVal && v > min) { bestVal = v; best = p; } }); return best; };
    const count30dAC = (p: string, condition: any) => { return sMatrix[p].metrics.rawSubsList.filter((s:CFSubmission) => s.verdict==='OK' && ((now-s.creationTimeSeconds)/86400)<=30 && condition(s)).length; };
    const maxRat30d = (p: string) => { let m = 0; sMatrix[p].metrics.rawSubsList.forEach((s:CFSubmission) => { if(s.verdict==='OK' && ((now-s.creationTimeSeconds)/86400)<=30 && (s.problem.rating || 0) > m) m = s.problem.rating!; }); return m; };

    let badges: BadgeDef[] = [
      { id: 'vanguard', icon: '⚡', name: 'The Vanguard', desc: 'Highest Sprint Score (7 Days).', owner: findWinner((d:SquadMemberData) => d.metrics.weeklyScore, 50) },
      { id: 'overlord', icon: '👑', name: 'Monthly Overlord', desc: 'Highest Sprint Score (30 Days).', owner: findWinner((d:SquadMemberData) => d.metrics.monthlyScore, 100) },
      { id: 'architect', icon: '📐', name: 'The Architect', desc: 'Highest absolute First-Try Accuracy.', owner: findWinner((d:SquadMemberData) => d.metrics.acc, 0) },
      { id: 'marathon', icon: '🏃', name: 'Marathon Runner', desc: 'Most active days (Last 30D).', owner: findWinner((d:SquadMemberData) => { let days=new Set(); d.metrics.rawSubsList.forEach((s:CFSubmission)=>{if(s.verdict==='OK' && (Date.now()/1000 - s.creationTimeSeconds)/86400 <= 30) days.add(new Date(s.creationTimeSeconds*1000).toDateString());}); return days.size; }, 5) },
      { id: 'nightowl', icon: '🦉', name: 'Night Owl', desc: 'Most problems solved 00:00-06:00 (Last 30D).', owner: findWinner((d:SquadMemberData) => count30dAC(d.info.handle, (s:CFSubmission) => new Date(s.creationTimeSeconds*1000).getHours() < 6), 2) },
      { id: 'earlybird', icon: '🌅', name: 'Early Riser', desc: 'Most problems solved 06:00-12:00 (Last 30D).', owner: findWinner((d:SquadMemberData) => count30dAC(d.info.handle, (s:CFSubmission) => { let h=new Date(s.creationTimeSeconds*1000).getHours(); return h>=6 && h<12; }), 2) },
      { id: 'polymath', icon: '🌐', name: 'The Polymath', desc: 'Highest distinct algorithmic tags.', owner: findWinner((d:SquadMemberData) => Object.keys(d.metrics.tagsDist).length, 5) },
      { id: 'grinder', icon: '⏳', name: 'The Grinder', desc: 'Most problems requiring 5+ hours.', owner: findWinner((d:SquadMemberData) => d.metrics.timeToSolveDist["> 5h (Grind)"], 0) },
      { id: 'headhunter', icon: '🦅', name: 'The Headhunter', desc: 'Most bounties sniped.', owner: findWinner((d:SquadMemberData, b:any) => b.snipes, 0) },
      { id: 'necromancer', icon: '🧟', name: 'The Necromancer', desc: 'Most personal bounties resurrected.', owner: findWinner((d:SquadMemberData, b:any) => b.resurrected, 0) },
      { id: 'mostwanted', icon: '🚨', name: 'Most Wanted', desc: '[NEGATIVE] Highest volume of active bounties.', owner: findWinner((d:SquadMemberData, b:any) => b.active.length, 2) },
      { id: 'untouchable', icon: '🕴️', name: 'Untouchable', desc: 'Zero active bounties (Min 20 solves).', owner: findWinner((d:SquadMemberData, b:any) => (b.active.length === 0 && b.solvedSet.size >= 20) ? b.solvedSet.size : 0, 0) },
      { id: 'berserker', icon: '🩸', name: 'Berserker', desc: 'Most problems solved in a single day.', owner: findWinner((d:SquadMemberData) => { let c:Record<string,number>={}; d.metrics.rawSubsList.forEach((s:CFSubmission) => { if(s.verdict==='OK' && (Date.now()/1000-s.creationTimeSeconds)/86400<=30) { let k=new Date(s.creationTimeSeconds*1000).toDateString(); c[k]=(c[k]||0)+1; }}); return Math.max(...Object.values(c), 0); }, 3) },
      { id: 'titanslayer', icon: '🗡️', name: 'Titan Slayer', desc: 'Secured AC on highest rated problem.', owner: findWinner((d:SquadMemberData) => maxRat30d(d.info.handle), 1200) },
      { id: 'efficiency', icon: '⚙️', name: 'Efficiency Node', desc: 'Lowest overall average execution time.', owner: findWinner((d:SquadMemberData) => { let arr = Object.values(d.metrics.tagResourceStress); return arr.length ? arr.reduce((sum,x)=>sum+x.timeAvg,0)/arr.length : 10000; }, 0, true) },
      { id: 'math', icon: '∑', name: 'Math Prodigy', desc: 'Most math/number theory problems.', owner: findWinner((d:SquadMemberData) => (d.metrics.tagsDist['math']||0) + (d.metrics.tagsDist['number theory']||0), 1) },
      { id: 'geom', icon: '◬', name: 'Geometry God', desc: 'Most geometry problems.', owner: findWinner((d:SquadMemberData) => d.metrics.tagsDist['geometry']||0, 1) },
      { id: 'graph', icon: '🕸️', name: 'Graph Monarch', desc: 'Most graph/trees problems.', owner: findWinner((d:SquadMemberData) => (d.metrics.tagsDist['graphs']||0) + (d.metrics.tagsDist['dfs and similar']||0) + (d.metrics.tagsDist['trees']||0), 1) },
      { id: 'dp', icon: '🧠', name: 'DP Crown', desc: 'Most DP problems solved.', owner: findWinner((d:SquadMemberData) => d.metrics.tagsDist['dp']||0, 1) },
      { id: 'datastruct', icon: '🗄️', name: 'Data Structurist', desc: 'Most Data Structure problems.', owner: findWinner((d:SquadMemberData) => d.metrics.tagsDist['data structures']||0, 1) },
      { id: 'sniper', icon: '🎯', name: 'The Sniper', desc: 'Highest First-Try AC percentage (Min 5 att).', owner: findWinner((d:SquadMemberData) => { let a=0,f=0; d.metrics.rawSubsList.forEach((s:CFSubmission)=>{if((now-s.creationTimeSeconds)/86400<=30){a++; if(s.verdict==='OK')f++;}}); return a>=5 ? f/a : 0; }, 0) },
      { id: 'b_recon', icon: '🥷', name: 'Recon Ghost', desc: 'Acquired at least 5 ACs +200 rating.', owner: reconMetrics.unique >= 5 ? config.main : null },
      { id: 'b_emperor', icon: '🏰', name: 'The Emperor', desc: 'Constructed 5+ Citadels on Map.', owner: mapMetrics.citadel >= 5 ? config.main : null },
      { id: 'b_warlord', icon: '⚔️', name: 'The Warlord', desc: 'Conquered 10+ territories on Map.', owner: mapMetrics.conquered >= 10 ? config.main : null },
      { id: 'b_tactician', icon: '♟️', name: 'Grand Tactician', desc: 'Maintained 0 Rebellions.', owner: (mapMetrics.rebellion === 0 && (mapMetrics.occupied > 0 || mapMetrics.conquered > 0)) ? config.main : null },
      { id: 'b_pyro', icon: '🔥', name: 'The Pyromancer', desc: '[NEGATIVE] Allowed 3+ Rebellions.', owner: mapMetrics.rebellion >= 3 ? config.main : null },
      { id: 'b_preserver', icon: '🏺', name: 'The Preservationist', desc: 'Zero decaying territories.', owner: (mapMetrics.decaying === 0 && mapMetrics.occupied >= 10) ? config.main : null },
      { id: 'b_ruined', icon: '🏚️', name: 'Fallen Kingdom', desc: '[NEGATIVE] Allowed 5+ map ruins.', owner: mapMetrics.decaying >= 5 ? config.main : null },
      { id: 'b_pathfinder', icon: '🗺️', name: 'Pathfinder', desc: 'Scouted 10+ Incognito Nodes.', owner: mapMetrics.scouted >= 10 ? config.main : null },
    ];

    return { mainMetrics, squadMatrix: sMatrix, bounties: uniqueBounties.slice(0,30), computedBadges: badges };
  }, [squadData, config, contextFilter, timeFilter]);

  const getRankColor = (rank?: string) => { if(!rank) return '#e0e6ed'; if(rank.includes('newbie')) return '#8b949e'; if(rank.includes('pupil')) return '#56d364'; if(rank.includes('specialist')) return '#58a6ff'; if(rank.includes('expert')) return '#d2a8ff'; if(rank.includes('candidate master')) return '#e3b341'; if(rank.includes('master')) return '#db6d28'; return '#f85149'; };

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

  let timeAvgData: Record<string, number> = {}; let memAvgData: Record<string, number> = {};
  if (mainMetrics) Object.keys(mainMetrics.tagResourceStress).forEach(t => { timeAvgData[t] = mainMetrics.tagResourceStress[t].timeAvg; memAvgData[t] = mainMetrics.tagResourceStress[t].memAvg; });

  let sortedWeaknesses = mainMetrics ? Object.keys(mainMetrics.weaknessRatios).sort((a,b) => mainMetrics.weaknessRatios[b] - mainMetrics.weaknessRatios[a]) : [];

  return (
    <main className="min-h-screen bg-[#111214] text-[#e0e6ed] font-['Inter',sans-serif] overflow-x-hidden pb-20 selection:bg-[#58a6ff]">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSave={(newCfg) => { setConfig(newCfg); setHandle(newCfg.main); setShowSettings(false); fetchGlobalTelemetry(newCfg.main, newCfg.squad, newCfg.titan); }} />}
      
      {/* HEADER BAR */}
      <div className="flex justify-between items-center px-8 py-6 bg-[#1e2024] border-b border-[#30363d] sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div>
          <h1 className="text-[1.5rem] font-bold text-white tracking-tight m-0 leading-none">Codeforces Synthesis Engine</h1>
          <p className="text-[#8b949e] mt-1 text-[0.85rem] font-mono m-0">Tracking: {handle || "N/A"} | Context: {contextFilter}</p>
        </div>
        <div className="flex items-center gap-[15px]">
          <div className="flex bg-[#0d1117] rounded-[6px] border border-[#30363d] overflow-hidden">
            {['ALL', 'CONTEST', 'PRACTICE', 'RECON'].map(ctx => <button key={ctx} onClick={() => setContextFilter(ctx)} className={`px-4 py-2 border-r border-[#30363d] last:border-0 font-semibold text-[0.85rem] transition-colors cursor-pointer ${contextFilter === ctx ? (ctx==='RECON'?'bg-[#58a6ff] text-black':'bg-[#e3b341] text-black') : 'bg-transparent text-[#8b949e] hover:bg-[rgba(255,255,255,0.05)]'}`}>{ctx}</button>)}
          </div>
          <button onClick={() => setShowSettings(true)} className="bg-[#2b2e33] border border-[#30363d] text-[#e0e6ed] px-[12px] py-[8px] rounded-[6px] cursor-pointer text-[1.2rem] transition-colors hover:bg-[#e3b341] hover:text-black">⚙️</button>
        </div>
      </div>

      {loading && <div className="text-center my-16 font-mono text-[#e3b341] text-[1.2rem] animate-pulse">{loadingMsg}</div>}

      {!loading && mainMetrics && squadData[config.main] && (
        <div className="w-full max-w-[1400px] mx-auto p-8 animate-in fade-in duration-500">
          
          {/* TAB NAV */}
          <div className="flex justify-between items-center border-b border-[#30363d] bg-[rgba(30,32,36,0.8)] backdrop-blur-[10px] px-8 mb-8 -mx-8">
            <div className="flex gap-8">
              {['TELEMETRY', 'MAP', 'SQUAD', 'TITAN'].map(tab => {
                const isActive = activeTab === tab;
                return <div key={tab} onClick={() => setActiveTab(tab)} className={`py-4 font-mono text-[0.9rem] uppercase cursor-pointer border-b-[3px] transition-all ${isActive ? 'text-[#e3b341] border-[#e3b341] font-bold drop-shadow-[0_0_10px_rgba(227,179,65,0.3)]' : 'text-[#8b949e] border-transparent'}`}>[ {tab === 'MAP' ? 'THE WAR MAP' : tab === 'SQUAD' ? 'SQUAD CLASH' : tab === 'TELEMETRY' ? 'MY TELEMETRY' : 'TITAN TRACKER'} ]</div>
              })}
            </div>
            {activeTab === "TELEMETRY" && (
              <div className="flex gap-[5px]">
                {['ALL', '30', '7'].map(t => <button key={t} onClick={() => setTimeFilter(t)} className={`px-[10px] py-[4px] text-[0.75rem] font-mono rounded-[6px] border transition-colors cursor-pointer ${timeFilter === t ? "bg-[#58a6ff] text-black border-[#58a6ff]" : "bg-[#1e2024] text-[#8b949e] border-[#30363d]"}`}>{t === 'ALL' ? 'ALL TIME' : `${t} DAYS`}</button>)}
              </div>
            )}
          </div>

          {/* TAB 1: TELEMETRY */}
          {activeTab === "TELEMETRY" && (
            <div className="animate-in fade-in duration-400">
              <div className="bg-[#1e2024] border border-[#30363d] rounded-[20px] p-8 flex items-center gap-8 mb-8 shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex-wrap relative">
                <img src={squadData[config.main].info.titlePhoto} alt="Avatar" className="w-[100px] h-[100px] rounded-[12px] border-2 border-[#30363d] object-cover" />
                <div className="flex-1 min-w-[250px]">
                  <h2 className="text-[1.8rem] font-bold m-0 mb-1.5 flex items-center gap-2.5 flex-wrap">
                    {squadData[config.main].info.handle}
                    <span className="text-[0.85rem] uppercase px-2.5 py-1 bg-[rgba(0,0,0,0.3)] rounded-[20px] font-semibold tracking-[1px]" style={{color: getRankColor(squadData[config.main].info.rank)}}>{squadData[config.main].info.rank || "Unrated"}</span>
                  </h2>
                  <div className="flex gap-8 mt-[15px] flex-wrap">
                    <div className="flex flex-col"><span className="font-mono text-[1.4rem] font-bold text-[#e3b341]">{squadData[config.main].info.rating || 0}</span><span className="text-[0.75rem] text-[#8b949e] uppercase font-semibold">Live Rating</span></div>
                    <div className="flex flex-col"><span className="font-mono text-[1.4rem] font-bold text-[#58a6ff]">{squadData[config.main].info.maxRating || 0}</span><span className="text-[0.75rem] text-[#8b949e] uppercase font-semibold">Max Rating</span></div>
                    <div className="flex flex-col"><span className="font-mono text-[1.4rem] font-bold text-[#e3b341]">{squadData[config.main].info.contribution || 0}</span><span className="text-[0.75rem] text-[#8b949e] uppercase font-semibold">Contribution</span></div>
                  </div>
                  <Armory badges={computedBadges} mainHandle={config.main} variant="mini" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {[ { label: 'Active Sprint Score', val: (timeFilter === '30' ? mainMetrics.monthlyScore : timeFilter === '7' ? mainMetrics.weeklyScore : mainMetrics.score).toLocaleString(), c: '#e3b341' }, { label: 'Unique Solved', val: mainMetrics.unique.toLocaleString(), c: '#58a6ff' }, { label: 'Absolute First-Try', val: `${mainMetrics.acc}%`, c: '#d2a8ff' }, { label: 'Upsolve Rate', val: `${mainMetrics.upsolveRate}%`, c: '#db6d28' } ].map(s => (
                  <div key={s.label} className="bg-[rgba(0,0,0,0.2)] p-6 rounded-[12px] border border-[#30363d] border-t-[3px] transition-transform hover:-translate-y-1 hover:bg-[#1e2024] hover:shadow-[0_10px_40px_rgba(0,0,0,0.7)] flex flex-col justify-center items-start" style={{ borderTopColor: s.c }}>
                    <div className="text-[2.5rem] font-light font-mono leading-none mb-2">{s.val}</div>
                    <div className="text-[0.75rem] text-[#8b949e] uppercase tracking-[1px] font-semibold">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-[rgba(227,179,65,0.05)] border border-[#30363d] border-l-4 border-l-[#e3b341] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)] mb-6">
                <h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">The Oracle [Tactical Directives]</h3>
                <div className="font-mono text-[0.95rem] leading-[1.6]">
                  {sortedWeaknesses.length > 0 ? (
                    <>
                      <div className="mb-3"><span className="text-[#f85149] font-bold">[!] CRITICAL VULNERABILITY:</span> Failure rate in <strong className="text-white">{sortedWeaknesses[0]}</strong> is highly inefficient. Upsolve {Math.floor((squadData[config.main].info.rating || 1200)/100)*100} - {Math.floor((squadData[config.main].info.rating || 1200)/100)*100 + 200} rated problems.</div>
                      {sortedWeaknesses.length > 1 && <div><span className="text-[#e3b341] font-bold">[*] SECONDARY TARGET:</span> <strong className="text-white">{sortedWeaknesses[1]}</strong>. Run drills in this sector.</div>}
                    </>
                  ) : "Awaiting analysis..."}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Rating Trajectory (Momentum)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Historical point variations</p><div className="h-[300px] relative"><RatingLineChart history={squadData[config.main].history} /></div></div>
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Activity Heatmap (6 Months)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Daily AC volume</p><div className="h-[300px] flex items-center justify-center overflow-x-auto"><ActivityHeatmap subs={mainMetrics.rawSubsList} /></div></div>
              </div>

              <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)] mb-6"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Algorithmic Weakness Matrix (Fails / AC Ratio)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Penalty tracking across the entire algorithm spectrum for the active timeframe.</p><div className="h-[500px] relative"><TacticalBarChart data={mainMetrics.weaknessRatios} color="#f85149" horizontal={true} /></div></div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Time Execution Stress (Avg ms)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Dynamic Limit Tracking</p><div className="h-[300px] relative"><StressBarChart data={timeAvgData} type="time" /></div></div>
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Memory Footprint Stress (Avg MB)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Memory consumed per AC</p><div className="h-[300px] relative"><StressBarChart data={memAvgData} type="memory" /></div></div>
              </div>

              <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)] mb-6"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Resource Distribution (Scatter)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Correlation between Time (ms) and Memory (MB)</p><div className="h-[300px] relative"><ResourceScatterChart subs={mainMetrics.rawSubsList} /></div></div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Time-To-Solve (Debug Speed)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">First Attempt vs Final AC Timestamp</p><div className="h-[300px] relative"><TimeToSolveChart data={mainMetrics.timeToSolveDist} /></div></div>
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Algorithmic Mastery (Top AC Tags)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Volume of Successful Solves</p><div className="h-[300px] relative"><TagsRadarChart data={mainMetrics.tagsDist} handle={config.main} /></div></div>
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Problem Rating Distribution (AC)</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Distribution by Difficulty</p><div className="h-[300px] relative"><TacticalBarChart data={mainMetrics.ratingsDist} color="#58a6ff" /></div></div>
                <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Submission Verdicts</h3><p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-6">Verdict Breakdown</p><div className="h-[300px] relative"><VerdictChart data={mainMetrics.verdictsDist} /></div></div>
              </div>
            </div>
          )}

          {/* TAB 2: WAR MAP */}
          {activeTab === "MAP" && <div className="animate-in fade-in duration-400"><WarMap subs={mainMetrics.rawSubsList} /></div>}

          {/* TAB 3: SQUAD CLASH */}
          {activeTab === "SQUAD" && squadCharts && (
            <div className="space-y-8 animate-in fade-in duration-400">
              <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                <h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">The Vanguard [Global Leaderboard]</h3>
                <p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mb-4">Multi-metric evaluation across all registered squad personnel.</p>
                <div className="overflow-x-auto"><table className="w-full text-left font-mono text-[1rem] border-collapse mt-4">
                  <thead><tr className="text-[#8b949e] text-[0.75rem] uppercase tracking-[1px] font-semibold"><th className="pb-3 border-b border-[#30363d]">Operative</th><th className="pb-3 border-b border-[#30363d]">Rating</th><th className="pb-3 border-b border-[#30363d]">7-Day Sprint</th><th className="pb-3 border-b border-[#30363d]">30-Day Sprint</th><th className="pb-3 border-b border-[#30363d]">Lifetime AC</th><th className="pb-3 border-b border-[#30363d]">Global Acc</th></tr></thead>
                  <tbody>{squadCharts.players.map(p => (
                    <tr key={p} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors"><td className="py-[12px] pr-[15px] border-b border-[#30363d] font-bold font-sans text-[#58a6ff]">{p === config.main ? <><span className="text-[#e3b341]">[YOU]</span> {p}</> : p}</td><td className="py-[12px] pr-[15px] border-b border-[#30363d]" style={{color: getRankColor(squadMatrix[p].info.rank)}}>{squadMatrix[p].info.rating || 0}</td><td className="py-[12px] pr-[15px] border-b border-[#30363d] text-white">{squadMatrix[p].metrics.weeklyScore}</td><td className="py-[12px] pr-[15px] border-b border-[#30363d] text-white">{squadMatrix[p].metrics.monthlyScore}</td><td className="py-[12px] pr-[15px] border-b border-[#30363d] text-white">{squadMatrix[p].metrics.unique}</td><td className="py-[12px] pr-[15px] border-b border-[#30363d] text-white">{squadMatrix[p].metrics.acc}%</td></tr>
                  ))}</tbody>
                </table></div>
              </div>

              <div>
                <h3 className="text-[#f85149] font-mono text-[1rem] uppercase tracking-[1px] border-b-2 border-[#f85149] pb-[5px] mb-[1rem] mt-8">The Graveyard [Active Bounties]</h3>
                <p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mt-[-10px] mb-[15px]">Problems failed 3+ times by a squad member and abandoned. Snipe them to establish dominance.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[15px]">
                  {bounties.map(b => (
                    <div key={b.pid} className={`bg-[rgba(0,0,0,0.2)] border border-[#30363d] rounded-[6px] p-[15px] flex flex-col gap-[10px] transition-transform hover:-translate-y-[3px] hover:bg-[#2b2e33] hover:shadow-[0_10px_40px_rgba(0,0,0,0.7)] border-l-[3px] hover:border-l-[#e3b341] ${b.isOwn ? 'border-l-[#f85149]' : 'border-l-[#f85149]'}`}>
                      <div className="flex justify-between items-start"><span className="text-[#58a6ff] font-bold text-[1rem] leading-[1.2] pr-[10px]">{b.name}</span><span className="text-[#e3b341] font-mono text-[0.8rem] font-bold bg-[rgba(227,179,65,0.1)] px-[6px] py-[2px] rounded-[4px] shrink-0">{b.pts} PTS</span></div>
                      <p className="text-[0.8rem] text-[#8b949e] m-0">Failed {b.fails}x by <span className="text-[#f85149] font-bold">{b.victim}</span></p>
                      <div className="flex flex-wrap gap-[5px]">{b.prob.tags?.slice(0, 3).map((t:string) => <span key={t} className="text-[0.7rem] bg-[#1e2024] border border-[#30363d] text-[#8b949e] px-[6px] py-[2px] rounded-[12px]">{t}</span>)}</div>
                      <a href={`https://codeforces.com/contest/${b.prob.contestId}/problem/${b.prob.index}`} target="_blank" className={`mt-auto text-center font-mono text-[0.85rem] font-bold p-[8px] border rounded-[6px] transition-colors no-underline ${b.btnClass}`}>{b.status}</a>
                    </div>
                  ))}
                  {bounties.length === 0 && <div className="col-span-4 text-[#8b949e] font-mono italic">No active bounties detected. The squad is clean.</div>}
                </div>
              </div>

              <div>
                <h3 className="text-[#8b949e] font-mono text-[1rem] uppercase tracking-[1px] border-b-2 border-[#30363d] pb-[5px] mb-[1rem] mt-8">The Armory [Dynamic Badges]</h3>
                <p className="text-[#8b949e] text-[0.75rem] font-mono m-0 mt-[-10px] mb-[15px]">Volatile titles awarded based on active data windows, Map Conquests, and Graveyard snipes.</p>
                <Armory badges={computedBadges} mainHandle={config.main} variant="full" />
              </div>

              <div>
                <h3 className="text-[#8b949e] font-mono text-[1rem] uppercase tracking-[1px] border-b-2 border-[#30363d] pb-[5px] mb-[1rem] mt-8">The Crucible [1v1 Combinatorial Duels]</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1.5rem]">
                  {squadCharts.players.map((p1, i) => squadCharts.players.slice(i+1).map(p2 => {
                    const m1 = squadMatrix[p1]; const m2 = squadMatrix[p2];
                    return (
                      <div key={`${p1}-${p2}`} className="bg-[rgba(0,0,0,0.2)] border border-[#30363d] rounded-[12px] p-[1.5rem]">
                        <div className="flex justify-between items-center border-b border-[#30363d] pb-[10px] mb-[15px]"><span className={`font-bold ${p1 === config.main ? 'text-[#e3b341]' : 'text-[#58a6ff]'}`}>{p1}</span><span className="text-[#8b949e] text-[0.8rem] font-mono">VS</span><span className={`font-bold ${p2 === config.main ? 'text-[#e3b341]' : 'text-[#58a6ff]'}`}>{p2}</span></div>
                        <div className="space-y-[8px] font-mono text-[0.9rem]">
                          {['rating', 'unique', 'acc'].map(stat => {
                            const v1 = stat==='rating'?m1.info.rating:stat==='unique'?m1.metrics.unique:m1.metrics.acc; const v2 = stat==='rating'?m2.info.rating:stat==='unique'?m2.metrics.unique:m2.metrics.acc;
                            return (
                              <div key={stat} className="flex justify-between">
                                <span className={v1! >= v2! ? 'text-[#2ea043] font-bold' : 'text-[#f85149]'}>{v1}{stat==='acc'?'%':''}</span><span className="text-[#8b949e] uppercase">{stat === 'rating' ? 'Rating' : stat === 'unique' ? 'Unique AC' : 'First-Try'}</span><span className={v2! >= v1! ? 'text-[#2ea043] font-bold' : 'text-[#f85149]'}>{v2}{stat==='acc'?'%':''}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }))}
                </div>
              </div>

              <div>
                <h3 className="text-[#8b949e] font-mono text-[1rem] uppercase tracking-[1px] border-b-2 border-[#30363d] pb-[5px] mb-[1rem] mt-8">Squad Telemetry Synthesis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Rating Warfare (Historical Trajectory)</h3><div className="h-[300px]"><Line data={squadCharts.lineData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#30363d' }, ticks: {font: {family: 'JetBrains Mono'}}} }, plugins: { legend: { labels: { color: '#e0e6ed', font: { family: 'JetBrains Mono' } } } } }} /></div></div>
                  <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Tactical Sprints (Sprint Scores)</h3><div className="h-[300px]"><Bar data={squadCharts.sprintData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: {font: {family: 'JetBrains Mono'}} }, y: { grid: { color: '#30363d' } } }, plugins: { legend: { labels: { color: '#e0e6ed', font: { family: 'JetBrains Mono' } } } } }} /></div></div>
                  <div className="bg-[#1e2024] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)] md:col-span-2"><h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">The Triad (Combined Tag Radar)</h3><div className="h-[400px]"><Radar data={squadCharts.radarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: '#30363d' }, grid: { color: '#30363d' }, ticks: { display: false }, pointLabels: { color: '#8b949e', font: {family: 'JetBrains Mono'} } } }, plugins: { legend: { position: 'top', labels: { color: '#e0e6ed', font: { family: 'JetBrains Mono' } } } } }} /></div></div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TITAN TRACKER */}
          {activeTab === "TITAN" && (
            <div className="animate-in fade-in duration-400">
              {squadData[config.titan] ? (
                <>
                  <div className="bg-[#1e2024] border border-[#f85149] rounded-[20px] p-8 flex items-center gap-8 shadow-lg mb-6 relative overflow-hidden">
                    <img src={squadData[config.titan].info.titlePhoto} alt="Avatar" className="w-[100px] h-[100px] rounded-[12px] border-2 border-[#f85149] object-cover" />
                    <div className="flex-1">
                      <h2 className="text-[1.8rem] font-bold m-0 mb-1.5 flex items-center gap-2.5 flex-wrap text-[#f85149]">{squadData[config.titan].info.handle} <span className="text-[0.85rem] uppercase px-2.5 py-1 bg-[rgba(0,0,0,0.3)] rounded-[20px] font-semibold tracking-[1px] text-[#8b949e]">{squadData[config.titan].info.rank || "Unrated"}</span></h2>
                      <div className="flex gap-8 mt-[15px] flex-wrap">
                        <div className="flex flex-col"><span className="font-mono text-[1.4rem] font-bold text-[#e0e6ed]">{squadData[config.titan].info.rating || 0}</span><span className="text-[0.75rem] text-[#8b949e] uppercase font-semibold">Rating</span></div>
                        <div className="flex flex-col"><span className="font-mono text-[1.4rem] font-bold text-[#e0e6ed]">{squadData[config.titan].info.maxRating || 0}</span><span className="text-[0.75rem] text-[#8b949e] uppercase font-semibold">Max Rating</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[rgba(248,81,73,0.05)] border-l-4 border-l-[#f85149] border border-[#30363d] rounded-[12px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                    <h3 className="text-white text-[0.9rem] uppercase tracking-[1px] border-b border-[#30363d] pb-2.5 mb-1.5 m-0">Assassination Protocol</h3>
                    <div className="font-mono text-[1.1rem] leading-[1.5] text-[#e0e6ed] mt-4">
                      {((squadData[config.titan].info.rating || 0) - (squadData[config.main].info.rating || 0)) <= 0 
                        ? <>You surpassed <span className="text-[#e3b341] font-bold">{config.titan}</span>. Find a new Titan.</>
                        : <>Titan <span className="text-[#e3b341] font-bold">{config.titan}</span> is {(squadData[config.titan].info.rating || 0) - (squadData[config.main].info.rating || 0)} points ahead.<br/><br/>Target Protocol: Sustain First-Try ACs on <strong className="text-[#e3b341]">{Math.floor((squadData[config.titan].info.rating || 1500)/100)*100}</strong> rated problems.</>
                      }
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-[4rem] bg-[#1e2024] rounded-[12px] border border-[#30363d]">
                  <p className="text-[#8b949e] font-mono text-[1.2rem] m-0">NO TITAN CONFIGURED.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}