// ============================================================
// data.js — static tables: CARD_POOL, CARD_PRICING, PULL_ODDS, COPIES_TO_LEVEL, SLOT_UNLOCK_COSTS, TAGLINES, defaultSave shape, slot/copies helper functions.
// Owned by: balance/economy AI. Safe to edit without touching gameplay code.
// ============================================================

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const SAVE_KEY = 'tower_save_v7';
// Old save keys listed so we can DELETE them on load (not migrate)
const DEAD_SAVE_KEYS = ['tower_save_v6', 'tower_save_v5', 'tower_save_v4', 'tower_save_v3', 'tower_save_v2'];
const MAX_TIER = 18;
const MILESTONE_WAVES = [25, 50, 100, 200, 500, 1000, 2500, 5000, 10000];

// ============================================================
// CARD POOL (v0.7.6 placeholders — real 25-card pool in v0.8)
// ============================================================
// Each card:
//   id: unique key
//   name: display name
//   tier: 'standard' | 'prime' | 'apex'
//   icon: emoji glyph
//   desc: short text of what it does
//   stat: bucket key — 'damage' | 'health' | 'cash' | 'crit'
//   values: array of 5 fractional bonuses for levels 1-5 (e.g. [0.08, 0.16, ...] = +8%, +16%, ...)
// For crit specifically, values are additive percentage points applied as fractions.
// Card entry shape:
//   id, name, tier ('standard'|'prime'|'apex'), icon, desc
//   EITHER: stat: string, values: [5 nums]  (single-bucket card)
//   OR:     buckets: { statKey: [5 nums], otherKey: [...] }  (multi-bucket)
//   OR:     special: 'stormThread' | 'bulwarkVeil' | 'predatorLoop' | 'timeLock' | 'lastStand'
//           for apex cards with custom mechanics. They still carry a
//           values[5] field for the primary tuning knob.
const CARD_POOL = {
  // ========== STANDARD (12) ==========
  heavyCaliber: {
    id: 'heavyCaliber', name: 'Heavy Caliber', tier: 'standard', icon: '💥',
    desc: 'Damage bucket bonus', stat: 'damage',
    values: [0.08, 0.16, 0.24, 0.32, 0.40]
  },
  overclock: {
    id: 'overclock', name: 'Overclock', tier: 'standard', icon: '⏫',
    desc: 'Attack speed bucket bonus', stat: 'attackSpeed',
    values: [0.06, 0.12, 0.18, 0.24, 0.30]
  },
  fortressPlating: {
    id: 'fortressPlating', name: 'Fortress Plating', tier: 'standard', icon: '🛡️',
    desc: 'Max HP bucket bonus', stat: 'health',
    values: [0.10, 0.20, 0.30, 0.40, 0.50]
  },
  sightline: {
    id: 'sightline', name: 'Sightline', tier: 'standard', icon: '◎',
    desc: 'Range bucket bonus', stat: 'range',
    values: [0.10, 0.20, 0.30, 0.40, 0.50]
  },
  hardShell: {
    id: 'hardShell', name: 'Hard Shell', tier: 'standard', icon: '🔰',
    desc: 'Defense bucket bonus (percentage points)', stat: 'defense',
    values: [0.01, 0.02, 0.03, 0.04, 0.05]
  },
  bloodTap: {
    id: 'bloodTap', name: 'Blood Tap', tier: 'standard', icon: '🩸',
    desc: 'Lifesteal bucket bonus', stat: 'lifesteal',
    values: [0.05, 0.10, 0.15, 0.20, 0.25]
  },
  rapidRepair: {
    id: 'rapidRepair', name: 'Rapid Repair', tier: 'standard', icon: '✚',
    desc: 'Regen bucket bonus (% max HP/sec)', stat: 'regen',
    values: [0.002, 0.004, 0.006, 0.008, 0.010]
  },
  sharpEye: {
    id: 'sharpEye', name: 'Sharp Eye', tier: 'standard', icon: '🎯',
    desc: 'Crit chance bucket bonus', stat: 'crit',
    values: [0.02, 0.04, 0.06, 0.08, 0.10]
  },
  finisherCore: {
    id: 'finisherCore', name: 'Finisher Core', tier: 'standard', icon: '✸',
    desc: 'Crit power bucket bonus', stat: 'critPower',
    values: [0.10, 0.20, 0.30, 0.40, 0.50]
  },
  cashValve: {
    id: 'cashValve', name: 'Cash Valve', tier: 'standard', icon: '💰',
    desc: 'Cash per kill bucket bonus', stat: 'cash',
    values: [0.10, 0.20, 0.30, 0.40, 0.50]
  },
  vaultSeal: {
    id: 'vaultSeal', name: 'Vault Seal', tier: 'standard', icon: '🏦',
    desc: 'End-run coin bucket bonus', stat: 'coinGain',
    values: [0.08, 0.16, 0.24, 0.32, 0.40]
  },
  chargeFeed: {
    id: 'chargeFeed', name: 'Charge Feed', tier: 'standard', icon: '≋',
    desc: 'Wave bonus cash bucket bonus', stat: 'waveBonus',
    values: [0.10, 0.20, 0.30, 0.40, 0.50]
  },

  // ========== PRIME (8) ==========
  splitChamber: {
    id: 'splitChamber', name: 'Split Chamber', tier: 'prime', icon: '⌘',
    desc: 'Multishot chance bucket bonus', stat: 'multiChance',
    values: [0.05, 0.10, 0.15, 0.20, 0.25]
  },
  twinPayload: {
    id: 'twinPayload', name: 'Twin Payload', tier: 'prime', icon: '✚✚',
    desc: 'Multishot power bucket bonus', stat: 'multiPower',
    values: [0.12, 0.24, 0.36, 0.48, 0.60]
  },
  crossfireBus: {
    id: 'crossfireBus', name: 'Crossfire Bus', tier: 'prime', icon: '⫶',
    desc: 'Multishot extra targets', stat: 'multiTargetsAdd',
    values: [0, 0, 1, 1, 2]
  },
  ricochetSeed: {
    id: 'ricochetSeed', name: 'Ricochet Seed', tier: 'prime', icon: '⤢',
    desc: 'Bounce chance bucket bonus', stat: 'bounceChance',
    values: [0.05, 0.10, 0.15, 0.20, 0.25]
  },
  reboundCore: {
    id: 'reboundCore', name: 'Rebound Core', tier: 'prime', icon: '⤨',
    desc: 'Bounce power bucket bonus', stat: 'bouncePower',
    values: [0.12, 0.24, 0.36, 0.48, 0.60]
  },
  mirrorPath: {
    id: 'mirrorPath', name: 'Mirror Path', tier: 'prime', icon: '⋰⋱',
    desc: 'Bounce extra targets', stat: 'bounceTargetsAdd',
    values: [0, 0, 1, 1, 2]
  },
  bossBreaker: {
    id: 'bossBreaker', name: 'Boss Breaker', tier: 'prime', icon: '♛',
    desc: 'Boss damage AND bounty',
    buckets: {
      bossDmg:    [0.15, 0.30, 0.45, 0.60, 0.75],
      bossBounty: [0.10, 0.20, 0.30, 0.40, 0.50]
    }
  },
  comboBank: {
    id: 'comboBank', name: 'Combo Bank', tier: 'prime', icon: '⚡',
    desc: 'Combo max + decay delay',
    buckets: {
      comboMax:   [0.10, 0.20, 0.30, 0.40, 0.50],
      comboDecay: [500,  1000, 1500, 2000, 2500]  // ms added to decay window
    }
  },

  // ========== APEX (5) ==========
  stormThread: {
    id: 'stormThread', name: 'Storm Thread', tier: 'apex', icon: '⚡',
    desc: 'Every Nth shot arcs to 2 nearby enemies',
    special: 'stormThread',
    // levels 1-5: [interval, arcDamagePct]
    values: [
      { interval: 12, dmg: 0.40 },
      { interval: 11, dmg: 0.50 },
      { interval: 10, dmg: 0.60 },
      { interval: 9,  dmg: 0.70 },
      { interval: 8,  dmg: 0.80 }
    ]
  },
  bulwarkVeil: {
    id: 'bulwarkVeil', name: 'Bulwark Veil', tier: 'apex', icon: '⛨',
    desc: 'Overheal becomes temporary shield (caps % max HP)',
    special: 'bulwarkVeil',
    values: [0.10, 0.15, 0.20, 0.25, 0.30]
  },
  predatorLoop: {
    id: 'predatorLoop', name: 'Predator Loop', tier: 'apex', icon: '👁',
    desc: 'Each boss kill grants run bonus to damage + attack speed',
    special: 'predatorLoop',
    values: [
      { dmg: 0.04, aps: 0.02 },
      { dmg: 0.05, aps: 0.03 },
      { dmg: 0.06, aps: 0.04 },
      { dmg: 0.07, aps: 0.05 },
      { dmg: 0.08, aps: 0.06 }
    ]
  },
  timeLock: {
    id: 'timeLock', name: 'Time Lock', tier: 'apex', icon: '❄',
    desc: 'Every X sec, slows all enemies for 2 sec',
    special: 'timeLock',
    // levels 1-5: [intervalMs, slowFrac]
    values: [
      { interval: 20000, slow: 0.30 },
      { interval: 18000, slow: 0.35 },
      { interval: 16000, slow: 0.40 },
      { interval: 14000, slow: 0.45 },
      { interval: 12000, slow: 0.50 }
    ]
  },
  lastStand: {
    id: 'lastStand', name: 'Last Stand', tier: 'apex', icon: '☠',
    desc: 'Once per run, fatal damage is blocked and grants shield',
    special: 'lastStand',
    values: [0.20, 0.35, 0.50, 0.70, 1.00]
  }
};

