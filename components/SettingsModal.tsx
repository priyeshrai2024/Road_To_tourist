"use client";

import { useState, useEffect } from "react";

export default function SettingsModal({ onClose, onSave }: { onClose: () => void, onSave: (cfg: any) => void }) {
  const [main, setMain] = useState("");
  const [squad, setSquad] = useState("");
  const [titan, setTitan] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem('cf_config_v6');
    if (saved) {
      const cfg = JSON.parse(saved);
      setMain(cfg.main || "");
      setSquad(cfg.squad?.join(", ") || "");
      setTitan(cfg.titan || "");
    }
  }, []);

  const handleSave = () => {
    const cfg = {
      main: main.trim(),
      squad: squad.split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 2), // Strict Max 2 matching HTML
      titan: titan.trim()
    };
    localStorage.setItem('cf_config_v6', JSON.stringify(cfg));
    onSave(cfg);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex justify-center items-center z-[1000] p-4">
      <div className="bg-[#1e2024] p-10 rounded-xl border border-[#30363d] w-full max-w-lg shadow-2xl">
        <h2 className="text-[#e3b341] font-mono text-2xl font-bold mb-6 tracking-widest">[ CONFIGURATION ]</h2>
        <div className="space-y-5 font-mono">
          <div>
            <label className="block text-xs text-[#8b949e] uppercase mb-2 font-bold">Your Handle</label>
            <input type="text" value={main} onChange={e => setMain(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] text-[#e0e6ed] p-3 rounded focus:outline-none focus:border-[#58a6ff]" />
          </div>
          <div>
            <label className="block text-xs text-[#8b949e] uppercase mb-2 font-bold">The Squad (Max 2 handles, comma separated)</label>
            <input type="text" value={squad} onChange={e => setSquad(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] text-[#e0e6ed] p-3 rounded focus:outline-none focus:border-[#58a6ff]" />
          </div>
          <div>
            <label className="block text-xs text-[#8b949e] uppercase mb-2 font-bold">The Titan (Target)</label>
            <input type="text" value={titan} onChange={e => setTitan(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] text-[#e0e6ed] p-3 rounded focus:outline-none focus:border-[#58a6ff]" />
          </div>
        </div>
        <button onClick={handleSave} className="w-full mt-8 bg-[#e3b341] text-black font-bold py-4 rounded text-sm uppercase tracking-wider hover:bg-[#c49a30] transition-colors font-mono">INITIALIZE ENGINE</button>
        <button onClick={onClose} className="w-full mt-3 bg-transparent border border-[#30363d] text-[#8b949e] py-2 rounded text-sm uppercase transition-colors hover:bg-white/5 font-mono">CLOSE</button>
      </div>
    </div>
  );
}