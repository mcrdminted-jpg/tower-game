// ============================================================
// game.js — game state, stat getters (damage/HP/crit/etc), wave scaling, enemy types, battle start/end, combat loop, damage/heal pipelines, apex specials.
// Owned by: gameplay AI. This is the combat core. Do not edit tab UI here.
// ============================================================

// ============================================================
// LAB MATH (v0.7.15: labs deprecated, replaced by ranks)
// ============================================================
// labCost retained for any legacy callers.
function labCost(lab) { return Math.floor(lab.cost0 * Math.pow(lab.costMul, lab.level)); }
// labValue/labNextValue are now no-ops. Any straggler `labValue(save.labs.X)`
// calls will return 0, which is the identity for additive bonuses.
function labValue(lab) { return 0; }
function labNextValue(lab) { return 0; }

// Offline/utility values — hard-coded baselines until a utility ranks pass.
function offlineCapMinutes() { return 10; }     // 10 min offline cap
function offlineRateFraction() { return 0.05; } // 5% of active rate offline
function defenseFraction() { return 0; }        // armor now comes from ranks
function maxUnlockedSpeed() { return 3; }       // all 3 speeds unlocked at launch

// ============================================================
// TIER + MILESTONE
// ============================================================
function highestUnlockedTier() {
  let unlocked = 1;
  for (let t = 1; t < MAX_TIER; t++) {
    const reached = save.bestWavePerTier[t] || 0;
    if (reached >= 100) unlocked = t + 1;
    else break;
  }
  return unlocked;
}
function tierMultiplier_deprecated(tier) { return Math.pow(1.5, tier - 1); }

function milestoneReward(tier, wave) {
  const baseCoins = Math.floor(wave * 0.8 * Math.pow(1.7, tier - 1));
  const gems = wave >= 100 ? Math.max(1, Math.floor((wave / 50) * Math.pow(1.3, tier - 1))) : 0;
  return { coins: baseCoins, gems };
}
function milestoneKey(tier, wave) { return `T${tier}W${wave}`; }
function milestoneReady(tier, wave) {
  return (save.bestWavePerTier[tier] || 0) >= wave;
}
function claimMilestone(tier, wave) {
  const key = milestoneKey(tier, wave);
  if (save.claimedMilestones[key]) return;
  if (!milestoneReady(tier, wave)) return;
  const r = milestoneReward(tier, wave);
  save.coins += r.coins;
  save.gems += r.gems;
  save.claimedMilestones[key] = true;
  persistSave();
  renderHud();
  renderSubmenu();
}

// ============================================================
// RUN STATE
// ============================================================
const game = {
  running: false,
  startTime: 0,
  tier: 1,
  wave: 1,
  enemiesKilledInWave: 0,
  enemiesPerWave: 10,
  bossWave: false,
  cash: 0,
  hp: 100,
  hpMax: 100,
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  lastShotTime: 0,
  focusTarget: null,
  focusShotsRemaining: 0,
  lastFocusTime: 0,
  upgrades: {
    // OFFENSE - big stats (5000 levels, piecewise)
    damage:           { name: 'Damage',           group: 'offense', level: 0, cost0: 5,    costMul: 1.07, max: 5000 },
    attackSpeed:      { name: 'Fire Rate',        group: 'offense', level: 0, cost0: 8,    costMul: 1.08, max: 5000 },
    // OFFENSE - chance/power stats (100 cap, 1% per level)
    critChance:       { name: 'Crit Chance',      group: 'offense', level: 0, cost0: 20,   costMul: 1.14, max: 100 },
    critPower:        { name: 'Crit Power',       group: 'offense', level: 0, cost0: 40,   costMul: 1.15, max: 100 },
    multishotChance:  { name: 'Multishot Chance', group: 'offense', level: 0, cost0: 30,   costMul: 1.14, max: 100 },
    multishotPower:   { name: 'Multishot Power',  group: 'offense', level: 0, cost0: 40,   costMul: 1.15, max: 100 },
    multishotTargets: { name: 'Multi Targets',    group: 'offense', level: 0, cost0: 500,  costMul: 3.5,  max: 5 },
    bounceChance:     { name: 'Bounce Chance',    group: 'offense', level: 0, cost0: 25,   costMul: 1.14, max: 100 },
    bouncePower:      { name: 'Bounce Power',     group: 'offense', level: 0, cost0: 35,   costMul: 1.15, max: 100 },
    bounceTargets:    { name: 'Bounce Targets',   group: 'offense', level: 0, cost0: 800,  costMul: 3.5,  max: 5 },
    // DEFENSE
    health:           { name: 'Core Integrity',   group: 'defense', level: 0, cost0: 10,   costMul: 1.09, max: 5000 },
    defense:          { name: 'Armor',             group: 'defense', level: 0, cost0: 18,   costMul: 1.12, max: 180 },
    range:            { name: 'Range',            group: 'defense', level: 0, cost0: 14,   costMul: 1.11, max: 100 },
    lifesteal:        { name: 'Lifesteal',        group: 'defense', level: 0, cost0: 100,  costMul: 1.15, max: 400 },
    regen:            { name: 'Regen',            group: 'defense', level: 0, cost0: 60,   costMul: 1.14, max: 200 },
    // ECONOMY
    cashBonus:        { name: 'Cash Bonus',       group: 'economy', level: 0, cost0: 15,   costMul: 1.12 },
    waveBonus:        { name: 'Wave Bonus',       group: 'economy', level: 0, cost0: 25,   costMul: 1.13 },
    combo:            { name: 'Combo',            group: 'economy', level: 0, cost0: 40,   costMul: 1.15, max: 20 },
    bossBounty:       { name: 'Boss Bounty',      group: 'economy', level: 0, cost0: 60,   costMul: 1.16 },
    coinBonus:        { name: 'Coin Bonus',       group: 'economy', level: 0, cost0: 500,  costMul: 1.22, max: 50 },
    // ACTION
    heal:             { name: 'Heal',             group: 'action',  level: 0, cost0: 0,    costMul: 1, isAction: true }
  },
  bf: null, bfRect: null, towerEl: null, rangeRingEl: null,
  towerX: 0, towerY: 0,
  tickHandle: null, lastTick: 0,
  enemiesKilledThisRun: 0,
  cashEarnedThisRun: 0,
  damageBlockedThisRun: 0,
  bossesDefeated: 0,
  lastEnemySpawn: 0,
  regenAccum: 0,
  healsUsed: 0,
  bossSpawned: false,
  comboCount: 0,
  comboLastKillTime: 0,
  // Apex card state — reset each run
  shotCount: 0,               // for Storm Thread arc cadence
  shield: 0, shieldMax: 0,    // for Bulwark Veil
  timeLockLastTrigger: 0,     // timestamp ms of last Time Lock proc
  enemySlowUntil: 0,          // global slow expiry (ms timestamp)
  enemySlowFrac: 0,           // current slow fraction while active
  lastStandUsed: false        // Last Stand fires once per run
};