const CARD_TIER_COLORS = {
  standard: { bg: 'rgba(110,130,160,0.18)', border: 'var(--accent-dim)', name: 'STANDARD', nameColor: 'var(--accent)' },
  prime:    { bg: 'rgba(170,68,255,0.18)',  border: 'var(--purple)',     name: 'PRIME',    nameColor: 'var(--purple)' },
  apex:     { bg: 'rgba(255,204,0,0.20)',   border: 'var(--gold)',       name: 'APEX',     nameColor: 'var(--gold)' }
};

// Card economy: pack prices and pull odds
const CARD_PRICING = {
  pullSingle: 20,    // gems per random pull
  pullBundle: 180,   // 10-pull bundle (saves 20 gems)
  unlockStandard: 60,
  unlockPrime: 180,
  // Apex direct unlocks are NOT sold — shard/pity only (v0.8+)
};

// Pull odds. Apex is rare.
const PULL_ODDS = {
  standard: 0.78,
  prime:    0.20,
  apex:     0.02
};

// Copies needed per card per level (cumulative total includes unlock)
// Standard:  unlock=1, +1,+2,+3,+5 → max=12 copies
// Prime:     unlock=1, +1,+2,+4,+6 → max=14 copies
// Apex:      unlock=1, +1,+2,+4,+8 → max=16 copies
const COPIES_TO_LEVEL = {
  standard: [1, 2, 4, 7, 12],   // copies needed to REACH L1..L5
  prime:    [1, 2, 4, 8, 14],
  apex:     [1, 2, 4, 8, 16]
};

