"use client";

import React, { useRef, useState, useMemo, MouseEvent as ReactMouseEvent } from 'react';

// ─── THEME PALETTE (ROYAL ACADEMIC) ───────────────────────────────────────────
const theme = {
  bg:      '#0b090a',       // Deep obsidian
  surface: '#151314',       // Dark charcoal velvet
  sh:      'rgba(212, 175, 55, 0.15)', // Tarnished gold border
  text:    '#f0e6d2',       // Ivory/Parchment
  muted:   '#9c8973',       // Antique gold
  accent:  '#d4af37',       // Royal Gold
  stop:    '#8b0000',       // Crimson
  ok:      '#2e8b57',       // Emerald
};

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

// ─── ARCHITECTURE (ROYAL UPGRADE) ─────────────────────────────────────────────
const ARCH_TIERS = [
  { minLv:6, minR:2200, color:'#dc143c', name:'LEGENDARY',  shadow:'0 0 40px rgba(220, 20, 60, 0.6)', border:'#dc143c', bg:'rgba(220, 20, 60, 0.1)' },
  { minLv:5, minR:1900, color:'#d4af37', name:'CITADEL',    shadow:'0 0 30px rgba(212, 175, 55, 0.5)', border:'#d4af37', bg:'rgba(212, 175, 55, 0.1)' },
  { minLv:4, minR:1500, color:'#9932cc', name:'FORTRESS',   shadow:'0 0 20px rgba(153, 50, 204, 0.4)', border:'#9932cc', bg:'rgba(153, 50, 204, 0.1)' },
  { minLv:3, minR:1300, color:'#4169e1', name:'KEEP',       shadow:'0 0 15px rgba(65, 105, 225, 0.3)', border:'#4169e1', bg:'rgba(65, 105, 225, 0.08)' },
  { minLv:2, minR:1100, color:'#2e8b57', name:'SETTLEMENT', shadow:'0 0 10px rgba(46, 139, 87, 0.2)',  border:'#2e8b57', bg:'rgba(46, 139, 87, 0.06)' },
  { minLv:1, minR:800,  color:'#a89984', name:'OUTPOST',    shadow:'',                                 border:'#a89984', bg:'rgba(168, 153, 132, 0.05)' },
];

function getArch(lv: number, maxR: number) {
  for (const a of ARCH_TIERS) {
    if (lv >= a.minLv && maxR >= a.minR) return a;
  }
  return null;
}

// ─── GARRISON (LORE UPGRADE) ──────────────────────────────────────────────────
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