// ============================================================
// GETTERS — v0.7.0 COMBAT SYSTEM
// ============================================================

// Piecewise long-stat curve. Returns a bonus FRACTION (e.g. 0.50 = +50%)
//   L1-100   = +1%   per level  (max +100%)
//   L101-500 = +0.25% per level (max +200%)
//   L501+    = +0.05% per level (max +425% at 5000)
function longStatBonus(level) {
  if (level <= 0) return 0;
  if (level <= 100) return level * 0.01;
  if (level <= 500) return 1.00 + (level - 100) * 0.0025;
  return 2.00 + (level - 500) * 0.0005;
}
function longStatBonusNext(level) { return longStatBonus(level + 1); }

// === Damage ===
function getDamage() {
  const u = game.upgrades.damage;
  const permBase = rankPermanentValue('damage'); // 5 + rank * 1
  const run = 1 + longStatBonus(u.level);
  const cardBucket = getCardBucket('damage');
  const predator = getPredatorLoopPerBoss();
  const predBonus = predator ? predator.dmg * (game.bossesDefeated || 0) : 0;
  return permBase * run * (1 + cardBucket) * (1 + predBonus);
}
function getDamageNext() {
  const u = game.upgrades.damage;
  const permBase = rankPermanentValue('damage');
  const run = 1 + longStatBonus(u.level + 1);
  const cardBucket = getCardBucket('damage');
  const predator = getPredatorLoopPerBoss();
  const predBonus = predator ? predator.dmg * (game.bossesDefeated || 0) : 0;
  return permBase * run * (1 + cardBucket) * (1 + predBonus);
}

// === Fire Rate === (65% of curve per audit — multiplies DPS)
function getAttackSpeed() {
  const u = game.upgrades.attackSpeed;
  const permBase = rankPermanentValue('fireRate'); // 1.0 + rank * 0.02
  const cardBucket = getCardBucket('attackSpeed');
  const predator = getPredatorLoopPerBoss();
  const predBonus = predator ? predator.aps * (game.bossesDefeated || 0) : 0;
  return permBase * (1 + longStatBonus(u.level) * 0.65) * (1 + cardBucket) * (1 + predBonus);
}
function getAttackSpeedNext() {
  const u = game.upgrades.attackSpeed;
  const permBase = rankPermanentValue('fireRate');
  const cardBucket = getCardBucket('attackSpeed');
  const predator = getPredatorLoopPerBoss();
  const predBonus = predator ? predator.aps * (game.bossesDefeated || 0) : 0;
  return permBase * (1 + longStatBonus(u.level + 1) * 0.65) * (1 + cardBucket) * (1 + predBonus);
}
function getAttackInterval() { return 1000 / getAttackSpeed(); }

// === Core Integrity (max HP) ===
function getMaxHp() {
  const u = game.upgrades.health;
  const permBase = rankPermanentValue('coreHealth'); // 100 + rank * 10
  const run = 1 + longStatBonus(u.level);
  const cardBucket = getCardBucket('health');
  return Math.floor(permBase * run * (1 + cardBucket));
}
function getMaxHpNext() {
  const u = game.upgrades.health;
  const permBase = rankPermanentValue('coreHealth');
  const run = 1 + longStatBonus(u.level + 1);
  const cardBucket = getCardBucket('health');
  return Math.floor(permBase * run * (1 + cardBucket));
}

// === Armor === (0.5% per in-run level + flat from ranks, cap 75%)
function getDefenseFraction() {
  const u = game.upgrades.defense;
  const rankFlat = rankFlatBonus('armor'); // rank * 0.005
  return Math.min(0.75, u.level * 0.005 + rankFlat + getCardBucket('defense'));
}
function getDefenseFractionNext() {
  const u = game.upgrades.defense;
  const rankFlat = rankFlatBonus('armor');
  return Math.min(0.75, (u.level + 1) * 0.005 + rankFlat + getCardBucket('defense'));
}

// === Range === (words, not pixels)
// Max 100 levels. Band map:
//   0-19 = Short, 20-39 = Medium, 40-59 = Long, 60-79 = Very Long, 80+ = Edge
function getRangeLevel() { return game.upgrades.range.level + rankFlatBonus('range'); }
function getRange() {
  const effectiveLevel = game.upgrades.range.level + rankFlatBonus('range');
  const base = 120 + effectiveLevel * 6;
  return base * (1 + getCardBucket('range'));
}
function getRangeNext() {
  const effectiveLevel = game.upgrades.range.level + 1 + rankFlatBonus('range');
  const base = 120 + effectiveLevel * 6;
  return base * (1 + getCardBucket('range'));
}
function rangeLabel(lvl) {
  if (lvl < 20)  return 'Short';
  if (lvl < 40)  return 'Medium';
  if (lvl < 60)  return 'Long';
  if (lvl < 80)  return 'Very Long';
  return 'Edge of Screen';
}

// === Crit Chance === (1% per in-run level, rank adds flat)
function getCritChance() {
  const base = game.upgrades.critChance.level * 0.01;
  return Math.min(1.00, base + rankFlatBonus('critChance') + getCardBucket('crit'));
}
function getCritChanceNext() {
  const base = (game.upgrades.critChance.level + 1) * 0.01;
  return Math.min(1.00, base + rankFlatBonus('critChance') + getCardBucket('crit'));
}

// === Crit Power === (rank adds base from 2.0, in-run adds up to +1.0)
function getCritPower() {
  const permBase = rankPermanentValue('critPower'); // 2.0 + rank*0.02
  const lvl = game.upgrades.critPower.level * 0.01;
  return permBase + Math.min(1.00, lvl) + getCardBucket('critPower');
}
function getCritPowerNext() {
  const permBase = rankPermanentValue('critPower');
  const lvl = (game.upgrades.critPower.level + 1) * 0.01;
  return permBase + Math.min(1.00, lvl) + getCardBucket('critPower');
}

// === Multishot === (clean 3-stat model)
// Chance: % chance to fire ONE extra shot per target
// Power: damage multiplier on extra shots (1.0 = full damage, lower = weaker)
// Targets: max simultaneous targets hit per volley (1 = single, up to 6)
function getMultishotChance() {
  return Math.min(1.00, game.upgrades.multishotChance.level * 0.01 + rankFlatBonus('multiChance') + getCardBucket('multiChance'));
}
function getMultishotChanceNext() {
  return Math.min(1.00, (game.upgrades.multishotChance.level + 1) * 0.01 + rankFlatBonus('multiChance') + getCardBucket('multiChance'));
}
function getMultishotPower() {
  // Starts at 50%, +0.5% per in-run level, caps at 100% at level 100; rank adds flat
  return 0.50 + Math.min(0.50, game.upgrades.multishotPower.level * 0.005) + rankFlatBonus('multiPower') + getCardBucket('multiPower');
}
function getMultishotPowerNext() {
  return 0.50 + Math.min(0.50, (game.upgrades.multishotPower.level + 1) * 0.005) + rankFlatBonus('multiPower') + getCardBucket('multiPower');
}
function getMultishotTargets() {
  // Base 1 + in-run level + rank level + card
  return 1 + game.upgrades.multishotTargets.level + rankFlatBonus('multiTargets') + Math.round(getCardBucket('multiTargetsAdd'));
}
function getMultishotTargetsNext() {
  return 1 + (game.upgrades.multishotTargets.level + 1) + rankFlatBonus('multiTargets') + Math.round(getCardBucket('multiTargetsAdd'));
}