// Slot ladder: starts with 3 free, max 10 at launch (12 future)
const SLOT_UNLOCK_COSTS = {
  4: 100, 5: 200, 6: 350, 7: 550, 8: 800, 9: 1100, 10: 1500
  // 11: 2000, 12: 2600  // future extension
};
const MAX_SLOTS = 10;
const STARTING_SLOTS = 3;

function getUnlockedSlots() {
  return save.unlockedSlots || STARTING_SLOTS;
}

// Next slot unlock cost (in gems), or null if maxed
function getNextSlotCost() {
  const cur = getUnlockedSlots();
  if (cur >= MAX_SLOTS) return null;
  return SLOT_UNLOCK_COSTS[cur + 1];
}

// Spend gems to unlock next slot. Returns true on success.
function unlockNextSlot() {
  const cost = getNextSlotCost();
  if (cost === null) return false;
  if (save.gems < cost) return false;
  save.gems -= cost;
  save.unlockedSlots = getUnlockedSlots() + 1;
  // Extend equippedCards array if needed (keep nulls)
  while (save.equippedCards.length < save.unlockedSlots) {
    save.equippedCards.push(null);
  }
  persistSave();
  return true;
}

// Get copies owned for a given card (for leveling from duplicates).
function getCardCopies(cardId) {
  const inv = save.cardInventory[cardId];
  return inv ? (inv.copies || 1) : 0;
}

