"use client";

import React, { useRef, useState, useMemo, useEffect, MouseEvent as ReactMouseEvent } from 'react';

export const T_NODES: Record<string, any> = {
  impl: { id:'impl', label:'Implementation / Sims', tag:'implementation', x:3000, y:2500, parent:null },
  constructive: { id:'constructive', label:'Constructive Algos', tag:'constructive algorithms', x:3000, y:2350, parent:'impl' },
  greedy: { id:'greedy', label:'Greedy Choices', tag:'greedy', x:3200, y:2500, parent:'impl' },
  sort: { id:'sort', label:'Sorting Based Greedy', tag:'sortings', x:3350, y:2450, parent:'greedy' },
  twopt: { id:'twopt', label:'Two Pointers / Window', tag:'two pointers', x:3200, y:2650, parent:'greedy' },
  mitm: { id:'mitm', label:'Meet in the Middle', tag:'meet-in-the-middle', x:3350, y:2750, parent:'twopt' },
  bs: { id:'bs', label:'Binary Search', tag:'binary search', x:2800, y:2600, parent:'impl' },
  bs_ans: { id:'bs_ans', label:'BS on Answer', tag:'binary search', x:2650, y:2700, parent:'bs' },
  ts: { id:'ts', label:'Ternary Search', tag:'ternary search', x:2650, y:2850, parent:'bs_ans' },
  wqs: { id:'wqs', label:'WQS / Alien\'s Trick', tag:'binary search', x:2500, y:2950, parent:'ts' },
  bit: { id:'bit', label:'Bit Manipulation', tag:'bitmasks', x:2800, y:2400, parent:'impl' },
  math: { id:'math', label:'Basic Math / GCD', tag:'math', x:3800, y:2000, parent:'impl' },
  primes: { id:'primes', label:'Primality Testing', tag:'number theory', x:3950, y:1900, parent:'math' },
  sieve: { id:'sieve', label:'Sieve of Eratosthenes', tag:'number theory', x:4150, y:1850, parent:'primes' },
  mod: { id:'mod', label:'Modular Arithmetic', tag:'math', x:3950, y:2100, parent:'math' },
  crt: { id:'crt', label:'Chinese Remainder (CRT)', tag:'number theory', x:4150, y:2050, parent:'mod' },
  dio: { id:'dio', label:'Linear Diophantine', tag:'math', x:4150, y:2200, parent:'mod' },
  phi: { id:'phi', label:'Euler\'s Totient (Phi)', tag:'number theory', x:4350, y:2100, parent:'dio' },
  mat: { id:'mat', label:'Matrix Exponentiation', tag:'matrices', x:3800, y:1700, parent:'math' },
  fft: { id:'fft', label:'FFT / NTT', tag:'fft', x:4000, y:1600, parent:'mat' },
  mobius: { id:'mobius', label:'Möbius Inversion', tag:'number theory', x:4200, y:1600, parent:'fft' },
  comb: { id:'comb', label:'Combinatorics Basics', tag:'combinatorics', x:4500, y:2300, parent:'math' },
  pie: { id:'pie', label:'Inclusion-Exclusion (PIE)', tag:'combinatorics', x:4700, y:2250, parent:'comb' },
  catalan: { id:'catalan', label:'Catalan & Stirling', tag:'combinatorics', x:4700, y:2400, parent:'comb' },
  lucas: { id:'lucas', label:'Lucas Theorem', tag:'combinatorics', x:4900, y:2350, parent:'pie' },
  burnside: { id:'burnside', label:'Burnside\'s Lemma', tag:'combinatorics', x:5100, y:2300, parent:'lucas' },
  prob: { id:'prob', label:'Probability & Expected', tag:'probabilities', x:4500, y:2550, parent:'comb' },
  markov: { id:'markov', label:'Markov Chains', tag:'probabilities', x:4700, y:2650, parent:'prob' },
  bfs: { id:'bfs', label:'BFS / 0-1 BFS', tag:'graphs', x:2600, y:3100, parent:'bs' },
  dfs: { id:'dfs', label:'DFS & Components', tag:'dfs and similar', x:2800, y:3200, parent:'bfs' },
  sp: { id:'sp', label:'Shortest Paths (Dijkstra)', tag:'shortest paths', x:2500, y:3350, parent:'bfs' },
  mst: { id:'mst', label:'Minimum Spanning Tree', tag:'graphs', x:2700, y:3400, parent:'dfs' },
  topo: { id:'topo', label:'Topological Sort', tag:'graphs', x:2900, y:3450, parent:'dfs' },
  scc: { id:'scc', label:'SCC (Tarjan/Kosaraju)', tag:'graphs', x:2800, y:3650, parent:'topo' },
  art: { id:'art', label:'Articulation & Bridges', tag:'graphs', x:3050, y:3600, parent:'dfs' },
  euler: { id:'euler', label:'Eulerian Path', tag:'graphs', x:3250, y:3700, parent:'art' },
  sat: { id:'sat', label:'2-SAT Logic', tag:'2-sat', x:2800, y:3850, parent:'scc' },
  flow: { id:'flow', label:'Maximum Flow', tag:'flows', x:2400, y:3600, parent:'sp' },
  bip: { id:'bip', label:'Bipartite Matching', tag:'graph matchings', x:2550, y:3750, parent:'flow' },
  mcmf: { id:'mcmf', label:'Min-Cost Max-Flow', tag:'flows', x:2350, y:3850, parent:'flow' },
  tree: { id:'tree', label:'Tree Basics & Diameter', tag:'trees', x:3200, y:3200, parent:'dfs' },
  lca: { id:'lca', label:'Lowest Common Ancestor', tag:'trees', x:3400, y:3350, parent:'tree' },
  euler_tour: { id:'euler_tour', label:'Euler Tour / Flattening', tag:'trees', x:3600, y:3300, parent:'lca' },
  sack: { id:'sack', label:'DSU on Trees (Sack)', tag:'trees', x:3600, y:3500, parent:'euler_tour' },
  hld: { id:'hld', label:'Heavy-Light Decomp', tag:'trees', x:3800, y:3400, parent:'lca' },
  cent: { id:'cent', label:'Centroid Decomp', tag:'trees', x:3800, y:3600, parent:'lca' },
  vtree: { id:'vtree', label:'Virtual Trees', tag:'trees', x:4000, y:3500, parent:'lca' },
  stack: { id:'stack', label:'Stacks, Queues, Deques', tag:'data structures', x:2500, y:2200, parent:'impl' },
  mono: { id:'mono', label:'Monotonic Stacks/Qs', tag:'data structures', x:2300, y:2100, parent:'stack' },
  ps: { id:'ps', label:'Prefix Sums / Diff Arrays', tag:'data structures', x:2300, y:2300, parent:'stack' },
  st: { id:'st', label:'Sparse Table (RMQ)', tag:'data structures', x:2100, y:2200, parent:'ps' },
  bitds: { id:'bitds', label:'Fenwick Tree (BIT)', tag:'data structures', x:2100, y:2400, parent:'ps' },
  seg: { id:'seg', label:'Segment Tree', tag:'data structures', x:1900, y:2300, parent:'bitds' },
  lazy: { id:'lazy', label:'SegTree Lazy Prop', tag:'data structures', x:1700, y:2200, parent:'seg' },
  dsu: { id:'dsu', label:'Disjoint Set Union', tag:'dsu', x:2400, y:2500, parent:'stack' },
  dsu_roll: { id:'dsu_roll', label:'DSU with Rollbacks', tag:'dsu', x:2200, y:2600, parent:'dsu' },
  sqrt: { id:'sqrt', label:'SQRT Decomposition', tag:'data structures', x:1900, y:2500, parent:'seg' },
  mo: { id:'mo', label:'Mo\'s Algorithm', tag:'data structures', x:1700, y:2600, parent:'sqrt' },
  pers: { id:'pers', label:'Persistent Data Structs', tag:'data structures', x:1500, y:2300, parent:'lazy' },
  treap: { id:'treap', label:'Implicit Treap / Splay', tag:'data structures', x:1400, y:2100, parent:'lazy' },
  dp1: { id:'dp1', label:'1D / 2D DP Basics', tag:'dp', x:3000, y:1800, parent:'impl' },
  lcs: { id:'lcs', label:'Knapsack & LCS', tag:'dp', x:2800, y:1650, parent:'dp1' },
  lis: { id:'lis', label:'LIS (O(N log N))', tag:'dp', x:3200, y:1650, parent:'dp1' },
  dp_str: { id:'dp_str', label:'DP on Strings', tag:'dp', x:2800, y:1450, parent:'lcs' },
  dp_grid: { id:'dp_grid', label:'DP on Grids', tag:'dp', x:2600, y:1550, parent:'lcs' },
  bitdp: { id:'bitdp', label:'Bitmask DP', tag:'dp', x:3200, y:1450, parent:'lis' },
  digdp: { id:'digdp', label:'Digit DP', tag:'dp', x:3400, y:1350, parent:'bitdp' },
  treedp: { id:'treedp', label:'DP on Trees (In-Out)', tag:'dp', x:3000, y:1350, parent:'dp1' },
  cht: { id:'cht', label:'Convex Hull Trick / Li Chao', tag:'dp', x:2600, y:1300, parent:'dp_grid' },
  dc: { id:'dc', label:'Divide & Conquer Opt', tag:'dp', x:2400, y:1200, parent:'cht' },
  sos: { id:'sos', label:'SOS DP / FWHT', tag:'dp', x:3300, y:1200, parent:'bitdp' },
  hash: { id:'hash', label:'Rolling Hash', tag:'strings', x:4000, y:1300, parent:'math' },
  kmp: { id:'kmp', label:'KMP / Pi Array', tag:'strings', x:4200, y:1200, parent:'hash' },
  z: { id:'z', label:'Z-Algorithm', tag:'strings', x:4400, y:1100, parent:'kmp' },
  trie: { id:'trie', label:'Trie (Prefix Tree)', tag:'strings', x:4300, y:1350, parent:'hash' },
  aho: { id:'aho', label:'Aho-Corasick', tag:'strings', x:4500, y:1250, parent:'trie' },
  manacher: { id:'manacher', label:'Manacher\'s Algorithm', tag:'strings', x:4600, y:1000, parent:'z' },
  sa: { id:'sa', label:'Suffix Array + LCP', tag:'string suffix structures', x:4700, y:1150, parent:'aho' },
  sam: { id:'sam', label:'Suffix Automaton (SAM)', tag:'string suffix structures', x:4900, y:1050, parent:'sa' },
  palindromic: { id:'palindromic', label:'Palindromic Tree', tag:'strings', x:4800, y:1300, parent:'trie' },
  game: { id:'game', label:'Combinatorial Games', tag:'games', x:4200, y:2600, parent:'comb' },
  nim: { id:'nim', label:'Standard Nim / Variations', tag:'games', x:4400, y:2750, parent:'game' },
  grundy: { id:'grundy', label:'Sprague-Grundy Theorem', tag:'games', x:4600, y:2900, parent:'nim' },
  geo: { id:'geo', label:'Vectors & Basic Geo', tag:'geometry', x:2000, y:2800, parent:'impl' },
  hull: { id:'hull', label:'Convex Hull', tag:'geometry', x:1800, y:2950, parent:'geo' },
  sweep: { id:'sweep', label:'Sweep Line Algorithm', tag:'geometry', x:1600, y:3100, parent:'hull' },
  halfplane: { id:'halfplane', label:'Half-Plane Intersect', tag:'geometry', x:1400, y:3250, parent:'sweep' }
};