// Determines how many shots fire per volley
function rollMultishotCount() {
  const chance = getMultishotChance();
  if (chance <= 0) return 1;
  return Math.random() < chance ? 2 : 1;
}

// === Bounce === (same structure as multishot)
function getBounceChance() {
  return Math.min(1.00, game.upgrades.bounceChance.level * 0.01 + rankFlatBonus('bounceChance') + getCardBucket('bounceChance'));
}
function getBounceChanceNext() {
  return Math.min(1.00, (game.upgrades.bounceChance.level + 1) * 0.01 + rankFlatBonus('bounceChance') + getCardBucket('bounceChance'));
}
function getBouncePower() {
  return 0.50 + Math.min(0.50, game.upgrades.bouncePower.level * 0.005) + rankFlatBonus('bouncePower') + getCardBucket('bouncePower');
}
function getBouncePowerNext() {
  return 0.50 + Math.min(0.50, (game.upgrades.bouncePower.level + 1) * 0.005) + rankFlatBonus('bouncePower') + getCardBucket('bouncePower');
}
function getBounceTargets() {
  return game.upgrades.bounceTargets.level + rankFlatBonus('bounceTargets') + Math.round(getCardBucket('bounceTargetsAdd'));
}
function getBounceTargetsNext() {
  return game.upgrades.bounceTargets.level + 1 + rankFlatBonus('bounceTargets') + Math.round(getCardBucket('bounceTargetsAdd'));
}

// === Lifesteal === (0.25% per level, max 100% = level 400)
function getLifestealFraction() {
  return Math.min(1.00, game.upgrades.lifesteal.level * 0.0025 + rankFlatBonus('lifesteal') + getCardBucket('lifesteal'));
}
function getLifestealFractionNext() {
  return Math.min(1.00, (game.upgrades.lifesteal.level + 1) * 0.0025 + rankFlatBonus('lifesteal') + getCardBucket('lifesteal'));
}

// === Regen === (0.05% max HP/sec per in-run level, cap 10%, rank adds flat)
function getRegenPctPerSec() {
  return Math.min(0.10, game.upgrades.regen.level * 0.0005 + rankFlatBonus('regen') + getCardBucket('regen'));
}
function getRegenPctPerSecNext() {
  return Math.min(0.10, (game.upgrades.regen.level + 1) * 0.0005 + rankFlatBonus('regen') + getCardBucket('regen'));
}
function getRegenPerSec() {
  return game.hpMax * getRegenPctPerSec();
}

// === Economy ===
// Ranks give flat %: cashBonus adds rank*0.02 to the multiplier
function getCashMul() {
  const u = game.upgrades.cashBonus;
  const cardBucket = getCardBucket('cash');
  return (1 + u.level * 0.05 + rankFlatBonus('cashBonus')) * (1 + cardBucket);
}
function getCashMulNext() {
  const u = game.upgrades.cashBonus;
  const cardBucket = getCardBucket('cash');
  return (1 + (u.level + 1) * 0.05 + rankFlatBonus('cashBonus')) * (1 + cardBucket);
}
function getWaveBonusMul() {
  return (1 + game.upgrades.waveBonus.level * 0.15 + rankFlatBonus('waveBonus')) * (1 + getCardBucket('waveBonus'));
}
function getWaveBonusMulNext() {
  return (1 + (game.upgrades.waveBonus.level + 1) * 0.15 + rankFlatBonus('waveBonus')) * (1 + getCardBucket('waveBonus'));
}
function getComboMaxMul() {
  // Combo bonus has no rank in the spec yet — comboSystems unlock just reveals the in-run combo upgrade.
  return (1 + game.upgrades.combo.level * 0.075) * (1 + getCardBucket('comboMax'));
}
function getComboMaxMulNext() {
  return (1 + (game.upgrades.combo.level + 1) * 0.075) * (1 + getCardBucket('comboMax'));
}
function getCurrentComboMul() {
  if (game.upgrades.combo.level === 0) return 1;
  const max = getComboMaxMul();
  const progress = Math.min(1, game.comboCount / 20);
  return 1 + (max - 1) * progress;
}
// Combo decay: base 5000ms, card adds milliseconds of decay window
function getComboDecayMs() {
  return 5000 + getCardBucket('comboDecay');
}
function getBossBountyMul() {
  return (1 + game.upgrades.bossBounty.level * 0.25 + rankFlatBonus('bossBounty')) * (1 + getCardBucket('bossBounty'));
}
function getBossBountyMulNext() {
  return (1 + (game.upgrades.bossBounty.level + 1) * 0.25 + rankFlatBonus('bossBounty')) * (1 + getCardBucket('bossBounty'));
}
// Boss damage bonus from cards (applied to projectiles hitting bosses)
function getBossDamageBonus() {
  return getCardBucket('bossDmg');
}

// === Coin Bonus === (end-run coin multiplier, max 1.5× at L50)
// Levels 1-50 give linear +0.01 per level (1.00 at L0, 1.50 at L50).
function getCoinBonusMul() {
  return 1 + Math.min(0.5, game.upgrades.coinBonus.level * 0.01);
}
function getCoinBonusMulNext() {
  return 1 + Math.min(0.5, (game.upgrades.coinBonus.level + 1) * 0.01);
}

// === Heal ===
function getHealAmount() { return Math.floor(game.hpMax * 0.25); }
function getHealCost() {
  const heal = getHealAmount();
  return Math.floor(heal * 0.5 * (1 + game.wave / 100) * (1 + game.healsUsed * 0.4));
}

function upgradeCost(u) { return Math.floor(u.cost0 * Math.pow(u.costMul, u.level)); }

