"use client";

import { useState, useEffect } from 'react';

interface TitanEntry { handle: string; info: any | null; loading: boolean; error: string | null; }
interface TitanTabProps { myInfo: any; myRating: number; myHandle: string; }

function getRankColor(rank: string) {
  if (!rank) return 'var(--text-muted)';
  const r = rank.toLowerCase();
  if (r.includes('legendary')) return '#f0a500';
  if (r.includes('international')) return '#f85149';
  if (r.includes('grandmaster')) return '#f85149';
  if (r.includes('master')) return '#e879f9';
  if (r.includes('candidate')) return '#d2a8ff';
  if (r.includes('expert')) return '#58a6ff';
  if (r.includes('specialist')) return '#56d364';
  if (r.includes('pupil')) return '#56d36488';
  return 'var(--text-muted)';
}

function TitanCard({ titan, myRating, onRemove }: { titan: TitanEntry; myRating: number; onRemove: () => void }) {
  if (titan.loading) {
    return (
      <div className="rounded-xl p-5 animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg" style={{ background: 'var(--border)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded w-32" style={{ background: 'var(--border)' }} />
            <div className="h-2.5 rounded w-20" style={{ background: 'var(--border)' }} />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Fetching {titan.handle}...</p>
      </div>
    );
  }

  if (titan.error || !titan.info) {
    return (
      <div className="rounded-xl p-5 flex items-center justify-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div>
          <p className="font-mono font-bold" style={{ color: 'var(--status-wa)' }}>{titan.handle}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{titan.error || 'Handle not found.'}</p>
        </div>
        <button onClick={onRemove} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Remove</button>
      </div>
    );
  }

  const info = titan.info;
  const tRating = info.rating || 0;
  const gap = tRating - myRating;
  const neutralized = gap <= 0;
  const rankColor = getRankColor(info.rank || '');
  const bracketRating = Math.ceil((tRating) / 100) * 100;
  const contestCycles = neutralized ? 0 : Math.ceil(gap / 25);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: `1px solid ${neutralized ? 'var(--status-ac)' : 'var(--status-wa)'}33` }}>
      {/* Main header */}
      <div className="px-5 py-4 flex items-center gap-4">
        <img src={info.titlePhoto || '/api/placeholder/48/48'} alt={info.handle}
          className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ border: '1px solid var(--border)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`https://codeforces.com/profile/${info.handle}`} target="_blank"
              className="font-bold text-base font-mono hover:underline" style={{ color: rankColor }}>{info.handle}</a>
            <span className="text-xs capitalize px-2 py-0.5 rounded-full" style={{ background: `${rankColor}15`, color: rankColor, border: `1px solid ${rankColor}33` }}>{info.rank || 'unrated'}</span>
            {neutralized && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(62,207,142,0.1)', color: 'var(--status-ac)', border: '1px solid rgba(62,207,142,0.3)' }}>✓ Neutralized</span>}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{tRating}</span>
            {!neutralized && <span className="text-sm font-semibold" style={{ color: 'var(--status-wa)' }}>+{gap} gap</span>}
            {neutralized && <span className="text-sm font-semibold" style={{ color: 'var(--status-ac)' }}>{Math.abs(gap)} ahead</span>}
          </div>
        </div>
        <button onClick={onRemove} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0"
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Remove</button>
      </div>

      {/* Protocol */}
      {!neutralized && (
        <div className="px-5 pb-4 grid grid-cols-3 gap-3">
          {[['Gap', `${gap} pts`, 'var(--status-wa)'], ['Target Caliber', `${bracketRating}+`, 'var(--accent)'], ['ETA', `~${contestCycles} contests`, 'var(--status-ac)']].map(([label, val, color]) => (
            <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="font-mono font-bold text-sm" style={{ color: color as string }}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {(info.contribution !== undefined || info.organization) && (
        <div className="px-5 pb-4 flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          {info.contribution !== undefined && (
            <span>Contribution: <span style={{ color: info.contribution >= 0 ? 'var(--status-ac)' : 'var(--status-wa)' }}>{info.contribution >= 0 ? '+' : ''}{info.contribution}</span></span>
          )}
          {info.organization && <span>Org: {info.organization}</span>}
        </div>
      )}
    </div>
  );
}

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
        setTitans(saved.map(h => ({ handle: h, info: null, loading: true, error: null })));
        saved.forEach(h => fetchTitan(h));
      }
    } catch {}
    setLoaded(true);
  }, []);

  function saveTitanHandles(list: TitanEntry[]) {
    try { localStorage.setItem('cf_titans_v1', JSON.stringify(list.map(t => t.handle))); } catch {}
  }

  async function fetchTitan(handle: string) {
    try {
      const res = await fetch(`/api/cf?url=${encodeURIComponent(`https://codeforces.com/api/user.info?handles=${handle}`)}`);
      const data = await res.json();
      if (data.status === 'OK' && data.result?.length > 0) {
        const info = data.result[0];
        setTitans(prev => prev.map(t => t.handle.toLowerCase() === handle.toLowerCase() ? { ...t, info, loading: false, error: null, handle: info.handle } : t));
      } else {
        setTitans(prev => prev.map(t => t.handle.toLowerCase() === handle.toLowerCase() ? { ...t, loading: false, error: 'Handle not found.' } : t));
      }
    } catch {
      setTitans(prev => prev.map(t => t.handle.toLowerCase() === handle.toLowerCase() ? { ...t, loading: false, error: 'Fetch failed.' } : t));
    }
  }

  async function addTitan() {
    const h = inputHandle.trim();
    if (!h) { setAddError('Enter a handle.'); return; }
    if (titans.some(t => t.handle.toLowerCase() === h.toLowerCase())) { setAddError('Already tracking.'); return; }
    setAddError(''); setAdding(true); setInputHandle('');
    const newEntry: TitanEntry = { handle: h, info: null, loading: true, error: null };
    setTitans(prev => { const next = [...prev, newEntry]; saveTitanHandles(next); return next; });
    await fetchTitan(h);
    setAdding(false);
  }

  function removeTitan(handle: string) {
    setTitans(prev => { const next = prev.filter(t => t.handle !== handle); saveTitanHandles(next); return next; });
  }

  const resolvedTitans = titans.filter(t => !t.loading && !t.error && t.info);
  const neutralized = resolvedTitans.filter(t => (t.info?.rating || 0) <= myRating).length;
  const active = resolvedTitans.filter(t => (t.info?.rating || 0) > myRating);

  return (
    <div className="animate-in fade-in duration-300 flex flex-col gap-5">

      {/* Add titan */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>🎯 Lock a Target</p>
        <div className="flex gap-3">
          <input type="text" value={inputHandle} onChange={e => setInputHandle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTitan()}
            placeholder="Codeforces handle..."
            className="flex-1 text-sm px-4 py-2.5 rounded-lg outline-none font-mono"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-main)' }} />
          <button onClick={addTitan} disabled={adding}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)', border: 'none' }}>
            {adding ? '...' : '+ Lock'}
          </button>
        </div>
        {addError && <p className="text-xs mt-2" style={{ color: 'var(--status-wa)' }}>{addError}</p>}
      </div>

      {/* Summary strip */}
      {resolvedTitans.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[['Tracked', resolvedTitans.length, 'var(--text-main)'], ['Active Targets', active.length, 'var(--status-wa)'], ['Neutralized', neutralized, 'var(--status-ac)']].map(([label, val, color]) => (
            <div key={label as string} className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl font-bold mb-1" style={{ color: color as string }}>{val as number}</p>
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label as string}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {loaded && titans.length === 0 && (
        <div className="rounded-xl p-14 text-center" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
          <div className="text-4xl mb-4">💀</div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>No targets locked</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Add a Codeforces handle to start tracking.</p>
        </div>
      )}

      {/* Titan cards */}
      <div className="flex flex-col gap-4">
        {titans.map(titan => (
          <TitanCard key={titan.handle} titan={titan} myRating={myRating} onRemove={() => removeTitan(titan.handle)} />
        ))}
      </div>
    </div>
  );
}
