// ============================================================
// save.js — loadSave, persistSave, resetSave, migration, labCost, highestUnlockedTier, milestone helpers.
// Owned by: save/meta AI. Do not put combat logic here.
// ============================================================

// ============================================================
// SAVE
// ============================================================
const defaultSave = {
  coins: 0,
  gems: 0,
  totalRuns: 0,
  bestTier: 1,
  bestWave: 1,
  bestWavePerTier: { 1: 0 },
  claimedMilestones: {},
  selectedTier: 1,
  totalCashEarned: 0,
  totalEnemiesKilled: 0,
  totalPlaytimeMs: 0,
  settings: {
    showFloatingDamage: true,
    showFloatingCash: true,
    showFloatingHeals: true,
    theme: 'neon',
    gameSpeed: 1,
    devMode: false,
    buyMultiplier: 1  // 1, 10, 100, or 'max'
  },
  devState: {
    godMode: false
  },
  lastAdRewardTime: 0,  // last time the shop's ad-for-gems was claimed (ms epoch)
  // Cards system (v0.7.6+)
  // cardInventory: { 'heavyCaliber': { level: 1, copies: 3 }, ... }
  // equippedCards: array sized by unlockedSlots, null if empty
  cardInventory: {},
  equippedCards: [null, null, null],
  unlockedSlots: 3,
  labs: {
    // === Combat offense ===
    damage:         { level: 0, max: 999, group: 'combat',  name: 'Damage',         cost0: 30,   costMul: 1.10, valuePerLevel: 0.05, type: 'mul', desc: 'Permanent +5%/lvl damage' },
    fireRate:       { level: 0, max: 500, group: 'combat',  name: 'Fire Rate',      cost0: 60,   costMul: 1.11, valuePerLevel: 0.03, type: 'mul', desc: 'Permanent +3%/lvl fire rate' },
    critChance:     { level: 0, max: 100, group: 'combat',  name: 'Crit Chance',    cost0: 120,  costMul: 1.13, valuePerLevel: 0.005,type: 'add', desc: 'Permanent +0.5%/lvl crit chance (cap 50%)' },
    critPower:      { level: 0, max: 200, group: 'combat',  name: 'Crit Power',     cost0: 100,  costMul: 1.12, valuePerLevel: 0.02, type: 'add', desc: 'Permanent +0.02/lvl crit multiplier' },
    multiChance:    { level: 0, max: 100, group: 'combat',  name: 'Multishot',      cost0: 160,  costMul: 1.13, valuePerLevel: 0.004,type: 'add', desc: 'Permanent +0.4%/lvl multishot chance' },
    multiPower:     { level: 0, max: 100, group: 'combat',  name: 'Multi Power',    cost0: 140,  costMul: 1.12, valuePerLevel: 0.004,type: 'add', desc: 'Permanent +0.4%/lvl multishot power' },
    bounceChance:   { level: 0, max: 100, group: 'combat',  name: 'Bounce',         cost0: 160,  costMul: 1.13, valuePerLevel: 0.004,type: 'add', desc: 'Permanent +0.4%/lvl bounce chance' },
    bouncePower:    { level: 0, max: 100, group: 'combat',  name: 'Bounce Power',   cost0: 140,  costMul: 1.12, valuePerLevel: 0.004,type: 'add', desc: 'Permanent +0.4%/lvl bounce power' },
    range:          { level: 0, max: 100, group: 'combat',  name: 'Range',          cost0: 70,   costMul: 1.11, valuePerLevel: 0.02, type: 'mul', desc: 'Permanent +2%/lvl range' },

    // === Defense ===
    health:         { level: 0, max: 999, group: 'defense', name: 'Core Integrity', cost0: 50,   costMul: 1.12, valuePerLevel: 0.03, type: 'mul', desc: 'Permanent +3%/lvl max HP' },
    defense:        { level: 0, max: 100, group: 'defense', name: 'Armor',          cost0: 80,   costMul: 1.12, valuePerLevel: 0.01, type: 'add', desc: 'Permanent +1%/lvl damage reduction (cap 50%)' },
    lifesteal:      { level: 0, max: 100, group: 'defense', name: 'Lifesteal',      cost0: 130,  costMul: 1.12, valuePerLevel: 0.003,type: 'add', desc: 'Permanent +0.3%/lvl lifesteal' },
    regen:          { level: 0, max: 100, group: 'defense', name: 'Regen',          cost0: 110,  costMul: 1.12, valuePerLevel: 0.0005,type:'add', desc: 'Permanent +0.05%/lvl HP regen' },

    // === Economy ===
    cashBonus:      { level: 0, max: 999, group: 'economy', name: 'Cash Bonus',     cost0: 40,   costMul: 1.10, valuePerLevel: 0.02, type: 'mul', desc: 'More cash per kill' },
    waveBonus:      { level: 0, max: 200, group: 'economy', name: 'Wave Bonus',     cost0: 90,   costMul: 1.11, valuePerLevel: 0.02, type: 'mul', desc: 'Permanent +2%/lvl end-of-wave cash' },
    bossBounty:     { level: 0, max: 200, group: 'economy', name: 'Boss Bounty',    cost0: 120,  costMul: 1.12, valuePerLevel: 0.03, type: 'mul', desc: 'Permanent +3%/lvl boss kill reward' },
    comboBonus:     { level: 0, max: 200, group: 'economy', name: 'Combo Max',      cost0: 110,  costMul: 1.12, valuePerLevel: 0.02, type: 'mul', desc: 'Permanent +2%/lvl max combo multiplier' },
    coinsPerRun:    { level: 0, max: 999, group: 'economy', name: 'Coin Yield',     cost0: 100,  costMul: 1.13, valuePerLevel: 0.03, type: 'mul', desc: 'More coins earned per run' },

    // === Utility ===
    gameSpeed:      { level: 0, max: 60,  group: 'utility', name: 'Game Speed',     cost0: 500,  costMul: 1.20, valuePerLevel: 1,    type: 'add', desc: 'Unlocks 2× at L20, 3× at L50' },
    offlineRate:    { level: 0, max: 45,  group: 'utility', name: 'Offline Rate',   cost0: 25,   costMul: 1.18, valuePerLevel: 0.01, type: 'add', desc: 'Coin earn rate while offline' },
    offlineCap:     { level: 0, max: 35,  group: 'utility', name: 'Offline Cap',    cost0: 35,   costMul: 1.20, valuePerLevel: 10,   type: 'add', desc: 'Minutes of offline accumulation' }
  },
  lastSaveTime: Date.now(),
  version: 7,

  // Tournament (v0.7.13+): persistent bracket state, league, cycle info.
  // See js/tournament.js for the full shape and helpers.
  tournament: null,
  // Stable user-facing name used on leaderboards. Stored separately from save-file.
  playerId: 'You',

  // Skins (v0.7.14+): null = default CSS Core/background, else skin id.
  equippedCoreSkin: null,
  equippedBgSkin: null
};

