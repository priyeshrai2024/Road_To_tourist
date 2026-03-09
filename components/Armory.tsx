"use client";
import { useState } from "react";

export interface BadgeDef { id: string; icon: string; name: string; desc: string; owner: string | null; isNegative?: boolean; }

export default function Armory({ badges, mainHandle, variant = 'full' }: { badges: BadgeDef[], mainHandle: string, variant?: 'full' | 'mini' }) {
  const [modalData, setModalData] = useState<BadgeDef | null>(null);

  if (variant === 'mini') {
    const myBadges = badges.filter(b => b.owner === mainHandle);
    return (
      <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
        {myBadges.length === 0
          ? <div className="font-mono text-[9px] tracking-[3px] uppercase text-white/20">No active badges claimed.</div>
          : myBadges.map(b => (
            <div
              key={b.id}
              title={b.desc}
              className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] tracking-[2px] uppercase text-white/40 border border-white/10 hover:border-[#c5a059]/50 hover:text-[#c5a059]/80 transition-all duration-200 cursor-pointer bg-transparent"
            >
              <span className="text-sm">{b.icon}</span>
              {b.name}
            </div>
          ))
        }
      </div>
    );
  }

  return (
    <>
      {/* Modal */}
      {modalData && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-[2px] flex justify-center items-center z-[1000] p-4"
          onClick={() => setModalData(null)}
        >
          <div
            className="bg-[#030303] border border-white/[0.07] w-[440px] max-w-[90%] p-10 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Single razor accent line at top, color-coded */}
            <div className={`absolute top-0 left-0 w-full h-px ${
              modalData.id === 'mostwanted' || modalData.id === 'b_pyro' || modalData.id === 'b_ruined'
                ? 'bg-[#f85149]/70'
                : modalData.owner === mainHandle
                  ? 'bg-[#c5a059]/70'
                  : modalData.owner
                    ? 'bg-white/20'
                    : 'bg-white/5'
            }`} />

            <div className="text-3xl mb-6">{modalData.icon}</div>

            <h2 className="font-serif text-xl font-normal text-white/90 tracking-wide mb-2">
              {modalData.name}
            </h2>

            <p className="font-mono text-[9px] tracking-[4px] uppercase text-white/25 mb-8">
              {modalData.owner ? `Held by ${modalData.owner}` : 'Status: Unclaimed'}
            </p>

            <div className="w-6 h-px bg-white/10 mb-6" />

            <p className="font-mono text-[11px] tracking-[0.5px] text-white/45 leading-relaxed mb-10">
              {modalData.desc}
            </p>

            <button
              onClick={() => setModalData(null)}
              className="font-mono text-[9px] tracking-[4px] uppercase text-white/20 hover:text-white/50 transition-colors duration-200 bg-transparent border-none cursor-pointer p-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Badge Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-white/[0.04] mt-4">
        {badges.map(b => {
          const isMe = b.owner === mainHandle;
          const isSquad = b.owner && !isMe;
          const isNegative = b.id === 'mostwanted' || b.id === 'b_pyro' || b.id === 'b_ruined';

          // Unclaimed
          if (!b.owner) {
            return (
              <div
                key={b.id}
                onClick={() => setModalData(b)}
                className="bg-[#020202] p-4 flex items-center gap-3 cursor-pointer group transition-all duration-200 hover:bg-[#060606]"
              >
                <div className="text-2xl opacity-20 grayscale">{b.icon}</div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[10px] tracking-[1px] uppercase text-white/15 truncate">{b.name}</span>
                  <span className="font-mono text-[9px] tracking-[2px] uppercase text-white/10 mt-0.5">Unclaimed</span>
                </div>
              </div>
            );
          }

          // Claimed — derive accent color
          const accentBorder = isNegative
            ? 'border-l border-l-[#f85149]'
            : isMe
              ? 'border-l border-l-[#c5a059]'
              : isSquad
                ? 'border-l border-l-white/20'
                : '';

          const hoverBg = isNegative
            ? 'hover:bg-[rgba(248,81,73,0.04)]'
            : isMe
              ? 'hover:bg-[rgba(197,160,89,0.04)]'
              : 'hover:bg-white/[0.03]';

          const nameColor = isNegative
            ? 'text-[#f85149]/80 group-hover:text-[#f85149]'
            : isMe
              ? 'text-[#c5a059]/80 group-hover:text-[#c5a059]'
              : 'text-white/55 group-hover:text-white/80';

          return (
            <div
              key={b.id}
              onClick={() => setModalData(b)}
              className={`bg-[#020202] p-4 flex items-center gap-3 cursor-pointer group transition-all duration-200 ${accentBorder} ${hoverBg}`}
            >
              <div className="text-2xl shrink-0">{b.icon}</div>
              <div className="flex flex-col min-w-0">
                <span className={`font-mono text-[10px] tracking-[1px] uppercase truncate transition-colors duration-200 ${nameColor}`}>
                  {b.name}
                </span>
                <span className="font-mono text-[9px] tracking-[1px] text-white/20 mt-0.5 truncate group-hover:text-white/35 transition-colors duration-200">
                  {b.owner}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
