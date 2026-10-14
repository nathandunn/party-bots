// Hand-drawn (procedural) class sprites. Side view, facing right; caller flips for left.
// Local units: one grid cell = 40. Origin = cell centre, feet at y = +16.

export const LOOK = {
  barbarian: { skin: '#c98e62', hair: '#b5482a', bare: true, fur: '#8a6a45', belt: '#5a3b22', pants: '#5a3b22', boots: '#3b2717', head: 'horned', weapon: 'greataxe', scale: 1.1 },
  fighter:   { skin: '#e0b089', plate: '#a7b0ba', plateHi: '#dbe1e7', pants: '#7d8690', boots: '#525860', head: 'closed', weapon: 'greatsword' },
  paladin:   { skin: '#e8be97', plate: '#e6dfcb', plateHi: '#fffaf0', trim: '#d9a441', pants: '#b9b2a0', boots: '#8d7d58', head: 'winged', cape: true, weapon: 'longsword', shield: 'kite' },
  cleric:    { skin: '#b07650', hair: '#2e2018', chain: '#9aa1a8', tabard: '#efe6cf', trim: '#d9a441', pants: '#6b6f75', boots: '#4a3b2a', head: 'circlet', weapon: 'mace', shield: 'sun' },
  monk:      { skin: '#d9a066', gi: '#e08a2c', sash: '#7a3f12', pants: '#e08a2c', boots: null, head: 'bald', weapon: 'fist' },
  rogue:     { skin: '#e2b48e', leather: '#3d3a46', hood: '#2a2833', pants: '#2f2d36', boots: '#1e1d24', head: 'hood', mask: true, weapon: 'shortbow', melee: 'rapier' },
  ranger:    { skin: '#c99b74', tunic: '#56703d', hood: '#3f5a2c', pants: '#5b4a35', boots: '#3a2e20', head: 'hood', weapon: 'longbow', melee: 'shortsword', quiver: true, cloak: '#3f5a2c' },
  wizard:    { skin: '#efc9a6', robe: '#3b4ea6', robeHi: '#5a6fd0', trim: '#e8c45a', boots: '#2a2a3a', head: 'wizhat', beard: '#e8e8e8', weapon: 'staff', orb: '#8fd0ff' },
  sorcerer:  { skin: '#f0c7a0', robe: '#9e2232', robeHi: '#c43a4a', trim: '#f1c04a', boots: '#3a1418', head: 'spiky', hair: '#f1c04a', weapon: 'glow', glow: '#ff8a3d' },
  warlock:   { skin: '#c9b0b8', robe: '#2f1d3d', robeHi: '#4c2f61', trim: '#b06cff', boots: '#1a1022', head: 'hornhood', weapon: 'glow', glow: '#b06cff', tome: true },
  bard:      { skin: '#d8a27a', doublet: '#b03b6c', doubletHi: '#d45a8c', pants: '#e8d9b5', boots: '#5a3b22', head: 'plume', hat: '#2b6f8a', plume: '#f2d27a', weapon: 'rapier', lute: true },
  druid:     { skin: '#a8754f', robe: '#5e7b3c', robeHi: '#7b9a52', trim: '#cdb68a', boots: '#4a3b2a', head: 'antlers', hair: '#4a3020', weapon: 'druidstaff', cloak: '#3f6b2a' },
};