function upgradeDescriptor(key) {
  switch (key) {
    case 'damage':           return { cur: formatStat(getDamage()), next: formatStat(getDamageNext()), unit: '' };
    case 'attackSpeed':      return { cur: getAttackSpeed().toFixed(2), next: getAttackSpeedNext().toFixed(2), unit: '/s' };
    case 'health':           return { cur: formatStat(getMaxHp()), next: formatStat(getMaxHpNext()), unit: ' HP' };
    case 'defense':          return { cur: (getDefenseFraction() * 100).toFixed(1), next: (getDefenseFractionNext() * 100).toFixed(1), unit: '%' };
    case 'range': {
      return { cur: Math.round(getRange()), next: Math.round(getRangeNext()), unit: ' range' };
    }
    case 'critChance':       return { cur: (getCritChance() * 100).toFixed(0), next: (getCritChanceNext() * 100).toFixed(0), unit: '%' };
    case 'critPower':        return { cur: '×' + getCritPower().toFixed(2), next: '×' + getCritPowerNext().toFixed(2), unit: '' };
    case 'multishotChance':  return { cur: (getMultishotChance() * 100).toFixed(1), next: (getMultishotChanceNext() * 100).toFixed(1), unit: '%' };
    case 'multishotPower':   return { cur: (getMultishotPower() * 100).toFixed(1), next: (getMultishotPowerNext() * 100).toFixed(1), unit: '%' };
    case 'multishotTargets': return { cur: getMultishotTargets(), next: getMultishotTargetsNext(), unit: ' targets' };
    case 'bounceChance':     return { cur: (getBounceChance() * 100).toFixed(1), next: (getBounceChanceNext() * 100).toFixed(1), unit: '%' };
    case 'bouncePower':      return { cur: (getBouncePower() * 100).toFixed(1), next: (getBouncePowerNext() * 100).toFixed(1), unit: '%' };
    case 'bounceTargets':    return { cur: getBounceTargets(), next: getBounceTargetsNext(), unit: ' bounces' };
    case 'lifesteal':        return { cur: (getLifestealFraction() * 100).toFixed(1), next: (getLifestealFractionNext() * 100).toFixed(1), unit: '% dmg' };
    case 'regen':            return { cur: (getRegenPctPerSec() * 100).toFixed(2), next: (getRegenPctPerSecNext() * 100).toFixed(2), unit: '% HP/s' };
    case 'cashBonus':        return { cur: '×' + getCashMul().toFixed(2), next: '×' + getCashMulNext().toFixed(2), unit: '' };
    case 'waveBonus':        return { cur: '×' + getWaveBonusMul().toFixed(2), next: '×' + getWaveBonusMulNext().toFixed(2), unit: '' };
    case 'combo':            return { cur: '×' + getComboMaxMul().toFixed(2), next: '×' + getComboMaxMulNext().toFixed(2), unit: ' max' };
    case 'bossBounty':       return { cur: '×' + getBossBountyMul().toFixed(2), next: '×' + getBossBountyMulNext().toFixed(2), unit: '' };
    case 'coinBonus':        return { cur: '×' + getCoinBonusMul().toFixed(2), next: '×' + getCoinBonusMulNext().toFixed(2), unit: ' coins' };
  }
  return { cur: '', next: '', unit: '' };
}

// ============================================================
// WAVE SCALING — piecewise (was 1.18^wave across all bands)
// ============================================================
// Early game (W1-30): fast ramp, exciting first 30 waves
// Mid game (W31-120): moderate, rewarding progression
// Late game (W121+): flat growth, keeps runs possible without fake-difficulty wall
function hpWaveMul(w) {
  if (w <= 30) return Math.pow(1.055, w - 1);
  if (w <= 120) return Math.pow(1.055, 29) * Math.pow(1.028, w - 30);
  return Math.pow(1.055, 29) * Math.pow(1.028, 90) * Math.pow(1.009, w - 120);
}
function dmgWaveMul(w) {
  if (w <= 30) return Math.pow(1.038, w - 1);
  if (w <= 120) return Math.pow(1.038, 29) * Math.pow(1.020, w - 30);
  return Math.pow(1.038, 29) * Math.pow(1.020, 90) * Math.pow(1.007, w - 120);
}
function cashWaveMul(w) {
  if (w <= 30) return Math.pow(1.060, w - 1);
  if (w <= 120) return Math.pow(1.060, 29) * Math.pow(1.030, w - 30);
  return Math.pow(1.060, 29) * Math.pow(1.030, 90) * Math.pow(1.011, w - 120);
}
// Tier multipliers — SPLIT per stat (was uniform ×1.5)
function hpTierMul(t)   { return Math.pow(1.18, t - 1); }
function dmgTierMul(t)  { return Math.pow(1.11, t - 1); }
function cashTierMul(t) { return Math.pow(1.24, t - 1); }
// Legacy compatibility for UI code that still calls tierMultiplier()
function tierMultiplier(tier) { return hpTierMul(tier); }

function enemyHpForWave(wave) {
  // v0.7.15: Tier 1 onboarding — waves 1-10 get HP = wave number exactly.
  // So W1 = 1 HP, W2 = 2 HP, ..., W10 = 10 HP. Lets new players breathe.
  // From W11 onward, normal scaling resumes.
  if (game.tier === 1 && wave <= 10) {
    return wave; // 1,2,3,4,5,6,7,8,9,10
  }
  // Base HP 5 so regular scaling lands Wave 11 around 11-13 HP.
  return Math.floor(5 * hpWaveMul(wave) * hpTierMul(game.tier));
}
function enemySpeedForWave(wave) { return 35 + Math.min(50, wave * 0.25); }
function cashRewardForWave(wave) {
  // Base cash 5 so first kill buys the first Damage upgrade (cost0 = 5).
  return Math.floor(5 * cashWaveMul(wave) * cashTierMul(game.tier));
}
function damageToTowerForWave(wave) {
  return Math.floor(3 * dmgWaveMul(wave) * dmgTierMul(game.tier));
}
function spawnIntervalForWave(wave) {
  if (wave <= 30) return Math.max(500, 1000 - wave * 12);
  if (wave <= 120) return Math.max(320, 700 - (wave - 30) * 4);
  return 280;
}
// End-run coin reward: sublinear in wave, linear in tier, so deep runs have diminishing returns.
function coinRewardForRun(maxWave, totalCash) {
  const wavePart = Math.pow(maxWave, 1.35) * Math.pow(1.20, game.tier - 1);
  const cashPart = Math.pow(Math.max(1, totalCash), 0.60) / 40;
  const bossPart = game.bossesDefeated * 8 * Math.pow(1.10, game.tier - 1);
  const coinBonus = (game.upgrades && game.upgrades.coinBonus) ? getCoinBonusMul() : 1;
  const cardCoinGain = 1 + getCardBucket('coinGain');
  return Math.floor((wavePart + cashPart + bossPart) * coinBonus * cardCoinGain);
}

// ============================================================
// ENEMY TYPES
// ============================================================
const ENEMY_TYPES = {
  normal:    { name: 'Normal',    color: 'var(--danger)', hpMul: 1.0, speedMul: 1.0,  dmgMul: 1.0, meleeIntervalMul: 1.0,  unlockTier: 1,  desc: 'Standard' },
  fast:      { name: 'Fast',      color: 'var(--gold)',   hpMul: 0.5, speedMul: 1.3,  dmgMul: 0.7, meleeIntervalMul: 0.65, unlockTier: 2,  desc: 'Low HP, fast attacks' },
  tank:      { name: 'Tank',      color: 'var(--purple)', hpMul: 3.0, speedMul: 0.55, dmgMul: 1.5, meleeIntervalMul: 1.4,  unlockTier: 3,  desc: 'High HP, slow hits' },
  shooter:   { name: 'Shooter',   color: 'var(--cyan2)',  hpMul: 1.0, speedMul: 0.8,  dmgMul: 0.5, meleeIntervalMul: 1.0,  unlockTier: 4,  desc: 'Stops & shoots' },
  elite:     { name: 'Elite',     color: 'var(--text)',   hpMul: 5.0, speedMul: 0.7,  dmgMul: 2.0, meleeIntervalMul: 1.1,  unlockTier: 5,  desc: 'Rare, dangerous' },
  augmenter: { name: 'Augmenter', color: 'var(--good)',   hpMul: 2.0, speedMul: 0.6,  dmgMul: 0.5, meleeIntervalMul: 1.2,  unlockTier: 10, desc: 'Buffs nearby +30%' },
  boss:      { name: 'Boss',      color: 'var(--gold)',   hpMul: 50,  speedMul: 0.3,  dmgMul: 3.0, meleeIntervalMul: 1.8,  unlockTier: 1,  desc: 'Every 25 waves' }
};

