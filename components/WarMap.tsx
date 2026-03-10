"use client";

import React, { useRef, useState, useMemo, MouseEvent as ReactMouseEvent } from 'react';

// ─── NODE DEFINITIONS ─────────────────────────────────────────────────────────
export const T_NODES: Record<string, any> = {
  impl:        { id:'impl',        label:'Implementation / Sims',      tag:'implementation',            x:3000, y:2500, parent:null },
  constructive:{ id:'constructive',label:'Constructive Algos',         tag:'constructive algorithms',   x:3000, y:2350, parent:'impl' },
  greedy:      { id:'greedy',      label:'Greedy Choices',             tag:'greedy',                    x:3200, y:2500, parent:'impl' },
  sort:        { id:'sort',        label:'Sorting Based Greedy',       tag:'sortings',                  x:3350, y:2450, parent:'greedy' },
  twopt:       { id:'twopt',       label:'Two Pointers / Window',      tag:'two pointers',              x:3200, y:2650, parent:'greedy' },
  mitm:        { id:'mitm',        label:'Meet in the Middle',         tag:'meet-in-the-middle',        x:3350, y:2750, parent:'twopt' },
  bs:          { id:'bs',          label:'Binary Search',              tag:'binary search',             x:2800, y:2600, parent:'impl' },
  bs_ans:      { id:'bs_ans',      label:'BS on Answer',               tag:'binary search',             x:2650, y:2700, parent:'bs' },
  ts:          { id:'ts',          label:'Ternary Search',             tag:'ternary search',            x:2650, y:2850, parent:'bs_ans' },
  wqs:         { id:'wqs',         label:"WQS / Alien's Trick",        tag:'binary search',             x:2500, y:2950, parent:'ts' },
  bit:         { id:'bit',         label:'Bit Manipulation',           tag:'bitmasks',                  x:2800, y:2400, parent:'impl' },
  math:        { id:'math',        label:'Basic Math / GCD',           tag:'math',                      x:3800, y:2000, parent:'impl' },
  primes:      { id:'primes',      label:'Primality Testing',          tag:'number theory',             x:3950, y:1900, parent:'math' },
  sieve:       { id:'sieve',       label:'Sieve of Eratosthenes',      tag:'number theory',             x:4150, y:1850, parent:'primes' },
  mod:         { id:'mod',         label:'Modular Arithmetic',         tag:'math',                      x:3950, y:2100, parent:'math' },
  crt:         { id:'crt',         label:'Chinese Remainder (CRT)',    tag:'number theory',             x:4150, y:2050, parent:'mod' },
  dio:         { id:'dio',         label:'Linear Diophantine',         tag:'math',                      x:4150, y:2200, parent:'mod' },
  phi:         { id:'phi',         label:"Euler's Totient (Phi)",      tag:'number theory',             x:4350, y:2100, parent:'dio' },
  mat:         { id:'mat',         label:'Matrix Exponentiation',      tag:'matrices',                  x:3800, y:1700, parent:'math' },
  fft:         { id:'fft',         label:'FFT / NTT',                  tag:'fft',                       x:4000, y:1600, parent:'mat' },
  mobius:      { id:'mobius',      label:'Möbius Inversion',           tag:'number theory',             x:4200, y:1600, parent:'fft' },
  comb:        { id:'comb',        label:'Combinatorics Basics',       tag:'combinatorics',             x:4500, y:2300, parent:'math' },
  pie:         { id:'pie',         label:'Inclusion-Exclusion (PIE)',  tag:'combinatorics',             x:4700, y:2250, parent:'comb' },
  catalan:     { id:'catalan',     label:'Catalan & Stirling',         tag:'combinatorics',             x:4700, y:2400, parent:'comb' },
  lucas:       { id:'lucas',       label:'Lucas Theorem',              tag:'combinatorics',             x:4900, y:2350, parent:'pie' },
  burnside:    { id:'burnside',    label:"Burnside's Lemma",           tag:'combinatorics',             x:5100, y:2300, parent:'lucas' },
  prob:        { id:'prob',        label:'Probability & Expected',     tag:'probabilities',             x:4500, y:2550, parent:'comb' },
  markov:      { id:'markov',      label:'Markov Chains',              tag:'probabilities',             x:4700, y:2650, parent:'prob' },
  bfs:         { id:'bfs',         label:'BFS / 0-1 BFS',             tag:'graphs',                    x:2600, y:3100, parent:'bs' },
  dfs:         { id:'dfs',         label:'DFS & Components',           tag:'dfs and similar',           x:2800, y:3200, parent:'bfs' },
  sp:          { id:'sp',          label:'Shortest Paths (Dijkstra)',  tag:'shortest paths',            x:2500, y:3350, parent:'bfs' },
  mst:         { id:'mst',         label:'Minimum Spanning Tree',      tag:'graphs',                    x:2700, y:3400, parent:'dfs' },
  topo:        { id:'topo',        label:'Topological Sort',           tag:'graphs',                    x:2900, y:3450, parent:'dfs' },
  scc:         { id:'scc',         label:'SCC (Tarjan/Kosaraju)',      tag:'graphs',                    x:2800, y:3650, parent:'topo' },
  art:         { id:'art',         label:'Articulation & Bridges',     tag:'graphs',                    x:3050, y:3600, parent:'dfs' },
  euler:       { id:'euler',       label:'Eulerian Path',              tag:'graphs',                    x:3250, y:3700, parent:'art' },
  sat:         { id:'sat',         label:'2-SAT Logic',                tag:'2-sat',                     x:2800, y:3850, parent:'scc' },
  flow:        { id:'flow',        label:'Maximum Flow',               tag:'flows',                     x:2400, y:3600, parent:'sp' },
  bip:         { id:'bip',         label:'Bipartite Matching',         tag:'graph matchings',           x:2550, y:3750, parent:'flow' },
  mcmf:        { id:'mcmf',        label:'Min-Cost Max-Flow',          tag:'flows',                     x:2350, y:3850, parent:'flow' },
  tree:        { id:'tree',        label:'Tree Basics & Diameter',     tag:'trees',                     x:3200, y:3200, parent:'dfs' },
  lca:         { id:'lca',         label:'Lowest Common Ancestor',     tag:'trees',                     x:3400, y:3350, parent:'tree' },
  euler_tour:  { id:'euler_tour',  label:'Euler Tour / Flattening',    tag:'trees',                     x:3600, y:3300, parent:'lca' },
  sack:        { id:'sack',        label:'DSU on Trees (Sack)',        tag:'trees',                     x:3600, y:3500, parent:'euler_tour' },
  hld:         { id:'hld',         label:'Heavy-Light Decomp',         tag:'trees',                     x:3800, y:3400, parent:'lca' },
  cent:        { id:'cent',        label:'Centroid Decomp',            tag:'trees',                     x:3800, y:3600, parent:'lca' },
  vtree:       { id:'vtree',       label:'Virtual Trees',              tag:'trees',                     x:4000, y:3500, parent:'lca' },
  stack:       { id:'stack',       label:'Stacks, Queues, Deques',     tag:'data structures',           x:2500, y:2200, parent:'impl' },
  mono:        { id:'mono',        label:'Monotonic Stacks/Qs',        tag:'data structures',           x:2300, y:2100, parent:'stack' },
  ps:          { id:'ps',          label:'Prefix Sums / Diff Arrays',  tag:'data structures',           x:2300, y:2300, parent:'stack' },
  st:          { id:'st',          label:'Sparse Table (RMQ)',         tag:'data structures',           x:2100, y:2200, parent:'ps' },
  bitds:       { id:'bitds',       label:'Fenwick Tree (BIT)',         tag:'data structures',           x:2100, y:2400, parent:'ps' },
  seg:         { id:'seg',         label:'Segment Tree',               tag:'data structures',           x:1900, y:2300, parent:'bitds' },
  lazy:        { id:'lazy',        label:'SegTree Lazy Prop',          tag:'data structures',           x:1700, y:2200, parent:'seg' },
  dsu:         { id:'dsu',         label:'Disjoint Set Union',         tag:'dsu',                       x:2400, y:2500, parent:'stack' },
  dsu_roll:    { id:'dsu_roll',    label:'DSU with Rollbacks',         tag:'dsu',                       x:2200, y:2600, parent:'dsu' },
  sqrt:        { id:'sqrt',        label:'SQRT Decomposition',         tag:'data structures',           x:1900, y:2500, parent:'seg' },
  mo:          { id:'mo',          label:"Mo's Algorithm",             tag:'data structures',           x:1700, y:2600, parent:'sqrt' },
  pers:        { id:'pers',        label:'Persistent Data Structs',    tag:'data structures',           x:1500, y:2300, parent:'lazy' },
  treap:       { id:'treap',       label:'Implicit Treap / Splay',     tag:'data structures',           x:1400, y:2100, parent:'lazy' },
  dp1:         { id:'dp1',         label:'1D / 2D DP Basics',         tag:'dp',                        x:3000, y:1800, parent:'impl' },
  lcs:         { id:'lcs',         label:'Knapsack & LCS',             tag:'dp',                        x:2800, y:1650, parent:'dp1' },
  lis:         { id:'lis',         label:'LIS (O(N log N))',           tag:'dp',                        x:3200, y:1650, parent:'dp1' },
  dp_str:      { id:'dp_str',      label:'DP on Strings',              tag:'dp',                        x:2800, y:1450, parent:'lcs' },
  dp_grid:     { id:'dp_grid',     label:'DP on Grids',                tag:'dp',                        x:2600, y:1550, parent:'lcs' },
  bitdp:       { id:'bitdp',       label:'Bitmask DP',                 tag:'dp',                        x:3200, y:1450, parent:'lis' },
  digdp:       { id:'digdp',       label:'Digit DP',                   tag:'dp',                        x:3400, y:1350, parent:'bitdp' },
  treedp:      { id:'treedp',      label:'DP on Trees (In-Out)',       tag:'dp',                        x:3000, y:1350, parent:'dp1' },
  cht:         { id:'cht',         label:'Convex Hull Trick / Li Chao',tag:'dp',                        x:2600, y:1300, parent:'dp_grid' },
  dc:          { id:'dc',          label:'Divide & Conquer Opt',       tag:'dp',                        x:2400, y:1200, parent:'cht' },
  sos:         { id:'sos',         label:'SOS DP / FWHT',              tag:'dp',                        x:3300, y:1200, parent:'bitdp' },
  hash:        { id:'hash',        label:'Rolling Hash',               tag:'strings',                   x:4000, y:1300, parent:'math' },
  kmp:         { id:'kmp',         label:'KMP / Pi Array',             tag:'strings',                   x:4200, y:1200, parent:'hash' },
  z:           { id:'z',           label:'Z-Algorithm',                tag:'strings',                   x:4400, y:1100, parent:'kmp' },
  trie:        { id:'trie',        label:'Trie (Prefix Tree)',         tag:'strings',                   x:4300, y:1350, parent:'hash' },
  aho:         { id:'aho',         label:'Aho-Corasick',               tag:'strings',                   x:4500, y:1250, parent:'trie' },
  manacher:    { id:'manacher',    label:"Manacher's Algorithm",       tag:'strings',                   x:4600, y:1000, parent:'z' },
  sa:          { id:'sa',          label:'Suffix Array + LCP',         tag:'string suffix structures',  x:4700, y:1150, parent:'aho' },
  sam:         { id:'sam',         label:'Suffix Automaton (SAM)',     tag:'string suffix structures',  x:4900, y:1050, parent:'sa' },
  palindromic: { id:'palindromic', label:'Palindromic Tree',           tag:'strings',                   x:4800, y:1300, parent:'trie' },
  game:        { id:'game',        label:'Combinatorial Games',        tag:'games',                     x:4200, y:2600, parent:'comb' },
  nim:         { id:'nim',         label:'Standard Nim / Variations',  tag:'games',                     x:4400, y:2750, parent:'game' },
  grundy:      { id:'grundy',      label:'Sprague-Grundy Theorem',     tag:'games',                     x:4600, y:2900, parent:'nim' },
  geo:         { id:'geo',         label:'Vectors & Basic Geo',        tag:'geometry',                  x:2000, y:2800, parent:'impl' },
  hull:        { id:'hull',        label:'Convex Hull',                tag:'geometry',                  x:1800, y:2950, parent:'geo' },
  sweep:       { id:'sweep',       label:'Sweep Line Algorithm',       tag:'geometry',                  x:1600, y:3100, parent:'hull' },
  halfplane:   { id:'halfplane',   label:'Half-Plane Intersect',       tag:'geometry',                  x:1400, y:3250, parent:'sweep' },
};

