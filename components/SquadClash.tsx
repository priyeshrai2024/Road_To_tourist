"use client";

import { useState, useEffect } from "react";
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, RadialLinearScale, Tooltip, Legend, Filler 
} from 'chart.js';
import { Line, Bar, Radar, Scatter } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler);

const CF_SCORE_MAP: Record<number, number> = { 800:15, 900:20, 1000:30, 1100:45, 1200:65, 1300:90, 1400:130, 1500:180, 1600:250, 1700:350, 1800:500, 1900:720, 2000:1050, 2100:1530, 2200:2250, 2300:3300, 2400:4800 };
const SQUAD_COLORS = ['#e3b341', '#58a6ff', '#d2a8ff', '#56d364']; // Main, Mem1, Mem2, Mem3

interface SquadMember {
  handle: string;
  isMain: boolean;
  rating: number;
  peak: number;
  rank: string;
  uniqueAC: number;
  acc: number;
  upsolve: number;
  score7D: number;
  score30D: number;
  fastSolvesPct: number;
  tags: Record<string, number>;
  history: any[];
  solvedSet: Set<string>;
  rawSubs: any[];
}

export default function SquadClash({ mainHandle, squadHandles }: { mainHandle: string, squadHandles: string[] }) {
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [bounties, setBounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSquad = async () => {
      setLoading(true);
      const allHandles = [mainHandle, ...squadHandles].filter(Boolean); // Ensure no empties
      const now = Date.now() / 1000;

      try {
        const results = await Promise.all(
          allHandles.map(async (h) => {
            try {
              const res = await fetch(`/api/cf?handle=${h}`);
              const data = await res.json();
              if (data.error || !data.submissions) return null;

              let uniqueAC = new Set<string>();
              let attempts = new Set<string>();
              let firstTry = 0;
              let score7D = 0;
              let score30D = 0;
              let fastSolves = 0;
              let tags: Record<string, number> = {};
              let problemTimings: Record<string, { first: number, solved: number | null }> = {};
              let inContestFails = new Set<string>();
              let inContestSolves = new Set<string>();
              let practiceSolves = new Set<string>();

              [...data.submissions].reverse().forEach((s: any) => {
                const pid = s.problem ? `${s.problem.contestId}-${s.problem.index}` : 'unknown';
                const v = s.verdict;
                
                if (pid !== 'unknown') {
                  if (!problemTimings[pid]) problemTimings[pid] = { first: s.creationTimeSeconds, solved: null };
                  if (!attempts.has(pid)) { attempts.add(pid); if (v === 'OK') firstTry++; }

                  const isContest = (s.author?.participantType === 'CONTESTANT' || s.author?.participantType === 'VIRTUAL');
                  if (isContest) { if (v === 'OK') inContestSolves.add(pid); else inContestFails.add(pid); }
                  else if (s.author?.participantType === 'PRACTICE') { if (v === 'OK') practiceSolves.add(pid); }

                  if (v === 'OK' && !uniqueAC.has(pid)) {
                    uniqueAC.add(pid);
                    problemTimings[pid].solved = s.creationTimeSeconds;
                    
                    let r = s.problem.rating ? Math.floor(s.problem.rating / 100) * 100 : 0;
                    let pts = r === 0 ? 10 : (CF_SCORE_MAP[r > 2400 ? 2400 : r] || 0);
                    
                    const daysAgo = (now - s.creationTimeSeconds) / 86400;
                    if (daysAgo <= 7) score7D += pts;
                    if (daysAgo <= 30) score30D += pts;

                    s.problem.tags?.forEach((t: string) => { tags[t] = (tags[t] || 0) + 1; });
                  }
                }
              });

              Object.values(problemTimings).forEach(t => {
                if (t.solved && (t.solved - t.first) / 60 <= 30) fastSolves++;
              });

              const upsolveCandidates = [...inContestFails].filter(p => !inContestSolves.has(p)); 

              return {
                handle: h,
                isMain: h === mainHandle,
                rating: data.info.rating || 0,
                peak: data.info.maxRating || 0,
                rank: data.info.rank || "Unrated",
                uniqueAC: uniqueAC.size,
                acc: attempts.size > 0 ? parseFloat(((firstTry / attempts.size) * 100).toFixed(1)) : 0,
                upsolve: upsolveCandidates.length > 0 ? parseFloat(((upsolveCandidates.filter(p => practiceSolves.has(p)).length / upsolveCandidates.length) * 100).toFixed(1)) : 0,
                score7D,
                score30D,
                fastSolvesPct: uniqueAC.size > 0 ? parseFloat(((fastSolves / uniqueAC.size) * 100).toFixed(1)) : 0,
                tags,
                history: data.ratingHistory || [],
                solvedSet: uniqueAC,
                rawSubs: data.submissions
              };
            } catch (e) { return null; }
          })
        );

        const validMembers = results.filter((r): r is SquadMember => r !== null);
        setMembers(validMembers.sort((a, b) => b.score30D - a.score30D)); // Sort by 30D Score

        // Build Graveyard
        const mainUser = validMembers.find(m => m.isMain);
        let grave: any[] = [];
        
        validMembers.forEach(m => {
          const fails = m.rawSubs.filter((s: any) => s.verdict !== 'OK' && s.verdict !== 'COMPILATION_ERROR');
          const failCounts: Record<string, number> = {};
          fails.forEach((f: any) => {
            if (!f.problem) return;
            const pid = `${f.problem.contestId}-${f.problem.index}`;
            failCounts[pid] = (failCounts[pid] || 0) + 1;
            
            if (failCounts[pid] === 3 && !m.solvedSet.has(pid)) {
              let status = "INITIATE SNIPE";
              let sColor = "text-[#e3b341] border-[#e3b341]";
              
              if (m.isMain) { status = "UPSOLVE REQUIRED"; sColor = "text-[#f85149] border-[#f85149]"; }
              else if (mainUser?.solvedSet.has(pid)) { status = "ALREADY SNIPED"; sColor = "text-[#2ea043] border-[#2ea043]"; }

              // Prevent duplicates
              if (!grave.find(g => g.id === pid)) {
                grave.push({ 
                  id: pid, name: f.problem.name, rating: f.problem.rating || 800, 
                  victim: m.handle, fails: failCounts[pid], tags: f.problem.tags || [],
                  status, sColor, link: `https://codeforces.com/contest/${f.problem.contestId}/problem/${f.problem.index}`
                });
              }
            }
          });
        });
        setBounties(grave.sort((a,b) => b.rating - a.rating).slice(0, 12));

      } catch (err) { console.error(err); }
      setLoading(false);
    };

    fetchSquad();
  }, [mainHandle, squadHandles]);

  if (loading) return <div className="animate-pulse text-[#e3b341] font-mono text-center py-32 text-xl tracking-widest">SYNTHESIZING SQUAD TELEMETRY...</div>;
  if (members.length === 0) return <div className="text-center py-20 text-[#8b949e] font-mono">No valid squad data generated.</div>;

  // --- CHART DATA GENERATION ---
  
  // 1. Tactical Sprints (Bar)
  const sprintData = {
    labels: members.map(m => m.handle),
    datasets: [
      { label: '7-Day Score', data: members.map(m => m.score7D), backgroundColor: '#f85149', borderRadius: 4 },
      { label: '30-Day Score', data: members.map(m => m.score30D), backgroundColor: '#d2a8ff', borderRadius: 4 }
    ]
  };

  // 2. The Triad (Radar)
  let allTags: Record<string, number> = {};
  members.forEach(m => Object.keys(m.tags).forEach(t => allTags[t] = (allTags[t] || 0) + m.tags[t]));
  const topTags = Object.keys(allTags).sort((a,b) => allTags[b] - allTags[a]).slice(0, 15);
  
  const radarData = {
    labels: topTags,
    datasets: members.map((m, i) => ({
      label: m.handle,
      data: topTags.map(t => m.tags[t] || 0),
      borderColor: SQUAD_COLORS[i % SQUAD_COLORS.length],
      backgroundColor: m.isMain ? 'rgba(227, 179, 65, 0.2)' : 'transparent',
      borderDash: m.isMain ? [] : [5, 5],
      borderWidth: 2,
    }))
  };

  // 3. Rating Warfare (Line)
  let allTimestamps = new Set<number>();
  members.forEach(m => m.history.forEach(h => allTimestamps.add(h.ratingUpdateTimeSeconds)));
  const sortedTS = Array.from(allTimestamps).sort((a,b) => a-b);
  
  const lineData = {
    labels: sortedTS.map(ts => { const d = new Date(ts*1000); return `${d.getMonth()+1}/${d.getFullYear().toString().substr(-2)}`; }),
    datasets: members.map((m, i) => {
      let data: number[] = [];
      let lastRating = m.history.length > 0 ? (m.history[0].oldRating || 1500) : 1500;
      let histMap: Record<number, number> = {};
      m.history.forEach(h => histMap[h.ratingUpdateTimeSeconds] = h.newRating);
      
      sortedTS.forEach(ts => {
        if (histMap[ts]) lastRating = histMap[ts];
        data.push(lastRating);
      });

      return {
        label: m.handle, data, borderColor: SQUAD_COLORS[i % SQUAD_COLORS.length], 
        backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.2,
        borderDash: m.isMain ? [] : [4, 4]
      };
    })
  };

  // 4. Efficiency Scatter (New!)
  const scatterData = {
    datasets: members.map((m, i) => ({
      label: m.handle,
      data: [{ x: m.acc, y: m.fastSolvesPct }],
      backgroundColor: SQUAD_COLORS[i % SQUAD_COLORS.length],
      pointRadius: 8,
      pointHoverRadius: 12
    }))
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      
      {/* THE VANGUARD */}
      <div>
        <h3 className="text-[#8b949e] font-mono text-sm uppercase tracking-widest mb-4 border-b border-[#30363d] pb-2">
          The Vanguard [Global Leaderboard]
        </h3>
        <div className="bg-[#1e2024] border border-[#30363d] rounded-xl overflow-x-auto shadow-2xl">
          <table className="w-full text-left font-mono text-sm whitespace-nowrap">
            <thead className="bg-black/40 border-b border-[#30363d]">
              <tr className="text-[#8b949e] text-[10px] uppercase tracking-wider">
                <th className="px-6 py-4">Operative</th>
                <th className="px-6 py-4">Rating (Peak)</th>
                <th className="px-6 py-4">7-Day Sprint</th>
                <th className="px-6 py-4 text-[#e3b341]">30-Day Sprint</th>
                <th className="px-6 py-4">Lifetime AC</th>
                <th className="px-6 py-4">First-Try</th>
                <th className="px-6 py-4">Upsolve</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.handle} className="border-b border-[#30363d]/50 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`font-bold ${m.isMain ? 'text-[#e3b341]' : 'text-[#58a6ff]'}`}>
                      {m.isMain && "[YOU] "}{m.handle}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">{m.rating} <span className="text-[#8b949e] text-xs">({m.peak})</span></td>
                  <td className="px-6 py-4 text-white">{m.score7D.toLocaleString()}</td>
                  <td className="px-6 py-4 text-[#e3b341] font-bold">{m.score30D.toLocaleString()}</td>
                  <td className="px-6 py-4 text-white">{m.uniqueAC.toLocaleString()}</td>
                  <td className="px-6 py-4 text-white">{m.acc}%</td>
                  <td className="px-6 py-4 text-white">{m.upsolve}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* THE GRAVEYARD */}
      <div>
        <h3 className="text-[#f85149] font-mono text-sm uppercase tracking-widest mb-4 border-b border-[#f85149]/50 pb-2">
          The Graveyard [Active Bounties]
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {bounties.map(b => (
            <a key={b.id} href={b.link} target="_blank" className="bg-[#1e2024] border border-[#30363d] border-l-4 border-l-[#f85149] rounded-xl p-4 shadow-lg hover:-translate-y-1 hover:border-[#f85149] transition-all block group">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-bold text-sm truncate pr-2 group-hover:text-[#58a6ff] transition-colors">{b.name}</span>
                <span className="text-[#e3b341] font-mono text-[10px] font-bold bg-[#e3b341]/10 px-2 py-1 rounded">{b.rating} PTS</span>
              </div>
              <p className="text-[10px] text-[#8b949e] uppercase mb-3">Failed {b.fails}x by <span className="text-[#f85149] font-bold">{b.victim}</span></p>
              <div className="flex flex-wrap gap-1 mb-4">
                {b.tags.slice(0,2).map((t:string) => <span key={t} className="text-[9px] bg-black border border-[#30363d] text-[#8b949e] px-1.5 py-0.5 rounded">{t}</span>)}
              </div>
              <div className={`text-center font-mono text-[10px] uppercase font-bold py-2 border rounded ${b.sColor} bg-black/40`}>
                {b.status}
              </div>
            </a>
          ))}
          {bounties.length === 0 && <div className="col-span-4 text-[#8b949e] font-mono italic">The Graveyard is empty. The squad is clean.</div>}
        </div>
      </div>

      {/* THE CRUCIBLE (1v1 Duels) */}
      <div>
        <h3 className="text-[#8b949e] font-mono text-sm uppercase tracking-widest mb-4 border-b border-[#30363d] pb-2">
          The Crucible [1v1 Combinatorial Duels]
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {members.map((m1, i) => members.slice(i+1).map(m2 => {
            const winColor = "text-[#2ea043] font-bold";
            const loseColor = "text-[#f85149]";
            return (
              <div key={`${m1.handle}-${m2.handle}`} className="bg-black/40 border border-[#30363d] rounded-xl p-6 shadow-xl">
                <div className="flex justify-between items-center border-b border-[#30363d] pb-4 mb-4">
                  <span className={`font-bold ${m1.isMain ? 'text-[#e3b341]' : 'text-[#58a6ff]'}`}>{m1.handle}</span>
                  <span className="text-[#8b949e] text-xs font-mono">VS</span>
                  <span className={`font-bold ${m2.isMain ? 'text-[#e3b341]' : 'text-[#58a6ff]'}`}>{m2.handle}</span>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between"><span className={m1.rating >= m2.rating ? winColor : loseColor}>{m1.rating}</span><span className="text-[#8b949e]">Live Rating</span><span className={m2.rating >= m1.rating ? winColor : loseColor}>{m2.rating}</span></div>
                  <div className="flex justify-between"><span className={m1.peak >= m2.peak ? winColor : loseColor}>{m1.peak}</span><span className="text-[#8b949e]">Peak Rating</span><span className={m2.peak >= m1.peak ? winColor : loseColor}>{m2.peak}</span></div>
                  <div className="flex justify-between"><span className={m1.uniqueAC >= m2.uniqueAC ? winColor : loseColor}>{m1.uniqueAC}</span><span className="text-[#8b949e]">Unique AC</span><span className={m2.uniqueAC >= m1.uniqueAC ? winColor : loseColor}>{m2.uniqueAC}</span></div>
                  <div className="flex justify-between"><span className={m1.acc >= m2.acc ? winColor : loseColor}>{m1.acc}%</span><span className="text-[#8b949e]">First-Try Acc</span><span className={m2.acc >= m1.acc ? winColor : loseColor}>{m2.acc}%</span></div>
                  <div className="flex justify-between"><span className={m1.upsolve >= m2.upsolve ? winColor : loseColor}>{m1.upsolve}%</span><span className="text-[#8b949e]">Upsolve Rate</span><span className={m2.upsolve >= m1.upsolve ? winColor : loseColor}>{m2.upsolve}%</span></div>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* SQUAD TELEMETRY SYNTHESIS (Charts) */}
      <div>
        <h3 className="text-[#8b949e] font-mono text-sm uppercase tracking-widest mb-4 border-b border-[#30363d] pb-2">
          Squad Telemetry Synthesis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-[#1e2024] border border-[#30363d] rounded-xl p-6">
            <h3 className="text-white text-sm font-bold mb-6 font-mono uppercase">Rating Warfare (Trajectory)</h3>
            <div className="h-64"><Line data={lineData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#30363d' }, ticks: { color: '#8b949e', font: { family: 'monospace' } } } }, plugins: { legend: { labels: { color: '#e0e6ed', font: { family: 'monospace' } } } } }} /></div>
          </div>

          <div className="bg-[#1e2024] border border-[#30363d] rounded-xl p-6">
            <h3 className="text-white text-sm font-bold mb-6 font-mono uppercase">Tactical Sprints (Scores)</h3>
            <div className="h-64"><Bar data={sprintData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { color: '#8b949e', font: { family: 'monospace' } } }, y: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } } }, plugins: { legend: { labels: { color: '#e0e6ed', font: { family: 'monospace' } } } } }} /></div>
          </div>

          <div className="bg-[#1e2024] border border-[#30363d] rounded-xl p-6">
            <h3 className="text-white text-sm font-bold mb-2 font-mono uppercase">Efficiency Matrix (New)</h3>
            <p className="text-[#8b949e] text-[10px] uppercase mb-4">First-Try Accuracy vs % of Solves under 30 Mins</p>
            <div className="h-64"><Scatter data={scatterData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'First-Try Accuracy (%)', color: '#8b949e' }, grid: { color: '#30363d' }, ticks: { color: '#8b949e' } }, y: { title: { display: true, text: 'Speed (<30m %)', color: '#8b949e' }, grid: { color: '#30363d' }, ticks: { color: '#8b949e' } } }, plugins: { legend: { labels: { color: '#e0e6ed', font: { family: 'monospace' } } } } }} /></div>
          </div>

          <div className="bg-[#1e2024] border border-[#30363d] rounded-xl p-6">
            <h3 className="text-white text-sm font-bold mb-6 font-mono uppercase">The Triad (Tag Radar)</h3>
            <div className="h-64"><Radar data={radarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: '#30363d' }, grid: { color: '#30363d' }, pointLabels: { color: '#8b949e', font: { family: 'monospace', size: 9 } }, ticks: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { color: '#e0e6ed', font: { family: 'monospace' } } } } }} /></div>
          </div>

        </div>
      </div>

    </div>
  );
}