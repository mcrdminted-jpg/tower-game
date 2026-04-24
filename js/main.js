// ============================================================
// main.js — passive coin accrual, offline catchup, gem orb spawner, ad simulation, boot sequence.
// Owned by: glue AI. This file should remain small.
// ============================================================

// ============================================================
// PASSIVE + OFFLINE
// ============================================================
let passiveTimer = null;
function startPassiveAccrual() {
  stopPassiveAccrual();
  passiveTimer = setInterval(() => {
    if (game.running) return;
    const coinsPerMin = Math.pow(Math.max(1, save.bestTier), 1.0) * Math.pow(Math.max(1, save.bestWave), 1.2) * 0.05;
    const passivePerSec = (coinsPerMin / 60) * 0.05;
    save.coins += passivePerSec * 10;
    renderHud();
  }, 10000);
}
function stopPassiveAccrual() {
  if (passiveTimer) { clearInterval(passiveTimer); passiveTimer = null; }
}

function processOfflineProgress() {
  if (!save.lastSaveTime) return;
  const elapsedMs = Date.now() - save.lastSaveTime;
  if (elapsedMs < 60_000) return;
  const capMin = offlineCapMinutes();
  const cappedMs = Math.min(elapsedMs, capMin * 60_000);
  const rate = offlineRateFraction();
  const coinsPerMin = Math.pow(Math.max(1, save.bestTier), 1.0) * Math.pow(Math.max(1, save.bestWave), 1.2) * 0.05;
  const minutes = cappedMs / 60_000;
  const earned = Math.floor(coinsPerMin * minutes * rate);
  if (earned > 0) {
    save.coins += earned;
    persistSave();
    showOfflineToast(elapsedMs, cappedMs, earned, capMin, rate);
  }
}

function showOfflineToast(elapsedMs, cappedMs, earned, capMin, rate) {
  const t = document.getElementById('offlineToast');
  const m = document.getElementById('offlineMsg');
  const elapsedH = elapsedMs >= 3600_000
    ? (elapsedMs / 3600_000).toFixed(1) + 'h'
    : Math.floor(elapsedMs / 60_000) + ' min';
  const cappedDisp = capMin >= 60 ? (capMin / 60).toFixed(1) + 'h' : capMin + ' min';
  const capped = elapsedMs > cappedMs;
  m.innerHTML = `
    <b>Welcome back</b><br>
    Away ${elapsedH} ${capped ? `(capped at ${cappedDisp})` : ''}<br>
    +${formatNum(earned)} coins (${(rate*100).toFixed(0)}% rate)
  `;
  t.style.display = 'block';
  setTimeout(() => { if (t) t.style.display = 'none'; }, 9000);
}

function formatNum(n) {
  n = Math.floor(n);
  if (n < 1000) return n.toString();
  if (n < 1e6)  return (n / 1e3).toFixed(1) + 'K';
  if (n < 1e9)  return (n / 1e6).toFixed(2) + 'M';
  if (n < 1e12) return (n / 1e9).toFixed(2) + 'B';
  if (n < 1e15) return (n / 1e12).toFixed(2) + 'T';
  return n.toExponential(2);
}

// Stat formatter — for display in upgrade panel. Shows decimals on small
// numbers so early-game fractional changes (5 → 5.5) are visible.
// At scale this falls back to formatNum for readability.
function formatStat(n) {
  if (n < 10) return n.toFixed(1);
  if (n < 100) return n.toFixed(1);
  return formatNum(n);
}

// ============================================================
// GEM ORB SYSTEM — side-lane optional reward
// ============================================================
// Spawns at run start + 2 min, then every 6-8 min active play.
// One orb max on screen. Never during boss banner, death, or menus.
// Tap = +2 gems instant. Small "+3 ad" pill appears briefly after tap.

const orbState = {
  lastSpawnTime: 0,
  nextSpawnDelay: 0,  // ms until next spawn from orb.lastSpawnTime
  currentOrb: null,   // DOM element or null
  currentOrbSpawnedAt: 0,
  currentOrbDuration: 22000,
  pillEl: null,
  pillExpireTimer: null
};

function resetOrbStateForRun() {
  // When a run starts, schedule first orb at 2 min real-time from now
  orbState.lastSpawnTime = performance.now();
  orbState.nextSpawnDelay = 2 * 60 * 1000; // 2 minutes
  if (orbState.currentOrb) {
    orbState.currentOrb.remove();
    orbState.currentOrb = null;
  }
  if (orbState.pillEl) {
    orbState.pillEl.remove();
    orbState.pillEl = null;
  }
  if (orbState.pillExpireTimer) {
    clearTimeout(orbState.pillExpireTimer);
    orbState.pillExpireTimer = null;
  }
}