// ─── XP / LEVEL SYSTEM ────────────────────────────────────────────────────────
const SCORE_MAP: Record<number, number> = {
  800:15, 900:20, 1000:30, 1100:45, 1200:65, 1300:90,
  1400:130, 1500:180, 1600:250, 1700:350, 1800:500, 1900:720,
  2000:1050, 2100:1530, 2200:2250, 2300:3300, 2400:4800,
};

function getPts(rating: number): number {
  const r = Math.min(Math.floor(rating / 100) * 100, 2400);
  return SCORE_MAP[Math.max(r, 800)] ?? 10;
}

function getDecay(daysAgo: number): number {
  if (daysAgo <= 30)  return 1.0;
  if (daysAgo <= 90)  return 0.7;
  if (daysAgo <= 180) return 0.4;
  return 0.15;
}

const LEVELS = [
  { lv:0, name:'SCOUTED',    xp:0 },
  { lv:1, name:'OUTPOST',    xp:100 },
  { lv:2, name:'SETTLEMENT', xp:500 },
  { lv:3, name:'KEEP',       xp:2000 },
  { lv:4, name:'FORTRESS',   xp:8000 },
  { lv:5, name:'CITADEL',    xp:25000 },
  { lv:6, name:'LEGENDARY',  xp:80000 },
];

