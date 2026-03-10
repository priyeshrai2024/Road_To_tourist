"use client";

import { useState, useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export interface BadgeDef {
  id: string; icon: string; name: string; desc: string;
  owner: string | null; isNegative?: boolean;
}

// ─── Section config ────────────────────────────────────────────────────────
const SECTIONS: { key: string; label: string; prefix: string; color: string; icon: string }[] = [
  { key:'daily',       label:'Daily',        prefix:'d_',  color:'#f85149', icon:'⚡' },
  { key:'weekly',      label:'Weekly',       prefix:'w_',  color:'#e3b341', icon:'🗓' },
  { key:'monthly',     label:'Monthly',      prefix:'m_',  color:'#58a6ff', icon:'📅' },
  { key:'longterm',    label:'Long-Term',    prefix:'lt_', color:'#d2a8ff', icon:'🏺' },
  { key:'achievement', label:'Achievements', prefix:'a_',  color:'#56d364', icon:'🏆' },
  { key:'competitive', label:'Competitive',  prefix:'c_',  color:'#e879f9', icon:'⚔️' },
];

function getSection(id: string) {
  return SECTIONS.find(s => id.startsWith(s.prefix)) ?? SECTIONS[5];
}

// ─── Charts ────────────────────────────────────────────────────────────────
function BadgeDistChart({ badges, players, mainHandle }: { badges: BadgeDef[]; players: string[]; mainHandle: string }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    players.forEach(p => c[p] = 0);
    badges.forEach(b => { if (b.owner && c[b.owner] !== undefined) c[b.owner]++; });
    return c;
  }, [badges, players]);

  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  const COLORS = ['#e3b341','#58a6ff','#56d364','#f85149','#d2a8ff','#e879f9'];

  return (
    <div className="rounded-xl p-4" style={{ background:'#050505', border:'1px solid #1a1a1a' }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-widest text-[#e3b341] mb-3">🏅 Badge Leaderboard</div>
      <div className="flex flex-col gap-2">
        {sorted.map(([p, count], i) => (
          <div key={p} className="flex items-center gap-3">
            <div className="font-mono text-[10px] w-4 text-[#444]">{i+1}</div>
            <div className="font-mono text-[11px] flex-1" style={{ color: p === mainHandle ? '#e3b341' : '#8b949e' }}>
              {p === mainHandle ? `★ ${p}` : p}
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.04)' }}>
              <div className="h-full rounded-full" style={{
                width: `${sorted[0][1] > 0 ? (count / sorted[0][1]) * 100 : 0}%`,
                background: COLORS[i % COLORS.length]
              }} />
            </div>
            <div className="font-mono text-[11px] font-bold w-6 text-right" style={{ color: COLORS[i % COLORS.length] }}>{count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionBreakdownChart({ badges, mainHandle }: { badges: BadgeDef[]; mainHandle: string }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    SECTIONS.forEach(s => counts[s.label] = 0);
    badges.filter(b => b.owner === mainHandle).forEach(b => {
      const sec = getSection(b.id);
      counts[sec.label] = (counts[sec.label] || 0) + 1;
    });
    return counts;
  }, [badges, mainHandle]);

  const labels = SECTIONS.map(s => s.label);
  const values = labels.map(l => data[l] || 0);

  return (
    <div className="rounded-xl p-4" style={{ background:'#050505', border:'1px solid #1a1a1a' }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-widest text-[#58a6ff] mb-3">📊 My Badges by Category</div>
      <div className="h-[120px]">
        <Bar data={{
          labels,
          datasets: [{ data: values, backgroundColor: SECTIONS.map(s => s.color + '88'), borderColor: SECTIONS.map(s => s.color), borderWidth: 1, borderRadius: 4 }]
        }} options={{
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display:false }, ticks: { color:'#444', font:{ size:9 } } },
            y: { grid: { color:'#0f0f0f' }, ticks: { color:'#444', font:{ size:9 }, stepSize:1 } }
          }
        }} />
      </div>
    </div>
  );
}

function NegativeVsPositiveChart({ badges, mainHandle }: { badges: BadgeDef[]; mainHandle: string }) {
  const mine = badges.filter(b => b.owner === mainHandle);
  const pos = mine.filter(b => !b.isNegative).length;
  const neg = mine.filter(b => b.isNegative).length;

  return (
    <div className="rounded-xl p-4" style={{ background:'#050505', border:'1px solid #1a1a1a' }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-widest text-[#56d364] mb-3">⚖️ Honour vs Shame</div>
      <div className="flex items-center gap-4">
        <div className="w-[90px] h-[90px] relative">
          <Doughnut data={{
            datasets: [{ data: [pos, neg || 0.01], backgroundColor: ['#56d36488','#f8514988'], borderColor: ['#56d364','#f85149'], borderWidth: 1, hoverOffset: 2 }],
          }} options={{ responsive:true, cutout:'65%', plugins: { legend:{ display:false }, tooltip:{ enabled:false } } }} />
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-[#888]">
            {pos}/{pos+neg}
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#56d364]" />
            <span className="font-mono text-[10px] text-[#8b949e]">Honour</span>
            <span className="font-mono text-[10px] font-bold text-[#56d364] ml-auto">{pos}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#f85149]" />
            <span className="font-mono text-[10px] text-[#8b949e]">Shame</span>
            <span className="font-mono text-[10px] font-bold text-[#f85149] ml-auto">{neg}</span>
          </div>
          <div className="border-t border-[#0f0f0f] pt-2 font-mono text-[10px] text-[#444]">
            Score: {pos - neg * 2} net pts
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Badge card ───────────────────────────────────────────────────────────
function BadgeCard({ b, mainHandle, onClick }: { b: BadgeDef; mainHandle: string; onClick: () => void }) {
  const isMe = b.owner === mainHandle;
  const isSquad = b.owner && !isMe;
  const sec = getSection(b.id);
  const unclaimed = !b.owner;

  let borderColor = '#21262d';
  let bg = 'transparent';
  if (b.isNegative && b.owner) { borderColor = '#f85149'; bg = 'rgba(248,81,73,0.04)'; }
  else if (isMe) { borderColor = sec.color; bg = `${sec.color}08`; }
  else if (isSquad) { borderColor = '#30363d'; bg = 'rgba(88,166,255,0.03)'; }

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all hover:-translate-y-0.5 hover:brightness-110"
      style={{ borderColor, background: bg, opacity: unclaimed ? 0.3 : 1, filter: unclaimed ? 'grayscale(1)' : 'none' }}
    >
      <div className="text-xl flex-shrink-0 w-7 text-center">{b.icon}</div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-bold text-[11px] leading-tight truncate" style={{ color: unclaimed ? '#444' : isMe ? sec.color : '#e0e6ed' }}>{b.name}</span>
        <span className="font-mono text-[9px] truncate" style={{ color: '#555' }}>{b.owner || '—'}</span>
      </div>
      {b.isNegative && b.owner && <div className="text-[8px] text-[#f85149] font-mono flex-shrink-0">⚠</div>}
    </div>
  );
}

// ─── Section panel ─────────────────────────────────────────────────────────
function SectionPanel({ section, badges, mainHandle, onBadge }: {
  section: typeof SECTIONS[0]; badges: BadgeDef[]; mainHandle: string; onBadge: (b: BadgeDef) => void;
}) {
  const [open, setOpen] = useState(true);
  const mine = badges.filter(b => b.owner === mainHandle).length;
  const claimed = badges.filter(b => b.owner !== null).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${section.color}22` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:brightness-110"
        style={{ background: `${section.color}0a` }}
      >
        <span className="text-lg">{section.icon}</span>
        <span className="font-mono font-bold text-sm" style={{ color: section.color }}>{section.label}</span>
        <span className="font-mono text-[10px] text-[#444] ml-1">{badges.length} badges</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px]" style={{ color: section.color }}>{mine} mine</span>
          <span className="font-mono text-[10px] text-[#444]">/ {claimed} claimed</span>
          <span className="text-[#444] text-sm ml-1">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-3" style={{ background:'#020202' }}>
          {badges.map(b => <BadgeCard key={b.id} b={b} mainHandle={mainHandle} onClick={() => onBadge(b)} />)}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────
function BadgeModal({ b, mainHandle, onClose }: { b: BadgeDef; mainHandle: string; onClose: () => void }) {
  const sec = getSection(b.id);
  const isMe = b.owner === mainHandle;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex justify-center items-center z-[1000] p-4" onClick={onClose}>
      <div className="bg-[#0d1117] p-8 rounded-xl w-[420px] max-w-[90%] shadow-2xl" style={{ border:`1px solid ${sec.color}44` }} onClick={e => e.stopPropagation()}>
        <div className="text-5xl mb-4 text-center">{b.icon}</div>
        <div className="font-mono font-black text-xl text-center mb-1" style={{ color: b.isNegative ? '#f85149' : sec.color }}>{b.name.toUpperCase()}</div>
        <div className="font-mono text-[0.65rem] text-center uppercase tracking-widest mb-1" style={{ color: sec.color }}>{sec.label}</div>
        <div className="font-mono text-[0.7rem] text-[#555] text-center mb-4">{b.isNegative ? '⚠ SHAME BADGE' : '✦ HONOUR BADGE'}</div>
        <div className="text-[0.85rem] text-[#8b949e] leading-relaxed text-center mb-6">{b.desc}</div>
        <div className="rounded-lg p-3 text-center font-mono text-sm" style={{ background:`${sec.color}08`, border:`1px solid ${sec.color}22` }}>
          {b.owner
            ? <><span style={{ color: isMe ? sec.color : '#58a6ff' }}>{b.owner}</span><span className="text-[#444] ml-2 text-[10px]">{isMe ? '← YOU' : ''}</span></>
            : <span className="text-[#333]">UNCLAIMED</span>
          }
        </div>
        <button onClick={onClose} className="w-full mt-4 bg-transparent text-[#555] border border-[#21262d] py-2 rounded-lg cursor-pointer hover:bg-white/3 font-mono text-xs transition-colors">CLOSE</button>
      </div>
    </div>
  );
}

// ─── Main Armory ──────────────────────────────────────────────────────────
export default function Armory({ badges, mainHandle, variant = 'full', players }: {
  badges: BadgeDef[]; mainHandle: string; variant?: 'full' | 'mini'; players?: string[];
}) {
  const [modal, setModal] = useState<BadgeDef | null>(null);

  const allPlayers = useMemo(() => players ?? [mainHandle], [players, mainHandle]);

  const bySection = useMemo(() => {
    const map: Record<string, BadgeDef[]> = {};
    SECTIONS.forEach(s => map[s.key] = []);
    badges.forEach(b => {
      const sec = getSection(b.id);
      map[sec.key].push(b);
    });
    return map;
  }, [badges]);

  const myTotal = badges.filter(b => b.owner === mainHandle).length;
  const totalClaimed = badges.filter(b => b.owner !== null).length;

  if (variant === 'mini') {
    const myBadges = badges.filter(b => b.owner === mainHandle);
    return (
      <div className="mt-4 pt-4 border-t border-dashed border-[#30363d] flex flex-wrap gap-2">
        {myBadges.length === 0
          ? <div className="text-[#555] text-xs font-mono">No active badges.</div>
          : myBadges.map(b => (
            <div key={b.id} title={b.desc} className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full text-[0.7rem] font-bold border border-[#30363d] hover:border-[#e3b341] cursor-pointer transition-colors text-[#e0e6ed]">
              <span>{b.icon}</span> {b.name}
            </div>
          ))
        }
      </div>
    );
  }

  return (
    <>
      {modal && <BadgeModal b={modal} mainHandle={mainHandle} onClose={() => setModal(null)} />}

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-3 text-center" style={{ background:'#050505', border:'1px solid #e3b34122' }}>
          <div className="font-mono text-2xl font-black text-[#e3b341]">{myTotal}</div>
          <div className="font-mono text-[0.6rem] uppercase tracking-widest text-[#444] mt-0.5">My Badges</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background:'#050505', border:'1px solid #58a6ff22' }}>
          <div className="font-mono text-2xl font-black text-[#58a6ff]">{totalClaimed}</div>
          <div className="font-mono text-[0.6rem] uppercase tracking-widest text-[#444] mt-0.5">Total Claimed</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background:'#050505', border:'1px solid #56d36422' }}>
          <div className="font-mono text-2xl font-black text-[#56d364]">{badges.length - totalClaimed}</div>
          <div className="font-mono text-[0.6rem] uppercase tracking-widest text-[#444] mt-0.5">Unclaimed</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <BadgeDistChart badges={badges} players={allPlayers} mainHandle={mainHandle} />
        <SectionBreakdownChart badges={badges} mainHandle={mainHandle} />
        <NegativeVsPositiveChart badges={badges} mainHandle={mainHandle} />
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {SECTIONS.map(sec => (
          <SectionPanel
            key={sec.key}
            section={sec}
            badges={bySection[sec.key] ?? []}
            mainHandle={mainHandle}
            onBadge={setModal}
          />
        ))}
      </div>
    </>
  );
}