function canSpawnOrb() {
  if (!game.running) return false;
  if (orbState.currentOrb) return false;
  // Don't spawn during the first 1s of a boss wave (banner animation)
  if (game.bossWave && game.bossSpawned) {
    const w = game.enemies.find(e => e.type === 'boss');
    // If boss is still off-screen (just spawned), wait
    if (w && w.y < 0) return false;
  }
  return true;
}

function updateOrbSystem() {
  if (!game.running) return;
  const now = performance.now();
  const elapsed = now - orbState.lastSpawnTime;
  // Handle orb lifespan
  if (orbState.currentOrb) {
    const orbAge = now - orbState.currentOrbSpawnedAt;
    if (orbAge > orbState.currentOrbDuration && !orbState.currentOrb.classList.contains('fading')) {
      orbState.currentOrb.classList.add('fading');
      setTimeout(() => {
        if (orbState.currentOrb && orbState.currentOrb.classList.contains('fading')) {
          orbState.currentOrb.remove();
          orbState.currentOrb = null;
          // Schedule next
          orbState.lastSpawnTime = performance.now();
          orbState.nextSpawnDelay = (6 + Math.random() * 2) * 60 * 1000; // 6-8 min
        }
      }, 400);
    }
  } else if (elapsed >= orbState.nextSpawnDelay && canSpawnOrb()) {
    spawnGemOrb();
  }
}

function spawnGemOrb() {
  const orb = document.createElement('div');
  orb.className = 'gem-orb';
  orb.textContent = '💎';
  orb.addEventListener('click', onOrbTapped);
  orb.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  game.bf.appendChild(orb);
  orbState.currentOrb = orb;
  orbState.currentOrbSpawnedAt = performance.now();
}

function onOrbTapped(ev) {
  ev.stopPropagation();
  if (!orbState.currentOrb) return;
  const orb = orbState.currentOrb;
  const rect = orb.getBoundingClientRect();
  const bfRect = game.bf.getBoundingClientRect();
  const relTop = rect.top - bfRect.top;
  // Award 2 gems instantly
  save.gems += 2;
  game.gemsEarnedThisRun = (game.gemsEarnedThisRun || 0) + 2;
  persistSave();
  // Floating text
  spawnFloat(bfRect.width - 40, relTop + 22, '+2 💎', 'lifesteal');
  pulseGemCounter();
  // Burst animation, then remove
  orb.classList.add('claimed');
  setTimeout(() => {
    if (orb.parentNode) orb.parentNode.removeChild(orb);
  }, 450);
  orbState.currentOrb = null;
  // Schedule next orb
  orbState.lastSpawnTime = performance.now();
  orbState.nextSpawnDelay = (6 + Math.random() * 2) * 60 * 1000;
  // Spawn ad-bonus pill near orb location
  spawnAdPill(relTop);
}

function spawnAdPill(relTop) {
  if (orbState.pillEl) {
    orbState.pillEl.remove();
    if (orbState.pillExpireTimer) clearTimeout(orbState.pillExpireTimer);
  }
  const pill = document.createElement('div');
  pill.className = 'ad-pill';
  pill.innerHTML = '<span class="gem-icon">💎</span> <span class="ad-label">+3 for ad</span>';
  pill.style.top = (relTop + 8) + 'px';
  pill.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (pill.classList.contains('fading')) return;
    pill.classList.add('fading');
    setTimeout(() => pill.remove(), 300);
    if (orbState.pillExpireTimer) clearTimeout(orbState.pillExpireTimer);
    orbState.pillEl = null;
    // Show simulated ad, grant 3 gems on completion
    showSimulatedAd('Watch for +3 💎', 'Support the devs — and grab extra gems.', () => {
      save.gems += 3;
      game.gemsEarnedThisRun = (game.gemsEarnedThisRun || 0) + 3;
      persistSave();
      pulseGemCounter();
      spawnFloat(game.bfRect.width - 40, relTop + 22, '+3 💎', 'lifesteal');
    });
  });
  game.bf.appendChild(pill);
  orbState.pillEl = pill;
  // Auto-fade after 5 seconds
  orbState.pillExpireTimer = setTimeout(() => {
    if (orbState.pillEl === pill) {
      pill.classList.add('fading');
      setTimeout(() => pill.remove(), 300);
      orbState.pillEl = null;
    }
  }, 5000);
}

function pulseGemCounter() {
  // find the Gems HUD value cell (menu only has it)
  const hudValues = document.querySelectorAll('.hud-value.purple');
  hudValues.forEach(el => {
    el.classList.remove('coin-pulse');
    void el.offsetWidth;
    el.classList.add('coin-pulse');
  });
  // Always update HUD to refresh the displayed number
  renderHud();
}