const G_META: Record<Garrison, { label: string; color: string; bg: string }> = {
  RUINS:     { label:'🏚️ FALLEN',     color:'#8b0000', bg:'#1a0505' },
  REBELLION: { label:'⚔️ REBELLION', color:'#dc143c', bg:'#2a0808' },
  CRUMBLING: { label:'⚖️ CRUMBLING', color:'#d4af37', bg:'#2a2008' },
  FORTIFIED: { label:'🛡️ FORTIFIED', color:'#2e8b57', bg:'#081f12' },
  HOLDING:   { label:'⚜️ HOLDING',   color:'#4169e1', bg:'#0a122a' },
  SCOUTED:   { label:'📜 SCOUTED',   color:'#9c8973', bg:'#1c1a17' },
  OCCUPIED:  { label:'',             color:'',        bg:'' },
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
      className="relative w-full h-[800px] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ background: theme.bg, border: `1px solid ${theme.sh}`, boxShadow: 'inset 0 0 150px rgba(0,0,0,0.9)' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
    >
      <style>{`
        .royal-serif { font-family: 'Georgia', 'Times New Roman', serif; }
        @keyframes pulse-rebellion { 0% { box-shadow: 0 0 10px rgba(220, 20, 60, 0.4); } 50% { box-shadow: 0 0 25px rgba(220, 20, 60, 0.8); } 100% { box-shadow: 0 0 10px rgba(220, 20, 60, 0.4); } }
      `}</style>

      {/* Vignette Shadow */}
      <div className="absolute inset-0 pointer-events-none z-40 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(10,9,10,0.95)_100%)]" />

      {/* Brass Zoom Controls */}
      <div className="absolute top-6 right-6 z-50 flex flex-col gap-3 no-drag">
        {(['+', '−', '⌂'] as const).map((lbl) => (
          <button key={lbl} onClick={() => {
            if (lbl === '+') setScale(s => Math.min(s + 0.2, 3.0));
            else if (lbl === '−') setScale(s => Math.max(s - 0.2, 0.2));
            else { setScale(1); setPan({ x: -2300, y: -2100 }); }
          }} 
          className="w-10 h-10 flex items-center justify-center rounded transition-all shadow-xl no-drag royal-serif text-xl"
          style={{ 
            background: 'linear-gradient(145deg, rgba(30,28,29,0.9), rgba(15,13,14,0.9))',
            border: `1px solid ${theme.sh}`,
            color: theme.accent
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.color = theme.bg; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'linear-gradient(145deg, rgba(30,28,29,0.9), rgba(15,13,14,0.9))'; e.currentTarget.style.color = theme.accent; }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Cartographer's Key (Legend) */}
      <div className="absolute bottom-6 left-6 z-50 p-5 rounded-xl no-drag w-[240px]"
           style={{ 
             background: 'linear-gradient(135deg, rgba(21,19,20,0.95) 0%, rgba(10,9,10,0.98) 100%)', 
             border: `1px solid ${theme.sh}`,
             boxShadow: '0 10px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(212, 175, 55, 0.05)',
             backdropFilter: 'blur(10px)'
           }}>
        
        <div className="royal-serif text-center uppercase tracking-widest text-[11px] mb-4 pb-2 border-b" style={{ color: theme.accent, borderColor: theme.sh }}>
          Cartographer's Key
        </div>

        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: theme.muted }}>⚜️ Architecture Tiers</div>
        {ARCH_TIERS.map(a => (
          <div key={a.name} className="flex items-center gap-3 mb-2 font-mono text-[10px]">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ border: `1px solid ${a.color}`, background: a.bg, boxShadow: `0 0 5px ${a.color}` }} />
            <span style={{ color: a.color }}>{a.name}</span>
            <span className="ml-auto opacity-50 text-[9px]" style={{ color: theme.text }}>Lv{a.minLv} / R{a.minR}+</span>
          </div>
        ))}

        <div className="border-t my-3" style={{ borderColor: 'rgba(212, 175, 55, 0.1)' }} />
        
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: theme.muted }}>🏴 Territory States</div>
        {(['RUINS','REBELLION','CRUMBLING','FORTIFIED','HOLDING'] as Garrison[]).map(g => (
          <div key={g} className="flex items-center gap-3 mb-1.5 font-mono text-[9px]">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: G_META[g].color, boxShadow: `0 0 4px ${G_META[g].color}` }} />
            <span style={{ color: G_META[g].color }}>{G_META[g].label}</span>
          </div>
        ))}

        <div className="border-t my-3" style={{ borderColor: 'rgba(212, 175, 55, 0.1)' }} />
        
        <div className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: theme.muted }}>⏳ Attrition Rules</div>
        {[['0–30d','100%','#2e8b57'],['30–90d','70%','#d4af37'],['90–180d','40%','#dc143c'],['180d+','15%','#8b0000']].map(([d,p,c])=>(
          <div key={d} className="flex justify-between mb-1 font-mono text-[9px]" style={{ color: theme.text }}>
            <span>{d}</span><span style={{color:c, fontWeight: 'bold'}}>{p}</span>
          </div>
        ))}
        <div className="text-[8px] mt-2 font-mono text-center opacity-60" style={{ color: theme.text }}>
          Failed Incursions: −30% XP
        </div>
      </div>

      {/* The War Table Canvas */}
      <div className="absolute origin-top-left transition-transform duration-75" style={{
        width:6000, height:5000,
        transform:`matrix(${scale},0,0,${scale},${pan.x},${pan.y})`,
        willChange:'transform',
        backgroundImage:`linear-gradient(${theme.sh} 1px, transparent 1px), linear-gradient(90deg, ${theme.sh} 1px, transparent 1px)`,
        backgroundSize:'100px 100px',
      }}>
        
        {/* Giant Watermark Zone Labels */}
        {([[2400,2800,'Implementation & Tactics'],[1400,4200,'Math & Combinatorics'],[3600,2400,'Networks & Trees'],[1400,1600,'Data Vaults']] as [number,number,string][]).map(([t,l,txt])=>(
          <div key={txt} className="absolute royal-serif font-black uppercase pointer-events-none text-7xl tracking-[24px]" 
               style={{ top:t, left:l, color: 'rgba(212, 175, 55, 0.03)', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {txt}
          </div>
        ))}

        {/* Glowing Supply Lines (Edges) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {mapNodes.map(n => {
            if (!n.parent || !T_NODES[n.parent]) return null;
            const p = T_NODES[n.parent];
            const pSt = mapState[p.id], nSt = mapState[n.id];
            if (!pSt?.isRevealed || !nSt?.isRevealed) return null;
            
            const active = pSt.lv > 0 && nSt.lv > 0;
            const sx=p.x+95, sy=p.y+35, ex=n.x+95, ey=n.y+35;
            
            // Determine path color and style based on state
            let color = 'rgba(156, 137, 115, 0.15)'; // Default faint bronze
            let strokeWidth = 1.5;
            let dash = '6 8';
            
            if (active) {
              if (nSt.garrison === 'RUINS' || nSt.garrison === 'CRUMBLING') {
                color = 'rgba(139, 0, 0, 0.6)'; // Broken red supply line
                dash = '4 6';
              } else {
                color = 'rgba(212, 175, 55, 0.6)'; // Glowing gold supply line
                strokeWidth = 2.5;
                dash = '';
              }
            }

            return (
              <path key={`e-${n.id}`}
                d={`M ${sx} ${sy} Q ${(sx+ex)/2} ${(sy+ey)/2-80} ${ex} ${ey}`}
                stroke={color} strokeWidth={strokeWidth}
                strokeDasharray={dash}
                fill="none" 
                style={{ filter: active && nSt.garrison !== 'RUINS' ? `drop-shadow(0 0 5px ${color})` : 'none' }}
              />
            );
          })}
        </svg>

        {/* Territory Nodes (Plaques) */}
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

          // Plaque Styling
          const borderColor = isScouted ? theme.sh : (arch?.border ?? theme.sh);
          const bgColor = isScouted ? 'transparent' : `linear-gradient(145deg, ${theme.surface} 0%, #0a090a 100%)`;
          const boxShadow = [
            '0 8px 25px rgba(0,0,0,0.9)',
            arch?.shadow ?? '',
            !isScouted ? `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 15px ${arch?.bg ?? 'transparent'}` : ''
          ].filter(Boolean).join(', ');

          const isRebellion = st.garrison === 'REBELLION';

          return (
            <div key={n.id}
              className="absolute w-[195px] rounded-sm z-20 flex flex-col transition-all duration-300 hover:scale-[1.15] hover:z-50 border group"
              style={{
                left:n.x, top:n.y,
                borderColor,
                background: st.garrison === 'RUINS'
                  ? 'repeating-linear-gradient(45deg, #0d0505, #0d0505 8px, #1a0808 8px, #1a0808 16px)'
                  : bgColor,
                boxShadow,
                opacity: isScouted ? 0.4 : 1,
                borderStyle: isScouted ? 'dashed' : 'solid',
                animation: isRebellion ? 'pulse-rebellion 3s infinite' : 'none'
              }}
            >
              {/* Corner Accents for non-scouted */}
              {!isScouted && (
                <>
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l" style={{ borderColor: arch?.color }} />
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r" style={{ borderColor: arch?.color }} />
                  <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l" style={{ borderColor: arch?.color }} />
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r" style={{ borderColor: arch?.color }} />
                </>
              )}

              {/* Garrison Seal */}
              {st.garrison !== 'OCCUPIED' && st.garrison !== 'SCOUTED' && gMeta.label && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded shadow-lg z-10 font-mono tracking-widest border"
                  style={{ background: gMeta.bg, color: gMeta.color, borderColor: gMeta.color }}>
                  {gMeta.label}
                </div>
              )}

              <div className="p-3 flex flex-col gap-2 relative z-10">
                {/* Level chip */}
                <div className="flex items-center">
                  {!isScouted && arch ? (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 font-mono uppercase tracking-widest"
                      style={{ color: arch.color, borderBottom: `1px solid ${arch.color}55` }}>
                      LV{st.lv} {st.lvName}
                    </span>
                  ) : (
                    <span className="text-[8px] text-[#555] font-mono tracking-widest uppercase border-b border-[#333]">LV0 UNCHARTED</span>
                  )}
                </div>

                {/* Territory Label */}
                <div className={`royal-serif font-bold text-[13px] leading-snug tracking-wide ${isScouted ? 'text-[#555]' : 'text-[#f0e6d2]'}`} style={{ textShadow: !isScouted ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>
                  {isScouted ? 'Terra Incognita' : n.label}
                </div>

                {!isScouted && (
                  <>
                    {/* XP Progress (Gold Fill) */}
                    <div className="mt-1">
                      <div className="flex justify-between text-[8px] font-mono mb-1 tracking-wider" style={{ color: arch?.color ?? theme.muted }}>
                        <span>{Math.floor(netXpClamped).toLocaleString()} XP</span>
                        <span>{st.lv < 6 ? `→ ${nextLv.xp.toLocaleString()}` : 'MAXIMUM'}</span>
                      </div>
                      <div className="w-full h-1 bg-[#0a090a] border" style={{ borderColor: 'rgba(212, 175, 55, 0.2)' }}>
                        <div className="h-full relative overflow-hidden" style={{ width:`${xpPct}%`, background: arch?.color ?? theme.muted, transition:'width 0.5s ease-out', boxShadow: `0 0 8px ${arch?.color}` }}>
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-[200%] animate-[translateX_2s_infinite]" />
                        </div>
                      </div>
                    </div>

                    {/* Stats Ledger */}
                    <div className="flex justify-between text-[9px] font-mono border-t pt-2 mt-1 bg-black/20 -mx-1 px-1 rounded" style={{ borderColor:'rgba(212, 175, 55, 0.1)' }}>
                      <span style={{ color: theme.ok }}>AC:{st.acPids.size}</span>
                      <span style={{ color: st.failPids.size > st.acPids.size ? theme.stop : theme.muted }}>WA:{st.failPids.size}</span>
                      <span style={{ color: theme.accent }}>R:{st.maxR || '—'}</span>
                    </div>

                    {/* Decay warning */}
                    {showDecayWarn && (
                      <div className="text-[8px] font-mono tracking-widest text-center mt-1" style={{ color: theme.muted }}>
                        ⚠ −{Math.floor(decayLoss).toLocaleString()} XP ATTRITION
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