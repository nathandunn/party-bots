// node tools/cli.mjs fight barbarian wizard [map] [seed]   -> prints a log
// node tools/cli.mjs matrix [map] [n]                       -> mono-class matrix
import { Battle, CLASS_IDS, mono, classMatrix, matchup } from '../engine/index.js';
const team = (s) => (s.includes(',') ? s.split(',').map((x) => { const [cls, personality] = x.split(':'); return { cls, personality: personality || 'balanced' }; }) : mono(s));
const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'fight') {
  const r = new Battle({ teams: [team(a[0]), team(a[1])], map: a[2] || 'open', seed: +(a[3] || 1), record: true }).run();
  for (const f of r.frames) for (const t of f.text) console.log(t);
  console.log('winner', r.winner, 'rounds', r.rounds);
} else if (cmd === 'vs') {
  const r = matchup(team(a[0]), team(a[1]), { map: a[2] || 'open', n: +(a[3] || 200) });
  console.log(a[0], 'vs', a[1], (r.winRateA * 100).toFixed(1) + '%', 'rounds', r.rounds.toFixed(1), 'draws', r.draws);
} else if (cmd === 'matrix') {
  const t0 = Date.now();
  const r = classMatrix(CLASS_IDS, { map: a[0] || 'open', n: +(a[1] || 20) });
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('', 10) + CLASS_IDS.map((c) => pad(c.slice(0, 4), 5)).join('') + ' avg');
  r.M.forEach((row, i) => console.log(pad(CLASS_IDS[i], 10) + row.map((v, j) => pad(i === j ? ' -' : Math.round(v * 100), 5)).join('') + ' ' + Math.round(r.avg[i] * 100)));
  console.log('ms', Date.now() - t0);
}