const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function poly(ctx, pts, c, stroke) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); if (c) { ctx.fillStyle = c; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
function rrect(ctx, x, y, w, h, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.max(0, Math.min(255, r * f)); g = Math.max(0, Math.min(255, g * f)); b = Math.max(0, Math.min(255, b * f)); return `rgb(${r | 0},${g | 0},${b | 0})`; };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ---------------------------------------------------------------- weapons (drawn along +x from the hand)
export function drawWeapon(ctx, kind, opts = {}) {
  ctx.lineCap = 'round';
  switch (kind) {
    case 'greataxe':
      R(ctx, -4, -1.2, 28, 2.6, '#6b4a2b');
      poly(ctx, [19, -1, 25, -9, 29, -7, 28, 0, 29, 7, 25, 9, 19, 1], '#b9c0c7', '#6d747b');
      poly(ctx, [19, -1, 16, -5, 15, 0, 16, 5, 19, 1], '#9aa1a8');
      break;
    case 'greatsword':
      R(ctx, -5, -1.3, 7, 2.6, '#5b3a22'); R(ctx, 1, -5, 2.4, 10, '#c9a24a');
      poly(ctx, [3, -2.2, 27, -1.6, 31, 0, 27, 1.6, 3, 2.2], '#dfe5ea', '#8d959d');
      R(ctx, 5, -0.4, 20, 0.8, '#aab2ba');
      break;
    case 'longsword':
      R(ctx, -3, -1.2, 5, 2.4, '#5b3a22'); R(ctx, 1, -4, 2, 8, '#d9a441');
      poly(ctx, [3, -1.8, 20, -1.3, 23, 0, 20, 1.3, 3, 1.8], '#eef2f5', '#9aa1a8');
      break;
    case 'shortsword':
      R(ctx, -2, -1, 4, 2, '#4a3020'); R(ctx, 1, -3, 1.6, 6, '#8d959d');
      poly(ctx, [2.5, -1.5, 14, -1.1, 16, 0, 14, 1.1, 2.5, 1.5], '#dfe5ea', '#8d959d');
      break;
    case 'rapier':
      R(ctx, -2, -1, 4, 2, '#3a2a1e'); ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(2.5, 0, 3, -1.6, 1.6); ctx.stroke();
      ctx.strokeStyle = '#e8edf2'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(24, 0); ctx.stroke();
      break;
    case 'scimitar':
      R(ctx, -2, -1, 4, 2, '#4a3020');
      ctx.fillStyle = '#e3e8ec'; ctx.beginPath(); ctx.moveTo(2, -1.5); ctx.quadraticCurveTo(12, -4, 18, -1); ctx.lineTo(17, 1); ctx.quadraticCurveTo(11, -1, 2, 1.5); ctx.fill();
      break;
    case 'mace':
      R(ctx, -3, -1.1, 15, 2.2, '#6b4a2b');
      circ(ctx, 14, 0, 3.6, '#c9a24a'); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; R(ctx, 14 + Math.cos(a) * 3 - 1, Math.sin(a) * 3 - 1, 2, 2, '#e8c45a'); }
      break;
    case 'dagger':
      R(ctx, -2, -0.9, 4, 1.8, '#3a2a1e'); poly(ctx, [2, -1.2, 10, 0, 2, 1.2], '#dfe5ea');
      break;
    case 'staff':
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(24, 0); ctx.stroke();
      circ(ctx, 26, 0, 3.8, opts.orb || '#8fd0ff'); circ(ctx, 25, -1.2, 1.4, '#fff');
      ctx.globalAlpha *= 0.35; circ(ctx, 26, 0, 6.5, opts.orb || '#8fd0ff'); ctx.globalAlpha /= 0.35;
      break;
    case 'druidstaff':
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(8, 2, 22, -1); ctx.stroke();
      for (const [lx, ly, a] of [[20, -3, -0.6], [23, 2, 0.5], [16, -3, -1]]) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(a); ctx.fillStyle = '#6fbf4a'; ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 1.6, 0, 0, 7); ctx.fill(); ctx.restore(); }
      break;
    case 'javelin':
      ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(18, 0); ctx.stroke(); poly(ctx, [18, -1.8, 23, 0, 18, 1.8], '#c9d0d6');
      break;
    case 'lightxbow':
      R(ctx, -2, -1.4, 14, 2.8, '#6b4a2b'); ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(11, -7); ctx.quadraticCurveTo(14, 0, 11, 7); ctx.stroke();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(11, -7); ctx.lineTo(8, 0); ctx.lineTo(11, 7); ctx.stroke();
      break;
  }
}

// bows are held upright at the front hand; draw = 0..1 string pull
function drawBow(ctx, long, draw) {
  const h = long ? 15 : 11;
  ctx.strokeStyle = long ? '#7a5230' : '#5a3d24'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-1, -h); ctx.quadraticCurveTo(7, 0, -1, h); ctx.stroke();
  const pull = -2 - draw * 8;
  ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-1, -h); ctx.lineTo(pull, 0); ctx.lineTo(-1, h); ctx.stroke();
  if (draw > 0.05) { ctx.strokeStyle = '#c9a77a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pull, 0); ctx.lineTo(pull + 16, 0); ctx.stroke(); poly(ctx, [pull + 16, -1.4, pull + 19, 0, pull + 16, 1.4], '#d0d6dc'); }
}

