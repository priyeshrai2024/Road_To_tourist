"use client";

import { useState, useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export interface BadgeDef {
  id: string; icon: string; name: string; desc: string;
  owner: string | null; isNegative?: boolean;
}

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

// ── Charts ────────────────────────────────────────────────────────────────────
function BadgeDistChart({ badges, players, mainHandle }: { badges: BadgeDef[]; players: string[]; mainHandle: string }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    players.forEach(p => c[p] = 0);
    badges.forEach(b => { if (b.owner && c[b.owner] !== undefined) c[b.owner]++; });
    return c;
  }, [badges, players]);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const COLORS = ['#e3b341','#58a6ff','#56d364','#f85149','#d2a8ff','#e879f9'];
  return (
    <div className="rounded-xl p-4" style={{ background:'var(--bg-base)', border:'1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>🏅 Badge Leaderboard</p>
      <div className="flex flex-col gap-2">
        {sorted.map(([p, count], i) => (
          <div key={p} className="flex items-center gap-3">
            <div className="text-xs w-4" style={{ color: 'var(--text-muted)' }}>{i+1}</div>
            <div className="text-xs flex-1 font-mono" style={{ color: p === mainHandle ? 'var(--accent)' : 'var(--text-muted)' }}>{p === mainHandle ? `★ ${p}` : p}</div>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full" style={{ width: `${sorted[0][1] > 0 ? (count / sorted[0][1]) * 100 : 0}%`, background: COLORS[i % COLORS.length] }} />
            </div>
            <div className="text-xs font-bold w-6 text-right" style={{ color: COLORS[i % COLORS.length] }}>{count}</div>
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
    badges.filter(b => b.owner === mainHandle).forEach(b => { const sec = getSection(b.id); counts[sec.label] = (counts[sec.label] || 0) + 1; });
    return counts;
  }, [badges, mainHandle]);
  const labels = SECTIONS.map(s => s.label);
  const values = labels.map(l => data[l] || 0);
  return (
    <div className="rounded-xl p-4" style={{ background:'var(--bg-base)', border:'1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>📊 My Badges by Category</p>
      <div className="h-[120px]">
        <Bar data={{ labels, datasets: [{ data: values, backgroundColor: SECTIONS.map(s => s.color + '88'), borderColor: SECTIONS.map(s => s.color), borderWidth: 1, borderRadius: 4 }] }}
          options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 9 } } } } }} />
      </div>
    </div>
  );
}

function NegativeVsPositiveChart({ badges, mainHandle }: { badges: BadgeDef[]; mainHandle: string }) {
  const mine = badges.filter(b => b.owner === mainHandle);
  const pos = mine.filter(b => !b.isNegative).length;
  const neg = mine.filter(b => b.isNegative).length;
  return (
    <div className="rounded-xl p-4" style={{ background:'var(--bg-base)', border:'1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>⚖️ Honour vs Shame</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--status-ac)' }} /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Honour</span><span className="text-xs font-bold ml-auto" style={{ color: 'var(--status-ac)' }}>{pos}</span></div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--status-wa)' }} /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Shame</span><span className="text-xs font-bold ml-auto" style={{ color: 'var(--status-wa)' }}>{neg}</span></div>
        <div className="border-t pt-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Net: {pos - neg * 2} pts</div>
      </div>
    </div>
  );
}

// ── Badge card ────────────────────────────────────────────────────────────────
function BadgeCard({ b, mainHandle, onClick }: { b: BadgeDef; mainHandle: string; onClick: () => void }) {
  const isMe = b.owner === mainHandle;
  const sec = getSection(b.id);
  const unclaimed = !b.owner;
  const borderColor = b.isNegative && b.owner ? 'var(--status-wa)' : isMe ? sec.color : 'var(--border)';
  const bg = b.isNegative && b.owner ? 'rgba(248,81,73,0.04)' : isMe ? `${sec.color}08` : 'transparent';
  return (
    <div onClick={onClick}
      className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all hover:-translate-y-0.5 hover:brightness-110"
      style={{ borderColor, background: bg, opacity: unclaimed ? 0.3 : 1, filter: unclaimed ? 'grayscale(1)' : 'none' }}>
      <div className="text-xl shrink-0 w-7 text-center">{b.icon}</div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-bold text-[11px] leading-tight truncate" style={{ color: unclaimed ? 'var(--border)' : isMe ? sec.color : 'var(--text-main)' }}>{b.name}</span>
        <span className="text-[9px] truncate font-mono" style={{ color: 'var(--text-muted)' }}>{b.owner || '—'}</span>
      </div>
      {b.isNegative && b.owner && <div className="text-[8px] shrink-0" style={{ color: 'var(--status-wa)' }}>⚠</div>}
    </div>
  );
}