// ============================================================
// BATTLE FLOW
// ============================================================
function startBattle(startingWave) {
  game.tier = save.selectedTier;
  game.wave = startingWave || 1;
  game.enemiesKilledInWave = 0;
  game.bossWave = (game.wave % 25 === 0) && game.wave > 0;
  game.enemiesPerWave = game.bossWave ? 1 : 10;
  game.cash = 0;
  game.enemies = [];
  game.projectiles = [];
  game.enemyProjectiles = [];
  for (const k in game.upgrades) game.upgrades[k].level = 0;
  game.hpMax = getMaxHp();
  game.hp = game.hpMax;
  game.startTime = Date.now();
  game.cashEarnedThisRun = 0;
  game.gemsEarnedThisRun = 0;
  game.enemiesKilledThisRun = 0;
  game.damageBlockedThisRun = 0;
  game.bossesDefeated = 0;
  game.lastEnemySpawn = 0;
  game.lastShotTime = 0;
  game.focusShotsRemaining = 0;
  game.focusTarget = null;
  game.regenAccum = 0;
  game.healsUsed = 0;
  game.bossSpawned = false;
  game.comboCount = 0;
  game.comboLastKillTime = 0;
  // Apex card state reset
  game.shotCount = 0;
  game.shield = 0;
  game.shieldMax = 0;
  game.timeLockLastTrigger = Date.now();
  game.enemySlowUntil = 0;
  game.enemySlowFrac = 0;
  game.lastStandUsed = false;
  document.getElementById('endOverlay').classList.remove('active');
  document.getElementById('liveStats').classList.remove('open');
  stopPassiveAccrual();
  showScreen('battle');
  setTimeout(() => {
    if (game.bf) {
      game.bf.querySelectorAll('.enemy, .projectile, .float-text, .focus-marker, .wave-banner, .boss-clear-wave, .gem-orb, .ad-pill').forEach(el => el.remove());
      game.running = true;
      resetOrbStateForRun();
      renderUpgrades();
      renderHud();
      // Update battlefield rect AFTER upgrade panel renders, so tower position
      // uses the final battlefield height (upgrade panel eats space).
      updateBfRect();
      // And once more after a frame settles, belt-and-suspenders for iOS layout
      requestAnimationFrame(() => updateBfRect());
      startLoop();
      if (game.bossWave) showWaveBanner('BOSS ' + game.wave, true);
    }
  }, 30);
}

function endRunConfirm() {
  if (!game.running) return;
  if (!confirm('End run early? You keep coins earned.')) return;
  endRun();
}

function endRun() {
  if (!game.running) return;
  game.running = false;
  stopLoop();
  // If the menu overlay was open mid-run, close it so the death screen
  // actually shows on the battlefield underneath.
  if (typeof closeMenuOverlay === 'function' && isOverlayActive()) {
    closeMenuOverlay();
  }
  // Clean up orb/pill if any
  if (orbState.currentOrb) { orbState.currentOrb.remove(); orbState.currentOrb = null; }
  if (orbState.pillEl) { orbState.pillEl.remove(); orbState.pillEl = null; }
  if (orbState.pillExpireTimer) { clearTimeout(orbState.pillExpireTimer); orbState.pillExpireTimer = null; }
  const maxWave = game.wave;
  const totalCash = game.cashEarnedThisRun;
  const coinsEarned = coinRewardForRun(maxWave, totalCash);
  save.coins += coinsEarned;
  save.totalRuns += 1;
  save.totalCashEarned += totalCash;
  save.totalEnemiesKilled += game.enemiesKilledThisRun;
  save.totalPlaytimeMs += Date.now() - game.startTime;
  // Tournament: submit score if this was flagged as a tournament run
  if (game.isTourneyRun && typeof tourneySubmitScore === 'function') {
    tourneySubmitScore(maxWave, Date.now() - game.startTime);
    game.isTourneyRun = false;
  }
  const prevBest = save.bestWavePerTier[game.tier] || 0;
  if (maxWave > prevBest) save.bestWavePerTier[game.tier] = maxWave;
  if (game.tier > save.bestTier || (game.tier === save.bestTier && maxWave > save.bestWave)) {
    save.bestTier = game.tier;
    save.bestWave = maxWave;
  }
  persistSave();
  const stats = document.getElementById('endStats');
  const isNewBest = maxWave > prevBest;
  const tierJustUnlocked = (game.tier < MAX_TIER && prevBest < 100 && maxWave >= 100);
  stats.innerHTML = `
    <div class="end-stat-row"><span class="end-stat-label">Difficulty</span><span class="end-stat-value">T${game.tier}</span></div>
    <div class="end-stat-row"><span class="end-stat-label">Wave reached</span><span class="end-stat-value">${maxWave}</span></div>
    <div class="end-stat-row"><span class="end-stat-label">Cash earned</span><span class="end-stat-value">${formatNum(totalCash)}</span></div>
    <div class="end-stat-row"><span class="end-stat-label">Enemies killed</span><span class="end-stat-value">${game.enemiesKilledThisRun}</span></div>
    <div class="end-stat-row"><span class="end-stat-label">Bosses defeated</span><span class="end-stat-value">${game.bossesDefeated}</span></div>
    ${(game.gemsEarnedThisRun || 0) > 0 ? `<div class="end-stat-row"><span class="end-stat-label">Gems earned</span><span class="end-stat-value" style="color:var(--purple)">+${game.gemsEarnedThisRun} 💎</span></div>` : ''}
    <div class="end-stat-row"><span class="end-stat-label">Damage blocked</span><span class="end-stat-value">${formatNum(game.damageBlockedThisRun)}</span></div>
    <div class="end-stat-row"><span class="end-stat-label">Coins earned</span><span class="end-stat-value gold">+${formatNum(coinsEarned)}</span></div>
    <div class="end-stat-row"><span class="end-stat-label">Total coins</span><span class="end-stat-value gold">${formatNum(save.coins)}</span></div>
    ${isNewBest ? '<div class="end-stat-row"><span class="end-stat-label" style="color:var(--good)">★ NEW BEST WAVE</span><span></span></div>' : ''}
    ${tierJustUnlocked ? `<div class="end-stat-row"><span class="end-stat-label" style="color:var(--accent)">⚡ T${game.tier + 1} UNLOCKED</span><span></span></div>` : ''}
  `;
  document.getElementById('endOverlay').classList.add('active');
  document.getElementById('endTitle').textContent = game.hp <= 0 ? 'Core Lost' : 'Run Ended';

  // Show the player's name above the "Core Lost" title
  const titleEl = document.getElementById('endTitle');
  if (titleEl && save.username) {
    const parent = titleEl.parentNode;
    const stale = parent.querySelector('.end-player');
    if (stale) stale.remove();
    const line = document.createElement('div');
    line.className = 'end-player';
    line.textContent = save.username;
    parent.insertBefore(line, titleEl);
  }

  renderHud();
}