// Grant a card: adds a copy, auto-levels if thresholds met.
function grantCard(cardId) {
  const card = CARD_POOL[cardId];
  if (!card) return null;
  if (!save.cardInventory[cardId]) {
    save.cardInventory[cardId] = { level: 1, copies: 1 };
    return { cardId, newlyUnlocked: true, level: 1 };
  }
  const inv = save.cardInventory[cardId];
  inv.copies = (inv.copies || 1) + 1;
  // Check if we can level up
  const thresholds = COPIES_TO_LEVEL[card.tier];
  let leveledUp = false;
  while (inv.level < 5 && inv.copies >= thresholds[inv.level]) {
    inv.level++;
    leveledUp = true;
  }
  return { cardId, newlyUnlocked: false, level: inv.level, leveledUp };
}

// Roll a random card from the pool based on PULL_ODDS.
function rollRandomCard() {
  const r = Math.random();
  let tier;
  if (r < PULL_ODDS.apex) tier = 'apex';
  else if (r < PULL_ODDS.apex + PULL_ODDS.prime) tier = 'prime';
  else tier = 'standard';
  const pool = Object.values(CARD_POOL).filter(c => c.tier === tier);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Perform a single 20-gem pull. Returns result object or null on failure.
function performPull() {
  if (save.gems < CARD_PRICING.pullSingle) return null;
  save.gems -= CARD_PRICING.pullSingle;
  const card = rollRandomCard();
  const result = grantCard(card.id);
  persistSave();
  return { card, ...result };
}

// Perform a 10-pull bundle for 180 gems.
function performBundle() {
  if (save.gems < CARD_PRICING.pullBundle) return null;
  save.gems -= CARD_PRICING.pullBundle;
  const results = [];
  for (let i = 0; i < 10; i++) {
    const card = rollRandomCard();
    const r = grantCard(card.id);
    results.push({ card, ...r });
  }
  persistSave();
  return results;
}

// Direct unlock a specific Standard or Prime card by id.
function performDirectUnlock(cardId) {
  const card = CARD_POOL[cardId];
  if (!card) return null;
  if (card.tier === 'apex') return null; // not purchasable directly
  const cost = card.tier === 'standard' ? CARD_PRICING.unlockStandard : CARD_PRICING.unlockPrime;
  if (save.gems < cost) return null;
  // Only allowed if not already owned
  if (save.cardInventory[cardId]) return null;
  save.gems -= cost;
  const result = grantCard(cardId);
  persistSave();
  return { card, cost, ...result };
}

// Card bucket accumulator. Returns fraction to ADD to (1 + runBonus) * labMul calculation.
// Example: if you have 2 damage cards at +40% and +20%, cardBucket returns 0.60.
// Supports both single-stat ('stat' + 'values') and multi-stat ('buckets') cards.
// Apex specials are handled by other helpers (getStormThread, getTimeLock, etc).
function getCardBucket(statKey) {
  if (!save.equippedCards) return 0;
  let bucket = 0;
  for (const cardId of save.equippedCards) {
    if (!cardId) continue;
    const card = CARD_POOL[cardId];
    if (!card) continue;
    const inv = save.cardInventory[cardId];
    if (!inv) continue;
    const lvl = Math.max(1, Math.min(5, inv.level || 1));
    if (card.stat && card.stat === statKey) {
      const v = card.values[lvl - 1];
      // value can be a number (standard card) — ignore object entries here
      if (typeof v === 'number') bucket += v;
    } else if (card.buckets && card.buckets[statKey]) {
      bucket += card.buckets[statKey][lvl - 1] || 0;
    }
  }
  return bucket;
}

// Return the special card's level (1-5) if equipped, else 0
function getEquippedSpecialLevel(specialKey) {
  if (!save.equippedCards) return 0;
  for (const cardId of save.equippedCards) {
    if (!cardId) continue;
    const card = CARD_POOL[cardId];
    if (!card || card.special !== specialKey) continue;
    const inv = save.cardInventory[cardId];
    if (!inv) continue;
    return Math.max(1, Math.min(5, inv.level || 1));
  }
  return 0;
}

// Apex helper getters — return the current-level data object or null.
function getStormThreadData() {
  const lvl = getEquippedSpecialLevel('stormThread');
  return lvl ? CARD_POOL.stormThread.values[lvl - 1] : null;
}
function getBulwarkShieldCap() {
  const lvl = getEquippedSpecialLevel('bulwarkVeil');
  return lvl ? CARD_POOL.bulwarkVeil.values[lvl - 1] : 0;
}
function getPredatorLoopPerBoss() {
  const lvl = getEquippedSpecialLevel('predatorLoop');
  return lvl ? CARD_POOL.predatorLoop.values[lvl - 1] : null;
}
function getTimeLockData() {
  const lvl = getEquippedSpecialLevel('timeLock');
  return lvl ? CARD_POOL.timeLock.values[lvl - 1] : null;
}
function getLastStandShieldFrac() {
  const lvl = getEquippedSpecialLevel('lastStand');
  return lvl ? CARD_POOL.lastStand.values[lvl - 1] : 0;
}
const TAGLINES = [
  'one more wave',
  'the core holds',
  'progression, not punishment',
  'no popups. ever.',
  'your core, your pace',
  'every shot counts',
  'defend the core'
];


// ============================================================
// TOURNAMENT DATA — constants, bands, leagues, reward tables
// ============================================================

// Progression bands by highest tier unlocked (save.bestTier)
const TOURNEY_BANDS = [
  { id: 1, name: 'Band 1', minTier: 1,  maxTier: 2 },
  { id: 2, name: 'Band 2', minTier: 3,  maxTier: 5 },
  { id: 3, name: 'Band 3', minTier: 6,  maxTier: 8 },
  { id: 4, name: 'Band 4', minTier: 9,  maxTier: 11 },
  { id: 5, name: 'Band 5', minTier: 12, maxTier: 14 },
  { id: 6, name: 'Band 6', minTier: 15, maxTier: 17 },
  { id: 7, name: 'Band 7', minTier: 18, maxTier: 999 }
];

const TOURNEY_LEAGUES = ['copper', 'bronze', 'silver', 'gold', 'platinum'];
const TOURNEY_LEAGUE_DISPLAY = {
  copper:   { name: 'Copper',   color: '#b87333' },
  bronze:   { name: 'Bronze',   color: '#cd7f32' },
  silver:   { name: 'Silver',   color: '#c0c0c0' },
  gold:     { name: 'Gold',     color: '#ffcc00' },
  platinum: { name: 'Platinum', color: '#e5e4e2' }
};

// Base reward table [band_id][league] = { coins, gems }
// Copied from the spec's "Standard Tournament base rewards" tables.
const TOURNEY_REWARDS_BASE = {
  1: { copper: { coins: 150,  gems: 5  }, bronze: { coins: 180,  gems: 6  }, silver: { coins: 220,  gems: 7  }, gold: { coins: 270,  gems: 8  }, platinum: { coins: 330,  gems: 10 } },
  2: { copper: { coins: 300,  gems: 8  }, bronze: { coins: 360,  gems: 9  }, silver: { coins: 430,  gems: 11 }, gold: { coins: 520,  gems: 13 }, platinum: { coins: 630,  gems: 16 } },
  3: { copper: { coins: 600,  gems: 12 }, bronze: { coins: 720,  gems: 14 }, silver: { coins: 860,  gems: 17 }, gold: { coins: 1040, gems: 20 }, platinum: { coins: 1260, gems: 24 } },
  4: { copper: { coins: 1100, gems: 18 }, bronze: { coins: 1320, gems: 21 }, silver: { coins: 1580, gems: 25 }, gold: { coins: 1900, gems: 30 }, platinum: { coins: 2280, gems: 36 } },
  5: { copper: { coins: 1800, gems: 24 }, bronze: { coins: 2160, gems: 28 }, silver: { coins: 2580, gems: 33 }, gold: { coins: 3100, gems: 39 }, platinum: { coins: 3720, gems: 46 } },
  6: { copper: { coins: 2800, gems: 32 }, bronze: { coins: 3360, gems: 37 }, silver: { coins: 4020, gems: 43 }, gold: { coins: 4820, gems: 50 }, platinum: { coins: 5780, gems: 58 } },
  7: { copper: { coins: 4200, gems: 40 }, bronze: { coins: 5040, gems: 46 }, silver: { coins: 6040, gems: 53 }, gold: { coins: 7240, gems: 61 }, platinum: { coins: 8680, gems: 70 } }
};

// Placement multipliers — based on final rank in 250-player bracket
const TOURNEY_PLACEMENT_MULTS = [
  { minRank: 1,   maxRank: 1,   mul: 3.0 },
  { minRank: 2,   maxRank: 3,   mul: 2.3 },
  { minRank: 4,   maxRank: 10,  mul: 1.8 },
  { minRank: 11,  maxRank: 25,  mul: 1.4 },
  { minRank: 26,  maxRank: 50,  mul: 1.15 },
  { minRank: 51,  maxRank: 100, mul: 1.0 },
  { minRank: 101, maxRank: 150, mul: 0.8 },
  { minRank: 151, maxRank: 212, mul: 0.65 },
  { minRank: 213, maxRank: 250, mul: 0.5 }
];

const TOURNEY_BRACKET_SIZE = 250;
const TOURNEY_CYCLE_MS = 72 * 60 * 60 * 1000;  // 72 hours
const TOURNEY_PROMOTE_PCT = 0.10;  // top 10% promote
const TOURNEY_DEMOTE_PCT  = 0.15;  // bottom 15% demote
const TOURNEY_STANDARD_ENTRIES = 3; // 1 free + 2 extra

// Name pool for synthetic competitors. Mix of short sci-fi handles.
const TOURNEY_SYNTHETIC_NAMES = [
  'Raze', 'Hexon', 'Vanta', 'ArcLight', 'Nox', 'Silo', 'DeltaRay', 'GrimVale',
  'IonRush', 'Kryo', 'Pulse', 'Vex', 'Obsidian', 'Hazard', 'Cinder', 'Glacier',
  'Volt', 'Ember', 'Shard', 'Relay', 'Echo', 'Drift', 'Flux', 'Solar',
  'Vector', 'Orbit', 'Spire', 'Fathom', 'Zenith', 'Nexus', 'Void', 'Crux',
  'Axiom', 'Prism', 'Cipher', 'Quill', 'Boreal', 'Tundra', 'Mirage', 'Lumen',
  'Wraith', 'Helix', 'Onyx', 'Crimson', 'Verge', 'Omen', 'Rift', 'Halcyon',
  'Talon', 'Tempest', 'Kestrel', 'Shrike', 'Basilisk', 'Hydra', 'Phoenix',
  'Sable', 'Quartz', 'Coda', 'Meridian', 'Cascade', 'Paragon', 'Ronin',
  'Blight', 'Scion', 'Sentinel', 'Thorn', 'Wick', 'Halo', 'Ridge', 'Fable'
];

// Helpers — pure functions, no side effects

function tourneyBandForTier(bestTier) {
  const t = Math.max(1, bestTier || 1);
  for (const b of TOURNEY_BANDS) {
    if (t >= b.minTier && t <= b.maxTier) return b;
  }
  return TOURNEY_BANDS[TOURNEY_BANDS.length - 1];
}

function tourneyPlacementMul(rank) {
  for (const p of TOURNEY_PLACEMENT_MULTS) {
    if (rank >= p.minRank && rank <= p.maxRank) return p.mul;
  }
  return 0.5;
}

function tourneyRewardForPlacement(bandId, league, rank) {
  const base = (TOURNEY_REWARDS_BASE[bandId] || TOURNEY_REWARDS_BASE[1])[league]
               || { coins: 0, gems: 0 };
  const mul = tourneyPlacementMul(rank);
  return {
    coins: Math.round(base.coins * mul),
    gems:  Math.round(base.gems  * mul)
  };
}

// Expected wave score band per progression band × league.
// Used to generate synthetic competitor scores.
// [minWave, maxWave] — avg player ceiling for that band/league
function tourneyExpectedWaveRange(bandId, league) {
  // Base scales with band, league tilts toward top of band range
  const bandBaseWave = { 1: 18, 2: 45, 3: 85, 4: 150, 5: 250, 6: 400, 7: 650 };
  const leagueMul = { copper: 0.55, bronze: 0.75, silver: 1.00, gold: 1.30, platinum: 1.70 };
  const base = bandBaseWave[bandId] || 18;
  const mul = leagueMul[league] || 1;
  const center = base * mul;
  return [Math.floor(center * 0.65), Math.floor(center * 1.35)];
}