export default function WarMap({ subs }: { subs: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null); const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1); const [pan, setPan] = useState({ x: -2300, y: -2100 });
  const isDragging = useRef(false); const dragStart = useRef({ x: 0, y: 0 });

  const mapNodes = Object.values(T_NODES);

  const mapState = useMemo(() => {
    const state: Record<string, any> = {}; const now = Date.now() / 1000;
    mapNodes.forEach(n => { state[n.id] = { ac: 0, fail: 0, maxR: 0, lastAC: 0 }; });
    subs.forEach(s => {
      if (!s.problem || !s.problem.tags) return;
      const isAC = s.verdict === 'OK'; const r = s.problem.rating || 800;
      mapNodes.forEach(n => {
        if (s.problem.tags.includes(n.tag)) {
          if (isAC) { state[n.id].ac++; if (r > state[n.id].maxR) state[n.id].maxR = r; if (s.creationTimeSeconds > state[n.id].lastAC) state[n.id].lastAC = s.creationTimeSeconds; } 
          else if (s.verdict !== 'COMPILATION_ERROR') state[n.id].fail++;
        }
      });
    });
    mapNodes.forEach(n => {
      const isRoot = n.parent === null; const parentOccupied = n.parent && state[n.parent].ac > 0;
      let hasOccupiedChild = false; mapNodes.forEach(child => { if (child.parent === n.id && state[child.id].ac > 0) hasOccupiedChild = true; });
      state[n.id].isRevealed = isRoot || parentOccupied || hasOccupiedChild || state[n.id].ac > 0;
    });
    return state;
  }, [subs]);

  const onMouseDown = (e: ReactMouseEvent) => { if ((e.target as Element).closest('.no-drag')) return; isDragging.current = true; dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; };
  const onMouseMove = (e: ReactMouseEvent) => { if (!isDragging.current) return; setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); };
  const onMouseUp = () => { isDragging.current = false; };
  const onWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - pan.x) / scale; const worldY = (mouseY - pan.y) / scale;
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1; const newScale = Math.min(Math.max(0.2, scale + zoomDelta), 3.0);
    setScale(newScale); setPan({ x: mouseX - (worldX * newScale), y: mouseY - (worldY * newScale) });
  };

  return (
    <div ref={containerRef} className="relative w-full h-[800px] bg-black border border-[#30363d] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing shadow-[inset_0_0_120px_rgba(0,0,0,1)] select-none" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
      <div className="absolute inset-0 pointer-events-none z-40 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 no-drag">
        <button onClick={() => setScale(s => Math.min(s + 0.2, 3.0))} className="w-10 h-10 bg-[#0d1117]/90 border border-[#30363d] text-white rounded hover:bg-[#e3b341] hover:text-black transition-colors shadow-lg text-xl">+</button>
        <button onClick={() => setScale(s => Math.max(s - 0.2, 0.2))} className="w-10 h-10 bg-[#0d1117]/90 border border-[#30363d] text-white rounded hover:bg-[#e3b341] hover:text-black transition-colors shadow-lg text-xl">-</button>
        <button onClick={() => { setScale(1); setPan({x:-2300, y:-2100}); }} className="w-10 h-10 bg-[#0d1117]/90 border border-[#30363d] text-white rounded hover:bg-[#e3b341] hover:text-black transition-colors shadow-lg text-xl">⌂</button>
      </div>

      <div className="absolute bottom-4 left-4 z-50 bg-[#0d1117]/90 border border-[#30363d] p-4 rounded-xl shadow-2xl font-mono text-[10px] text-[#8b949e] no-drag backdrop-blur-md">
        <strong className="text-[#e3b341] block mb-2 text-xs">Architecture (Max Rating)</strong>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-[2px] border border-[#8b949e] bg-gradient-to-b from-[#161b22] to-[#21262d]" /> 800 - 1100 (Outpost)</div>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-[2px] border border-[#56d364] bg-gradient-to-b from-[#161b22] to-[#56d364]/20" /> 1200 - 1300 (Village)</div>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-[2px] border border-[#58a6ff] bg-gradient-to-b from-[#161b22] to-[#58a6ff]/20" /> 1400 - 1800 (Keep)</div>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-[2px] border border-[#d2a8ff] bg-gradient-to-b from-[#161b22] to-[#d2a8ff]/20" /> 1900 - 2100 (Spire)</div>
        <div className="flex items-center gap-2 mb-3"><div className="w-3 h-3 rounded-[2px] border border-[#e3b341] bg-gradient-to-b from-[#161b22] to-[#e3b341]/20 shadow-[0_0_8px_rgba(227,179,65,0.4)]" /> 2200+ (Citadel)</div>
        <div className="border-t border-[#30363d] my-2" />
        <strong className="text-[#e3b341] block mb-2 text-xs">Garrison & Status</strong>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-[2px] border border-[#e3b341] shadow-[inset_0_0_8px_rgba(227,179,65,0.6)]" /> Conquered (25+ ACs)</div>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-[2px] border border-dashed border-[#484f58] bg-[#0d1117] opacity-60" /> Scouted (Fog of War)</div>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-[2px] border border-[#8b0000]" style={{background: 'repeating-linear-gradient(45deg, #161b22, #161b22 2px, #2a0a0a 2px, #2a0a0a 4px)'}} /> Ruins (&gt;30D no AC)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px] border border-[#db6d28] shadow-[0_0_8px_rgba(219,109,40,0.6)]" /> Rebellion (Fails &gt; 2x AC)</div>
      </div>

      <div ref={mapRef} className="absolute origin-top-left" style={{ width: 6000, height: 5000, transform: `matrix(${scale}, 0, 0, ${scale}, ${pan.x}, ${pan.y})`, willChange: 'transform', backgroundImage: 'linear-gradient(rgba(48, 54, 61, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(48, 54, 61, 0.15) 1px, transparent 1px)', backgroundSize: '100px 100px' }}>
        <div className="absolute text-center font-mono font-bold uppercase tracking-[20px] text-white/5 pointer-events-none z-0" style={{top: 2400, left: 2800}}><span className="text-6xl tracking-[20px]">Implementation & Logic</span></div>
        <div className="absolute text-center font-mono font-bold uppercase tracking-[20px] text-white/5 pointer-events-none z-0" style={{top: 1400, left: 4200}}><span className="text-6xl tracking-[20px]">Math & Combinatorics</span></div>
        <div className="absolute text-center font-mono font-bold uppercase tracking-[20px] text-white/5 pointer-events-none z-0" style={{top: 3600, left: 2400}}><span className="text-6xl tracking-[20px]">Graphs & Trees</span></div>
        <div className="absolute text-center font-mono font-bold uppercase tracking-[20px] text-white/5 pointer-events-none z-0" style={{top: 1400, left: 1600}}><span className="text-6xl tracking-[20px]">Data Vaults</span></div>
        
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {mapNodes.map(n => {
            if (!n.parent || !T_NODES[n.parent]) return null;
            const p = T_NODES[n.parent];
            const sx = p.x + 95, sy = p.y + 35, ex = n.x + 95, ey = n.y + 35;
            const pStats = mapState[p.id]; const nStats = mapState[n.id];
            const isPathActive = (pStats.ac > 0 && nStats.ac > 0);
            const pathHidden = (!pStats.isRevealed || !nStats.isRevealed);
            const isDecaying = (nStats.ac > 0 && (Date.now()/1000 - nStats.lastAC)/86400 > 30);
            if (pathHidden) return null;
            return <path key={`path-${n.id}`} d={`M ${sx} ${sy} Q ${(sx+ex)/2} ${(sy+ey)/2 - 100} ${ex} ${ey}`} stroke={isPathActive ? (isDecaying ? 'rgba(248,81,73,0.4)' : '#58a6ff') : 'rgba(48,54,61,0.3)'} strokeWidth={isPathActive ? 3 : 2} strokeDasharray={isPathActive ? (isDecaying ? "4 4" : "") : "6 6"} fill="none" />;
          })}
        </svg>

        {mapNodes.map(n => {
          const m = mapState[n.id];
          if (!m.isRevealed) return null;
          const isScouted = m.ac === 0;
          const isDecaying = (m.ac > 0 && (Date.now()/1000 - m.lastAC)/86400 > 30);
          const isRebellion = (m.ac > 0 && m.fail / m.ac > 2.0);

          let archStyle = "border-[#30363d] bg-[#161b22]";
          if (m.ac > 0) {
            if (m.maxR < 1200) archStyle = "border-[#8b949e] bg-gradient-to-b from-[#161b22] to-[#21262d]";
            else if (m.maxR < 1400) archStyle = "border-[#56d364] bg-gradient-to-b from-[#161b22] to-[#56d364]/15";
            else if (m.maxR < 1900) archStyle = "border-[#58a6ff] bg-gradient-to-b from-[#161b22] to-[#58a6ff]/15";
            else if (m.maxR < 2200) archStyle = "border-[#d2a8ff] bg-gradient-to-b from-[#161b22] to-[#d2a8ff]/15";
            else archStyle = "border-[#e3b341] bg-gradient-to-b from-[#161b22] to-[#e3b341]/20 shadow-[0_0_15px_rgba(227,179,65,0.3)]";
          }
          let garrisonGlow = "";
          if (m.ac >= 25) garrisonGlow = "shadow-[inset_0_0_30px_rgba(227,179,65,0.3)] border-[#e3b341]";
          else if (m.ac >= 5) garrisonGlow = "shadow-[inset_0_0_20px_rgba(88,166,255,0.2)]";

          if (isScouted) { archStyle = "border-dashed border-[#484f58] bg-[#0d1117] opacity-40 grayscale hover:opacity-80"; garrisonGlow = ""; }
          if (isRebellion) { archStyle += " border-[#db6d28] shadow-[0_0_20px_rgba(219,109,40,0.6)]"; }
          if (isDecaying) { archStyle += " border-[#8b0000]"; }

          return (
            <div key={n.id} className={`absolute w-[190px] p-3.5 border-2 rounded-lg text-center z-20 flex flex-col gap-1.5 transition-all shadow-[0_4px_15px_rgba(0,0,0,0.8)] hover:scale-110 hover:z-50 ${archStyle} ${garrisonGlow}`} style={{ left: n.x, top: n.y, backgroundImage: isDecaying ? 'repeating-linear-gradient(45deg, #161b22, #161b22 10px, #2a0a0a 10px, #2a0a0a 20px)' : '' }}>
              {isDecaying && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8b0000] text-white text-[10px] font-bold px-2 py-0.5 rounded">RUINS (30D+)</div>}
              {isRebellion && !isDecaying && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#db6d28] text-black text-[10px] font-bold px-2 py-0.5 rounded">[!] REBELLION</div>}
              <div className={`font-bold text-sm leading-tight ${isDecaying ? 'text-[#ff7b72] line-through' : 'text-white'}`}>{n.label}</div>
              <div className="font-mono text-[10px] text-[#8b949e] flex justify-between border-t border-[#30363d] mt-1 pt-1.5">
                {m.ac > 0 ? <><span className="text-[#e3b341] font-bold">AC: {m.ac}</span><span>Max: {m.maxR}</span></> : <><span>???</span><span>???</span></>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}