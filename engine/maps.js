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

// spawn cells for a team (side 0 = left, 1 = right). roles front/back get different columns.
export function spawnCells(map, side, roles) {
  const rowsOrder = [7, 8, 5, 10, 3, 12, 6, 9, 4, 11];
  const used = new Set(); const out = [];
  const fx = side === 0 ? map.spawn.front : W - 1 - map.spawn.front;
  const bx = side === 0 ? map.spawn.back : W - 1 - map.spawn.back;
  roles.forEach((role) => {
    const xs = role === 'front' ? [fx, bx] : [bx, fx];
    let placed = null;
    for (const x of xs) {
      for (const y of rowsOrder) {
        const k = x + ',' + y;
        if (!used.has(k) && !map.blocksMove(x, y)) { placed = [x, y]; used.add(k); break; }
      }
      if (placed) break;
    }
    out.push(placed);
  });
  return out;
}
