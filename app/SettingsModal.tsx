"use client";

import { useState, useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { THEMES, getTheme, applyTheme, DEFAULT_THEME_ID } from "@/lib/themes";

export default function SettingsModal({ onClose, onSave }: { onClose: () => void, onSave: (cfg: any) => void }) {
  const [main, setMain]       = useState("");
  const [squad, setSquad]     = useState("");
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        const cfg = JSON.parse(saved);
        setMain(cfg.main || "");
        setSquad(cfg.squad?.join(", ") || "");
      }
    } catch { console.warn('[Settings] Could not read saved config.'); }

    try {
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme) setThemeId(savedTheme);
    } catch {}
  }, []);

  const handleThemeSelect = (id: string) => {
    setThemeId(id);
    applyTheme(getTheme(id));
    try { localStorage.setItem(STORAGE_KEYS.THEME, id); } catch {}
  };

  const handleSave = () => {
    const cfg = {
      main:  main.trim(),
      squad: squad.split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 2),
      titan: "",
    };
    try { localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg)); } catch { console.warn('[Settings] Could not persist config.'); }
    onSave(cfg);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex justify-center items-center z-[1000] p-4">
      <div className="p-8 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col gap-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

        <h2 className="font-bold text-xl tracking-wide" style={{ color: 'var(--accent)' }}>
          Configuration
        </h2>

        {/* Handles */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2 font-semibold"
              style={{ color: 'var(--text-muted)' }}>Your Handle</label>
            <input
              type="text"
              value={main}
              onChange={e => setMain(e.target.value)}
              placeholder="e.g. tourist"
              className="w-full p-3 rounded-lg text-sm outline-none transition-colors font-mono"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2 font-semibold"
              style={{ color: 'var(--text-muted)' }}>Squad Handles <span className="normal-case font-normal opacity-60">(max 2, comma separated)</span></label>
            <input
              type="text"
              value={squad}
              onChange={e => setSquad(e.target.value)}
              placeholder="e.g. handle1, handle2"
              className="w-full p-3 rounded-lg text-sm outline-none transition-colors font-mono"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
            />
          </div>
          <p className="text-xs rounded-lg px-3 py-2" style={{ color: 'var(--text-dim)', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            💀 Titans are managed in the <span style={{ color: 'var(--status-wa)' }}>TITAN</span> tab.
          </p>
        </div>

        {/* Theme Switcher */}
        <div>
          <label className="block text-xs uppercase tracking-widest mb-3 font-semibold"
            style={{ color: 'var(--text-muted)' }}>Theme</label>
          <div className="flex flex-col gap-2">
            {THEMES.map(theme => {
              const isActive = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all cursor-pointer"
                  style={{
                    background: isActive ? 'var(--accent-15)' : 'var(--bg-base)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    color: isActive ? 'var(--accent)' : 'var(--text-main)',
                  }}
                >
                  <div className="flex gap-1 shrink-0">
                    {theme.c.slice(0, 5).map((color, i) => (
                      <div key={i} className="w-3.5 h-3.5 rounded-full border border-white/10"
                        style={{ background: color }} />
                    ))}
                  </div>
                  <span className="text-sm font-medium flex-1">{theme.emoji} {theme.name}</span>
                  {isActive && (
                    <span className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: 'var(--accent)' }}>Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)', border: 'none' }}
          >
            Save & Initialize
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
