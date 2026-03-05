"use client";

import { useState } from "react";

export interface BadgeDef { id: string; icon: string; name: string; desc: string; owner: string | null; isNegative?: boolean; }

export default function Armory({ badges, mainHandle, variant = 'full' }: { badges: BadgeDef[], mainHandle: string, variant?: 'full' | 'mini' }) {
  const [modalData, setModalData] = useState<BadgeDef | null>(null);

  if (variant === 'mini') {
    const myBadges = badges.filter(b => b.owner === mainHandle);
    return (
      <div className="mt-4 pt-4 border-t border-dashed border-[#30363d] flex flex-wrap gap-2.5">
        {myBadges.length === 0 ? <div className="text-[#8b949e] text-xs font-mono">No active badges claimed.</div> : 
          myBadges.map(b => (
            <div key={b.id} title={b.desc} className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-[20px] text-[0.75rem] font-bold border border-[#30363d] hover:border-[#e3b341] hover:text-[#e3b341] transition-colors cursor-pointer text-[#e0e6ed]">
              <span className="text-sm drop-shadow-md">{b.icon}</span> {b.name}
            </div>
          ))
        }
      </div>
    );
  }

  return (
    <>
      {modalData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex justify-center items-center z-[1000] p-4" onClick={() => setModalData(null)}>
          <div className="bg-[#1e2024] p-10 rounded-xl border border-[#30363d] w-[450px] max-w-[90%] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="mt-0 font-mono text-[#e3b341] text-2xl font-bold mb-1">[{modalData.name.toUpperCase()}]</h2>
            <div className="text-[#8b949e] font-mono text-[0.8rem] mb-4">{modalData.owner ? `CURRENT OWNER: ${modalData.owner}` : 'STATUS: UNCLAIMED'}</div>
            <div className="text-[0.9rem] text-[#e0e6ed] mb-6 leading-relaxed">{modalData.desc}</div>
            <button onClick={() => setModalData(null)} className="w-full bg-transparent text-[#8b949e] border border-[#30363d] p-2 rounded-md cursor-pointer mt-2 transition-colors hover:bg-white/5 font-mono">CLOSE</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
        {badges.map(b => {
          const isMe = b.owner === mainHandle;
          const isSquad = b.owner && !isMe;
          const isNegative = b.id === 'mostwanted' || b.id === 'b_pyro' || b.id === 'b_ruined';

          let bClass = "bg-[rgba(0,0,0,0.2)] border-[#30363d] border-l-transparent opacity-40 grayscale";
          if (b.owner) {
            bClass = "bg-[#1e2024] border-[#30363d] opacity-100 hover:-translate-y-0.5 hover:bg-[#2b2e33] shadow-[0_5px_15px_rgba(0,0,0,0.3)]";
            if (isNegative) bClass += " border-l-[#f85149] bg-[rgba(248,81,73,0.05)]";
            else if (isMe) bClass += " border-l-[#e3b341] bg-[rgba(227,179,65,0.05)]";
            else if (isSquad) bClass += " border-l-[#58a6ff] bg-[rgba(88,166,255,0.05)]";
          }

          return (
            <div key={b.id} onClick={() => setModalData(b)} className={`flex items-center gap-3 p-3 rounded-md border border-l-[3px] cursor-pointer transition-all duration-300 ${bClass}`}>
              <div className="text-[1.8rem] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{b.icon}</div>
              <div className="flex flex-col">
                <span className={`font-bold text-[0.85rem] ${b.owner ? 'text-white' : 'text-[#8b949e]'}`}>{b.name}</span>
                <span className="font-mono text-[0.75rem] text-[#8b949e] mt-[2px]">{b.owner || 'Unclaimed'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}