let save;

function loadSave() {
  // v0.7.0 wipes all prior saves intentionally. Combat system overhaul
  // means old upgrade names/structure no longer apply.
  for (const deadKey of DEAD_SAVE_KEYS) {
    if (localStorage.getItem(deadKey)) {
      console.log('v0.7.0: purging old save ' + deadKey);
      localStorage.removeItem(deadKey);
    }
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      save = { ...defaultSave, ...loaded };
      save.settings = { ...defaultSave.settings, ...(loaded.settings || {}) };
      save.devState = { ...defaultSave.devState, ...(loaded.devState || {}) };
      save.bestWavePerTier = loaded.bestWavePerTier || { 1: 0 };
      save.claimedMilestones = loaded.claimedMilestones || {};
      save.labs = { ...defaultSave.labs };
      for (const k of Object.keys(defaultSave.labs)) {
        if (loaded.labs && loaded.labs[k]) {
          save.labs[k] = { ...defaultSave.labs[k], level: loaded.labs[k].level || 0 };
        }
      }
      if (!save.selectedTier || save.selectedTier < 1) save.selectedTier = 1;
      // Card system: migrate or default
      save.cardInventory = loaded.cardInventory || {};
      // Ensure every card has a copies count (older saves only had level)
      for (const id of Object.keys(save.cardInventory)) {
        if (!save.cardInventory[id].copies) save.cardInventory[id].copies = 1;
      }
      save.unlockedSlots = Math.max(STARTING_SLOTS, Math.min(MAX_SLOTS, loaded.unlockedSlots || STARTING_SLOTS));
      // Ensure equippedCards array matches unlockedSlots length
      const loadedEquipped = Array.isArray(loaded.equippedCards) ? loaded.equippedCards : [];
      save.equippedCards = [];
      for (let i = 0; i < save.unlockedSlots; i++) {
        save.equippedCards.push(loadedEquipped[i] || null);
      }
      // Clean equipped slots pointing to cards that no longer exist
      for (let i = 0; i < save.equippedCards.length; i++) {
        if (save.equippedCards[i] && !save.cardInventory[save.equippedCards[i]]) {
          save.equippedCards[i] = null;
        }
      }
      // Tournament migration — preserve if present, otherwise null (lazy init on first view)
      save.tournament = loaded.tournament || null;
      save.playerId = loaded.playerId || 'You';
      // Skin migration (v0.7.14+)
      save.equippedCoreSkin = loaded.equippedCoreSkin || null;
      save.equippedBgSkin = loaded.equippedBgSkin || null;
    } else {
      save = JSON.parse(JSON.stringify(defaultSave));
    }
  } catch (e) {
    console.error('Save load failed', e);
    save = JSON.parse(JSON.stringify(defaultSave));
  }
}

function persistSave() {
  save.lastSaveTime = Date.now();
  save.version = 6;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}

function resetSave() {
  if (!confirm('Wipe ALL progress? This cannot be undone.')) return;
  // Stop any timers that might re-persist before reload
  stopPassiveAccrual();
  if (game.tickHandle) cancelAnimationFrame(game.tickHandle);
  if (window._autoSaveInterval) clearInterval(window._autoSaveInterval);
  // Blank the save object so any in-flight persistSave writes defaults
  save = JSON.parse(JSON.stringify(defaultSave));
  // Now remove from storage
  localStorage.removeItem(SAVE_KEY);
  for (const k of DEAD_SAVE_KEYS) localStorage.removeItem(k);
  // Reload after a tick so no racing writes
  setTimeout(() => location.reload(), 50);
}

