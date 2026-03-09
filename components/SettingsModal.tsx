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
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#020202] w-full max-w-lg relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Razor gold accent line */}
        <div className="absolute top-0 left-0 w-full h-px bg-[#c5a059]/50" />

        {/* Outer border */}
        <div className="border border-white/[0.05] p-10">

          {/* Header */}
          <h2 className="font-serif text-xl font-normal text-white/80 tracking-wide mb-1">
            System Configuration
          </h2>
          <div className="w-6 h-px bg-white/10 mb-8 mt-2" />

          {/* Fields */}
          <div className="space-y-7 font-mono">
            <div>
              <label className="block font-mono text-[9px] tracking-[3px] uppercase text-white/25 mb-3">
                Your Handle
              </label>
              <input
                type="text"
                value={main}
                onChange={e => setMain(e.target.value)}
                className="w-full bg-transparent border border-white/10 text-white/70 px-3 py-2.5 font-mono text-sm tracking-wide focus:outline-none focus:border-[#c5a059]/60 focus:text-white/90 transition-colors duration-200 placeholder:text-white/15"
                placeholder="handle"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] tracking-[3px] uppercase text-white/25 mb-3">
                The Squad
                <span className="ml-3 text-white/15 normal-case tracking-normal">max 2, comma separated</span>
              </label>
              <input
                type="text"
                value={squad}
                onChange={e => setSquad(e.target.value)}
                className="w-full bg-transparent border border-white/10 text-white/70 px-3 py-2.5 font-mono text-sm tracking-wide focus:outline-none focus:border-[#c5a059]/60 focus:text-white/90 transition-colors duration-200 placeholder:text-white/15"
                placeholder="handle1, handle2"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] tracking-[3px] uppercase text-white/25 mb-3">
                The Titan
                <span className="ml-3 text-white/15 normal-case tracking-normal">target / nemesis</span>
              </label>
              <input
                type="text"
                value={titan}
                onChange={e => setTitan(e.target.value)}
                className="w-full bg-transparent border border-white/10 text-white/70 px-3 py-2.5 font-mono text-sm tracking-wide focus:outline-none focus:border-[#c5a059]/60 focus:text-white/90 transition-colors duration-200 placeholder:text-white/15"
                placeholder="handle"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-10 space-y-3">
            <button
              onClick={handleSave}
              className="w-full bg-transparent border border-[#c5a059]/40 text-[#c5a059]/70 font-mono text-[10px] tracking-[4px] uppercase py-3.5 hover:border-[#c5a059]/70 hover:text-[#c5a059] hover:bg-[rgba(197,160,89,0.04)] transition-all duration-200 cursor-pointer"
            >
              Initialize Engine
            </button>
            <button
              onClick={onClose}
              className="w-full bg-transparent border border-white/[0.07] text-white/20 font-mono text-[10px] tracking-[4px] uppercase py-3 hover:border-white/15 hover:text-white/40 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