// ── Section panel ─────────────────────────────────────────────────────────────
function SectionPanel({ section, badges, mainHandle, onBadge }: { section: typeof SECTIONS[0]; badges: BadgeDef[]; mainHandle: string; onBadge: (b: BadgeDef) => void }) {
  const [open, setOpen] = useState(true);
  const mine = badges.filter(b => b.owner === mainHandle).length;
  const claimed = badges.filter(b => b.owner !== null).length;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${section.color}22` }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:brightness-110"
        style={{ background: `${section.color}0a`, border: 'none' }}>
        <span className="text-base">{section.icon}</span>
        <span className="font-bold text-sm" style={{ color: section.color }}>{section.label}</span>
        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{badges.length} badges</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: section.color }}>{mine} mine</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {claimed} claimed</span>
          <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-3"
          style={{ background: 'var(--bg-base)' }}>
          {badges.map(b => <BadgeCard key={b.id} b={b} mainHandle={mainHandle} onClick={() => onBadge(b)} />)}
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function BadgeModal({ b, mainHandle, onClose }: { b: BadgeDef; mainHandle: string; onClose: () => void }) {
  const sec = getSection(b.id);
  const isMe = b.owner === mainHandle;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[1000] p-4" onClick={onClose}>
      <div className="p-8 rounded-2xl w-[420px] max-w-[90%] shadow-2xl" style={{ background: 'var(--bg-card)', border: `1px solid ${sec.color}44` }} onClick={e => e.stopPropagation()}>
        <div className="text-5xl mb-4 text-center">{b.icon}</div>
        <p className="font-bold text-xl text-center mb-1" style={{ color: b.isNegative ? 'var(--status-wa)' : sec.color }}>{b.name}</p>
        <p className="text-xs text-center uppercase tracking-widest mb-1" style={{ color: sec.color }}>{sec.label}</p>
        <p className="text-xs text-center mb-4" style={{ color: 'var(--text-muted)' }}>{b.isNegative ? '⚠ Shame Badge' : '✦ Honour Badge'}</p>
        <p className="text-sm text-center leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>{b.desc}</p>
        <div className="rounded-lg p-3 text-center text-sm" style={{ background: `${sec.color}08`, border: `1px solid ${sec.color}22` }}>
          {b.owner ? <><span style={{ color: isMe ? sec.color : '#58a6ff' }}>{b.owner}</span>{isMe && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>← You</span>}</> : <span style={{ color: 'var(--text-muted)' }}>Unclaimed</span>}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2 rounded-lg cursor-pointer transition-colors text-sm" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Close</button>
      </div>
    </div>
  );
}

// ── Main Armory ───────────────────────────────────────────────────────────────
export default function Armory({ badges, mainHandle, variant = 'full', players }: { badges: BadgeDef[]; mainHandle: string; variant?: 'full' | 'mini'; players?: string[] }) {
  const [modal, setModal] = useState<BadgeDef | null>(null);
  const allPlayers = useMemo(() => players ?? [mainHandle], [players, mainHandle]);
  const bySection = useMemo(() => { const map: Record<string, BadgeDef[]> = {}; SECTIONS.forEach(s => map[s.key] = []); badges.forEach(b => { const sec = getSection(b.id); map[sec.key].push(b); }); return map; }, [badges]);
  const myTotal = badges.filter(b => b.owner === mainHandle).length;
  const totalClaimed = badges.filter(b => b.owner !== null).length;

  if (variant === 'mini') {
    const myBadges = badges.filter(b => b.owner === mainHandle);
    return (
      <div className="mt-4 pt-4 flex flex-wrap gap-2" style={{ borderTop: '1px dashed var(--border)' }}>
        {myBadges.length === 0
          ? <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No active badges.</div>
          : myBadges.map(b => (
            <div key={b.id} title={b.desc} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
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

      {/* Header stat strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[['My Badges', myTotal, 'var(--accent)'], ['Total Claimed', totalClaimed, 'var(--status-ac)'], ['Unclaimed', badges.length - totalClaimed, 'var(--text-muted)']].map(([label, val, color]) => (
          <div key={label as string} className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-2xl font-bold mb-1" style={{ color: color as string }}>{val as number}</p>
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label as string}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <BadgeDistChart badges={badges} players={allPlayers} mainHandle={mainHandle} />
        <SectionBreakdownChart badges={badges} mainHandle={mainHandle} />
        <NegativeVsPositiveChart badges={badges} mainHandle={mainHandle} />
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {SECTIONS.map(sec => <SectionPanel key={sec.key} section={sec} badges={bySection[sec.key] ?? []} mainHandle={mainHandle} onBadge={setModal} />)}
      </div>
    </>
  );
}
