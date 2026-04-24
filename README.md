# Core Surge — Project Structure (v0.7.14)

**Core Surge: Endless Tower Defense** — modular file layout so multiple AIs
can work in parallel without stomping on each other.

## File tree

```
index.html        HTML skeleton only. Just DOM + link/script tags.
README.md         This file.

css/
  theme.css       :root CSS variables per theme. Add new themes here.
  base.css        Global reset, body, TOP HUD, DEV PANEL, toasts, ad overlay.
  battle.css      Battle screen, battlefield, Core/Tower, enemies,
                  HP bar, upgrade panel, projectiles.
  menu.css        Main menu, tier picker, submenu bar, global bottom nav,
                  gem orb, card tiles, shop, skins, tournament tab.
  skins.css       Core skin + background skin visual rules (additive).

js/
  data.js         Static tables: CARD_POOL, CARD_PRICING, PULL_ODDS,
                  COPIES_TO_LEVEL, SLOT_UNLOCK_COSTS, TAGLINES,
                  TOURNEY_BANDS, TOURNEY_REWARDS_BASE, defaultSave shape.
  save.js         loadSave, persistSave, resetSave, migration,
                  labCost, highestUnlockedTier, milestone helpers.
  game.js         Game state, stat getters (damage/HP/crit/etc),
                  wave scaling, enemy types, battle start/end,
                  combat loop, damage/heal pipelines, apex specials.
  tournament.js   Bracket generation, synthetic competitors, score
                  submission, cycle end processing, reward payout.
  render.js       DOM rendering for battlefield, enemies, projectiles,
                  gem orbs, floating text.
  ui.js           Upgrades panel, live stats, HUD, screen routing,
                  main menu, all tab renderers (Research, Goals,
                  Loadout, Tournament, Store, Skins, Settings), dev panel.
  main.js         Passive accrual, offline catchup, gem orb spawner,
                  ad simulation, boot sequence.
  skins.js        Skin equip/apply/persist. DOM glue only, no combat math.

assets/
  cores/          6 Core sprite PNGs — wired to Skins tab.
  backgrounds/    4 background PNGs — wired to Skins tab.
  enemies/        12 enemy sprite PNGs — unwired, for future render.js work.
  vfx/            30 projectile/muzzle/impact/burst PNGs — unwired.
```

## Script load order (in index.html)

```
data -> save -> game -> tournament -> render -> ui -> main -> skins
```

Order matters. `data.js` defines constants that `game.js` reads. `game.js`
defines functions that `ui.js` calls. `skins.js` runs last so it can
apply equipped skins once everything else is loaded.

## Rules for AI co-work

1. **One AI, one scope.** Tell each AI exactly which files it may edit.
   Do not let an AI "redo the whole index."

2. **Do not rewrite unrelated files.** If an AI wants to edit `game.js`,
   it should return only `game.js`, not all files.

3. **No ES modules.** Everything is global via script tag load order.

4. **Stable DOM hooks.** Skins/themes should only read these IDs and
   never rewrite them: `#battlefield`, `#tower`, `#rangeRing`, `#hud`,
   `#screen-menu`, `#screen-battle`, `body[data-theme]`.

5. **Data before code.** New cards -> `data.js`. New math -> `game.js`.
   New UI panels -> `ui.js`. New skin art -> `assets/` + `skins.css`.

## Typical AI scope examples

**Balance / economy AI:**
- Edits: `js/data.js`
- Changes: card values, pull odds, tournament reward tables, taglines

**Theme / skin AI:**
- Edits: `css/theme.css`, `css/skins.css`, `assets/`
- Changes: new themes, new skin art

**Gameplay AI:**
- Edits: `js/game.js`
- Changes: combat formulas, wave scaling, enemy behavior

**UI polish AI:**
- Edits: `css/menu.css`, `css/battle.css`, `js/ui.js`
- Changes: tab layouts, button styles

**Tournament / meta AI:**
- Edits: `js/tournament.js`, `js/data.js` (reward tables only)
- Changes: bracket logic, synthetic competitor behavior

## Deploy

Cloudflare Pages serves this repo directly. No build step.

Repo root must look like this:
```
tower-game/
  index.html
  README.md
  css/...
  js/...
  assets/...
```

## Save compatibility

Save key is `tower_save_v7`. All migrations handle missing fields by
filling defaults. Existing saves load normally through v0.7.x.
