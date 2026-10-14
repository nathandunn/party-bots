// Runs batch simulations off the main thread.
import { matchup, classMatrix, tournament, MAP_IDS } from '../engine/index.js';

self.onmessage = (ev) => {
  const { id, type, args } = ev.data;
  const progress = (p) => self.postMessage({ id, progress: p });
  try {
    let result;
    if (type === 'matchup') {
      // batch in chunks so progress can be reported
      const { a, b, map, n, seed } = args; const chunk = 20; const parts = [];
      for (let i = 0; i < n; i += chunk) { parts.push(matchup(a, b, { map, n: Math.min(chunk, n - i), seed: seed + i })); progress(Math.min(1, (i + chunk) / n)); }
      result = mergeMatchups(parts);
    } else if (type === 'matrix') {
      const maps = args.map === 'all' ? MAP_IDS : [args.map];
      result = maps.map((map, k) => classMatrix(args.classes, { ...args, map, onProgress: (p) => progress((k + p) / maps.length) }));
    } else if (type === 'tournament') {
      const maps = args.maps === 'all' ? MAP_IDS : [args.maps];
      result = tournament(args.comps, { maps, n: args.n, seed: args.seed, onProgress: progress });
    }
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.stack || e) });
  }
};

function mergeMatchups(parts) {
  const out = { n: 0, winsA: 0, winsB: 0, draws: 0, rounds: 0, survA: 0, survB: 0, dmgA: 0, dmgB: 0, healA: 0, healB: 0, byUnit: {} };
  for (const p of parts) {
    for (const k of ['winsA', 'winsB', 'draws', 'survA', 'survB', 'dmgA', 'dmgB', 'healA', 'healB']) out[k] += p[k];
    out.rounds += p.rounds * p.n; out.n += p.n;
    for (const [k, u] of Object.entries(p.byUnit)) {
      const o = out.byUnit[k] || (out.byUnit[k] = { ...u, count: 0, dmg: 0, taken: 0, heal: 0, kills: 0, downs: 0, downed: 0, survived: 0, hits: 0, attacks: 0 });
      for (const f of ['count', 'dmg', 'taken', 'heal', 'kills', 'downs', 'downed', 'survived', 'hits', 'attacks']) o[f] += u[f];
    }
  }
  out.rounds /= out.n; out.winRateA = (out.winsA + out.draws / 2) / out.n;
  return out;
}
