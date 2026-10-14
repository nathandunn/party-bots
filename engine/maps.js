// Battle maps: 24x16 grid of 5-ft cells, mirrored left/right so neither side gets the better ground.
// '.' floor  '#' wall (blocks movement + sight)  'T' tree/pillar post (blocks movement, half cover)
// '+' low wall/rubble (difficult terrain, half cover)  '"' brush (difficult terrain)
import { makeRng } from './dice.js';

export const W = 24, H = 16;

function blank() { return Array.from({ length: H }, () => Array(W).fill('.')); }
function mirrorSet(g, x, y, ch) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  g[y][x] = ch; g[y][W - 1 - x] = ch;
}

const GEN = {
  open: { name: 'Open Field', blurb: 'Nothing to hide behind. Range and burst damage rule.', gen: () => blank() },
  pillars: {
    name: 'Pillared Hall', blurb: 'Stone pillars break line of sight; casters must step out to fire.',
    gen: () => {
      const g = blank();
      for (const [x, y] of [[5, 2], [5, 7], [5, 12], [9, 4], [9, 10]])
        for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) mirrorSet(g, x + dx, y + dy, '#');
      return g;
    },
  },
  forest: {
    name: 'Forest', blurb: 'Trees give half cover, undergrowth slows everyone.',
    gen: () => {
      const g = blank(); const r = makeRng(1234);
      for (let y = 0; y < H; y++) for (let x = 3; x < W / 2; x++) {
        const p = r();
        if (p < 0.09) mirrorSet(g, x, y, 'T'); else if (p < 0.27) mirrorSet(g, x, y, '"');
      }
      return g;
    },
  },
  choke: {
    name: 'Chokepoint', blurb: 'A wall splits the field; two narrow gaps. Frontliners hold the doors.',
    gen: () => {
      const g = blank();
      for (let y = 0; y < H; y++) if (![3, 4, 11, 12].includes(y)) mirrorSet(g, 11, y, '#');
      for (const [x, y] of [[8, 2], [8, 5], [8, 10], [8, 13]]) mirrorSet(g, x, y, '+');
      return g;
    },
  },
  ruins: {
    name: 'Ruins', blurb: 'Broken low walls everywhere: cover for archers, slow ground for chargers.',
    gen: () => {
      const g = blank();
      for (let x = 5; x <= 9; x++) { mirrorSet(g, x, 3, '+'); mirrorSet(g, x, 12, '+'); }
      for (let y = 6; y <= 9; y++) mirrorSet(g, 7, y, '+');
      for (const [x, y] of [[10, 7], [10, 8], [3, 5], [3, 10]]) mirrorSet(g, x, y, '+');
      return g;
    },
  },
  room: {
    name: 'Close Quarters', blurb: 'A 60x50 ft room. Everyone starts within a dash of each other.',
    spawn: { front: 8, back: 6 },
    gen: () => {
      const g = blank();
      for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++)
        if (x < 6 || y < 3 || y > 12) mirrorSet(g, x, y, '#');
      return g;
    },
  },
};
export const MAP_IDS = Object.keys(GEN);
export const MAP_INFO = Object.fromEntries(MAP_IDS.map((k) => [k, { name: GEN[k].name, blurb: GEN[k].blurb }]));

const cache = {};
export function getMap(id) {
  if (cache[id]) return cache[id];
  const G = GEN[id]; if (!G) throw new Error('unknown map ' + id);
  const grid = G.gen();
  const cells = grid.map((row) => row.join(''));
  const m = {
    id, name: G.name, w: W, h: H, cells,
    spawn: G.spawn || { front: 3, back: 1 },
    blocksMove: (x, y) => x < 0 || y < 0 || x >= W || y >= H || '#T'.includes(grid[y][x]),
    blocksSight: (x, y) => grid[y][x] === '#',
    cover: (x, y) => 'T+'.includes(grid[y][x]),
    cost: (x, y) => ('+"'.includes(grid[y][x]) ? 2 : 1),
  };
  cache[id] = m;
  return m;
}

// spawn cells for a team (side 0 = left, 1 = right). Members spread out over their home zone so one
// area spell cannot catch the whole party on turn one. A small seeded search minimises, in order:
// the most teammates a single 20-ft-radius burst could hit, then how close the closest pair stands.
// Front-liners stand in the forward columns, everyone else at the back. Results are cached.
const spawnCache = new Map();
export function spawnCells(map, side, roles) {
  const key = map.id + '|' + side + '|' + roles.join(',');
  if (spawnCache.has(key)) return spawnCache.get(key).map((p) => [...p]);
  const { front, back } = map.spawn;
  const maxX = Math.min(front + 5, W / 2 - 2);
  const mirror = (x) => (side === 0 ? x : W - 1 - x);
  const allowed = roles.map((r) => {
    const out = [];
    const [x0, x1] = r === 'front' ? [front, maxX] : [Math.max(0, back - 1), back + 2];
    for (let x = x0; x <= x1; x++) for (let y = 0; y < H; y++) if (!map.blocksMove(mirror(x), y)) out.push([mirror(x), y]);
    return out;
  });
  const R = 4.5; // fireball reach in cells (radius 4 + half a square)
  const cover = (pts) => {
    let worst = 1;
    for (const c of pts) { // a burst catching k creatures can be centred near one of them; test midpoints too
      for (const d of pts) {
        const mx = (c[0] + d[0]) / 2, my = (c[1] + d[1]) / 2;
        let k = 0; for (const p of pts) if (Math.hypot(p[0] - mx, p[1] - my) <= R) k++;
        if (k > worst) worst = k;
      }
    }
    return worst;
  };
  const minGap = (pts) => { let m = 99; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])); return m; };
  const score = (pts) => {
    const seen = new Set(pts.map((p) => p.join()));
    if (seen.size < pts.length) return -1e9;
    return -cover(pts) * 1000 + Math.min(minGap(pts), 14) * 10 - pts.reduce((s, p) => s + Math.abs(p[1] - (H - 1) / 2), 0) * 0.05;
  };
  let seed = 12345 + roles.length * 977 + side; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let best = null, bestS = -Infinity;
  for (let restart = 0; restart < 12; restart++) {
    let cur = allowed.map((a) => a[Math.floor(rnd() * a.length)]);
    let s = score(cur);
    for (let it = 0; it < 400; it++) {
      const i = Math.floor(rnd() * cur.length);
      const cand = cur.slice(); cand[i] = allowed[i][Math.floor(rnd() * allowed[i].length)];
      const cs = score(cand);
      if (cs >= s) { cur = cand; s = cs; }
    }
    if (s > bestS) { bestS = s; best = cur; }
  }
  spawnCache.set(key, best);
  return best.map((p) => [...p]);
}