function getLevel(xp: number) {
  let lv = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.xp) lv = l; else break; }
  return lv;
}

// ─── ARCHITECTURE ─────────────────────────────────────────────────────────────
const ARCH_TIERS = [
  { minLv:6, minR:2200, color:'#f85149', name:'LEGENDARY',  shadow:'0 0 30px rgba(248,81,73,0.55)',  border:'#f85149', bg:'rgba(248,81,73,0.08)' },
  { minLv:5, minR:1900, color:'#e3b341', name:'CITADEL',    shadow:'0 0 20px rgba(227,179,65,0.45)', border:'#e3b341', bg:'rgba(227,179,65,0.08)' },
  { minLv:4, minR:1500, color:'#d2a8ff', name:'FORTRESS',   shadow:'0 0 14px rgba(210,168,255,0.35)',border:'#d2a8ff', bg:'rgba(210,168,255,0.06)' },
  { minLv:3, minR:1300, color:'#58a6ff', name:'KEEP',       shadow:'',                               border:'#58a6ff', bg:'rgba(88,166,255,0.06)' },
  { minLv:2, minR:1100, color:'#56d364', name:'SETTLEMENT', shadow:'',                               border:'#56d364', bg:'rgba(86,211,100,0.06)' },
  { minLv:1, minR:800,  color:'#8b949e', name:'OUTPOST',    shadow:'',                               border:'#8b949e', bg:'rgba(139,148,158,0.04)' },
];

