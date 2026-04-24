// ============================================================
// tournament.js — bracket generation, synthetic competitors,
// score submission, cycle end processing, reward payout.
// Owned by: tournament AI. Reads game state; never writes to it.
// ============================================================

// Persistent tournament state shape (stored in save.tournament):
//   {
//     playerLeague: 'copper' | 'bronze' | ... ,
//     playerBand: 1..7 (the band the league tracks for),
//     cycleId: number,             // increments each cycle
//     cycleStartTime: timestamp,   // ms
//     currentBracket: {
//       bracketId: string,
//       cycleId: number,
//       band: number,
//       league: string,
//       entries: [ { id, name, isSynthetic, bestWave, bestTime, ... } ]
//     } | null,
//     playerEntries: number,       // how many tourney runs used this cycle
//     playerBestWave: number,      // best wave this cycle
//     playerBestTime: number,      // ms to reach playerBestWave
//     lastRewardedCycleId: number,
//     lastResult: null | { rank, coins, gems, promoted, demoted, cycleId }
//   }

// --- Random helpers ---
function tourneyRand() { return Math.random(); }
function tourneyRandInt(lo, hi) { return lo + Math.floor(tourneyRand() * (hi - lo + 1)); }
function tourneyPick(arr) { return arr[Math.floor(tourneyRand() * arr.length)]; }

// Generate a synthetic competitor name (may append digits)
function tourneyGenerateName(usedNames) {
  let attempts = 0;
  while (attempts < 100) {
    let base = tourneyPick(TOURNEY_SYNTHETIC_NAMES);
    // 40% chance of 2-digit suffix
    if (tourneyRand() < 0.4) base = base + tourneyRandInt(10, 99);
    if (!usedNames.has(base)) {
      usedNames.add(base);
      return base;
    }
    attempts++;
  }
  // Fallback: append more random
  return 'Player' + tourneyRandInt(1000, 9999);
}

// Generate a synthetic competitor score using band/league expected range,
// percentile band, and variance. Returns { bestWave, bestTime, percentile }.
function tourneyGenerateSyntheticScore(bandId, league) {
  const [lo, hi] = tourneyExpectedWaveRange(bandId, league);
  const range = hi - lo;

  // Percentile band: weak 20%, average 50%, strong 20%, top-end 10%
  const r = tourneyRand();
  let percentile, center;
  if (r < 0.20)       { percentile = 'weak';    center = lo + range * 0.20; }
  else if (r < 0.70)  { percentile = 'average'; center = lo + range * 0.50; }
  else if (r < 0.90)  { percentile = 'strong';  center = lo + range * 0.80; }
  else                { percentile = 'top';     center = hi + range * 0.15; }

  // Variance around center
  const variance = range * 0.15;
  const wave = Math.max(1, Math.round(center + (tourneyRand() - 0.5) * 2 * variance));

  // Time to reach: average 90s per wave + variance (faster = better tiebreaker)
  const baseTime = wave * (60 + tourneyRandInt(20, 40)) * 1000;
  return {
    bestWave: wave,
    bestTime: Math.round(baseTime),
    percentile
  };
}

// Generate a fresh 250-player bracket with player + synthetic competitors.
// Called once at the start of a new cycle.
function tourneyGenerateBracket(cycleId, band, league, playerId) {
  const usedNames = new Set();
  usedNames.add(playerId); // don't let a synth share the player name
  const entries = [];

  // Add player entry (score starts at 0, updated as they submit)
  entries.push({
    id: playerId,
    name: playerId,
    isSynthetic: false,
    bestWave: 0,
    bestTime: 0
  });

  // Fill rest with synthetic competitors
  for (let i = 0; i < TOURNEY_BRACKET_SIZE - 1; i++) {
    const score = tourneyGenerateSyntheticScore(band, league);
    entries.push({
      id: 'synth_' + cycleId + '_' + i,
      name: tourneyGenerateName(usedNames),
      isSynthetic: true,
      bestWave: score.bestWave,
      bestTime: score.bestTime
    });
  }

  return {
    bracketId: 'br_' + cycleId + '_' + band + '_' + league,
    cycleId, band, league,
    entries
  };
}

// Sort bracket entries by tournament score:
// primary: highest wave DESC
// tiebreaker: fastest time ASC
// Returns a new sorted array (does not mutate).
function tourneySortEntries(entries) {
  const arr = entries.slice();
  arr.sort((a, b) => {
    if (b.bestWave !== a.bestWave) return b.bestWave - a.bestWave;
    return a.bestTime - b.bestTime;
  });
  return arr;
}

// Find player's rank (1-indexed) in the bracket
function tourneyPlayerRank(bracket, playerId) {
  const sorted = tourneySortEntries(bracket.entries);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].id === playerId) return i + 1;
  }
  return sorted.length;
}

