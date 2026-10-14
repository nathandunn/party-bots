// Seeded RNG + dice. mulberry32: fast, good enough for Monte Carlo.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const rng = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);          // 0..n-1
  rng.die = (s) => 1 + Math.floor(rng() * s);      // 1..s
  rng.d20 = (adv = 0) => {                         // adv: +1 advantage, -1 disadvantage, 0 straight
    const a1 = rng.die(20);
    if (!adv) return a1;
    const a2 = rng.die(20);
    return adv > 0 ? Math.max(a1, a2) : Math.min(a1, a2);
  };
  rng.dice = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += rng.die(s); return t; };
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return rng;
}

// "2d6" -> {n:2,s:6}
export function parseDice(str) {
  const m = /^(\d+)d(\d+)$/.exec(str);
  if (!m) throw new Error('bad dice ' + str);
  return { n: +m[1], s: +m[2] };
}
export const avgDie = (s) => (s + 1) / 2;
export const avgDice = (n, s) => n * (s + 1) / 2;
// Great Weapon Fighting: reroll 1s and 2s once -> expected value of one die
export const avgDieGWF = (s) => {
  let t = 0;
  for (let r = 1; r <= s; r++) t += r <= 2 ? avgDie(s) : r;
  return t / s;
};

// probability a d20 roll (with adv state) + bonus >= target. nat 1 always misses, nat 20 always hits (attacks)
export function pAtLeast(target, bonus, adv = 0, attack = false) {
  let need = target - bonus;               // need roll >= need
  if (attack) need = Math.min(Math.max(need, 2), 20);
  else need = Math.min(Math.max(need, 1), 21);
  const p = Math.max(0, Math.min(1, (21 - need) / 20));
  if (adv > 0) return 1 - (1 - p) * (1 - p);
  if (adv < 0) return p * p;
  return p;
}
export function pCrit(critOn = 20, adv = 0) {
  const p = (21 - critOn) / 20;
  if (adv > 0) return 1 - (1 - p) * (1 - p);
  if (adv < 0) return p * p;
  return p;
}