function getArch(lv: number, maxR: number) {
  for (const a of ARCH_TIERS) {
    if (lv >= a.minLv && maxR >= a.minR) return a;
  }
  return null;
}

// ─── GARRISON ─────────────────────────────────────────────────────────────────
type Garrison = 'RUINS'|'REBELLION'|'CRUMBLING'|'FORTIFIED'|'HOLDING'|'SCOUTED'|'OCCUPIED';

function getGarrison(lv: number, netXp: number, grossXp: number, solved: number, failed: number, lastAcDays: number): Garrison {
  if (lv === 0 && grossXp === 0) return 'SCOUTED';
  if (grossXp > 0 && netXp < 50) return 'RUINS';
  if (lv > 0) {
    const curThresh = LEVELS[lv].xp;
    const prevThresh = LEVELS[lv - 1].xp;
    const band = curThresh - prevThresh;
    if (band > 0 && (netXp - prevThresh) / band < 0.2) return 'CRUMBLING';
  }
  if (failed > solved && solved > 0) return 'REBELLION';
  if (lv >= 4 && lastAcDays <= 14) return 'FORTIFIED';
  if (lv >= 2 && lv <= 3 && lastAcDays <= 30) return 'HOLDING';
  return 'OCCUPIED';
}

const G_META: Record<Garrison, { label: string; color: string }> = {
  RUINS:     { label:'💀 RUINS',     color:'#8b0000' },
  REBELLION: { label:'🔴 REBELLION', color:'#db6d28' },
  CRUMBLING: { label:'🟠 CRUMBLING', color:'#e3b341' },
  FORTIFIED: { label:'🟢 FORTIFIED', color:'#56d364' },
  HOLDING:   { label:'🟡 HOLDING',   color:'#e3b341' },
  SCOUTED:   { label:'⚪ SCOUTED',   color:'#444' },
  OCCUPIED:  { label:'',             color:'' },
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function WarMap({ subs }: { subs: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: -2300, y: -2100 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const mapNodes = useMemo(() => Object.values(T_NODES), []);
  const now = Date.now() / 1000;

  const mapState = useMemo(() => {
    const state: Record<string, any> = {};
    mapNodes.forEach(n => {
      state[n.id] = { netXp:0, grossXp:0, penaltyXp:0, maxR:0, lastAcTs:0, acPids:new Set<string>(), failPids:new Set<string>() };
    });

    subs.forEach(s => {
      if (!s.problem?.tags) return;
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      const r = s.problem.rating || 800;
      const pts = getPts(r);
      const daysAgo = (now - s.creationTimeSeconds) / 86400;
      const isAC = s.verdict === 'OK';

      mapNodes.forEach(n => {
        if (!s.problem.tags.includes(n.tag)) return;
        const st = state[n.id];
        if (isAC) {
          if (!st.acPids.has(pid)) {
            st.acPids.add(pid);
            st.failPids.delete(pid);
            const xp = pts * getDecay(daysAgo);
            st.grossXp += xp;
            st.netXp += xp;
            if (r > st.maxR) st.maxR = r;
            if (s.creationTimeSeconds > st.lastAcTs) st.lastAcTs = s.creationTimeSeconds;
          }
        } else if (s.verdict !== 'COMPILATION_ERROR') {
          if (!st.acPids.has(pid) && !st.failPids.has(pid)) {
            st.failPids.add(pid);
            const pen = pts * 0.3;
            st.penaltyXp += pen;
            st.netXp -= pen;
          }
        }
      });
    });

    mapNodes.forEach(n => {
      const st = state[n.id];
      const netClamped = Math.max(0, st.netXp);
      const lvData = getLevel(netClamped);
      st.lv = lvData.lv;
      st.lvName = lvData.name;
      st.arch = getArch(st.lv, st.maxR);
      const lastAcDays = st.lastAcTs > 0 ? (now - st.lastAcTs) / 86400 : 9999;
      st.garrison = getGarrison(st.lv, st.netXp, st.grossXp, st.acPids.size, st.failPids.size, lastAcDays);
      const isRoot = n.parent === null;
      const parentActive = n.parent && state[n.parent]?.lv > 0;
      const hasActiveChild = mapNodes.some(c => c.parent === n.id && state[c.id]?.lv > 0);
      st.isRevealed = isRoot || !!parentActive || hasActiveChild || st.lv > 0;
    });

    return state;
  }, [subs]);

  const onMouseDown = (e: ReactMouseEvent) => {
    if ((e.target as Element).closest('.no-drag')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging.current) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => { isDragging.current = false; };
  const onWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = (mx - pan.x) / scale, wy = (my - pan.y) / scale;
    const ns = Math.min(Math.max(0.2, scale + (e.deltaY > 0 ? -0.1 : 0.1)), 3.0);
    setScale(ns);
    setPan({ x: mx - wx * ns, y: my - wy * ns });
  };

  return (
    <div ref={containerRef}
      className="relative w-full h-[800px] bg-black border border-[#30363d] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing shadow-[inset_0_0_120px_rgba(0,0,0,1)] select-none"
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
    >
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none z-40 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 no-drag">
        {(['+', '−', '⌂'] as const).map((lbl) => (
          <button key={lbl} onClick={() => {
            if (lbl === '+') setScale(s => Math.min(s + 0.2, 3.0));
            else if (lbl === '−') setScale(s => Math.max(s - 0.2, 0.2));
            else { setScale(1); setPan({ x: -2300, y: -2100 }); }
          }} className="w-10 h-10 bg-[#0d1117]/90 border border-[#30363d] text-white rounded hover:bg-[#e3b341] hover:text-black transition-colors shadow-lg text-xl no-drag">{lbl}</button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-50 bg-[#0d1117]/95 border border-[#30363d] p-4 rounded-xl font-mono text-[10px] text-[#8b949e] no-drag backdrop-blur-md w-[210px]">
        <div className="text-[#e3b341] font-bold text-xs mb-2">⚔ Architecture</div>
        {ARCH_TIERS.map(a => (
          <div key={a.name} className="flex items-center gap-2 mb-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ border: `1px solid ${a.color}`, background: a.bg }} />
            <span style={{ color: a.color }}>{a.name}</span>
            <span className="text-[#333] ml-auto text-[9px]">Lv{a.minLv}+{a.minR}+</span>
          </div>
        ))}
        <div className="border-t border-[#21262d] my-2" />
        <div className="text-[#e3b341] font-bold text-xs mb-2">🏴 Garrison</div>
        {(['RUINS','REBELLION','CRUMBLING','FORTIFIED','HOLDING'] as Garrison[]).map(g => (
          <div key={g} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: G_META[g].color }} />
            <span style={{ color: G_META[g].color }}>{G_META[g].label}</span>
          </div>
        ))}
        <div className="border-t border-[#21262d] my-2" />
        <div className="text-[#e3b341] font-bold text-xs mb-1.5">📉 XP Decay</div>
        {[['0–30d','100%','#56d364'],['30–90d','70%','#e3b341'],['90–180d','40%','#db6d28'],['180d+','15%','#f85149']].map(([d,p,c])=>(
          <div key={d} className="flex justify-between mb-1"><span>{d}</span><span style={{color:c}}>{p}</span></div>
        ))}
        <div className="text-[#333] text-[9px] mt-2">WA: −30% pts per unique unsolved fail</div>
      </div>

      {/* Canvas */}
      <div className="absolute origin-top-left" style={{
        width:6000, height:5000,
        transform:`matrix(${scale},0,0,${scale},${pan.x},${pan.y})`,
        willChange:'transform',
        backgroundImage:'linear-gradient(rgba(48,54,61,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(48,54,61,0.1) 1px,transparent 1px)',
        backgroundSize:'100px 100px',
      }}>
        {/* Zone labels */}
        {([[2400,2800,'Implementation & Logic'],[1400,4200,'Math & Combinatorics'],[3600,2400,'Graphs & Trees'],[1400,1600,'Data Vaults']] as [number,number,string][]).map(([t,l,txt])=>(
          <div key={txt} className="absolute font-mono font-black uppercase text-white/[0.025] pointer-events-none text-6xl tracking-[16px]" style={{top:t,left:l}}>{txt}</div>
        ))}

        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {mapNodes.map(n => {
            if (!n.parent || !T_NODES[n.parent]) return null;
            const p = T_NODES[n.parent];
            const pSt = mapState[p.id], nSt = mapState[n.id];
            if (!pSt?.isRevealed || !nSt?.isRevealed) return null;
            const active = pSt.lv > 0 && nSt.lv > 0;
            const sx=p.x+95, sy=p.y+35, ex=n.x+95, ey=n.y+35;
            const color = active ? ((nSt.arch?.color ?? '#58a6ff') + '77') : 'rgba(48,54,61,0.25)';
            return (
              <path key={`e-${n.id}`}
                d={`M ${sx} ${sy} Q ${(sx+ex)/2} ${(sy+ey)/2-80} ${ex} ${ey}`}
                stroke={color} strokeWidth={active ? 2.5 : 1.5}
                strokeDasharray={active ? (nSt.garrison==='RUINS'?'4 4':'') : '6 6'}
                fill="none" />
            );
          })}
        </svg>

        {/* Nodes */}
        {mapNodes.map(n => {
          const st = mapState[n.id];
          if (!st?.isRevealed) return null;

          const isScouted = st.lv === 0;
          const arch = st.arch;
          const gMeta = G_META[st.garrison as Garrison];
          const netXpClamped = Math.max(0, st.netXp);
          const curLv = LEVELS[st.lv];
          const nextLv = LEVELS[Math.min(st.lv + 1, 6)];
          const bandSize = nextLv.xp - curLv.xp;
          const xpPct = st.lv >= 6 ? 100 : Math.min(100, ((netXpClamped - curLv.xp) / bandSize) * 100);
          const decayLoss = st.grossXp - netXpClamped - st.penaltyXp;
          const showDecayWarn = st.grossXp > 0 && decayLoss / st.grossXp > 0.2;

          const borderColor = isScouted ? '#21262d' : (arch?.border ?? '#21262d');
          const bgColor = isScouted ? 'transparent' : (arch?.bg ?? 'transparent');
          const boxShadow = [
            '0 4px 15px rgba(0,0,0,0.8)',
            arch?.shadow ?? '',
            st.garrison === 'REBELLION' ? '0 0 18px rgba(219,109,40,0.45)' : '',
            st.garrison === 'CRUMBLING' ? '0 0 12px rgba(227,179,65,0.3)' : '',
            st.garrison === 'FORTIFIED' ? '0 0 20px rgba(86,211,100,0.4)' : '',
            st.garrison === 'RUINS'     ? '0 0 15px rgba(139,0,0,0.5)' : '',
          ].filter(Boolean).join(', ');

          return (
            <div key={n.id}
              className="absolute w-[195px] rounded-xl z-20 flex flex-col transition-all hover:scale-110 hover:z-50 border-2"
              style={{
                left:n.x, top:n.y,
                borderColor,
                background: st.garrison === 'RUINS'
                  ? 'repeating-linear-gradient(45deg,#0d0505,#0d0505 8px,#120303 8px,#120303 16px)'
                  : bgColor,
                boxShadow,
                opacity: isScouted ? 0.3 : 1,
                borderStyle: isScouted ? 'dashed' : 'solid',
              }}
            >
              {/* Garrison badge */}
              {st.garrison !== 'OCCUPIED' && st.garrison !== 'SCOUTED' && gMeta.label && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded z-10 text-black font-mono"
                  style={{ background: gMeta.color }}>
                  {gMeta.label}
                </div>
              )}

              <div className="p-3 flex flex-col gap-1.5">
                {/* Level chip */}
                <div className="flex items-center">
                  {!isScouted && arch ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
                      style={{ background:`${arch.color}18`, color:arch.color, border:`1px solid ${arch.color}33` }}>
                      LV{st.lv} {st.lvName}
                    </span>
                  ) : (
                    <span className="text-[9px] text-[#333] font-mono">LV0 SCOUTED</span>
                  )}
                </div>

                {/* Label */}
                <div className={`font-bold text-[12px] leading-tight ${isScouted ? 'text-[#2a2a2a]' : 'text-white'}`}>
                  {isScouted ? '???' : n.label}
                </div>

                {!isScouted && (
                  <>
                    {/* XP bar */}
                    <div className="mt-0.5">
                      <div className="flex justify-between text-[9px] font-mono mb-1" style={{ color: arch?.color ?? '#555' }}>
                        <span>{Math.floor(netXpClamped).toLocaleString()} XP</span>
                        <span>{st.lv < 6 ? `→ ${nextLv.xp.toLocaleString()}` : 'MAX'}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{ width:`${xpPct}%`, background: arch?.color ?? '#555', transition:'width 0.3s' }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-[9px] font-mono border-t pt-1.5 mt-0.5" style={{ borderColor:'rgba(255,255,255,0.05)', color:'#555' }}>
                      <span style={{ color:'#56d364' }}>AC {st.acPids.size}</span>
                      <span style={{ color: st.failPids.size > st.acPids.size ? '#f85149' : '#8b949e' }}>WA {st.failPids.size}</span>
                      <span style={{ color:'#8b949e' }}>R {st.maxR || '—'}</span>
                    </div>

                    {/* Decay warning */}
                    {showDecayWarn && (
                      <div className="text-[8px] font-mono" style={{ color:'#e3b341', opacity:0.7 }}>
                        ⚠ −{Math.floor(decayLoss).toLocaleString()} XP decayed
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
