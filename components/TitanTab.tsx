"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TitanEntry {
  handle: string;
  info: any | null;         // CF user.info result
  history: any[];           // CF user.rating result
  loading: boolean;
  error: string | null;
}

interface TitanTabProps {
  myHandle: string;
  myRating: number;
  myHistory: any[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function TopLine({ color }: { color: string }) {
  return (
    <div className="absolute top-0 left-0 right-0 h-[1px]"
      style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
  );
}

function PulseDot({ color }: { color: string }) {
  return <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />;
}

const CF_RANK_COLORS: Record<string, string> = {
  newbie: '#888888', pupil: '#77ff77', specialist: '#77ddbb',
  expert: '#aaaaff', 'candidate master': '#ff88ff', master: '#ffcc88',
  'international master': '#ffbb55', grandmaster: '#ff7777',
  'international grandmaster': '#ff3333', 'legendary grandmaster': '#aa0000',
};

function rankColor(rank?: string): string {
  if (!rank) return '#888';
  return CF_RANK_COLORS[rank.toLowerCase()] || '#888';
}

function formatRatingDelta(gap: number) {
  if (gap <= 0) return { text: `You're ahead by ${Math.abs(gap)}`, color: '#56d364' };
  return { text: `${gap} points behind`, color: '#f85149' };
}

function estimateContests(gap: number) {
  if (gap <= 0) return 'Target neutralized';
  return `~${Math.ceil(gap / 20)} contests at current velocity`;
}

// ── Titan Card ─────────────────────────────────────────────────────────────────
function TitanCard({
  titan, myRating, onRemove,
}: {
  titan: TitanEntry; myRating: number; onRemove: () => void;
}) {
  const { info, loading, error, handle } = titan;

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-[4px] p-8 flex items-center justify-center min-h-[180px]"
        style={{ background: '#050505', border: '1px solid #f8514922' }}>
        <TopLine color="#f85149" />
        <div className="font-mono text-[11px] uppercase tracking-[3px] text-[#f85149] animate-pulse">
          [ Locking onto {handle}... ]
        </div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="relative overflow-hidden rounded-[4px] p-6"
        style={{ background: '#050505', border: '1px solid #f8514922' }}>
        <TopLine color="#f85149" />
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[13px] font-bold text-[#f85149]">{handle}</div>
            <div className="font-mono text-[10px] text-[#555] mt-1">{error || 'Handle not found on Codeforces'}</div>
          </div>
          <button onClick={onRemove}
            className="font-mono text-[9px] uppercase tracking-wider text-[#333] hover:text-[#f85149] transition-colors px-3 py-1.5 border border-[#1a1a1a] hover:border-[#f85149] rounded-[3px]">
            Remove
          </button>
        </div>
      </div>
    );
  }

  const tRating = info.rating || 0;
  const gap = tRating - myRating;
  const { text: deltaText, color: deltaColor } = formatRatingDelta(gap);
  const rColor = rankColor(info.rank);

  // Mini rating spark from history
  const histPoints = titan.history.slice(-12).map((h: any) => h.newRating);
  const sparkMin = Math.min(...histPoints, tRating);
  const sparkMax = Math.max(...histPoints, tRating);
  const sparkRange = sparkMax - sparkMin || 100;

  return (
    <div className="relative overflow-hidden rounded-[4px]"
      style={{ background: '#050505', border: '1px solid #f8514922', boxShadow: '0 0 30px rgba(248,81,73,0.04)' }}>
      <TopLine color="#f85149" />

      {/* Skull watermark */}
      <div className="absolute bottom-2 right-4 text-[5rem] opacity-[0.03] leading-none pointer-events-none select-none">💀</div>

      {/* Header */}
      <div className="p-6 flex items-start gap-5">
        <div className="relative shrink-0">
          <img src={info.titlePhoto} alt={handle}
            className="w-16 h-16 rounded-[4px] object-cover"
            style={{ border: `2px solid ${rColor}44` }}
            onError={(e: any) => { e.target.style.display = 'none'; }} />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#050505]"
            style={{ background: rColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-mono text-[1.1rem] font-black tracking-tight" style={{ color: rColor }}>
                {info.handle}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#333] mt-0.5">
                Assassination Target
              </div>
            </div>
            <button onClick={onRemove}
              className="font-mono text-[9px] uppercase tracking-wider text-[#222] hover:text-[#f85149] transition-colors px-2 py-1 border border-[#111] hover:border-[#f85149]/40 rounded-[2px] shrink-0">
              ✕ Remove
            </button>
          </div>

          {/* Rating + rank */}
          <div className="flex items-baseline gap-3 mt-2">
            <span className="font-mono text-2xl font-black" style={{ color: '#f0a500' }}>{tRating}</span>
            <span className="font-mono text-[10px] capitalize" style={{ color: rColor }}>{info.rank}</span>
          </div>
        </div>
      </div>

      {/* Mini spark */}
      {histPoints.length > 1 && (
        <div className="px-6 pb-3">
          <svg width="100%" height="32" viewBox={`0 0 ${histPoints.length * 20} 32`} preserveAspectRatio="none"
            className="opacity-40">
            <polyline
              fill="none"
              stroke="#f85149"
              strokeWidth="1.5"
              strokeLinejoin="round"
              points={histPoints.map((v, i) =>
                `${i * 20},${32 - ((v - sparkMin) / sparkRange) * 28}`
              ).join(' ')}
            />
            {/* Current rating dot */}
            <circle
              cx={(histPoints.length - 1) * 20}
              cy={32 - ((histPoints[histPoints.length - 1] - sparkMin) / sparkRange) * 28}
              r="2.5"
              fill="#f85149"
            />
          </svg>
        </div>
      )}

      {/* Protocol panel */}
      <div className="mx-5 mb-5 rounded-[3px] p-4"
        style={{ background: '#0a0a0a', borderLeft: '3px solid #f8514966', border: '1px solid #f8514915' }}>
        <div className="font-mono text-[8px] uppercase tracking-[2px] text-[#f85149] mb-3 flex items-center gap-2">
          <PulseDot color="#f85149" /> Assassination Protocol
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="font-mono text-[8px] uppercase text-[#333] mb-1">Rating Delta</div>
            <div className="font-mono text-[15px] font-black" style={{ color: deltaColor }}>{deltaText}</div>
          </div>
          <div>
            <div className="font-mono text-[8px] uppercase text-[#333] mb-1">Intercept ETA</div>
            <div className="font-mono text-[11px] text-[#56d364]">{estimateContests(gap)}</div>
          </div>
        </div>

        {gap > 0 && (
          <>
            {/* Progress bar toward titan */}
            <div className="mb-2">
              <div className="flex justify-between font-mono text-[8px] text-[#333] mb-1">
                <span>Your rating</span>
                <span>Titan</span>
              </div>
              <div className="h-[3px] bg-[#111] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (myRating / Math.max(tRating, myRating)) * 100)}%`,
                    background: 'linear-gradient(90deg, #56d364, #e3b341)',
                    boxShadow: '0 0 6px #e3b34166',
                  }} />
              </div>
              <div className="flex justify-between font-mono text-[8px] mt-1">
                <span style={{ color: '#56d364' }}>{myRating}</span>
                <span style={{ color: '#f85149' }}>{tRating}</span>
              </div>
            </div>

            <div className="font-mono text-[11px] leading-relaxed" style={{ color: '#666' }}>
              Target {info.handle} is <span style={{ color: '#f85149', fontWeight: 900 }}>{gap} pts</span> ahead.
              Sustain first-try ACs on <span style={{ color: '#f0a500' }}>
                {Math.floor((tRating || 1500) / 100) * 100}+
              </span> rated problems to close the gap.
            </div>
          </>
        )}

        {gap <= 0 && (
          <div className="font-mono text-[11px]" style={{ color: '#56d364' }}>
            ✓ Target neutralized. You surpassed {info.handle} by{' '}
            <span style={{ fontWeight: 900 }}>{Math.abs(gap)} pts</span>. Lock a new Titan.
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="px-5 pb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Max Rating', val: info.maxRating || '—', color: '#e3b341' },
          { label: 'Max Rank', val: info.maxRank || '—', color: rankColor(info.maxRank) },
          { label: 'Contribution', val: info.contribution != null ? (info.contribution >= 0 ? `+${info.contribution}` : info.contribution) : '—', color: info.contribution > 0 ? '#56d364' : '#f85149' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-[#0a0a0a] rounded-[3px] p-2.5">
            <div className="font-mono text-[8px] uppercase text-[#333] mb-1">{label}</div>
            <div className="font-mono text-[13px] font-bold" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TitanTab({ myHandle, myRating, myHistory }: TitanTabProps) {
  const [titans, setTitans] = useState<TitanEntry[]>([]);
  const [inputHandle, setInputHandle] = useState('');
  const [inputError, setInputError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // ── Hydrate titan list from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cf_titans_v1');
      if (saved) {
        const handles: string[] = JSON.parse(saved);
        // Load with empty info, then fetch each
        const initial: TitanEntry[] = handles.map(h => ({
          handle: h, info: null, history: [], loading: true, error: null,
        }));
        setTitans(initial);
        initial.forEach(t => fetchTitan(t.handle));
      }
    } catch { /**/ }
    setHydrated(true);
  }, []);

  function saveTitanHandles(entries: TitanEntry[]) {
    try {
      localStorage.setItem('cf_titans_v1', JSON.stringify(entries.map(e => e.handle)));
    } catch { /**/ }
  }

  const fetchTitan = useCallback(async (handle: string) => {
    try {
      const res = await fetch(`/api/cf?url=${encodeURIComponent(`https://codeforces.com/api/user.info?handles=${handle}`)}`);
      const data = await res.json();
      if (data.status !== 'OK' || !data.result?.length) {
        setTitans(prev => prev.map(t => t.handle === handle
          ? { ...t, loading: false, error: 'Handle not found on Codeforces' }
          : t));
        return;
      }
      const info = data.result[0];

      // fetch history
      let history: any[] = [];
      try {
        const rRes = await fetch(`/api/cf?url=${encodeURIComponent(`https://codeforces.com/api/user.rating?handle=${handle}`)}`);
        const rData = await rRes.json();
        if (rData.status === 'OK') history = rData.result;
      } catch { /**/ }

      setTitans(prev => prev.map(t => t.handle === handle
        ? { ...t, info, history, loading: false, error: null }
        : t));
    } catch {
      setTitans(prev => prev.map(t => t.handle === handle
        ? { ...t, loading: false, error: 'Network error — try again' }
        : t));
    }
  }, []);

  function addTitan() {
    const h = inputHandle.trim();
    if (!h) { setInputError('Enter a handle.'); return; }
    if (titans.some(t => t.handle.toLowerCase() === h.toLowerCase())) {
      setInputError('Already tracking this handle.');
      return;
    }
    setInputError('');
    const newEntry: TitanEntry = { handle: h, info: null, history: [], loading: true, error: null };
    const updated = [...titans, newEntry];
    setTitans(updated);
    saveTitanHandles(updated);
    setInputHandle('');
    fetchTitan(h);
  }

  function removeTitan(handle: string) {
    const updated = titans.filter(t => t.handle !== handle);
    setTitans(updated);
    saveTitanHandles(updated);
  }

  if (!hydrated) return null;

  return (
    <div className="animate-in fade-in duration-400 space-y-5">

      {/* ── Add Titan panel ── */}
      <div className="relative overflow-hidden rounded-[4px] p-6"
        style={{ background: '#050505', border: '1px solid #f8514933', boxShadow: '0 0 30px rgba(248,81,73,0.06)' }}>
        <TopLine color="#f85149" />

        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#f85149] mb-2 flex items-center gap-2">
              <PulseDot color="#f85149" />
              Lock Assassination Target
            </div>
            <p className="font-mono text-[11px] text-[#333] leading-relaxed mb-4">
              Add any number of Titan targets. Each will be tracked independently with their own rating trajectory and protocol.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputHandle}
                onChange={e => { setInputHandle(e.target.value); setInputError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') addTitan(); }}
                placeholder="CF handle e.g. tourist"
                className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] text-white rounded-[3px] px-3 py-2.5 text-[13px] font-mono outline-none transition-all placeholder:text-[#222]"
                style={{ borderColor: inputError ? '#f85149' : undefined }}
                onFocus={e => { e.target.style.borderColor = '#f85149'; e.target.style.boxShadow = '0 0 0 3px rgba(248,81,73,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = inputError ? '#f85149' : '#1a1a1a'; e.target.style.boxShadow = 'none'; }}
              />
              <button onClick={addTitan}
                className="px-5 py-2.5 bg-[#f85149] text-black font-black uppercase tracking-widest text-[10px] rounded-[3px] hover:bg-[#ff6a64] transition-all shadow-[0_0_12px_rgba(248,81,73,0.25)] shrink-0">
                Lock In
              </button>
            </div>
            {inputError && (
              <div className="font-mono text-[10px] text-[#f85149] mt-1.5">{inputError}</div>
            )}
          </div>

          {/* Titan count badge */}
          <div className="flex flex-col items-center justify-center px-6 py-4 rounded-[4px] shrink-0"
            style={{ background: titans.length > 0 ? 'rgba(248,81,73,0.06)' : '#0a0a0a', border: '1px solid rgba(248,81,73,0.15)' }}>
            <div className="font-mono text-3xl font-black text-[#f85149]">{titans.length}</div>
            <div className="font-mono text-[8px] uppercase tracking-[2px] text-[#444] mt-0.5">
              {titans.length === 1 ? 'Titan' : 'Titans'} locked
            </div>
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {titans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-[4rem] opacity-10">💀</div>
          <div className="font-mono text-[11px] uppercase tracking-[3px] text-[#222]">
            No targets locked
          </div>
          <div className="font-mono text-[10px] text-[#1a1a1a]">
            Add a handle above to track your first Titan
          </div>
        </div>
      )}

      {/* ── Titan cards grid ── */}
      {titans.length > 0 && (
        <div className={`grid gap-4 ${titans.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {titans.map(titan => (
            <TitanCard
              key={titan.handle}
              titan={titan}
              myRating={myRating}
              onRemove={() => removeTitan(titan.handle)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