function returnToMenu() {
  document.getElementById('endOverlay').classList.remove('active');
  showScreen('menu');
  renderMenu();
  renderHud();
  startPassiveAccrual();
}

// ============================================================
// COMBAT LOOP
// ============================================================
function startLoop() {
  game.lastTick = performance.now();
  function tick(now) {
    if (!game.running) return;
    const rawDt = Math.min(100, now - game.lastTick) / 1000;
    const dt = rawDt * (save.settings.gameSpeed || 1);
    game.lastTick = now;
    update(dt, rawDt);
    render();
    game.tickHandle = requestAnimationFrame(tick);
  }
  game.tickHandle = requestAnimationFrame(tick);
}
function stopLoop() {
  if (game.tickHandle) cancelAnimationFrame(game.tickHandle);
  game.tickHandle = null;
}

function update(dt, rawDt) {
  if (!game.bfRect) updateBfRect();
  const now = performance.now();
  const speedFactor = save.settings.gameSpeed || 1;

  // Tick Time Lock apex — may slow all enemies periodically.
  tickTimeLock(now);

  // Combo decay — window extended by Combo Bank card
  const decayMs = getComboDecayMs();
  if (game.comboCount > 0) {
    const timeSinceKill = now - game.comboLastKillTime;
    if (timeSinceKill > decayMs) {
      game.comboCount = 0;
    } else if (timeSinceKill > 500) {
      // Linear decay starting at 0.5s, fully gone at decayMs
      const decayProgress = (timeSinceKill - 500) / (decayMs - 500);
      const targetCombo = Math.max(0, game.comboCount * (1 - decayProgress * 0.02));
      game.comboCount = targetCombo;
    }
  }

  const regen = getRegenPerSec();
  if (regen > 0) {
    game.regenAccum += regen * dt;
    if (game.regenAccum >= 1) {
      const inc = Math.floor(game.regenAccum);
      applyHealToTower(inc);
      game.regenAccum -= inc;
    }
  }

  // Spawn
  if (!game.lastEnemySpawn) game.lastEnemySpawn = now;
  if (game.bossWave) {
    if (!game.bossSpawned) {
      spawnBoss();
      game.bossSpawned = true;
    }
  } else {
    if ((now - game.lastEnemySpawn) * speedFactor > spawnIntervalForWave(game.wave)) {
      if (game.enemies.length < 80) {
        spawnEnemy();
        game.lastEnemySpawn = now;
      }
    }
  }

  // Move enemies (continuous-attack model)
  // - Enemies stop at their melee range when close to the tower.
  // - While in melee range, each enemy attacks every meleeInterval ms.
  // - Shooter enemies stay at shooter range and fire projectiles.
  const baseSpeed = enemySpeedForWave(game.wave);
  const MELEE_RANGE = 42;       // normal enemies stop this close (px)
  const BOSS_MELEE_RANGE = 52;  // bosses are bigger, stop sooner
  const MELEE_INTERVAL = 900;   // ms between melee attacks (baseline)
  // Per-type damage-per-hit scaling — enemies now hit repeatedly so each hit
  // is lower than the old one-shot contact damage. This preserves overall
  // pressure: old model = 1 big hit on death, new model = ~3-4 smaller hits
  // over 2-3 seconds while the tower tries to kill it.
  const HIT_FRAC = 0.32;  // each melee hit = 32% of the legacy contact damage
  for (const e of game.enemies) {
    if (e.dead) continue;
    const dx = game.towerX - e.x;
    const dy = game.towerY - e.y;
    const dist = Math.hypot(dx, dy);
    // --- Shooter behavior ---
    if (e.type === 'shooter') {
      const SHOOTER_IDEAL = 180;
      if (dist > SHOOTER_IDEAL) {
        // Close in until we reach our firing range
        const buffMul = e.auraBuffed ? 1.3 : 1;
        const speed = baseSpeed * (e.speedMul || 1) * buffMul;
        e.x += (dx / dist) * speed * dt;
        e.y += (dy / dist) * speed * dt;
      }
      // Fire projectiles
      if ((now - (e.lastShot || 0)) * speedFactor > 1500) {
        e.lastShot = now;
        spawnEnemyProjectile(e);
      }
      continue;
    }
    // --- Melee behavior ---
    const meleeR = (e.type === 'boss') ? BOSS_MELEE_RANGE : MELEE_RANGE;
    if (dist <= meleeR) {
      // In melee range. Attack on cooldown.
      if (!e.lastMeleeAt) e.lastMeleeAt = now;
      const interval = MELEE_INTERVAL * (e.meleeIntervalMul || 1);
      if ((now - e.lastMeleeAt) * speedFactor >= interval) {
        e.lastMeleeAt = now;
        const buffMul = e.auraBuffed ? 1.3 : 1;
        const baseDmg = damageToTowerForWave(game.wave) * (e.dmgMul || 1) * buffMul * HIT_FRAC;
        const reduced = baseDmg * (1 - getDefenseFraction());
        game.damageBlockedThisRun += baseDmg - reduced;
        const alive = applyDamageToTower(reduced);
        flashTower();
        if (save.settings.showFloatingDamage) {
          spawnFloat(game.towerX, game.towerY - 30, '-' + Math.floor(reduced), 'tower-dmg');
        }
        if (!alive) { game.hp = 0; cleanDeadEnemies(); endRun(); return; }
      }
    } else {
      // Walk toward tower. Apply Time Lock slow if active.
      const slow = game.enemySlowFrac || 0;
      const buffMul = e.auraBuffed ? 1.3 : 1;
      const speed = baseSpeed * (e.speedMul || 1) * buffMul * (1 - slow);
      e.x += (dx / dist) * speed * dt;
      e.y += (dy / dist) * speed * dt;
    }
  }
  cleanDeadEnemies();

  // Augmenter aura: each augmenter buffs nearby enemies.
  // Effect: buffed enemies move 30% faster and deal 30% more damage.
  // Recalc each frame because enemies move.
  const AUG_RADIUS = 120;
  const augmenters = game.enemies.filter(e => !e.dead && e.type === 'augmenter');
  for (const e of game.enemies) {
    if (e.dead || e.type === 'augmenter') continue;
    let buffed = false;
    for (const a of augmenters) {
      if (Math.hypot(e.x - a.x, e.y - a.y) <= AUG_RADIUS) {
        buffed = true;
        break;
      }
    }
    e.auraBuffed = buffed;
  }
  for (const ep of game.enemyProjectiles) {
    const dx = game.towerX - ep.x;
    const dy = game.towerY - ep.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      ep.dead = true;
      const baseDmg = damageToTowerForWave(game.wave) * 0.5;
      const reduced = baseDmg * (1 - getDefenseFraction());
      game.damageBlockedThisRun += baseDmg - reduced;
      const alive = applyDamageToTower(reduced);
      flashTower();
      if (save.settings.showFloatingDamage) {
        spawnFloat(game.towerX, game.towerY - 30, '-' + Math.floor(reduced), 'tower-dmg');
      }
      if (!alive) { game.hp = 0; cleanDeadEnemies(); endRun(); return; }
    } else {
      const speed = 250;
      ep.x += (dx / dist) * speed * dt;
      ep.y += (dy / dist) * speed * dt;
    }
  }
  game.enemyProjectiles = game.enemyProjectiles.filter(ep => {
    if (ep.dead && ep.el) ep.el.remove();
    return !ep.dead;
  });

  // Tower shooting
  const interval = getAttackInterval();
  if ((now - game.lastShotTime) * speedFactor > interval) {
    const nTargets = getMultishotTargets();
    const targets = pickTargets(nTargets);
    if (targets.length > 0) {
      for (const t of targets) {
        // Primary shot (full damage)
        fireAt(t, 1.0);
        // Roll multishot chance for an extra shot at multishot power damage
        if (Math.random() < getMultishotChance()) {
          fireAt(t, getMultishotPower());
        }
      }
      game.lastShotTime = now;
    }
  }

  // Projectile movement + bounce
  const bouncePower = getBouncePower();
  for (const p of game.projectiles) {
    if (p.dead) continue;
    if (!p.target || p.target.dead) {
      p.target = pickClosestEnemy(p.x, p.y, p.alreadyHit, getRange());
      if (!p.target) { p.dead = true; continue; }
    }
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const dist = Math.hypot(dx, dy);
    const speed = 900;
    const move = speed * dt;
    if (move >= dist) {
      hitEnemy(p.target, p.damage, p.crit);
      p.alreadyHit.add(p.target);
      if (p.bouncesLeft > 0) {
        const next = pickClosestEnemy(p.target.x, p.target.y, p.alreadyHit, 250);
        if (next) {
          p.target = next;
          p.bouncesLeft--;
          p.damage *= bouncePower;
          if (p.el) p.el.classList.add('bounce');
        } else { p.dead = true; }
      } else { p.dead = true; }
    } else {
      p.x += (dx / dist) * move;
      p.y += (dy / dist) * move;
    }
  }
  game.projectiles = game.projectiles.filter(p => {
    if (p.dead && p.el) p.el.remove();
    return !p.dead;
  });
}

