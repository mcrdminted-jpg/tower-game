// ============================================================
// render.js — DOM rendering for battlefield, enemies, projectiles, gem orbs, floating text.
// Owned by: render AI. Reads game state; writes to battlefield DOM. No gameplay math.
// ============================================================

// ============================================================
// RENDER
// ============================================================
function updateBfRect() {
  if (!game.bf) return;
  game.bfRect = game.bf.getBoundingClientRect();
  game.towerX = game.bfRect.width / 2;
  game.towerY = game.bfRect.height * 0.50; // truly centered
  if (game.towerEl) {
    game.towerEl.style.left = game.towerX + 'px';
    game.towerEl.style.top = game.towerY + 'px';
  }
  updateRangeRing();
}
function updateRangeRing() {
  if (!game.rangeRingEl) return;
  const r = getRange() * 2;
  game.rangeRingEl.style.left = game.towerX + 'px';
  game.rangeRingEl.style.top = game.towerY + 'px';
  game.rangeRingEl.style.width = r + 'px';
  game.rangeRingEl.style.height = r + 'px';
}

function render() {
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (!e.el) {
      e.el = document.createElement('div');
      e.el.className = 'enemy ' + e.type;
      e.hpEl = document.createElement('div');
      e.hpEl.className = 'enemy-hp';
      e.hpFillEl = document.createElement('div');
      e.hpFillEl.className = 'enemy-hp-fill';
      e.hpEl.appendChild(e.hpFillEl);
      e.el.appendChild(e.hpEl);
      // Inner sprite element that rotates independently so the HP bar
      // stays flat while the enemy body rotates toward the tower.
      e.spriteEl = document.createElement('div');
      e.spriteEl.className = 'enemy-sprite';
      e.el.appendChild(e.spriteEl);
      game.bf.appendChild(e.el);
    }
    e.el.style.transform = `translate(${e.x}px, ${e.y}px) translate(-50%, -50%)`;
    // v0.7.19: rotate sprite toward tower. atan2 gives radians; convert to deg.
    // +90 because sprite art is drawn "facing up" by default; we want them facing
    // the tower which is below/center.
    const dx = game.towerX - e.x;
    const dy = game.towerY - e.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (e.spriteEl) e.spriteEl.style.transform = `rotate(${angle}deg)`;
    e.hpFillEl.style.width = (Math.max(0, e.hp) / e.hpMax * 100) + '%';
    if (e.auraBuffed && !e.el.classList.contains('buffed')) e.el.classList.add('buffed');
    else if (!e.auraBuffed && e.el.classList.contains('buffed')) e.el.classList.remove('buffed');
  }
  for (const p of game.projectiles) {
    if (p.dead) continue;
    if (!p.el) {
      p.el = document.createElement('div');
      p.el.className = 'projectile' + (p.crit ? ' crit' : '');
      game.bf.appendChild(p.el);
    }
    p.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }
  for (const ep of game.enemyProjectiles) {
    if (ep.dead) continue;
    if (!ep.el) {
      ep.el = document.createElement('div');
      ep.el.className = 'projectile enemy';
      game.bf.appendChild(ep.el);
    }
    ep.el.style.transform = `translate(${ep.x}px, ${ep.y}px) translate(-50%, -50%)`;
  }
  const hpPct = Math.max(0, game.hp / game.hpMax * 100);
  document.getElementById('hpFill').style.width = hpPct + '%';
  document.getElementById('hpText').textContent = `${Math.max(0, Math.floor(game.hp))} / ${Math.floor(game.hpMax)}`;
  document.getElementById('battleTier').textContent = game.tier;
  document.getElementById('waveNum').textContent = game.wave + (game.bossWave ? ' BOSS' : '');
  document.getElementById('cashDisp').textContent = formatNum(game.cash);
  document.getElementById('waveProg').textContent = `${game.enemiesKilledInWave}/${game.enemiesPerWave}`;
  // HUD resource cards (new for v0.7.7)
  const hudCoinsEl = document.getElementById('hudCoinsValue');
  if (hudCoinsEl) hudCoinsEl.textContent = formatNum(save.coins);
  const hudCashEl = document.getElementById('hudCashValue');
  if (hudCashEl) hudCashEl.textContent = formatNum(game.cash);
  const coinPreview = document.getElementById('coinPreview');
  const newCoins = formatNum(coinRewardForRun(game.wave, game.cashEarnedThisRun));
  if (coinPreview.textContent !== newCoins) {
    coinPreview.textContent = newCoins;
    coinPreview.classList.remove('coin-pulse');
    void coinPreview.offsetWidth;
    coinPreview.classList.add('coin-pulse');
  }
  updateUpgradeAffordability();
  if (document.getElementById('liveStats').classList.contains('open')) renderLiveStats();
  updateRangeRing();
  updateOrbSystem();
}

function flashTower() {
  const base = game.towerEl.querySelector('.tower-base');
  if (!base) return;
  base.style.background = 'radial-gradient(circle at 50% 50%, var(--danger), #660022)';
  setTimeout(() => base.style.background = '', 100);
}

function spawnFloat(x, y, txt, cls) {
  const el = document.createElement('div');
  el.className = 'float-text ' + (cls || 'dmg');
  el.textContent = txt;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  game.bf.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

function showWaveBanner(txt, boss) {
  const el = document.createElement('div');
  el.className = 'wave-banner' + (boss ? ' boss' : '');
  el.textContent = txt;
  game.bf.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ============================================================
// FOCUS TAP
// ============================================================
function setupTapFocus() {
  game.bf.addEventListener('pointerdown', (ev) => {
    if (!game.running) return;
    const now = performance.now();
    if (now - game.lastFocusTime < 2000) return;
    game.lastFocusTime = now;
    const rect = game.bf.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    game.focusTarget = { x, y };
    game.focusShotsRemaining = 3;
    const marker = document.createElement('div');
    marker.className = 'focus-marker';
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    game.bf.appendChild(marker);
    setTimeout(() => marker.remove(), 600);
  });
}

