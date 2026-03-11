// ─── BADGE FACTORY — 100 BADGES ───────────────────────────────────────────────
import { BadgeDef } from "@/components/Armory";
import { CF_SCORE_MAP } from "@/lib/constants";
import type { CFSubmission, SquadMemberData } from "@/lib/types";

interface BMatrix {
  [player: string]: { active: string[]; resurrected: number; solvedSet: Set<string>; snipes: number; };
}
interface MapMetrics {
  conquered: number; citadel: number; rebellion: number; occupied: number; decaying: number; scouted: number;
}

export function computeBadges(
  allPlayers: string[],
  sMatrix: Record<string, SquadMemberData>,
  bMatrix: BMatrix,
  reconMetrics: { unique: number },
  mapMetrics: MapMetrics,
  mainHandle: string,
  now: number
): BadgeDef[] {

  // ── helpers ────────────────────────────────────────────────────────────────
  const ac   = (p: string, d: number) => sMatrix[p].metrics.rawSubsList.filter((s: CFSubmission) => s.verdict === 'OK' && (now - s.creationTimeSeconds) / 86400 <= d);
  const subs = (p: string, d: number) => sMatrix[p].metrics.rawSubsList.filter((s: CFSubmission) => (now - s.creationTimeSeconds) / 86400 <= d);
  const allAc = (p: string) => sMatrix[p].metrics.rawSubsList.filter((s: CFSubmission) => s.verdict === 'OK');
  const tags = (p: string, d: number, t: string) => ac(p, d).filter((s: CFSubmission) => s.problem.tags?.includes(t)).length;
  const maxR = (p: string, d: number) => Math.max(0, ...ac(p, d).map((s: CFSubmission) => s.problem.rating || 0));
  const pts  = (p: string, d: number) => ac(p, d).reduce((sum, s) => sum + (CF_SCORE_MAP[Math.min(2400, Math.floor((s.problem.rating || 800) / 100) * 100)] || 10), 0);
  const activeDays = (p: string, d: number) => new Set(ac(p, d).map((s: CFSubmission) => new Date(s.creationTimeSeconds * 1000).toDateString())).size;
  const acc  = (p: string, d: number) => { const a = subs(p, d); return a.length > 0 ? ac(p, d).length / a.length : 0; };
  const hour = (p: string, d: number, h1: number, h2: number) => ac(p, d).filter((s: any) => { const h = new Date(s.creationTimeSeconds * 1000).getHours(); return h >= h1 && h < h2; }).length;
  const distinctTags = (p: string, d: number) => { const t = new Set<string>(); ac(p, d).forEach((s: any) => s.problem.tags?.forEach((x: string) => t.add(x))); return t.size; };

  // ── FIX #2: shared ISO date key — zero-padded YYYY-MM-DD ─────────────────
  // Previously streak() used `${year}-${month}-${date}` (month 0-indexed, no padding)
  // and longestStreak() used millisecond timestamps — two completely different formats.
  // Both now use this single helper for consistency and correctness.
  const toDateKey = (ts: number): string => {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const streak = (p: string) => {
    const days = new Set(allAc(p).map((s: CFSubmission) => toDateKey(s.creationTimeSeconds)));
    let cur = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (days.has(key)) cur++; else break;
    }
    return cur;
  };

  const longestStreak = (p: string) => {
    // Collect unique YYYY-MM-DD strings — ISO format sorts lexicographically correctly
    const days = [...new Set(allAc(p).map((s: CFSubmission) => toDateKey(s.creationTimeSeconds)))].sort();
    let best = 0, cur = 0;
    for (let i = 0; i < days.length; i++) {
      if (i === 0) {
        cur = 1;
      } else {
        const prev = new Date(days[i - 1] + 'T00:00:00');
        const curr = new Date(days[i]     + 'T00:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        cur = diffDays === 1 ? cur + 1 : 1;
      }
      if (cur > best) best = cur;
    }
    return best;
  };

  const ratingBucket = (p: string, d: number, minR: number, maxRv: number) => ac(p, d).filter((s: CFSubmission) => (s.problem.rating || 0) >= minR && (s.problem.rating || 0) <= maxRv).length;
  const wa7  = (p: string) => subs(p, 7).filter((s: any) => s.verdict === 'WRONG_ANSWER').length;
  const tle7 = (p: string) => subs(p, 7).filter((s: any) => s.verdict === 'TIME_LIMIT_EXCEEDED').length;
  const uniqueSolved = (p: string) => new Set(allAc(p).map((s: CFSubmission) => `${s.problem.contestId}-${s.problem.index}`)).size;
  const firstTryRate = (p: string, d: number) => {
    const attempts = new Map<string, boolean>();
    subs(p, d).forEach((s: any) => {
      const pid = `${s.problem.contestId}-${s.problem.index}`;
      if (!attempts.has(pid)) attempts.set(pid, s.verdict === 'OK');
    });
    const total = attempts.size; if (total === 0) return 0;
    return [...attempts.values()].filter(v => v).length / total;
  };
  const avgRating = (p: string, d: number) => { const a = ac(p, d); if (!a.length) return 0; return a.reduce((s: number, x: CFSubmission) => s + (x.problem.rating || 0), 0) / a.length; };
  const hardestProblem = (p: string) => Math.max(0, ...allAc(p).map((s: CFSubmission) => s.problem.rating || 0));

  const fw = (fn: (p: string) => number, min = 0): string | null => {
    let best: string | null = null, bestVal = -Infinity;
    allPlayers.forEach(p => { const v = fn(p); if (v > bestVal && v >= min) { bestVal = v; best = p; } });
    return best;
  };
  const fwMin = (fn: (p: string) => number, max = Infinity): string | null => {
    let best: string | null = null, bestVal = Infinity;
    allPlayers.forEach(p => { const v = fn(p); if (v < bestVal && v <= max) { bestVal = v; best = p; } });
    return best;
  };
  // personal achievement — only awarded to mainHandle if condition met
  const personal = (cond: boolean): string | null => cond ? mainHandle : null;

  return [
    // ══════════════════════════════════════════════════════
    // DAILY (5 badges)
    // ══════════════════════════════════════════════════════
    { id:'d_hero',      icon:'🔥', name:'Daily Hero',      desc:'Highest Synth Score in last 24h',                     owner: fw(p => pts(p, 1), 1) },
    { id:'d_berserker', icon:'🩸', name:'Bloodlust',        desc:'Most ACs in last 24h (min 2)',                        owner: fw(p => ac(p, 1).length, 2) },
    { id:'d_slayer',    icon:'🗡️', name:'Daily Slayer',     desc:'Highest rated AC in last 24h',                        owner: fw(p => maxR(p, 1), 800) },
    { id:'d_owl',       icon:'🦉', name:'Midnight Oil',     desc:'Most ACs between midnight and 5AM today',             owner: fw(p => hour(p, 1, 0, 5), 1) },
    { id:'d_firstblood',icon:'💉', name:'First Blood',      desc:'First AC of the day across the squad',                owner: (() => { let earliest: string|null=null, ts=Infinity; allPlayers.forEach(p => { const a = ac(p,1); if(a.length){ const t = Math.min(...a.map((s:any)=>s.creationTimeSeconds)); if(t<ts){ts=t;earliest=p;} } }); return earliest; })() },

    // ══════════════════════════════════════════════════════
    // WEEKLY (25 badges)
    // ══════════════════════════════════════════════════════
    { id:'w_vanguard',  icon:'⚡',  name:'Vanguard',         desc:'Highest Synth Score this week',                       owner: fw(p => pts(p, 7), 50) },
    { id:'w_volume',    icon:'📦',  name:'Volume King',      desc:'Most total ACs this week',                            owner: fw(p => ac(p, 7).length, 5) },
    { id:'w_flawless',  icon:'📐',  name:'Flawless',         desc:'Best accuracy this week (min 5 submissions)',         owner: fw(p => subs(p, 7).length >= 5 ? acc(p, 7) * 1000 : 0, 0) },
    { id:'w_marathon',  icon:'🏃',  name:'Road Runner',      desc:'Most active days this week',                         owner: fw(p => activeDays(p, 7), 4) },
    { id:'w_slayer',    icon:'⚔️',  name:'Weekly Slayer',    desc:'Highest rated AC this week',                         owner: fw(p => maxR(p, 7), 1000) },
    { id:'w_firsttry',  icon:'🎯',  name:'Sharpshooter',     desc:'Best first-try rate this week (min 5 attempts)',      owner: fw(p => subs(p, 7).length >= 5 ? firstTryRate(p, 7) * 1000 : 0, 0) },
    { id:'w_dp',        icon:'🧠',  name:'DP Crown',         desc:'Most DP ACs this week',                              owner: fw(p => tags(p, 7, 'dp'), 1) },
    { id:'w_graph',     icon:'🕸️',  name:'Graph Monarch',    desc:'Most Graph + Tree ACs this week',                    owner: fw(p => tags(p,7,'graphs') + tags(p,7,'trees'), 1) },
    { id:'w_math',      icon:'∑',   name:'Math Prodigy',     desc:'Most Math + NT ACs this week',                       owner: fw(p => tags(p,7,'math') + tags(p,7,'number theory'), 1) },
    { id:'w_ds',        icon:'🗄️',  name:'Data Structurist', desc:'Most Data Structure ACs this week',                  owner: fw(p => tags(p, 7, 'data structures'), 1) },
    { id:'w_greedy',    icon:'🤑',  name:'Greedy God',       desc:'Most Greedy ACs this week',                          owner: fw(p => tags(p, 7, 'greedy'), 1) },
    { id:'w_string',    icon:'🔤',  name:'String Theorist',  desc:'Most String ACs this week',                          owner: fw(p => tags(p, 7, 'strings'), 1) },
    { id:'w_construct', icon:'🏗️',  name:'Builder',          desc:'Most Constructive ACs this week',                    owner: fw(p => tags(p, 7, 'constructive algorithms'), 1) },
    { id:'w_explorer',  icon:'🗺️',  name:'Explorer',         desc:'Most distinct tags explored this week',              owner: fw(p => distinctTags(p, 7), 5) },
    { id:'w_gladiator', icon:'🏆',  name:'Gladiator',        desc:'Most in-contest ACs this week',                      owner: fw(p => ac(p,7).filter((s:any)=>s.author?.participantType==='CONTESTANT').length, 1) },
    { id:'w_sniper',    icon:'🦅',  name:'Headhunter',       desc:'Most squad snipes this week',                        owner: fw(p => bMatrix[p].snipes, 1) },
    { id:'w_necro',     icon:'🧟',  name:'Necromancer',      desc:'Most bounties resurrected this week',                owner: fw(p => bMatrix[p].resurrected, 1) },
    { id:'w_vampire',   icon:'🧛',  name:'Vampire',          desc:'Most ACs between midnight and 6AM this week',        owner: fw(p => hour(p, 7, 0, 6), 2) },
    { id:'w_earlybird', icon:'🌅',  name:'Early Bird',       desc:'Most ACs between 6AM and noon this week',            owner: fw(p => hour(p, 7, 6, 12), 2) },
    { id:'w_hardball',  icon:'💎',  name:'Hardball',         desc:'Most ACs rated 1600+ this week',                     owner: fw(p => ratingBucket(p, 7, 1600, 9999), 1) },
    { id:'w_upsolve',   icon:'🛠️',  name:'Mechanic',         desc:'Most practice/upsolve ACs this week',               owner: fw(p => ac(p,7).filter((s:any)=>s.author?.participantType==='PRACTICE').length, 3) },
    { id:'w_avgr',      icon:'📊',  name:'Calibrated',       desc:'Highest average problem rating solved this week',    owner: fw(p => ac(p, 7).length >= 3 ? avgRating(p, 7) : 0, 1000) },
    { id:'w_tilter',    icon:'🤡',  name:'Tilter',           desc:'[NEGATIVE] Most WAs this week',                      owner: fw(p => wa7(p), 5), isNegative: true },
    { id:'w_tle',       icon:'⌛',  name:'TLE King',         desc:'[NEGATIVE] Most TLEs this week',                    owner: fw(p => tle7(p), 3), isNegative: true },
    { id:'w_slacker',   icon:'💤',  name:'Slacker',          desc:'[NEGATIVE] Zero ACs this week',                     owner: fw(p => ac(p,7).length === 0 ? 1 : 0, 1), isNegative: true },

    // ══════════════════════════════════════════════════════
    // MONTHLY (15 badges)
    // ══════════════════════════════════════════════════════
    { id:'m_overlord',  icon:'👑',  name:'Overlord',          desc:'Highest Synth Score this month',                    owner: fw(p => pts(p, 30), 200) },
    { id:'m_marathon',  icon:'🏃‍♂️', name:'Monthly Marathon',  desc:'Most active days this month',                      owner: fw(p => activeDays(p, 30), 10) },
    { id:'m_architect', icon:'🏛️',  name:'Architect',         desc:'Best accuracy this month (min 20 subs)',            owner: fw(p => subs(p,30).length >= 20 ? acc(p,30)*1000 : 0, 0) },
    { id:'m_polymath',  icon:'🌐',  name:'Polymath',          desc:'Most distinct algorithm tags solved this month',    owner: fw(p => distinctTags(p, 30), 8) },
    { id:'m_titan',     icon:'🗡️',  name:'Titan Slayer',      desc:'Highest rated AC this month',                      owner: fw(p => maxR(p, 30), 1200) },
    { id:'m_grind',     icon:'📈',  name:'Grind Master',      desc:'Most total ACs this month',                        owner: fw(p => ac(p, 30).length, 15) },
    { id:'m_dp',        icon:'🧠',  name:'DP God',            desc:'Most DP ACs this month',                           owner: fw(p => tags(p, 30, 'dp'), 5) },
    { id:'m_graph',     icon:'🕸️',  name:'Graph Lord',        desc:'Most Graph + Tree ACs this month',                 owner: fw(p => tags(p,30,'graphs') + tags(p,30,'trees'), 5) },
    { id:'m_hardball',  icon:'💎',  name:'Hard Hitter',       desc:'Most ACs rated 1800+ this month',                  owner: fw(p => ratingBucket(p, 30, 1800, 9999), 1) },
    { id:'m_streak',    icon:'🔗',  name:'Streak Lord',       desc:'Longest current AC streak this month',             owner: fw(p => streak(p), 7) },
    { id:'m_untouchable',icon:'🕴️', name:'Untouchable',       desc:'Zero active bounties + 20+ ACs this month',       owner: fw(p => (bMatrix[p].active.length===0 && ac(p,30).length>=20) ? ac(p,30).length : 0, 20) },
    { id:'m_upsolve',   icon:'⬆️',  name:'Upsolve Machine',   desc:'Most upsolves this month (practice ACs)',          owner: fw(p => ac(p,30).filter((s:any)=>s.author?.participantType==='PRACTICE').length, 10) },
    { id:'m_firsttry',  icon:'🎯',  name:'Sniper Elite',      desc:'Best first-try rate this month (min 15 attempts)', owner: fw(p => subs(p,30).length >= 15 ? firstTryRate(p,30)*1000 : 0, 0) },
    { id:'m_wanted',    icon:'🚨',  name:'Most Wanted',       desc:'[NEGATIVE] Most active bounties on them',          owner: fw(p => bMatrix[p].active.length, 2), isNegative: true },
    { id:'m_tilter',    icon:'🤡',  name:'Monthly Tilter',    desc:'[NEGATIVE] Most WAs this month',                   owner: fw(p => subs(p,30).filter((s:any)=>s.verdict==='WRONG_ANSWER').length, 15), isNegative: true },

    // ══════════════════════════════════════════════════════
    // LONG-TERM 180D / 365D (5 badges)
    // ══════════════════════════════════════════════════════
    { id:'lt_emperor',  icon:'⚜️',  name:'Emperor',           desc:'Highest Synth Score in 180 days',                  owner: fw(p => pts(p, 180), 1000) },
    { id:'lt_ironman',  icon:'🦾',  name:'Ironman',           desc:'Most active days in 180 days',                     owner: fw(p => activeDays(p, 180), 60) },
    { id:'lt_legend',   icon:'🏺',  name:'Living Legend',     desc:'Longest ever AC streak',                           owner: fw(p => longestStreak(p), 14) },
    { id:'lt_godslayer',icon:'🌑',  name:'God Slayer',        desc:'Highest rated problem ever solved',                owner: fw(p => hardestProblem(p), 2000) },
    { id:'lt_library',  icon:'📚',  name:'The Library',       desc:'Most unique problems ever solved (all time)',      owner: fw(p => uniqueSolved(p), 100) },

    // ══════════════════════════════════════════════════════
    // ACHIEVEMENTS / MAP (15 badges)
    // ══════════════════════════════════════════════════════
    { id:'a_emperor',    icon:'🏰', name:'The Emperor',       desc:'Built 5+ Citadels on the War Map',                 owner: personal(mapMetrics.citadel >= 5) },
    { id:'a_warlord',    icon:'⚔️', name:'The Warlord',       desc:'Conquered 10+ territories on the War Map',        owner: personal(mapMetrics.conquered >= 10) },
    { id:'a_tactician',  icon:'♟️', name:'Grand Tactician',   desc:'Zero rebellions on the War Map',                  owner: personal(mapMetrics.rebellion===0 && mapMetrics.occupied > 0) },
    { id:'a_preserver',  icon:'🛡️', name:'The Preservationist',desc:'Zero decaying nodes with 10+ occupied',          owner: personal(mapMetrics.decaying===0 && mapMetrics.occupied >= 10) },
    { id:'a_pathfinder', icon:'🗺️', name:'Pathfinder',        desc:'10+ scouted but unrevealed nodes',                owner: personal(mapMetrics.scouted >= 10) },
    { id:'a_pyro',       icon:'🔥', name:'The Pyromancer',    desc:'[NEGATIVE] 3+ rebellions on the War Map',         owner: personal(mapMetrics.rebellion >= 3), isNegative: true },
    { id:'a_ruined',     icon:'🏚️', name:'Fallen Kingdom',    desc:'[NEGATIVE] 5+ ruins on the War Map',             owner: personal(mapMetrics.decaying >= 5), isNegative: true },
    { id:'a_recon',      icon:'🥷', name:'Recon Ghost',       desc:'5+ ACs on problems rated 200+ above your rating', owner: personal(reconMetrics.unique >= 5) },
    { id:'a_century',    icon:'💯', name:'Centurion',         desc:'Solved 100+ unique problems all time',            owner: personal(uniqueSolved(mainHandle) >= 100) },
    { id:'a_hardboiled', icon:'🥚', name:'Hard Boiled',       desc:'Solved a problem rated 2000+',                   owner: personal(hardestProblem(mainHandle) >= 2000) },
    { id:'a_diversified',icon:'🌈', name:'Diversified',       desc:'Solved problems in 15+ distinct tags',            owner: personal(distinctTags(mainHandle, 36500) >= 15) },
    { id:'a_sniper500',  icon:'🎖️', name:'Sniper 500',        desc:'Solved 500+ unique problems',                    owner: personal(uniqueSolved(mainHandle) >= 500) },
    { id:'a_streak30',   icon:'📅', name:'Month Warrior',     desc:'30-day consecutive AC streak',                   owner: personal(longestStreak(mainHandle) >= 30) },
    { id:'a_nighter',    icon:'🌙', name:'Night Owl',         desc:'50+ ACs solved between midnight and 4AM ever',   owner: personal(hour(mainHandle, 36500, 0, 4) >= 50) },
    { id:'a_speedster',  icon:'🏎️', name:'Speedster',         desc:'50+ first-try solves in 180 days',               owner: personal((() => { let c=0; subs(mainHandle,180).forEach((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; const first = !subs(mainHandle,180).some((x:any)=>`${x.problem.contestId}-${x.problem.index}`===pid && x.creationTimeSeconds < s.creationTimeSeconds); if(first && s.verdict==='OK') c++; }); return c; })() >= 50) },

    // ══════════════════════════════════════════════════════
    // COMPETITIVE / OTHER (35 badges — squad-based, interesting, non-repetitive)
    // ══════════════════════════════════════════════════════
    // Rating bracket dominance
    { id:'c_div4king',   icon:'🟢', name:'Div.4 King',        desc:'Most ACs rated 800–1200 this month',              owner: fw(p => ratingBucket(p,30,800,1200), 5) },
    { id:'c_div3king',   icon:'🔵', name:'Div.3 King',        desc:'Most ACs rated 1300–1600 this month',             owner: fw(p => ratingBucket(p,30,1300,1600), 3) },
    { id:'c_div2king',   icon:'🟣', name:'Div.2 King',        desc:'Most ACs rated 1600–1900 this month',             owner: fw(p => ratingBucket(p,30,1600,1900), 2) },
    { id:'c_div1king',   icon:'🔴', name:'Div.1 King',        desc:'Most ACs rated 1900+ this month',                 owner: fw(p => ratingBucket(p,30,1900,9999), 1) },
    // Consistency
    { id:'c_metronome',  icon:'🎵', name:'Metronome',         desc:'Solved at least 1 problem every day for 14 days', owner: fw(p => streak(p) >= 14 ? streak(p) : 0, 14) },
    { id:'c_clockwork',  icon:'⚙️', name:'Clockwork',         desc:'Active in all 7 days of this week',               owner: fw(p => activeDays(p,7) >= 7 ? 1 : 0, 1) },
    // Efficiency
    { id:'c_surgeon',    icon:'🔬', name:'The Surgeon',       desc:'90%+ accuracy this week (min 10 subs)',           owner: fw(p => subs(p,7).length >= 10 && acc(p,7) >= 0.9 ? acc(p,7)*1000 : 0, 900) },
    { id:'c_onebullet',  icon:'🎯', name:'One Bullet',        desc:'Most problems solved first try this week',        owner: fw(p => { let c=0; const seen=new Set<string>(); subs(p,7).forEach((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; if(!seen.has(pid)){seen.add(pid);if(s.verdict==='OK')c++;} }); return c; }, 3) },
    // Speed
    { id:'c_speedrun',   icon:'⚡', name:'Speed Run',         desc:'Most ACs solved within 5 mins of first attempt this week', owner: fw(p => { const map=new Map<string,number>(); subs(p,7).forEach((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; if(!map.has(pid)) map.set(pid,s.creationTimeSeconds); }); return ac(p,7).filter((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; return (s.creationTimeSeconds-(map.get(pid)||0)) <= 300; }).length; }, 2) },
    // Variety
    { id:'c_allrounder', icon:'🌀', name:'All-Rounder',       desc:'ACs in 5+ different tags in a single day this week', owner: fw(p => { let best=0; ac(p,7).reduce((map:any,s:any)=>{ const day=new Date(s.creationTimeSeconds*1000).toDateString(); if(!map[day]) map[day]=new Set(); s.problem.tags?.forEach((t:string)=>map[day].add(t)); best=Math.max(best,map[day].size); return map; },{}); return best; }, 5) },
    { id:'c_newblood',   icon:'🧪', name:'New Blood',         desc:'Tried a tag never solved before this week',       owner: fw(p => { const old=new Set<string>(); allAc(p).forEach((s:any)=>{ if((now-s.creationTimeSeconds)/86400 > 7) s.problem.tags?.forEach((t:string)=>old.add(t)); }); let n=0; ac(p,7).forEach((s:any)=>{ s.problem.tags?.forEach((t:string)=>{ if(!old.has(t)){n++;old.add(t);} }); }); return n; }, 1) },
    // Punishment / chaos
    { id:'c_roulette',   icon:'🎰', name:'Russian Roulette',  desc:'[NEGATIVE] 3+ different verdicts in a single day', owner: fw(p => { let worst=0; subs(p,7).reduce((map:any,s:any)=>{ const day=new Date(s.creationTimeSeconds*1000).toDateString(); if(!map[day]) map[day]=new Set(); map[day].add(s.verdict); worst=Math.max(worst,map[day].size); return map; },{}); return worst>=3?worst:0; }, 3), isNegative: true },
    { id:'c_ghost',      icon:'👻', name:'Ghost Protocol',    desc:'[NEGATIVE] Not a single submission in 48h',       owner: fw(p => { const last=subs(p,36500); if(!last.length) return 1; return (now-last[last.length-1].creationTimeSeconds)/3600 >= 48 ? 1 : 0; }, 1), isNegative: true },
    { id:'c_obsessed',   icon:'😤', name:'Obsessed',          desc:'[NEGATIVE] Submitted the same problem 5+ times without solving', owner: fw(p => { const attempts=new Map<string,number>(); subs(p,7).filter((s:any)=>s.verdict!=='OK').forEach((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; if(!new Set(ac(p,7).map((x:any)=>`${x.problem.contestId}-${x.problem.index}`)).has(pid)) attempts.set(pid,(attempts.get(pid)||0)+1); }); return Math.max(0,...attempts.values()); }, 5), isNegative: true },
    { id:'c_latebloomer',icon:'🌸', name:'Late Bloomer',      desc:'Solved a 1800+ problem after 3+ failed attempts', owner: fw(p => { const fails=new Map<string,number>(); subs(p,36500).forEach((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; if(s.verdict!=='OK') fails.set(pid,(fails.get(pid)||0)+1); }); return ac(p,36500).filter((s:any)=>(s.problem.rating||0)>=1800&&(fails.get(`${s.problem.contestId}-${s.problem.index}`)||0)>=3).length; }, 1) },
    { id:'c_perfectweek',icon:'🌟', name:'Perfect Week',      desc:'7+ ACs with 100% accuracy this week',            owner: fw(p => ac(p,7).length>=7 && subs(p,7).every((s:any)=>s.verdict==='OK') ? ac(p,7).length : 0, 7) },
    { id:'c_comeback',   icon:'💪', name:'Comeback Kid',      desc:'Best score this week after zero last week',      owner: fw(p => ac(p,14).length>0 && ac(p,7).length>0 && pts(p,7)>0 && pts(p,14)-pts(p,7)<pts(p,7)*0.1 ? pts(p,7) : 0, 50) },
    { id:'c_problemchef',icon:'👨‍🍳',name:'Problem Chef',      desc:'Solved 3+ problems of 3+ different rating brackets this week', owner: fw(p => { const buckets=new Set<number>(); ac(p,7).forEach((s:any)=>{ const r=Math.floor((s.problem.rating||0)/300)*300; buckets.add(r); }); return buckets.size; }, 3) },
    { id:'c_tactician',  icon:'♟️', name:'Cold Strategist',   desc:'Lowest WA rate this week (min 10 subs)',         owner: fwMin(p => subs(p,7).length>=10 ? subs(p,7).filter((s:any)=>s.verdict==='WRONG_ANSWER').length/subs(p,7).length : Infinity) },
    { id:'c_tortoise',   icon:'🐢', name:'The Tortoise',      desc:'Solved a problem that took more than 5 hours of attempts this week', owner: fw(p => { const first=new Map<string,number>(); subs(p,7).forEach((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; if(!first.has(pid)||s.creationTimeSeconds<(first.get(pid)||0)) first.set(pid,s.creationTimeSeconds); }); return ac(p,7).filter((s:any)=>{ const pid=`${s.problem.contestId}-${s.problem.index}`; return (s.creationTimeSeconds-(first.get(pid)||s.creationTimeSeconds))/3600 >= 5; }).length; }, 1) },
    { id:'c_insomniac',  icon:'😴', name:'Insomniac',         desc:'ACs in 3+ consecutive late-night hours (11PM–5AM)', owner: fw(p => { const hrs=new Set(ac(p,7).map((s:any)=>new Date(s.creationTimeSeconds*1000).getHours()).filter(h=>h>=23||h<5)); return hrs.size; }, 3) },
    { id:'c_bountykiller',icon:'💣',name:'Bounty Killer',     desc:"Solved a problem that was on someone else's active bounty list", owner: fw(p => bMatrix[p].snipes >= 3 ? bMatrix[p].snipes : 0, 3) },
    { id:'c_snipedback', icon:'🔁', name:'Sniped Back',       desc:'Had a bounty sniped AND retaliated with a snipe', owner: fw(p => bMatrix[p].snipes >= 1 && bMatrix[p].active.length >= 1 ? bMatrix[p].snipes : 0, 1) },
    { id:'c_grindset',   icon:'⚙️', name:'The Grindset',      desc:'Most total submissions (win or lose) this week',  owner: fw(p => subs(p,7).length, 20) },
    { id:'c_longhaul',   icon:'🚛', name:'Long Haul',         desc:'Most ACs in problems over 2500 rating ever',      owner: fw(p => ac(p,36500).filter((s:any)=>(s.problem.rating||0)>=2500).length, 1) },
    { id:'c_allnight',   icon:'🌃', name:'All-Nighter',       desc:'Submitted for 6+ consecutive hours overnight',    owner: fw(p => { const hrs=subs(p,7).map((s:any)=>Math.floor(s.creationTimeSeconds/3600)); const unique=new Set(hrs); let best=0; unique.forEach(h=>{ let run=0; for(let i=h;i<h+6;i++) if(unique.has(i)) run++; else break; best=Math.max(best,run); }); return best; }, 6) },
    { id:'c_reliable',   icon:'🔒', name:'Reliable',          desc:'Active at least 5 of last 7 days',               owner: fw(p => activeDays(p,7) >= 5 ? activeDays(p,7) : 0, 5) },
  ];
}
