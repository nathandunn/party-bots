# Party Bots

Level-5 party combat simulator on SRD 5.1 (2014 rules). It asks which classes, class mixes and AI personalities actually win: all monks against all wizards, on open fields, in pillared halls, forests, chokepoints, ruins and tight rooms.

Live: https://party-bots.apps.precogsoftwareservices.com

## What's in it
- **Battle**: build two parties (1–6 each, any class, any personality). Watch one fight as an animated replay with a full log, or simulate 200 fights for win rates and per-unit stats.
- **Class matrix**: mono-class round robin (12×12) per map or across all maps.
- **Comps**: round-robin tournament between whole parties. It reports whether mixed parties beat single-class ones.
- **Personalities**: the same party driven by different minds, ranked against each other. Includes an editor for custom personalities, saved in the browser.
- **Rules**: class sheets, maps, simplifications, attribution.

## Engine (`engine/`)
Plain ES modules with no dependencies. The same code runs in Node and in a Web Worker.

| file | role |
|---|---|
| `classes.js` | 12 level-5 builds (human, standard array, ASI into the primary stat, one SRD subclass each) |
| `spells.js` | the SRD spells those builds use, as data |
| `maps.js` | six mirrored 24×16 battlefields |
| `combat.js` | grid, line of sight, cover, movement + opportunity attacks, attacks, saves, damage, death saves, concentration, auras |
| `actions.js` | weapon attacks (sneak, smite, rage, marks, colossus), spell resolution, reactions |
| `ai.js` | utility AI: scores option × target × destination, bonus actions, retreat, kiting |
| `personalities.js` | trait-based policies: aggression, caution, focus, teamwork, nova, ruthless, randomness, target mode |
| `sim.js` | `fight`, `matchup`, `classMatrix`, `tournament` |

```sh
node tools/cli.mjs fight barbarian wizard open 3                 # one logged fight, 4v4 mono
node tools/cli.mjs fight fighter,cleric:guardian,rogue,wizard sorcerer,monk,bard,paladin:berserker ruins 9
node tools/cli.mjs vs monk wizard pillars 200                    # win rate
node tools/cli.mjs matrix forest 30                              # 12x12 class matrix
node --test test/engine.test.mjs
```

## Personalities are policies
Every class can run any personality. The traits feed directly into the utility scores:

- **aggression**: closing distance, dashing in, accepting opportunity attacks
- **caution**: weighting danger, kiting, spreading out against fireballs, self-healing
- **focus**: team focus target, kill-shot bonus
- **teamwork**: healing, buffs, revives
- **nova**: how cheaply spell slots, smites, ki, action surge and quickened spells are spent
- **ruthless**: finishing downed enemies so they can't be healed back up
- **randomness**: noise on every decision

Target mode is one of threat, weakest, nearest or squishy.

## Deploy
This is a plain static site (no `package.json` on purpose). `deploy.sh party-bots nathandunn/party-bots` bind-mounts it into nginx.

## Licence / attribution
This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.