// ---------------------------------------------------------------- the character
// st: { walk (phase radians), moving, atk: {kind:'melee'|'bow'|'throw'|'cast'|'punch', t}, hurt (0..1), lying (0..1 rotation), dead, weapon override, glow }
export function drawCharacter(ctx, cls, team, st) {
  const L = LOOK[cls];
  const S = L.scale || 1;
  ctx.save();
  ctx.scale(S, S);
  const teamCol = team === 0 ? '#5b8def' : '#e0574f';

  // ground ring (team)
  ctx.save(); ctx.globalAlpha *= 0.85;
  ctx.strokeStyle = teamCol; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 16, 13, 4.5, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 16, 11, 3.6, 0, 0, 7); ctx.fill();
  ctx.restore();

  // falling / lying: rotate around the feet
  if (st.lying) { ctx.translate(-2, 16); ctx.rotate(-Math.PI / 2 * st.lying); ctx.translate(0, -16); }
  const bob = st.moving && !st.lying ? Math.abs(Math.sin(st.walk)) * -1.6 : 0;
  ctx.translate(0, bob);
  // hurt recoil
  if (st.hurt) ctx.translate(-st.hurt * 3, 0);
  // lunge
  const a = st.atk;
  if (a && (a.kind === 'melee' || a.kind === 'punch')) { const l = Math.sin(Math.min(1, a.t) * Math.PI); ctx.translate(l * 6, 0); }

  const swing = st.moving && !st.lying ? Math.sin(st.walk) * 0.55 : 0;
  const robe = L.robe;

  // cape / cloak behind
  if (L.cape || L.cloak) {
    const c = L.cape ? teamCol : L.cloak;
    const flap = st.moving ? Math.sin(st.walk * 1.3) * 2 : 0;
    poly(ctx, [-3, -7, 3, -7, -1 - 6 - flap, 13, -9 - flap, 12], shade(c, 0.85));
  }
  if (L.quiver) { ctx.save(); ctx.translate(-5, -3); ctx.rotate(-0.4); R(ctx, -2, -8, 4, 11, '#6b4a2b'); for (let k = 0; k < 3; k++) R(ctx, -1.5 + k * 1.3, -11, 0.8, 4, '#e8e2d0'); ctx.restore(); }
  if (L.lute) { ctx.save(); ctx.translate(-6, -1); ctx.rotate(-0.5); ctx.fillStyle = '#a8743a'; ctx.beginPath(); ctx.ellipse(0, 3, 4, 5, 0, 0, 7); ctx.fill(); R(ctx, -0.8, -9, 1.6, 9, '#6b4a2b'); circ(ctx, 0, 3, 1.3, '#3a2414'); ctx.restore(); }

  // legs
  const legCol = L.pants || (robe ? shade(robe, 0.7) : '#555');
  const boot = L.boots || L.skin;
  const leg = (ang, dark) => {
    ctx.save(); ctx.translate(0, 5); ctx.rotate(ang);
    R(ctx, -2, 0, 4, 8, dark ? shade(legCol, 0.75) : legCol);
    R(ctx, -2.2, 7.5, 5.5, 3, dark ? shade(boot, 0.75) : boot);
    ctx.restore();
  };
  leg(-swing, true); leg(swing, false);

  // back arm + off-hand item
  const backArmAng = a && a.kind === 'cast' ? -2.2 * Math.sin(Math.min(1, a.t) * Math.PI) - 0.2 : 0.35 - swing * 0.6;
  ctx.save(); ctx.translate(-1, -4); ctx.rotate(backArmAng);
  R(ctx, -1.6, 0, 3.2, 9, L.bare ? shade(L.skin, 0.85) : shade(L.plate || L.chain || L.gi || L.leather || L.tunic || L.doublet || robe || '#666', 0.8));
  circ(ctx, 0, 9.5, 1.9, shade(L.skin, 0.85));
  if (L.tome) { ctx.translate(0, 10); ctx.rotate(-backArmAng); R(ctx, 0, -4, 6, 7, '#3c1f52'); R(ctx, 0.6, -3.4, 4.8, 5.8, '#e6dcc4'); R(ctx, 0, -4, 1.2, 7, '#b06cff'); }
  ctx.restore();
  if (L.shield) {
    ctx.save(); ctx.translate(5, 1);
    if (L.shield === 'kite') { poly(ctx, [-4, -8, 4, -8, 4, 2, 0, 8, -4, 2], '#f2ede0', '#b9a46a'); R(ctx, -0.8, -6, 1.6, 11, L.trim); R(ctx, -3, -3.5, 6, 1.6, L.trim); }
    else { circ(ctx, 0, -1, 6.5, '#c9a24a'); circ(ctx, 0, -1, 5, '#e8c45a'); for (let k = 0; k < 8; k++) { const q = k * Math.PI / 4; R(ctx, Math.cos(q) * 3.5 - 0.6, -1 + Math.sin(q) * 3.5 - 0.6, 1.2, 1.2, '#fff6c8'); } circ(ctx, 0, -1, 1.8, '#fff6c8'); }
    ctx.restore();
  }

  // torso
  if (robe) {
    poly(ctx, [-5.5, -6, 5.5, -6, 8, 14, -8, 14], robe);
    poly(ctx, [0.5, -6, 5.5, -6, 8, 14, 2, 14], L.robeHi);
    R(ctx, -8, 12.5, 16, 1.6, L.trim);
    R(ctx, -5.5, 2, 11, 1.8, L.trim);
    if (cls === 'wizard') for (const [sx, sy] of [[-3, 6], [3, 9], [-1, 11]]) circ(ctx, sx, sy, 0.8, '#ffe9a0');
  } else if (L.plate) {
    rrect(ctx, -5.5, -7, 11, 14, 3, L.plate);
    R(ctx, 0.5, -6, 3.5, 12, L.plateHi);
    R(ctx, -5.5, 2, 11, 1.8, L.trim || shade(L.plate, 0.7));
    circ(ctx, -1, -6, 3.5, shade(L.plate, 0.9)); // pauldron
    if (L.trim) { R(ctx, -2.5, -4, 5, 1.2, L.trim); R(ctx, -0.6, -5.5, 1.2, 4.5, L.trim); }
  } else if (L.bare) {
    rrect(ctx, -5.5, -7, 11, 13, 3, L.skin);
    R(ctx, 1.5, -5, 3, 4, shade(L.skin, 1.1));
    R(ctx, -5.5, 4, 11, 3, L.belt);
    poly(ctx, [-6, -7, 2, -8, 4, -4, -6, -2], L.fur);
    poly(ctx, [-6, 6, 6, 6, 5, 11, -5, 11], L.fur);
  } else if (L.chain) {
    rrect(ctx, -5.5, -7, 11, 14, 3, L.chain);
    poly(ctx, [-4, -6, 4, -6, 5, 12, -5, 12], L.tabard);
    circ(ctx, 0, 0, 2.6, L.trim); circ(ctx, 0, 0, 1.4, '#fff6c8');
  } else {
    const c = L.gi || L.leather || L.tunic || L.doublet;
    rrect(ctx, -5.5, -7, 11, 14, 3, c);
    R(ctx, 0.5, -6, 3.5, 12, L.doubletHi || shade(c, 1.15));
    if (L.sash) R(ctx, -5.5, 2, 11, 2.4, L.sash);
    else R(ctx, -5.5, 3, 11, 1.8, '#3a2a1e');
    if (cls === 'monk') poly(ctx, [-2, -7, 2, -7, 0, -2], shade(L.skin, 0.95));
  }
  // team tabard stripe so sides read at a glance
  ctx.save(); ctx.globalAlpha *= 0.9; ctx.fillStyle = teamCol; ctx.beginPath(); ctx.moveTo(-5.5, -5); ctx.lineTo(-3.5, -7); ctx.lineTo(5.5, 3); ctx.lineTo(5.5, 5.5); ctx.closePath(); ctx.fill(); ctx.restore();

  // head
  const hx = 0.8, hy = -12.5;
  circ(ctx, hx, hy, 5.8, L.skin);
  drawHead(ctx, cls, L, hx, hy, st);

  // front arm + weapon
  let armAng, wAng, wKind = st.weapon || L.weapon;
  const t = a ? Math.min(1, a.t) : 0;
  if (a && a.kind === 'melee') {
    // wind-up behind the head, chop through, follow-through
    const k = t < 0.35 ? t / 0.35 : 1;
    const k2 = t < 0.35 ? 0 : ease((t - 0.35) / 0.65);
    armAng = -2.6 * k + 3.2 * k2; wAng = -0.3;
  } else if (a && a.kind === 'punch') {
    armAng = -1.57 + Math.sin(t * Math.PI) * 0.0; wAng = 0; wKind = 'fist';
  } else if (a && a.kind === 'throw') {
    armAng = t < 0.5 ? -2.8 * (t / 0.5) : -2.8 + 3.4 * ease((t - 0.5) / 0.5); wAng = 0.2;
  } else if (a && a.kind === 'cast') {
    armAng = -1.4 - Math.sin(t * Math.PI) * 0.6; wAng = 0.4;
  } else if (a && a.kind === 'bow') {
    armAng = -1.57; wAng = 1.57;
  } else { armAng = -0.5 + swing * 0.5; wAng = -0.9; }

  const isBow = wKind === 'longbow' || wKind === 'shortbow';
  ctx.save(); ctx.translate(1, -4); ctx.rotate(armAng + (isBow && !(a && a.kind === 'bow') ? 0.6 : 0));
  const sleeve = L.bare ? L.skin : (L.plate || L.chain || L.gi || L.leather || L.tunic || L.doublet || robe);
  R(ctx, -1.7, 0, 3.4, 9, sleeve);
  if (cls === 'monk' || L.bare) R(ctx, -1.8, 6, 3.6, 2.2, '#e8dcc0'); // wraps / bracer
  circ(ctx, 0, 10, 2, L.skin);
  ctx.translate(0, 10);
  if (a && a.kind === 'punch') { circ(ctx, 0, 0, 2.6, '#e8dcc0'); }
  else if (isBow) { ctx.rotate(-armAng - (a && a.kind === 'bow' ? 0 : 0.6)); drawBow(ctx, wKind === 'longbow', a && a.kind === 'bow' ? Math.min(1, t * 1.6) : 0); }
  else if (wKind === 'glow' || wKind === 'fist') {
    if (wKind === 'glow') { const g = L.glow; ctx.save(); ctx.globalAlpha *= 0.45 + (a && a.kind === 'cast' ? 0.5 : 0.15 * Math.sin(st.time / 200)); circ(ctx, 0, 0, a && a.kind === 'cast' ? 6 : 3.5, g); ctx.restore(); circ(ctx, 0, 0, 1.6, '#fff'); }
  } else { ctx.rotate(wAng); drawWeapon(ctx, wKind, { orb: L.orb }); }
  ctx.restore();

  // dead: grey wash + x eyes are drawn by caller via filter; mark here
  ctx.restore();
}