function cleanDeadEnemies() {
  game.enemies = game.enemies.filter(e => {
    if (e.dead && e.el) e.el.remove();
    return !e.dead;
  });
}

function pickTargets(n) {
  if (game.enemies.length === 0) return [];
  const range = getRange();
  const focus = (game.focusTarget && game.focusShotsRemaining > 0) ? game.focusTarget : null;
  const inRange = game.enemies.filter(e => !e.dead && Math.hypot(e.x - game.towerX, e.y - game.towerY) <= range);
  if (inRange.length === 0) return [];
  const sorted = inRange.sort((a, b) => {
    if (focus) return Math.hypot(a.x - focus.x, a.y - focus.y) - Math.hypot(b.x - focus.x, b.y - focus.y);
    return Math.hypot(a.x - game.towerX, a.y - game.towerY) - Math.hypot(b.x - game.towerX, b.y - game.towerY);
  });
  return sorted.slice(0, n);
}

function pickClosestEnemy(fromX, fromY, exclude, maxDist) {
  let best = null, bestD = maxDist || Infinity;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (exclude && exclude.has(e)) continue;
    const d = Math.hypot(e.x - fromX, e.y - fromY);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

// Centralized damage pipeline: handles Bulwark Veil shield + Last Stand.
// Returns true if tower still alive, false if this kill confirms death.
function applyDamageToTower(amount) {
  if (save.devState.godMode) return true;
  // Consume shield first (Bulwark Veil + Last Stand both feed into game.shield)
  if (game.shield > 0) {
    const absorbed = Math.min(game.shield, amount);
    game.shield -= absorbed;
    amount -= absorbed;
  }
  if (amount > 0) {
    game.hp -= amount;
  }
  // Last Stand: if this would kill, prevent once per run
  if (game.hp <= 0 && !game.lastStandUsed) {
    const frac = getLastStandShieldFrac();
    if (frac > 0) {
      game.lastStandUsed = true;
      game.hp = 1;
      game.shield = Math.floor(game.hpMax * frac);
      game.shieldMax = Math.max(game.shieldMax, game.shield);
      spawnFloat(game.towerX, game.towerY - 40, 'LAST STAND!', 'heal');
      return true;
    }
  }
  return game.hp > 0;
}

// Centralized heal pipeline: Bulwark Veil converts overheal to shield.
function applyHealToTower(amount) {
  const before = game.hp;
  game.hp = Math.min(game.hpMax, game.hp + amount);
  const actual = game.hp - before;
  const overflow = amount - actual;
  if (overflow > 0) {
    const cap = Math.floor(game.hpMax * getBulwarkShieldCap());
    if (cap > 0) {
      game.shield = Math.min(cap, game.shield + overflow);
      game.shieldMax = Math.max(game.shieldMax, game.shield);
    }
  }
  return actual;
}

// Time Lock apex: periodically freeze all enemies briefly.
// Returns the slow fraction active now (0 if no freeze).
function tickTimeLock(now) {
  const tl = getTimeLockData();
  if (!tl) { game.enemySlowFrac = 0; return 0; }
  // Trigger
  if (!game.timeLockLastTrigger) game.timeLockLastTrigger = now;
  if (now - game.timeLockLastTrigger >= tl.interval) {
    game.timeLockLastTrigger = now;
    game.enemySlowUntil = now + 2000;
    game.enemySlowFrac = tl.slow;
  }
  // Decay
  if (now > game.enemySlowUntil) {
    game.enemySlowFrac = 0;
  }
  return game.enemySlowFrac;
}

function fireAt(target, dmgMul) {
  dmgMul = dmgMul === undefined ? 1.0 : dmgMul;
  const baseDmg = getDamage();
  const isFocus = game.focusShotsRemaining > 0;
  const isCrit = Math.random() < getCritChance();
  let dmg = baseDmg * dmgMul;
  if (isFocus) { dmg *= 1.5; game.focusShotsRemaining--; }
  if (isCrit) dmg *= getCritPower();
  // Boss damage bonus card (Boss Breaker)
  if (target.type === 'boss') dmg *= (1 + getBossDamageBonus());
  // Roll bounce — if passed, the projectile gets `bounceTargets` bounces
  const willBounce = Math.random() < getBounceChance();
  const bouncesAllowed = willBounce ? getBounceTargets() : 0;
  game.projectiles.push({
    x: game.towerX, y: game.towerY,
    target, damage: dmg, crit: isCrit, dead: false,
    bouncesLeft: bouncesAllowed,
    alreadyHit: new Set()
  });
  // Storm Thread apex: every Nth shot arc to 2 nearest enemies for % damage
  game.shotCount++;
  const st = getStormThreadData();
  if (st && game.shotCount % st.interval === 0) {
    const arcDmg = baseDmg * st.dmg;
    const nearby = pickNearbyEnemies(target, 2, 160);
    for (const extra of nearby) {
      game.projectiles.push({
        x: game.towerX, y: game.towerY,
        target: extra, damage: arcDmg, crit: false, dead: false,
        bouncesLeft: 0, alreadyHit: new Set(),
        isArc: true
      });
    }
  }
}

// Pick N nearest non-dead enemies excluding the given target
function pickNearbyEnemies(centerEnemy, count, maxDist) {
  const candidates = [];
  for (const e of game.enemies) {
    if (e.dead || e === centerEnemy) continue;
    const d = Math.hypot(e.x - centerEnemy.x, e.y - centerEnemy.y);
    if (d > maxDist) continue;
    candidates.push({ e, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates.slice(0, count).map(c => c.e);
}

function spawnEnemyProjectile(enemy) {
  game.enemyProjectiles.push({ x: enemy.x, y: enemy.y, dead: false, el: null });
}

function hitEnemy(e, dmg, crit) {
  e.hp -= dmg;
  if (save.settings.showFloatingDamage) {
    spawnFloat(e.x, e.y - 12, Math.floor(dmg), crit ? 'crit' : 'dmg');
  }
  if (e.hp <= 0) {
    e.dead = true;
    game.enemiesKilledInWave++;
    game.enemiesKilledThisRun++;
    // Increment combo on every kill
    game.comboCount++;
    game.comboLastKillTime = performance.now();
    const comboMul = getCurrentComboMul();
    const mul = e.type === 'boss' ? 20 * getBossBountyMul() : (e.hpMul || 1);
    const reward = Math.floor(cashRewardForWave(game.wave) * mul * getCashMul() * comboMul);
    game.cash += reward;
    game.cashEarnedThisRun += reward;
    if (save.settings.showFloatingCash) {
      const comboLabel = (comboMul > 1.01) ? ` ×${comboMul.toFixed(2)}` : '';
      spawnFloat(e.x, e.y + 8, '+$' + formatNum(reward) + comboLabel, 'cash');
    }
    if (e.type === 'boss') {
      game.bossesDefeated++;
      bossClearEffect(e.x, e.y);
      // Gem drop: 1 gem at T1, scales modestly with tier. Every 5 bosses = bonus gem.
      const gemReward = Math.max(1, Math.floor(game.tier * 0.5 + (game.bossesDefeated % 5 === 0 ? 2 : 0)));
      save.gems += gemReward;
      game.gemsEarnedThisRun = (game.gemsEarnedThisRun || 0) + gemReward;
      spawnFloat(e.x, e.y - 20, '+' + gemReward + ' 💎', 'lifesteal');
    }
    const ls = getLifestealFraction();
    if (ls > 0) {
      const heal = Math.max(1, Math.floor(dmg * ls));
      const actual = applyHealToTower(heal);
      if (actual > 0 && save.settings.showFloatingHeals) {
        spawnFloat(game.towerX + (Math.random() * 20 - 10), game.towerY - 12, '+' + actual, 'lifesteal');
      }
    }
    if (game.enemiesKilledInWave >= game.enemiesPerWave) advanceWave();
  }
}

function advanceWave() {
  game.wave++;
  game.enemiesKilledInWave = 0;
  game.bossWave = game.wave % 25 === 0;
  game.enemiesPerWave = game.bossWave ? 1 : 10;
  game.bossSpawned = false;
  const bonus = Math.floor(cashRewardForWave(game.wave) * 5 * getCashMul() * getWaveBonusMul());
  game.cash += bonus;
  game.cashEarnedThisRun += bonus;
  if (game.bossWave) showWaveBanner('BOSS ' + game.wave, true);
  else showWaveBanner('WAVE ' + game.wave);
}

function spawnEnemy() {
  const w = game.bfRect.width;
  const angle = (Math.random() * 1.7 - 0.85) * (Math.PI / 2);
  const spawnDist = Math.max(w, game.bfRect.height) * 0.7;
  const sx = game.towerX + Math.sin(angle) * spawnDist;
  const sy = game.towerY - Math.cos(angle) * spawnDist;
  const x = Math.max(10, Math.min(w - 10, sx));
  const y = Math.max(-20, Math.min(game.towerY - 60, sy));
  const r = Math.random();
  let type = 'normal';
  // Tier gates enemy variety. Higher tier = more variety available.
  if (game.tier >= ENEMY_TYPES.augmenter.unlockTier && r < 0.03) type = 'augmenter';
  else if (game.tier >= ENEMY_TYPES.elite.unlockTier && game.wave >= 10 && game.wave % 10 === 0 && r < 0.04) type = 'elite';
  else if (game.tier >= ENEMY_TYPES.shooter.unlockTier && game.wave >= 5 && r < 0.10) type = 'shooter';
  else if (game.tier >= ENEMY_TYPES.tank.unlockTier && r < 0.20) type = 'tank';
  else if (game.tier >= ENEMY_TYPES.fast.unlockTier && r < 0.25) type = 'fast';
  const t = ENEMY_TYPES[type];
  game.enemies.push({
    x, y, type,
    hp: enemyHpForWave(game.wave) * t.hpMul,
    hpMax: enemyHpForWave(game.wave) * t.hpMul,
    speedMul: t.speedMul, dmgMul: t.dmgMul, hpMul: t.hpMul,
    meleeIntervalMul: t.meleeIntervalMul || 1.0,
    dead: false, el: null, hpEl: null, hpFillEl: null, lastShot: 0, lastMeleeAt: 0,
    auraActive: type === 'augmenter'
  });
}

function spawnBoss() {
  const w = game.bfRect.width;
  const t = ENEMY_TYPES.boss;
  game.enemies.push({
    x: w / 2, y: -30,
    type: 'boss',
    hp: enemyHpForWave(game.wave) * t.hpMul,
    hpMax: enemyHpForWave(game.wave) * t.hpMul,
    speedMul: t.speedMul, dmgMul: t.dmgMul, hpMul: t.hpMul,
    meleeIntervalMul: t.meleeIntervalMul || 1.0,
    dead: false, el: null, hpEl: null, hpFillEl: null, lastShot: 0, lastMeleeAt: 0
  });
}

function bossClearEffect(x, y) {
  const el = document.createElement('div');
  el.className = 'boss-clear-wave';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  game.bf.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