// Initialize or refresh the player's tournament state.
// Creates a bracket if one doesn't exist or the cycle has rolled over.
function tourneyEnsureActive() {
  if (!save.tournament) {
    save.tournament = {
      playerLeague: 'copper',
      playerBand: 1,
      cycleId: 0,
      cycleStartTime: Date.now(),
      currentBracket: null,
      playerEntries: 0,
      playerBestWave: 0,
      playerBestTime: 0,
      lastRewardedCycleId: -1,
      lastResult: null
    };
  }
  const t = save.tournament;
  const now = Date.now();

  // Check if cycle has expired → process rewards + start new cycle
  if (t.currentBracket && (now - t.cycleStartTime) >= TOURNEY_CYCLE_MS) {
    tourneyProcessCycleEnd();
  }

  // Update band based on current progression (highest tier unlocked)
  const band = tourneyBandForTier(save.bestTier || 1);
  if (band.id !== t.playerBand) {
    // Player unlocked a new band — reset to Copper in new band
    t.playerBand = band.id;
    t.playerLeague = 'copper';
    t.currentBracket = null; // force new bracket in new band
  }

  // Create a bracket if none exists
  if (!t.currentBracket) {
    t.cycleId += 1;
    t.cycleStartTime = now;
    t.playerEntries = 0;
    t.playerBestWave = 0;
    t.playerBestTime = 0;
    const playerId = save.playerId || 'You';
    t.currentBracket = tourneyGenerateBracket(t.cycleId, t.playerBand, t.playerLeague, playerId);
  }

  return t;
}

// Submit a tournament run result (called after a run ends).
// Only updates if this is better than current best.
// score: { wave, timeMs }
function tourneySubmitScore(wave, timeMs) {
  const t = tourneyEnsureActive();
  if (!t.currentBracket) return false;

  const isBetter = wave > t.playerBestWave
                   || (wave === t.playerBestWave && timeMs < t.playerBestTime);
  if (!isBetter && t.playerBestWave > 0) return false;

  t.playerBestWave = wave;
  t.playerBestTime = timeMs;

  // Update the player's entry in the bracket
  const playerId = save.playerId || 'You';
  const entry = t.currentBracket.entries.find(e => e.id === playerId);
  if (entry) {
    entry.bestWave = wave;
    entry.bestTime = timeMs;
  }
  persistSave();
  return true;
}

// Mark a tournament entry used (called when player starts a tourney run)
function tourneyConsumeEntry() {
  const t = tourneyEnsureActive();
  if (t.playerEntries >= TOURNEY_STANDARD_ENTRIES) return false;
  t.playerEntries += 1;
  persistSave();
  return true;
}

function tourneyEntriesRemaining() {
  const t = tourneyEnsureActive();
  return Math.max(0, TOURNEY_STANDARD_ENTRIES - (t.playerEntries || 0));
}

// Cycle end: compute final rank, pay rewards, promote/demote, reset bracket.
function tourneyProcessCycleEnd() {
  const t = save.tournament;
  if (!t || !t.currentBracket) return null;

  const playerId = save.playerId || 'You';
  const rank = tourneyPlayerRank(t.currentBracket, playerId);
  const totalEntries = t.currentBracket.entries.length;

  const promoteCut = Math.floor(totalEntries * TOURNEY_PROMOTE_PCT);
  const demoteCutFromBottom = Math.floor(totalEntries * TOURNEY_DEMOTE_PCT);
  const demoteCutRank = totalEntries - demoteCutFromBottom + 1;

  let promoted = false;
  let demoted = false;
  let newLeague = t.playerLeague;

  if (rank <= promoteCut) {
    const curIdx = TOURNEY_LEAGUES.indexOf(t.playerLeague);
    if (curIdx < TOURNEY_LEAGUES.length - 1) {
      newLeague = TOURNEY_LEAGUES[curIdx + 1];
      promoted = true;
    }
  } else if (rank >= demoteCutRank) {
    const curIdx = TOURNEY_LEAGUES.indexOf(t.playerLeague);
    if (curIdx > 0) {
      newLeague = TOURNEY_LEAGUES[curIdx - 1];
      demoted = true;
    }
  }

  // Only pay rewards if the player actually submitted a score
  let coins = 0, gems = 0;
  if (t.playerBestWave > 0) {
    const reward = tourneyRewardForPlacement(t.playerBand, t.playerLeague, rank);
    coins = reward.coins;
    gems = reward.gems;
    save.coins += coins;
    save.gems += gems;
  }

  t.lastResult = {
    cycleId: t.currentBracket.cycleId,
    rank, totalEntries,
    bestWave: t.playerBestWave,
    bestTime: t.playerBestTime,
    coins, gems,
    oldLeague: t.playerLeague,
    newLeague,
    promoted, demoted,
    band: t.playerBand
  };
  t.lastRewardedCycleId = t.currentBracket.cycleId;

  // Apply league change and reset bracket for new cycle
  t.playerLeague = newLeague;
  t.currentBracket = null;
  t.playerEntries = 0;
  t.playerBestWave = 0;
  t.playerBestTime = 0;

  persistSave();
  return t.lastResult;
}

// Dev helper: force end the current cycle immediately
function tourneyDevForceCycleEnd() {
  const t = tourneyEnsureActive();
  if (t && t.currentBracket) {
    t.cycleStartTime = Date.now() - TOURNEY_CYCLE_MS - 1000;
    tourneyProcessCycleEnd();
    tourneyEnsureActive(); // regenerate bracket
  }
}

// Get remaining time in current cycle, in ms
function tourneyTimeRemaining() {
  const t = tourneyEnsureActive();
  if (!t.currentBracket) return 0;
  const elapsed = Date.now() - t.cycleStartTime;
  return Math.max(0, TOURNEY_CYCLE_MS - elapsed);
}

function tourneyFormatTimeRemaining(ms) {
  if (ms <= 0) return 'Ending...';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const hoursLeft = hours % 24;
    return `${days}d ${hoursLeft}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
