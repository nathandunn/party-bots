// Batch simulation: matchups, class matrices, comp tournaments. Pure functions — run in Node or a Worker.
import { Battle } from './actions.js';

export function fight({ a, b, map, seed, record = false, swap = false }) {
  const teams = swap ? [b, a] : [a, b];
  const r = new Battle({ teams, map, seed, record }).run();
  // normalise so 0 always means team a
  const winner = r.winner === -1 ? -1 : swap ? 1 - r.winner : r.winner;
  return { ...r, winner, swapped: swap };
}

// n fights, sides alternate. returns aggregate stats
export function matchup(a, b, { map = 'open', n = 100, seed = 1 } = {}) {
  const agg = { n, winsA: 0, winsB: 0, draws: 0, rounds: 0, survA: 0, survB: 0, dmgA: 0, dmgB: 0, healA: 0, healB: 0, byUnit: {} };
  for (let i = 0; i < n; i++) {
    const r = fight({ a, b, map, seed: seed * 7919 + i * 104729 + 1, swap: i % 2 === 1 });
    if (r.winner === 0) agg.winsA++; else if (r.winner === 1) agg.winsB++; else agg.draws++;
    agg.rounds += r.rounds;
    for (const u of r.units) {
      const side = (u.team === 0) !== r.swapped ? 'A' : 'B';
      if (u.up) agg['surv' + side]++;
      agg['dmg' + side] += u.dmg; agg['heal' + side] += u.heal;
      const k = side + ':' + u.cls + ':' + u.personality;
      const s = agg.byUnit[k] || (agg.byUnit[k] = { side, cls: u.cls, personality: u.personality, count: 0, dmg: 0, taken: 0, heal: 0, kills: 0, downs: 0, downed: 0, survived: 0, hits: 0, attacks: 0 });
      s.count++; s.dmg += u.dmg; s.taken += u.taken; s.heal += u.heal; s.kills += u.kills; s.downs += u.downs; s.downed += u.downed; s.survived += u.up ? 1 : 0; s.hits += u.hits; s.attacks += u.attacks;
    }
  }
  agg.rounds /= n;
  agg.winRateA = (agg.winsA + agg.draws / 2) / n;
  return agg;
}

export const mono = (cls, size = 4, personality = 'balanced') => Array.from({ length: size }, () => ({ cls, personality }));

// mono-class round robin: cell [i][j] = win rate of class i vs class j
export function classMatrix(classes, { map = 'open', n = 40, size = 4, personality = 'balanced', seed = 1, onProgress } = {}) {
  const k = classes.length;
  const M = Array.from({ length: k }, () => Array(k).fill(0.5));
  const rounds = Array.from({ length: k }, () => Array(k).fill(0));
  let done = 0; const total = k * (k - 1) / 2;
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const r = matchup(mono(classes[i], size, personality), mono(classes[j], size, personality), { map, n, seed: seed + i * 31 + j });
    M[i][j] = r.winRateA; M[j][i] = 1 - r.winRateA;
    rounds[i][j] = rounds[j][i] = r.rounds;
    done++; onProgress && onProgress(done / total);
  }
  const avg = M.map((row, i) => row.reduce((s, v, j) => s + (i === j ? 0 : v), 0) / (k - 1));
  return { classes, M, rounds, avg, map, n, size, personality };
}

// comp tournament: every comp vs every other comp, ranked by win rate
export function tournament(comps, { maps = ['open'], n = 20, seed = 1, onProgress } = {}) {
  const k = comps.length;
  const wins = Array(k).fill(0), games = Array(k).fill(0);
  const M = Array.from({ length: k }, () => Array(k).fill(null));
  const total = (k * (k - 1) / 2) * maps.length; let done = 0;
  for (const map of maps) for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const r = matchup(comps[i].members, comps[j].members, { map, n, seed: seed + i * 131 + j * 7 + map.length });
    const wa = r.winsA + r.draws / 2, wb = r.winsB + r.draws / 2;
    wins[i] += wa; wins[j] += wb; games[i] += n; games[j] += n;
    M[i][j] = (M[i][j] || 0) + wa / n / maps.length; M[j][i] = (M[j][i] || 0) + wb / n / maps.length;
    done++; onProgress && onProgress(done / total);
  }
  const rank = comps.map((c, i) => ({ ...c, winRate: wins[i] / games[i], i })).sort((p, q) => q.winRate - p.winRate);
  return { rank, M, maps, n };
}
