"use client";

import { useState, useEffect } from 'react';

interface TitanEntry {
  handle: string;
  info: any | null;
  loading: boolean;
  error: string | null;
}

interface TitanTabProps {
  myInfo: any;
  myRating: number;
  myHandle: string;
}

function TopLine({ color }: { color: string }) {
  return <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
}

function getRankColor(rank: string) {
  if (!rank) return '#888';
  const r = rank.toLowerCase();
  if (r.includes('legendary')) return '#f0a500';
  if (r.includes('international grandmaster') || r.includes('international master')) return '#f85149';
  if (r.includes('grandmaster')) return '#f85149';
  if (r.includes('master')) return '#e879f9';
  if (r.includes('candidate')) return '#d2a8ff';
  if (r.includes('expert')) return '#58a6ff';
  if (r.includes('specialist')) return '#56d364';
  if (r.includes('pupil')) return '#56d36488';
  return '#666';
}

function TitanCard({ titan, myRating, myHandle, onRemove }: {
  titan: TitanEntry; myRating: number; myHandle: string; onRemove: () => void;
}) {
  if (titan.loading) {
    return (
      <div className="relative overflow-hidden rounded-[4px] p-6 animate-pulse"
        style={{ background: '#050505', border: '1px solid #f8514922' }}>
        <TopLine color="#f85149" />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[4px] bg-[#111]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[#111] rounded w-32" />
            <div className="h-3 bg-[#0a0a0a] rounded w-20" />
          </div>
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#222] mt-4 animate-pulse">
          Fetching intel on {titan.handle}...
        </div>
      </div>
    );
  }

  if (titan.error || !titan.info) {
    return (
      <div className="relative overflow-hidden rounded-[4px] p-5"
        style={{ background: '#050505', border: '1px solid #f8514933' }}>
        <TopLine color="#f85149" />
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[#f85149] font-bold">{titan.handle}</div>
            <div className="font-mono text-[10px] text-[#555] mt-1">{titan.error || 'Handle not found.'}</div>
          </div>
          <button onClick={onRemove}
            className="font-mono text-[9px] text-[#333] hover:text-[#f85149] transition-colors border border-[#1a1a1a] hover:border-[#f85149]/40 px-3 py-1.5 rounded-[3px] uppercase tracking-wider">
            Remove
          </button>
        </div>
      </div>
    );
  }

  const info = titan.info;
  const tRating = info.rating || 0;
  const gap = tRating - myRating;
  const neutralized = gap <= 0;
  const rankColor = getRankColor(info.rank || '');
  const contestCycles = neutralized ? 0 : Math.ceil(gap / 15);
  const bracketRating = Math.floor((info.rating || 1500) / 100) * 100;
  const progressPct = myRating > 0 && tRating > 0 ? Math.min(99, (myRating / tRating) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-[4px]"
      style={{
        background: neutralized
          ? 'radial-gradient(ellipse at top left, #001a06 0%, #050505 60%)'
          : 'radial-gradient(ellipse at top left, #150000 0%, #050505 60%)',
        border: `1px solid ${neutralized ? '#56d36433' : '#f8514933'}`,
        boxShadow: neutralized ? '0 0 24px rgba(86,211,100,0.04)' : '0 0 24px rgba(248,81,73,0.06)',
      }}>
      <TopLine color={neutralized ? '#56d364' : '#f85149'} />

      {/* Card header */}
      <div className="p-6 flex items-start gap-5">
        {info.titlePhoto && (
          <img src={info.titlePhoto} alt={info.handle}
            className="w-16 h-16 rounded-[4px] object-cover shrink-0"
            style={{ border: `2px solid ${rankColor}44` }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-xl font-black tracking-tight leading-none" style={{ color: rankColor }}>
                {info.handle}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[2px] text-[#444] mt-1">
                {info.rank || 'unranked'}
                {info.maxRating ? <span className="text-[#2a2a2a] ml-2">· peak {info.maxRating}</span> : null}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {neutralized ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#56d364] border border-[#56d364]/30 px-2 py-1 rounded-[3px]">
                    ✓ Neutralized
                  </span>
                  <span className="font-mono text-[#56d364] font-bold text-sm">{tRating}</span>
                </div>
              ) : (
                <div className="text-right">
                  <div className="font-mono text-2xl font-black text-[#f85149]">{tRating}</div>
                  <div className="font-mono text-[8px] text-[#333] uppercase tracking-wider">rating</div>
                </div>
              )}
              <button onClick={onRemove}
                className="font-mono text-[9px] text-[#222] hover:text-[#f85149] transition-colors border border-[#111] hover:border-[#f85149]/30 w-7 h-7 flex items-center justify-center rounded-[3px]">
                ✕
              </button>
            </div>
          </div>

          {/* Progress bar toward titan */}
          {!neutralized && myRating > 0 && (
            <div className="mt-4">
              <div className="flex justify-between font-mono text-[9px] text-[#333] mb-1.5">
                <span style={{ color: '#e3b341' }}>{myHandle} — {myRating}</span>
                <span className="text-[#f85149]">gap: {gap} pts</span>
              </div>
              <div className="h-[3px] bg-[#111] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #e3b341, #f85149)',
                    boxShadow: '0 0 6px rgba(248,81,73,0.3)',
                  }} />
              </div>
              <div className="flex justify-between font-mono text-[8px] text-[#222] mt-1">
                <span>{progressPct.toFixed(0)}% of the way there</span>
                <span>{tRating} target</span>
              </div>
            </div>
          )}

          {neutralized && (
            <div className="mt-2 font-mono text-[11px] text-[#56d364]">
              Surpassed by {Math.abs(gap)} points. Time to find a new target.
            </div>
          )}
        </div>
      </div>

      {/* Protocol section */}
      {!neutralized && (
        <div className="border-t border-[#f85149]/10 px-6 py-4">
          <div className="font-mono text-[8px] uppercase tracking-[2px] text-[#f85149] mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-[#f85149] animate-pulse" />
            Assassination Protocol
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#f8514906] border border-[#f85149]/10 rounded-[3px] px-3 py-2.5">
              <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#444] mb-1">Gap</div>
              <div className="font-mono text-lg font-black text-[#f85149]">{gap} <span className="text-[10px] text-[#444]">pts</span></div>
            </div>
            <div className="bg-[#e3b34108] border border-[#e3b341]/10 rounded-[3px] px-3 py-2.5">
              <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#444] mb-1">Target Caliber</div>
              <div className="font-mono text-lg font-black text-[#e3b341]">{bracketRating}+ <span className="text-[10px] text-[#444]">rated</span></div>
            </div>
            <div className="bg-[#56d36406] border border-[#56d364]/10 rounded-[3px] px-3 py-2.5">
              <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#444] mb-1">ETA</div>
              <div className="font-mono text-lg font-black text-[#56d364]">~{contestCycles} <span className="text-[10px] text-[#444]">contests</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Footer stats */}
      {(info.contribution !== undefined || info.friendOfCount !== undefined) && (
        <div className="border-t border-[#0f0f0f] px-6 py-3 flex gap-6">
          {info.contribution !== undefined && (
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#2a2a2a]">Contribution</div>
              <div className="font-mono text-[12px] font-bold" style={{ color: info.contribution >= 0 ? '#56d364' : '#f85149' }}>
                {info.contribution >= 0 ? '+' : ''}{info.contribution}
              </div>
            </div>
          )}
          {info.friendOfCount !== undefined && (
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#2a2a2a]">Friend of</div>
              <div className="font-mono text-[12px] font-bold text-[#555]">{info.friendOfCount.toLocaleString()}</div>
            </div>
          )}
          {info.organization && (
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#2a2a2a]">Org</div>
              <div className="font-mono text-[12px] text-[#555] truncate max-w-[160px]">{info.organization}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function TitanTab({ myInfo, myRating, myHandle }: TitanTabProps) {
  const [titans, setTitans] = useState<TitanEntry[]>([]);
  const [inputHandle, setInputHandle] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cf_titans_v1') || '[]') as string[];
      if (saved.length > 0) {
        const initial: TitanEntry[] = saved.map(h => ({ handle: h, info: null, loading: true, error: null }));
        setTitans(initial);
        saved.forEach(h => fetchTitan(h));
      }
    } catch { /**/ }
    setLoaded(true);
  }, []);

  function saveTitanHandles(list: TitanEntry[]) {
    try { localStorage.setItem('cf_titans_v1', JSON.stringify(list.map(t => t.handle))); } catch { /**/ }
  }

  async function fetchTitan(handle: string) {
    try {
      const res = await fetch(`/api/cf?url=${encodeURIComponent(`https://codeforces.com/api/user.info?handles=${handle}`)}`);
      const data = await res.json();
      if (data.status === 'OK' && data.result?.length > 0) {
        const info = data.result[0];
        setTitans(prev => prev.map(t =>
          t.handle.toLowerCase() === handle.toLowerCase()
            ? { ...t, info, loading: false, error: null, handle: info.handle }
            : t
        ));
      } else {
        setTitans(prev => prev.map(t =>
          t.handle.toLowerCase() === handle.toLowerCase()
            ? { ...t, loading: false, error: 'Handle not found on Codeforces.' }
            : t
        ));
      }
    } catch {
      setTitans(prev => prev.map(t =>
        t.handle.toLowerCase() === handle.toLowerCase()
          ? { ...t, loading: false, error: 'Failed to fetch — check your connection.' }
          : t
      ));
    }
  }

  async function addTitan() {
    const h = inputHandle.trim();
    if (!h) { setAddError('Enter a handle.'); return; }
    if (titans.some(t => t.handle.toLowerCase() === h.toLowerCase())) {
      setAddError('Already tracking this titan.'); return;
    }
    setAddError('');
    setAdding(true);
    setInputHandle('');

    const newEntry: TitanEntry = { handle: h, info: null, loading: true, error: null };
    setTitans(prev => {
      const next = [...prev, newEntry];
      saveTitanHandles(next);
      return next;
    });

    await fetchTitan(h);
    setAdding(false);
  }

  function removeTitan(handle: string) {
    setTitans(prev => {
      const next = prev.filter(t => t.handle !== handle);
      saveTitanHandles(next);
      return next;
    });
  }

  const resolvedTitans = titans.filter(t => !t.loading && !t.error && t.info);
  const neutralizedCount = resolvedTitans.filter(t => (t.info?.rating || 0) <= myRating).length;
  const activeTargets = resolvedTitans.filter(t => (t.info?.rating || 0) > myRating);
  const closestGap = activeTargets.length > 0
    ? Math.min(...activeTargets.map(t => (t.info?.rating || 0) - myRating))
    : null;

  return (
    <div className="animate-in fade-in duration-400 space-y-5">

      {/* Header */}
      <div className="relative overflow-hidden rounded-[4px] p-6"
        style={{ background: 'radial-gradient(ellipse at top, #180000 0%, #050505 70%)', border: '1px solid #f8514930', boxShadow: '0 0 30px rgba(248,81,73,0.06)' }}>
        <TopLine color="#f85149" />
        <div className="absolute bottom-0 right-8 text-[5rem] opacity-[0.025] leading-none select-none">💀</div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div>
            <h2 className="font-mono text-xl font-black uppercase tracking-widest text-[#f85149] m-0 mb-1">
              Titan Board
            </h2>
            <p className="font-mono text-[10px] text-[#333] uppercase tracking-[1.5px]">
              {resolvedTitans.length > 0
                ? `${resolvedTitans.length} target${resolvedTitans.length > 1 ? 's' : ''} · ${neutralizedCount} neutralized`
                : 'Designate your assassination targets'}
            </p>
            {resolvedTitans.length > 0 && (
              <div className="flex gap-5 mt-4 pt-4 border-t border-[#f85149]/10">
                <div>
                  <div className="font-mono text-[8px] text-[#333] uppercase tracking-[1.5px]">Locked</div>
                  <div className="font-mono text-xl font-black text-[#f85149]">{resolvedTitans.length}</div>
                </div>
                {neutralizedCount > 0 && (
                  <div>
                    <div className="font-mono text-[8px] text-[#333] uppercase tracking-[1.5px]">Neutralized</div>
                    <div className="font-mono text-xl font-black text-[#56d364]">{neutralizedCount}</div>
                  </div>
                )}
                {closestGap !== null && (
                  <div>
                    <div className="font-mono text-[8px] text-[#333] uppercase tracking-[1.5px]">Closest gap</div>
                    <div className="font-mono text-xl font-black text-[#e3b341]">{closestGap}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add input */}
          <div className="flex flex-col gap-1.5 w-full md:w-72 shrink-0">
            <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#333] mb-0.5">Add target</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputHandle}
                onChange={e => { setInputHandle(e.target.value); setAddError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') addTitan(); }}
                placeholder="CF handle…"
                className="flex-1 min-w-0 bg-[#050505] border border-[#f85149]/20 text-white rounded-[3px] px-3 py-2.5 text-[12px] font-mono outline-none focus:border-[#f85149]/60 focus:shadow-[0_0_0_2px_rgba(248,81,73,0.1)] placeholder:text-[#222] transition-all"
              />
              <button
                onClick={addTitan}
                disabled={adding}
                className="shrink-0 px-4 py-2.5 bg-[#f85149] text-black font-black uppercase tracking-widest text-[10px] rounded-[3px] hover:bg-[#ff6a64] transition-all shadow-[0_0_10px_rgba(248,81,73,0.2)] disabled:opacity-40 disabled:cursor-not-allowed">
                {adding ? '…' : '+ Lock'}
              </button>
            </div>
            {addError && <div className="font-mono text-[9px] text-[#f85149]">{addError}</div>}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {loaded && titans.length === 0 && (
        <div className="rounded-[4px] p-14 text-center" style={{ background: '#050505', border: '1px dashed #1a1a1a' }}>
          <div className="text-4xl mb-4">💀</div>
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[#1a1a1a] mb-2">No targets designated</div>
          <div className="font-mono text-[9px] text-[#111]">Type a Codeforces handle above and hit Lock.</div>
        </div>
      )}

      {/* Titan cards */}
      <div className="space-y-4">
        {titans.map(titan => (
          <TitanCard
            key={titan.handle}
            titan={titan}
            myRating={myRating}
            myHandle={myHandle}
            onRemove={() => removeTitan(titan.handle)}
          />
        ))}
      </div>
    </div>
  );
}