function drawHead(ctx, cls, L, hx, hy, st) {
  // eyes (facing right)
  const eye = (c) => { R(ctx, hx + 2.2, hy - 1, 1.4, 1.6, c); };
  switch (L.head) {
    case 'horned':
      poly(ctx, [hx - 6, hy - 1, hx - 9, hy + 9, hx - 4, hy + 4], L.hair); // long hair
      ctx.fillStyle = '#7d858c'; ctx.beginPath(); ctx.arc(hx, hy - 1, 6.1, Math.PI, 0); ctx.fill(); R(ctx, hx - 6.1, hy - 1.5, 12.2, 1.8, '#5d646b');
      ctx.fillStyle = '#efe4c8';
      ctx.beginPath(); ctx.moveTo(hx + 4, hy - 4); ctx.quadraticCurveTo(hx + 11, hy - 6, hx + 10, hy - 13); ctx.quadraticCurveTo(hx + 8, hy - 7, hx + 3, hy - 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx - 4, hy - 4); ctx.quadraticCurveTo(hx - 11, hy - 6, hx - 10, hy - 13); ctx.quadraticCurveTo(hx - 8, hy - 7, hx - 3, hy - 6); ctx.fill();
      eye('#2a1a10'); R(ctx, hx - 1, hy + 2.5, 6, 3, L.hair); // beard
      break;
    case 'closed':
      circ(ctx, hx, hy, 6.3, L.plate); R(ctx, hx - 1, hy - 5, 7.3, 7, L.plateHi);
      R(ctx, hx + 1, hy - 1.6, 5.6, 1.4, '#2a2d31'); R(ctx, hx + 2, hy + 1.5, 4, 0.8, '#2a2d31');
      poly(ctx, [hx - 2, hy - 6, hx + 1, hy - 11, hx + 3, hy - 6], '#b5322c'); // plume
      break;
    case 'winged':
      circ(ctx, hx, hy, 6.3, L.plate); R(ctx, hx + 1.5, hy - 2, 5, 5, L.skin); eye('#1d2a3a');
      ctx.fillStyle = L.trim; ctx.beginPath(); ctx.moveTo(hx - 4, hy - 3); ctx.quadraticCurveTo(hx - 12, hy - 9, hx - 7, hy - 14); ctx.quadraticCurveTo(hx - 6, hy - 8, hx - 2, hy - 5); ctx.fill();
      R(ctx, hx - 6.3, hy - 3, 12.6, 1.4, L.trim);
      break;
    case 'circlet':
      ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(hx, hy - 0.5, 6.1, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); R(ctx, hx - 6, hy - 2, 3, 6, L.hair);
      R(ctx, hx - 5.8, hy - 3.2, 11.6, 1.3, L.trim); circ(ctx, hx + 5, hy - 2.6, 1.2, '#fff6c8'); eye('#1a1008');
      break;
    case 'bald':
      circ(ctx, hx - 0.5, hy - 2.5, 2.6, shade(L.skin, 1.12)); eye('#1a1008'); R(ctx, hx - 2, hy - 5, 0.9, 1.8, '#6b3a1a'); R(ctx, hx - 0.5, hy - 5.4, 0.9, 1.8, '#6b3a1a');
      break;
    case 'hood':
      ctx.fillStyle = L.hood; ctx.beginPath(); ctx.moveTo(hx - 7, hy + 5); ctx.quadraticCurveTo(hx - 8, hy - 9, hx + 1, hy - 9); ctx.quadraticCurveTo(hx + 8, hy - 8, hx + 6.5, hy - 1); ctx.lineTo(hx + 3, hy - 3); ctx.quadraticCurveTo(hx + 1, hy + 3, hx + 4, hy + 6); ctx.closePath(); ctx.fill();
      eye(L.mask ? '#d9e0e8' : '#1a1008');
      if (L.mask) R(ctx, hx + 1.5, hy + 0.8, 4.6, 3.6, '#22212a');
      break;
    case 'wizhat':
      R(ctx, hx - 1, hy + 1, 6.5, 9, L.beard); poly(ctx, [hx - 1, hy + 10, hx + 5.5, hy + 10, hx + 2, hy + 14], L.beard);
      eye('#1a1a30');
      poly(ctx, [hx - 9, hy - 3.5, hx + 9, hy - 3.5, hx + 6, hy - 1.5, hx - 6, hy - 1.5], '#2c3a85');
      ctx.fillStyle = '#33449a'; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 3.5); ctx.lineTo(hx + 6, hy - 3.5); ctx.quadraticCurveTo(hx + 2, hy - 12, hx - 6, hy - 19); ctx.quadraticCurveTo(hx - 3, hy - 10, hx - 6, hy - 3.5); ctx.fill();
      R(ctx, hx - 5.5, hy - 6, 11, 1.6, L.trim); circ(ctx, hx - 1, hy - 11, 0.9, '#ffe9a0');
      break;
    case 'spiky':
      ctx.fillStyle = L.hair; ctx.beginPath(); ctx.moveTo(hx - 6.5, hy + 1);
      const sp = [[-7, -6], [-4, -11], [-1, -7], [2, -12], [4, -7], [8, -9], [6.5, -2]];
      for (const [dx, dy] of sp) ctx.lineTo(hx + dx, hy + dy); ctx.closePath(); ctx.fill();
      eye('#a01818'); R(ctx, hx - 3.5, hy + 1, 2, 1.2, '#c43a4a'); R(ctx, hx - 3, hy + 3, 2, 1.2, '#c43a4a'); // scales
      break;
    case 'hornhood':
      ctx.fillStyle = L.robe; ctx.beginPath(); ctx.moveTo(hx - 7, hy + 5); ctx.quadraticCurveTo(hx - 8, hy - 9, hx + 1, hy - 9); ctx.quadraticCurveTo(hx + 8, hy - 8, hx + 6.5, hy - 1); ctx.lineTo(hx + 3, hy - 3); ctx.quadraticCurveTo(hx + 1, hy + 3, hx + 4, hy + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8c7a8'; ctx.beginPath(); ctx.moveTo(hx - 1, hy - 7); ctx.quadraticCurveTo(hx - 5, hy - 13, hx - 1, hy - 15); ctx.quadraticCurveTo(hx - 2, hy - 11, hx + 1, hy - 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx + 3, hy - 7.5); ctx.quadraticCurveTo(hx + 4, hy - 13, hx + 8, hy - 14); ctx.quadraticCurveTo(hx + 5, hy - 11, hx + 5, hy - 7); ctx.fill();
      ctx.save(); ctx.shadowColor = '#b06cff'; ctx.shadowBlur = 4; R(ctx, hx + 2.2, hy - 1, 2, 1.4, '#e4c4ff'); ctx.restore();
      break;
    case 'plume':
      R(ctx, hx - 6, hy - 1, 3, 5, '#5a3820'); eye('#1a1008'); R(ctx, hx + 2, hy + 2.2, 3, 0.8, '#5a3820');
      ctx.fillStyle = L.hat; ctx.beginPath(); ctx.ellipse(hx, hy - 4, 8.5, 2.5, -0.15, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(hx - 0.5, hy - 6, 5.5, 3.5, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = L.plume; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 3, hy - 7); ctx.quadraticCurveTo(hx - 10, hy - 13, hx - 12, hy - 7); ctx.stroke();
      break;
    case 'antlers':
      ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(hx, hy - 0.5, 6.1, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); R(ctx, hx - 6.5, hy - 2, 3.5, 9, L.hair);
      eye('#1a1008');
      ctx.strokeStyle = L.trim; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * 2.5, hy - 5); ctx.lineTo(hx + s * 5, hy - 12); ctx.moveTo(hx + s * 3.6, hy - 8.5); ctx.lineTo(hx + s * 7.5, hy - 10); ctx.moveTo(hx + s * 4.5, hy - 11); ctx.lineTo(hx + s * 3, hy - 15); ctx.stroke(); }
      for (const [dx, dy] of [[-3, -5], [3, -5], [0, -6]]) { ctx.fillStyle = '#6fbf4a'; ctx.beginPath(); ctx.ellipse(hx + dx, hy + dy, 2, 1, dx * 0.2, 0, 7); ctx.fill(); }
      break;
  }
}

// small helpers for the effects layer
export const SPELL_COL = {
  fireBolt: '#ff8a3d', eldritchBlast: '#b06cff', produceFlame: '#ffb347', sacredFlame: '#fff2a8', viciousMockery: '#ff6bd5',
  magicMissile: '#9fd3ff', guidingBolt: '#ffe27a', scorchingRay: '#ff6a2b', fireball: '#ff7a2a', shatter: '#e8f0ff',
  thunderwave: '#8fc8ff', callLightning: '#bfe3ff', hypnoticPattern: '#d38cff', faerieFire: '#c58cff', entangle: '#6fbf4a',
  moonbeam: '#f4f4d2', spiritGuardians: '#f2d27a', holdPerson: '#8fd0ff', dissonantWhispers: '#a77cff', bless: '#ffe9a0',
  haste: '#9ff2c8', hex: '#a04cff', huntersMark: '#e0574f', spiritualWeapon: '#f2d27a', healingWord: '#7ee08a', cureWounds: '#7ee08a',
  massHealingWord: '#7ee08a', layOnHands: '#ffe27a', secondWind: '#9fe0a8', preserveLife: '#ffe9a0', mistyStep: '#c8b6ff', shield: '#9fd3ff',
};