// ============================================================
// AD SIMULATION OVERLAY
// ============================================================
// Shows a 30-second countdown with skip enabled after 5s.
// onComplete() is called only when the user completes OR skips.
// Placeholder for real ad SDK.

let adSimState = {
  active: false,
  countdown: 30,
  timer: null,
  onComplete: null
};

function showSimulatedAd(title, body, onComplete) {
  const overlay = document.getElementById('adOverlay');
  const titleEl = document.getElementById('adSimTitle');
  const bodyEl = document.getElementById('adSimBody');
  const countEl = document.getElementById('adSimCountdown');
  const skipBtn = document.getElementById('adSimSkip');
  titleEl.textContent = title || 'Supporting the devs';
  bodyEl.textContent = body || 'Real ads will be rewarded, opt-in, and never interrupt gameplay. This is a placeholder.';
  adSimState.active = true;
  adSimState.countdown = 30;
  adSimState.onComplete = onComplete || null;
  countEl.textContent = '30';
  skipBtn.textContent = 'Please wait...';
  skipBtn.disabled = true;
  skipBtn.classList.remove('enabled');
  overlay.classList.add('active');
  adSimState.timer = setInterval(() => {
    adSimState.countdown--;
    countEl.textContent = adSimState.countdown;
    if (adSimState.countdown <= 25) {
      skipBtn.disabled = false;
      skipBtn.textContent = 'Skip (give reward)';
      skipBtn.classList.add('enabled');
    }
    if (adSimState.countdown <= 0) {
      completeSimulatedAd();
    }
  }, 1000);
}

function completeSimulatedAd() {
  const overlay = document.getElementById('adOverlay');
  if (adSimState.timer) { clearInterval(adSimState.timer); adSimState.timer = null; }
  overlay.classList.remove('active');
  const cb = adSimState.onComplete;
  adSimState.onComplete = null;
  adSimState.active = false;
  if (cb) cb();
}

function cancelSimulatedAd() {
  // Don't grant reward if user somehow cancels early. In this placeholder there's no cancel path.
  const overlay = document.getElementById('adOverlay');
  if (adSimState.timer) { clearInterval(adSimState.timer); adSimState.timer = null; }
  overlay.classList.remove('active');
  adSimState.active = false;
  adSimState.onComplete = null;
}


// ============================================================
// BOOT
// ============================================================
window.addEventListener('load', () => {
  loadSave();
  document.documentElement.dataset.theme = save.settings.theme || 'neon';
  game.bf = document.getElementById('battlefield');
  game.towerEl = document.getElementById('tower');
  game.rangeRingEl = document.getElementById('rangeRing');

  document.getElementById('tierUp').addEventListener('click', () => {
    const max = highestUnlockedTier();
    if (save.selectedTier < max) { save.selectedTier++; persistSave(); renderMenu(); }
  });
  document.getElementById('tierDown').addEventListener('click', () => {
    if (save.selectedTier > 1) { save.selectedTier--; persistSave(); renderMenu(); }
  });
  document.getElementById('startBtn').addEventListener('click', () => startBattle());
  document.getElementById('endMenuBtn').addEventListener('click', returnToMenu);
  document.getElementById('devClose').addEventListener('click', closeDevPanel);
  // Ad skip button (simulated ads)
  const adSkip = document.getElementById('adSimSkip');
  if (adSkip) {
    adSkip.addEventListener('click', () => {
      if (!adSkip.disabled) completeSimulatedAd();
    });
  }
  document.querySelectorAll('.submenu-btn').forEach(b => {
    b.addEventListener('click', () => {
      activeSubmenu = b.dataset.tab;
      renderSubmenu();
    });
  });

  setupTapFocus();
  window.addEventListener('resize', () => { if (game.bf) updateBfRect(); });
  if (window.ResizeObserver && game.bf) {
    const ro = new ResizeObserver(() => {
      if (game.bf) updateBfRect();
    });
    ro.observe(game.bf);
  }
  processOfflineProgress();
  if (save.selectedTier > highestUnlockedTier()) save.selectedTier = highestUnlockedTier();
  if (save.settings.gameSpeed > maxUnlockedSpeed()) save.settings.gameSpeed = maxUnlockedSpeed();
  renderHud();
  renderMenu();
  wireBattlefieldSideButtons();
  wireGlobalNav();
  startPassiveAccrual();
  window._autoSaveInterval = setInterval(persistSave, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persistSave();
  });
});

window._game = game;
window._save = () => save;
window._dev = () => { save.settings.devMode = true; persistSave(); openDevPanel(); };
