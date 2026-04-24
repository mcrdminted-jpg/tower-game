// ============================================================
// ui.js — upgrades panel, live stats, HUD, screen routing, main menu, all tab renderers (Research, Goals, Loadout, Store, Skins, Settings), dev panel.
// Owned by: UI AI. Do not put combat math here.
// ============================================================

// ============================================================
// IN-RUN UPGRADES (tabbed)
// ============================================================
let activeUpgradeTab = 'offense';
const UPGRADE_TABS = {
  offense: { title: 'Offense', icon: '🚀', color: 'var(--danger)', keys: ['damage','attackSpeed','critChance','critPower','multishotChance','multishotPower','multishotTargets','bounceChance','bouncePower','bounceTargets'] },
  defense: { title: 'Armor',   icon: '🛡', color: 'var(--accent)', keys: ['health','defense','range','lifesteal','regen'] },
  economy: { title: 'Economy', icon: '💰', color: 'var(--gold)', keys: ['cashBonus','waveBonus','combo','bossBounty','coinBonus'] }
};

// v0.7.15: each in-run upgrade maps to an unlock family. If the family isn't
// owned, the upgrade is hidden from the battle panel.
// null = always visible (starter set).
const UPGRADE_UNLOCK_FAMILY = {
  // Starter — always visible
  damage:           null,
  attackSpeed:      null,
  health:           null,
  defense:          null,
  range:            null,
  cashBonus:        null,
  heal:             null,
  coinBonus:        null,
  // Gated by critSystems
  critChance:       'critSystems',
  critPower:        'critSystems',
  // Gated by economyExpansion
  waveBonus:        'economyExpansion',
  bossBounty:       'economyExpansion',
  // Gated by sustainSystems
  lifesteal:        'sustainSystems',
  regen:            'sustainSystems',
  // Gated by multishotSystems
  multishotChance:  'multishotSystems',
  multishotPower:   'multishotSystems',
  multishotTargets: 'multishotSystems',
  // Gated by bounceSystems
  bounceChance:     'bounceSystems',
  bouncePower:      'bounceSystems',
  bounceTargets:    'bounceSystems',
  // Gated by comboSystems
  combo:            'comboSystems'
};

function upgradeIsVisible(key) {
  const fam = UPGRADE_UNLOCK_FAMILY[key];
  if (!fam) return true;  // always visible
  return familyIsOwned(fam);
}

// Icon metadata per upgrade — rendered as colored tiles on the left of each upgrade button
const UPGRADE_ICONS = {
  damage:           { icon: '🚀', color: 'var(--danger)' },
  attackSpeed:      { icon: '⏫', color: 'var(--accent)' },
  critChance:       { icon: '✦',  color: 'var(--gold)' },
  critPower:        { icon: '✸',  color: 'var(--danger)' },
  multishotChance:  { icon: '↟',  color: 'var(--good)' },
  multishotPower:   { icon: '⇧',  color: 'var(--good)' },
  multishotTargets: { icon: '⋮⋮',  color: 'var(--accent)' },
  bounceChance:     { icon: '⤢',  color: 'var(--purple)' },
  bouncePower:      { icon: '⤨',  color: 'var(--purple)' },
  bounceTargets:    { icon: '⋰⋱',  color: 'var(--purple)' },
  health:           { icon: '♥',  color: 'var(--danger)' },
  defense:          { icon: '🛡', color: 'var(--accent)' },
  range:            { icon: '◎',  color: 'var(--accent)' },
  lifesteal:        { icon: '☖',  color: 'var(--good)' },
  regen:            { icon: '✚',  color: 'var(--good)' },
  cashBonus:        { icon: '$',  color: 'var(--gold)' },
  waveBonus:        { icon: '≋',  color: 'var(--gold)' },
  combo:            { icon: '⚡', color: 'var(--gold)' },
  bossBounty:       { icon: '♛',  color: 'var(--gold)' },
  coinBonus:        { icon: '⊙',  color: 'var(--gold)' }
};

function renderUpgrades() {
  const wrap = document.getElementById('upgradesWrap');
  wrap.innerHTML = '';

  // Top row: heal on left, buy multiplier pill on the right (opposite)
  const topRow = document.createElement('div');
  topRow.className = 'upgrade-heal-slot';
  const healBtn = buildUpgradeBtn('heal');
  topRow.appendChild(healBtn);

  // Buy multiplier pill (mirrors the cost pill style)
  const bm = save.settings.buyMultiplier || 1;
  const bmLabel = bm === 'max' ? 'MAX' : '×' + bm;
  const bmBtn = document.createElement('button');
  bmBtn.className = 'upgrade-bm-btn';
  bmBtn.id = 'upgradeBmBtn';
  bmBtn.innerHTML = `<span class="upgrade-bm-label">BUY</span><span class="upgrade-bm-value">${bmLabel}</span>`;
  bmBtn.addEventListener('click', () => {
    cycleBuyMultiplier();
  });
  topRow.appendChild(bmBtn);
  wrap.appendChild(topRow);

  // Tabs with colored icons
  const tabs = document.createElement('div');
  tabs.className = 'upgrade-tabs';
  for (const tabKey of Object.keys(UPGRADE_TABS)) {
    const t = UPGRADE_TABS[tabKey];
    const btn = document.createElement('button');
    btn.className = 'upgrade-tab' + (activeUpgradeTab === tabKey ? ' active' : '');
    btn.dataset.tab = tabKey;
    btn.style.setProperty('--tab-color', t.color);
    btn.innerHTML = `<span class="upgrade-tab-icon">${t.icon}</span> <span>${t.title}</span>`;
    btn.addEventListener('click', () => {
      activeUpgradeTab = tabKey;
      renderUpgrades();
    });
    tabs.appendChild(btn);
  }
  wrap.appendChild(tabs);

  // Grid — filtered by unlock family (hide locked upgrades entirely)
  const grid = document.createElement('div');
  grid.className = 'upgrade-grid';
  const visibleKeys = UPGRADE_TABS[activeUpgradeTab].keys.filter(upgradeIsVisible);
  if (visibleKeys.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 20px 12px; color: var(--muted); font-size: 10px;';
    empty.innerHTML = `Nothing unlocked in this tab yet.<br><span style="color:var(--accent)">Buy system unlocks in the <b>Ranks</b> tab.</span>`;
    grid.appendChild(empty);
  } else {
    for (const key of visibleKeys) {
      grid.appendChild(buildUpgradeBtn(key));
    }
  }
  wrap.appendChild(grid);
}

function buildUpgradeBtn(key) {
  const u = game.upgrades[key];
  const btn = document.createElement('button');
  btn.className = 'upgrade-btn';
  if (key === 'heal') btn.classList.add('heal');
  btn.dataset.key = key;

  if (key === 'heal') {
    const healAmt = getHealAmount();
    const cost = getHealCost();
    btn.innerHTML = `
      <div class="upgrade-heal-icon">💊</div>
      <div class="upgrade-heal-body">
        <div class="upgrade-heal-name">HEAL</div>
        <div class="upgrade-heal-desc">Instantly restore ${formatNum(healAmt)} HP</div>
      </div>
      <div class="upgrade-heal-delta" data-delta>+${formatNum(healAmt)} HP</div>
      <div class="upgrade-heal-cost" data-cost><span class="cost-cash">$</span>${formatNum(cost)}</div>
    `;
    btn.addEventListener('click', () => buyInRun('heal'));
    return btn;
  }

  const maxed = u.max && u.level >= u.max;
  const desc = upgradeDescriptor(key);
  const deltaText = maxed ? 'MAXED' : `${desc.cur} → ${desc.next}${desc.unit}`;
  const costText = maxed ? '—' : formatNum(upgradeCost(u));
  const iconMeta = UPGRADE_ICONS[key] || { icon: '?', color: 'var(--accent)' };

  // Progress bar: for capped stats, show level/max; for uncapped, show log-scale L up to 500
  let progPct = 0;
  if (u.max) {
    progPct = Math.min(100, (u.level / u.max) * 100);
  } else {
    // Uncapped: just show a fill out to level 500 (purely cosmetic feedback)
    progPct = Math.min(100, (u.level / 500) * 100);
  }

  btn.style.setProperty('--upg-color', iconMeta.color);
  btn.innerHTML = `
    <div class="upgrade-body">
      <div class="upgrade-icon" style="color:${iconMeta.color};border-color:${iconMeta.color}">${iconMeta.icon}</div>
      <div class="upgrade-data">
        <div class="upgrade-name">${u.name.toUpperCase()}</div>
        <div class="upgrade-delta" data-delta>${deltaText}</div>
        <div class="upgrade-level" data-level>Lv. ${u.level}${u.max ? ' / ' + u.max : ''}</div>
      </div>
    </div>
    <div class="upgrade-prog"><div class="upgrade-prog-fill" style="width:${progPct}%;background:${iconMeta.color}"></div></div>
    <div class="upgrade-cost" data-cost><span class="cost-cash">$</span>${costText}</div>
  `;
  attachHoldToBuy(btn, () => buyInRun(key));
  return btn;
}

// Hold-to-buy: tap = 1 buy, hold past 300ms = rapid repeat with acceleration.
// Fixes the old bug where quick taps fired multiple buys.
function attachHoldToBuy(btn, buyFn) {
  let holdStartTime = 0;
  let holdTimer = null;
  let repeating = false;
  let holdInterval = 250;
  let startedRepeat = false;

  function doRepeatBuy() {
    if (!repeating) return;
    const ok = buyFn();
    if (ok === false) {
      stopHold();
      return;
    }
    // Accelerate
    if (holdInterval > 50) {
      holdInterval = Math.max(50, Math.floor(holdInterval * 0.75));
    }
    holdTimer = setTimeout(doRepeatBuy, holdInterval);
  }

  function startHold(ev) {
    if (ev) ev.preventDefault();
    holdStartTime = performance.now();
    repeating = false;
    startedRepeat = false;
    holdInterval = 250;
    // Wait 300ms before starting rapid-fire. This way a quick tap doesn't trigger it.
    holdTimer = setTimeout(() => {
      repeating = true;
      startedRepeat = true;
      doRepeatBuy();
    }, 300);
  }

  function stopHold(ev) {
    if (ev) ev.preventDefault();
    const heldMs = performance.now() - holdStartTime;
    repeating = false;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    // If user released BEFORE the 300ms repeat started, this was a regular tap — fire once now.
    if (!startedRepeat && heldMs < 300 && heldMs > 0) {
      buyFn();
    }
    holdStartTime = 0;
    startedRepeat = false;
  }

  function cancelHold() {
    repeating = false;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    holdStartTime = 0;
    startedRepeat = false;
  }

  btn.addEventListener('pointerdown', startHold);
  btn.addEventListener('pointerup', stopHold);
  btn.addEventListener('pointerleave', cancelHold);
  btn.addEventListener('pointercancel', cancelHold);
  // Block the synthetic click so it doesn't double-fire after pointerup
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
}

function buyInRun(key) {
  const u = game.upgrades[key];
  if (key === 'heal') {
    const cost = getHealCost();
    if (game.cash < cost) return false;
    if (game.hp >= game.hpMax) return false;
    game.cash -= cost;
    const heal = getHealAmount();
    const actual = applyHealToTower(heal);
    if (save.settings.showFloatingHeals) {
      spawnFloat(game.towerX, game.towerY - 30, '+' + actual + ' HP', 'heal');
    }
    game.healsUsed++;
    refreshBtn(key);
    return true;
  }
  // Multi-buy: buy up to 'targetCount' copies respecting affordability and max cap.
  const mulSetting = save.settings.buyMultiplier || 1;
  let maxToBuy;
  if (mulSetting === 'max') {
    maxToBuy = 10000; // effectively "until can't afford / reach max"
  } else {
    maxToBuy = mulSetting;
  }
  let bought = 0;
  while (bought < maxToBuy) {
    if (u.max !== undefined && u.level >= u.max) break;
    const cost = upgradeCost(u);
    if (game.cash < cost) break;
    game.cash -= cost;
    u.level++;
    bought++;
    if (key === 'health') {
      const newMax = getMaxHp();
      const diff = newMax - game.hpMax;
      game.hpMax = newMax;
      game.hp += diff;
    }
  }
  if (bought === 0) return false;
  if (key === 'range') updateRangeRing();
  refreshBtn(key);
  return true;
}

function refreshBtn(key) {
  const btn = document.querySelector(`.upgrade-btn[data-key="${key}"]`);
  if (!btn) return;
  const u = game.upgrades[key];
  if (key === 'heal') {
    const amt = getHealAmount();
    const deltaEl = btn.querySelector('[data-delta]');
    const costEl = btn.querySelector('[data-cost]');
    if (deltaEl) deltaEl.textContent = `+${formatNum(amt)} HP`;
    const descEl = btn.querySelector('.upgrade-heal-desc');
    if (descEl) descEl.textContent = `Instantly restore ${formatNum(amt)} HP`;
    if (costEl) costEl.innerHTML = `<span class="cost-cash">$</span>${formatNum(getHealCost())}`;
  } else {
    const maxed = u.max && u.level >= u.max;
    const desc = upgradeDescriptor(key);
    const deltaEl = btn.querySelector('[data-delta]');
    const levelEl = btn.querySelector('[data-level]');
    const costEl = btn.querySelector('[data-cost]');
    if (deltaEl) deltaEl.textContent = maxed ? 'MAXED' : `${desc.cur} → ${desc.next}${desc.unit}`;
    if (levelEl) levelEl.textContent = `Lv. ${u.level}${u.max ? ' / ' + u.max : ''}`;
    if (costEl) costEl.innerHTML = maxed ? '—' : `<span class="cost-cash">$</span>${formatNum(upgradeCost(u))}`;
    // Update progress bar
    const progFill = btn.querySelector('.upgrade-prog-fill');
    if (progFill) {
      let pct;
      if (u.max) pct = Math.min(100, (u.level / u.max) * 100);
      else pct = Math.min(100, (u.level / 500) * 100);
      progFill.style.width = pct + '%';
    }
  }
  btn.classList.add('pulse-once');
  setTimeout(() => btn.classList.remove('pulse-once'), 250);
}

function updateUpgradeAffordability() {
  const btns = document.querySelectorAll('.upgrade-btn');
  for (const btn of btns) {
    const key = btn.dataset.key;
    if (key === 'heal') {
      const can = game.cash >= getHealCost() && game.hp < game.hpMax;
      btn.disabled = !can;
      btn.classList.toggle('affordable', can);
      const costEl = btn.querySelector('[data-cost]');
      if (costEl) costEl.textContent = '$' + formatNum(getHealCost());
      continue;
    }
    const u = game.upgrades[key];
    const maxed = u.max && u.level >= u.max;
    if (maxed) {
      btn.disabled = true;
      btn.classList.remove('affordable');
      continue;
    }
    const cost = upgradeCost(u);
    const can = game.cash >= cost;
    btn.disabled = !can;
    btn.classList.toggle('affordable', can);
  }
}

// ============================================================
// LIVE STATS
// ============================================================
function renderLiveStats() {
  const el = document.getElementById('liveStats');
  // Expected shots per volley: targets × (1 + chance × power)
  const avgShots = getMultishotTargets() * (1 + getMultishotChance() * getMultishotPower());
  const dps = getDamage() / (getAttackInterval() / 1000) * avgShots;
  const hpNow = enemyHpForWave(game.wave);
  const dmgNow = damageToTowerForWave(game.wave);
  const cashNow = cashRewardForWave(game.wave);
  const speedNow = enemySpeedForWave(game.wave);
  let types = '';
  for (const key of Object.keys(ENEMY_TYPES)) {
    const t = ENEMY_TYPES[key];
    if (key === 'boss' && !game.bossWave) continue;
    if (game.tier < t.unlockTier) continue;
    types += `
      <div style="background:var(--panel-2);border:1px solid var(--accent-dim);border-radius:4px;padding:5px 6px;font-size:10px">
        <div style="color:var(--accent);font-weight:bold;display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <span style="width:10px;height:10px;border-radius:50%;display:inline-block;background:${t.color}"></span>${t.name}
        </div>
        <div style="color:var(--muted);font-size:9px;line-height:1.4">
          HP: <b style="color:var(--text)">${formatNum(Math.floor(hpNow * t.hpMul))}</b><br>
          Dmg: <b style="color:var(--text)">${formatNum(Math.floor(dmgNow * t.dmgMul))}</b><br>
          Spd: <b style="color:var(--text)">${(speedNow * t.speedMul).toFixed(0)} px/s</b>
        </div>
      </div>
    `;
  }
  el.innerHTML = `
    <div class="live-stats-title">Your Core</div>
    <div class="live-stats-grid">
      <div class="live-stat-cell"><div class="live-stat-label">Damage</div><div class="live-stat-val">${formatStat(getDamage())}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">DPS (est)</div><div class="live-stat-val gold">${formatNum(dps)}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Fire Rate</div><div class="live-stat-val">${getAttackSpeed().toFixed(2)}/s</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Max HP</div><div class="live-stat-val">${formatStat(getMaxHp())}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Crit Chance</div><div class="live-stat-val">${(getCritChance() * 100).toFixed(0)}%</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Crit Power</div><div class="live-stat-val">×${getCritPower().toFixed(2)}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Armor</div><div class="live-stat-val good">${(getDefenseFraction() * 100).toFixed(1)}%</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Lifesteal</div><div class="live-stat-val good">${(getLifestealFraction() * 100).toFixed(1)}%</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Regen</div><div class="live-stat-val good">${(getRegenPctPerSec() * 100).toFixed(2)}%/s</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Range</div><div class="live-stat-val">${Math.round(getRange())}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Multishot</div><div class="live-stat-val">${(getMultishotChance()*100).toFixed(0)}% · ×${getMultishotPower().toFixed(2)} · ${getMultishotTargets()}T</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Bounce</div><div class="live-stat-val">${(getBounceChance()*100).toFixed(0)}% · ×${getBouncePower().toFixed(2)} · ${getBounceTargets()}B</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Cash mul</div><div class="live-stat-val gold">×${getCashMul().toFixed(2)}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Combo</div><div class="live-stat-val gold">×${getCurrentComboMul().toFixed(2)} (${Math.floor(game.comboCount)})</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Bosses beat</div><div class="live-stat-val good">${game.bossesDefeated}</div></div>
    </div>
    <div class="live-stats-title">This wave's enemies</div>
    <div class="live-stats-grid">
      <div class="live-stat-cell"><div class="live-stat-label">Base HP</div><div class="live-stat-val danger">${formatNum(hpNow)}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Base Dmg</div><div class="live-stat-val danger">${formatNum(dmgNow)}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Cash/kill</div><div class="live-stat-val gold">${formatNum(cashNow)}</div></div>
      <div class="live-stat-cell"><div class="live-stat-label">Shots to kill</div><div class="live-stat-val">${Math.ceil(hpNow / Math.max(1, getDamage()))}</div></div>
    </div>
    <div class="live-stats-title">Types active</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${types}</div>
  `;
}

function toggleLiveStats() {
  const el = document.getElementById('liveStats');
  el.classList.toggle('open');
  if (el.classList.contains('open')) renderLiveStats();
}

// ============================================================
// HUD
// ============================================================
function renderHud() {
  const hud = document.getElementById('hud');
  const inBattle = game.running;
  if (inBattle) {
    const battleDev = save.settings.devMode ? `<button class="hud-dev-btn" id="hudBattleDevBtn" title="Dev panel">⚙</button>` : '';
    hud.innerHTML = `
      <button class="hud-end-btn" id="hudBackBtn">
        <span class="hud-end-icon">✕</span>
        <span class="hud-end-label">END</span>
      </button>
      <div class="hud-resource-card hud-coins-card" id="hudCoinsCard">
        <div class="hud-resource-icon">⊙</div>
        <div class="hud-resource-stack">
          <div class="hud-resource-label">COINS</div>
          <div class="hud-resource-value" id="hudCoinsValue">${formatNum(save.coins)}</div>
        </div>
      </div>
      <div class="hud-resource-card hud-cash-card" id="hudCashCard">
        <div class="hud-resource-icon">$</div>
        <div class="hud-resource-stack">
          <div class="hud-resource-label">CASH</div>
          <div class="hud-resource-value" id="hudCashValue">${formatNum(game.cash)}</div>
        </div>
      </div>
      ${battleDev}
    `;
    const back = document.getElementById('hudBackBtn');
    if (back) back.addEventListener('click', endRunConfirm);
    const bDev = document.getElementById('hudBattleDevBtn');
    if (bDev) bDev.addEventListener('click', openDevPanel);
  } else {
    const devBtn = save.settings.devMode ? `<button class="hud-dev-pill" id="hudDevBtn">⚙</button>` : '';
    hud.innerHTML = `
      ${devBtn}
      <div class="hud-stat-card hud-stat-coins">
        <div class="hud-stat-icon">⊙</div>
        <div class="hud-stat-body">
          <div class="hud-stat-value">${formatNum(save.coins)}</div>
          <div class="hud-stat-label">COINS</div>
        </div>
      </div>
      <div class="hud-stat-card hud-stat-gems" id="hudGemsCard">
        <div class="hud-stat-icon">◆</div>
        <div class="hud-stat-body">
          <div class="hud-stat-value">${formatNum(save.gems)}</div>
          <div class="hud-stat-label">GEMS</div>
        </div>
        <div class="hud-stat-plus">+</div>
      </div>
      <div class="hud-stat-card hud-stat-best">
        <div class="hud-stat-icon">🏆</div>
        <div class="hud-stat-body">
          <div class="hud-stat-value">W${save.bestWave || 0}</div>
          <div class="hud-stat-label">BEST</div>
        </div>
      </div>
      <div class="hud-stat-card hud-stat-runs">
        <div class="hud-stat-icon">⎍</div>
        <div class="hud-stat-body">
          <div class="hud-stat-value">${save.totalRuns}</div>
          <div class="hud-stat-label">RUNS</div>
        </div>
      </div>
    `;
    const dev = document.getElementById('hudDevBtn');
    if (dev) dev.addEventListener('click', openDevPanel);
    const gemCard = document.getElementById('hudGemsCard');
    if (gemCard) gemCard.addEventListener('click', () => { activeSubmenu = 'shop'; renderSubmenu(); });
  }
  // Side buttons (battlefield left/right) are wired independently — they exist outside hud,
  // see wireBattlefieldSideButtons(). Re-wire on every HUD refresh is not needed.

  // Keep Return to Battle label fresh (shows live HP when in overlay)
  const rtbHp = document.getElementById('returnToBattleHp');
  if (rtbHp) {
    if (game.running) {
      const hp = Math.max(0, Math.floor(game.hp));
      const hpMax = Math.floor(game.hpMax);
      rtbHp.textContent = `W${game.wave} · ${formatNum(hp)}/${formatNum(hpMax)} HP`;
    } else {
      rtbHp.textContent = '';
    }
  }
}

// Cycle buy multiplier 1 → 10 → 100 → max → 1
function cycleBuyMultiplier() {
  const cur = save.settings.buyMultiplier || 1;
  const order = [1, 10, 100, 'max'];
  const idx = order.findIndex(v => v === cur);
  save.settings.buyMultiplier = order[(idx + 1) % order.length];
  persistSave();
  renderHud();
  // If in battle with upgrades visible, also re-render them so their buy multiplier buttons update
  if (game.running) renderUpgrades();
}

// Wire the battlefield side buttons (speed + stats). Called once on DOM ready.
function wireBattlefieldSideButtons() {
  const spd = document.getElementById('bfSpeedBtn');
  if (spd) {
    spd.addEventListener('click', () => {
      const maxSpeed = maxUnlockedSpeed();
      let cur = save.settings.gameSpeed || 1;
      cur = cur + 1;
      if (cur > maxSpeed) cur = 1;
      save.settings.gameSpeed = cur;
      persistSave();
      updateBattlefieldSpeedLabel();
    });
  }
  const stats = document.getElementById('bfStatsBtn');
  if (stats) stats.addEventListener('click', toggleLiveStats);
  updateBattlefieldSpeedLabel();
}

function updateBattlefieldSpeedLabel() {
  const v = document.getElementById('bfSpeedValue');
  if (v) v.textContent = '×' + (save.settings.gameSpeed || 1);
}

// ============================================================
// SCREEN ROUTING
// ============================================================
function showScreen(name) {
  // Always clear overlay mode when transitioning between screens.
  const menu = document.getElementById('screen-menu');
  menu.classList.remove('overlay');
  menu.classList.toggle('active', name === 'menu');
  document.getElementById('screen-battle').classList.toggle('active', name === 'battle');
  renderHud();
  updateGlobalNavActive();
}

// Global nav: bottom bar that switches menu tabs. If user is in battle,
// tapping it asks to end the run first.
function wireGlobalNav() {
  document.querySelectorAll('.global-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;

      // HOME: return to main menu (tier picker view). If mid-battle, close overlay first.
      if (target === 'home') {
        if (isOverlayActive()) closeMenuOverlay();
        if (!game.running) {
          activeSubmenu = 'labs';
          showScreen('menu');
          renderMenu();
        }
        updateGlobalNavActive();
        return;
      }

      // BATTLE: jump back to the active battle. If no battle running, do nothing visible
      // (the user would start one from Begin Defense on home).
      if (target === 'battle') {
        if (game.running) {
          closeMenuOverlay();
          updateGlobalNavActive();
        }
        return;
      }

      // MORE: open a sheet listing Store / Goals / Tourney / Skins / Settings
      if (target === 'more') {
        openMoreSheet();
        return;
      }

      // Otherwise it's a submenu target (labs/cards etc.)
      if (game.running && isOverlayActive() && activeSubmenu === target) {
        closeMenuOverlay();
        return;
      }
      activeSubmenu = target;
      if (game.running) {
        openMenuOverlay();
      } else {
        renderSubmenu();
        showScreen('menu');
      }
    });
  });
  const rtb = document.getElementById('returnToBattleBtn');
  if (rtb) rtb.addEventListener('click', closeMenuOverlay);
}

// The "MORE" sheet — a popover of the less-frequent tabs.
function openMoreSheet() {
  let sheet = document.getElementById('moreSheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'moreSheet';
    sheet.className = 'more-sheet';
    sheet.innerHTML = `
      <div class="more-sheet-backdrop"></div>
      <div class="more-sheet-panel">
        <div class="more-sheet-title">MORE</div>
        <div class="more-sheet-grid">
          <button class="more-sheet-btn" data-more="shop">
            <span class="more-sheet-icon">🛒</span>
            <span class="more-sheet-label">STORE</span>
          </button>
          <button class="more-sheet-btn" data-more="milestones">
            <span class="more-sheet-icon">🎯</span>
            <span class="more-sheet-label">GOALS</span>
          </button>
          <button class="more-sheet-btn" data-more="tournament">
            <span class="more-sheet-icon">🏆</span>
            <span class="more-sheet-label">TOURNEY</span>
          </button>
          <button class="more-sheet-btn" data-more="skins">
            <span class="more-sheet-icon">🎨</span>
            <span class="more-sheet-label">SKINS</span>
          </button>
          <button class="more-sheet-btn" data-more="settings">
            <span class="more-sheet-icon">⚙</span>
            <span class="more-sheet-label">SETTINGS</span>
          </button>
        </div>
        <button class="more-sheet-close">CLOSE</button>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.querySelector('.more-sheet-backdrop').addEventListener('click', closeMoreSheet);
    sheet.querySelector('.more-sheet-close').addEventListener('click', closeMoreSheet);
    sheet.querySelectorAll('.more-sheet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.more;
        activeSubmenu = target;
        closeMoreSheet();
        if (game.running) openMenuOverlay();
        else { renderSubmenu(); showScreen('menu'); }
      });
    });
  }
  sheet.classList.add('visible');
}

function closeMoreSheet() {
  const sheet = document.getElementById('moreSheet');
  if (sheet) sheet.classList.remove('visible');
}

// Show the menu as an overlay on top of an active battle. The battle
// loop keeps running — enemies move, tower fires, death can happen.
function openMenuOverlay() {
  const menu = document.getElementById('screen-menu');
  menu.classList.add('overlay');
  menu.classList.add('active');
  const rtb = document.getElementById('returnToBattleBtn');
  if (rtb) rtb.classList.add('visible');
  renderSubmenu();
  updateGlobalNavActive();
}

// Dismiss the overlay and return to the live battlefield.
function closeMenuOverlay() {
  const menu = document.getElementById('screen-menu');
  menu.classList.remove('overlay');
  menu.classList.remove('active');
  const rtb = document.getElementById('returnToBattleBtn');
  if (rtb) rtb.classList.remove('visible');
  updateGlobalNavActive();
}

// Returns true if menu is currently overlaying a running battle
function isOverlayActive() {
  const menu = document.getElementById('screen-menu');
  return menu && menu.classList.contains('overlay') && menu.classList.contains('active');
}

// Highlight the current nav button based on what's showing.
function updateGlobalNavActive() {
  const onMenu = document.getElementById('screen-menu').classList.contains('active');
  const inBattle = game.running && !isOverlayActive();
  document.querySelectorAll('.global-nav-btn').forEach(btn => {
    const nav = btn.dataset.nav;
    let match = false;
    if (nav === 'home')    match = onMenu && !isOverlayActive();
    else if (nav === 'battle')  match = inBattle;
    else if (nav === 'labs')    match = onMenu && activeSubmenu === 'labs';
    else if (nav === 'cards')   match = onMenu && activeSubmenu === 'cards';
    else if (nav === 'more')    match = false; // more is a sheet trigger, never "active"
    btn.classList.toggle('active', match);
  });
}

// ============================================================
// MAIN MENU
// ============================================================
let activeSubmenu = 'labs';
// (openLabGroups was the old accordion state; replaced by activeLabTab above)

function renderMenu() {
  const sel = save.selectedTier;
  const max = highestUnlockedTier();
  document.getElementById('tierSelected').textContent = sel;
  const mul = tierMultiplier(sel);
  // Build enemy type list for this tier
  const unlockedTypes = [];
  for (const key of Object.keys(ENEMY_TYPES)) {
    if (key === 'boss') continue;
    if (ENEMY_TYPES[key].unlockTier <= sel) unlockedTypes.push(ENEMY_TYPES[key].name);
  }
  const typesStr = unlockedTypes.join(', ');
  document.getElementById('tierMul').textContent = `×${mul.toFixed(2)} · ${typesStr}`;
  document.getElementById('tierDown').disabled = sel <= 1;
  document.getElementById('tierUp').disabled = sel >= max;
  const info = document.getElementById('tierInfo');
  if (sel === max && max < MAX_TIER) {
    const wavesNeeded = 100 - (save.bestWavePerTier[sel] || 0);
    info.textContent = wavesNeeded > 0
      ? `W100 on T${sel} to unlock T${sel + 1}`
      : `T${sel + 1} ready · complete any run`;
  } else if (sel === MAX_TIER) {
    info.textContent = `Max difficulty`;
  } else {
    info.textContent = `Best on T${sel}: W${save.bestWavePerTier[sel] || 0}`;
  }
  document.getElementById('startBtn').textContent = `Begin Defense (T${sel})`;
  // pick a tagline deterministically (doesn't change every render)
  const tag = TAGLINES[save.totalRuns % TAGLINES.length];
  document.getElementById('menuTagline').textContent = tag;

  // v0.7.17: drive the home battlefield preview from the equipped skin
  const previewCore = save.equippedCoreSkin || 'sentinel';
  const previewBg = save.equippedBgSkin || 'cyber_grid';
  document.body.setAttribute('data-preview-core', previewCore);
  document.body.setAttribute('data-preview-bg', previewBg);
  const coreNames = { sentinel:'SENTINEL', industrial:'INDUSTRIAL', verdant:'VERDANT',
                      aegis:'AEGIS', frost:'FROST', royal:'ROYAL' };
  const previewLabel = document.getElementById('menuPreviewLabel');
  if (previewLabel) previewLabel.textContent = `CORE: ${coreNames[previewCore] || 'SENTINEL'}`;

  renderSubmenu();
}

function renderSubmenu() {
  document.querySelectorAll('.submenu-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === activeSubmenu);
  });
  const c = document.getElementById('submenuContent');
  // v0.7.16: prepend a big neon panel title matching the mockup
  const titles = {
    labs:       { t: 'RESEARCH',   s: 'PERMANENT UPGRADES' },
    milestones: { t: 'GOALS',      s: 'EARN REWARDS · GET STRONGER' },
    cards:      { t: 'LOADOUT',    s: 'CARDS' },
    shop:       { t: 'STORE',      s: 'GEMS · COINS · BOOSTERS' },
    skins:      { t: 'SKINS',      s: 'CUSTOMIZE YOUR EXPERIENCE' },
    tournament: { t: 'TOURNAMENT', s: 'COMPETE · RANK UP · EARN REWARDS' },
    settings:   { t: 'SETTINGS',   s: 'CUSTOMIZE YOUR GAME' }
  };
  const info = titles[activeSubmenu];
  const headerHTML = info
    ? `<div class="panel-title">${info.t}</div><div class="panel-subtitle">${info.s}</div>`
    : '';
  c.innerHTML = headerHTML; // reset + set header first
  const inner = document.createElement('div');
  inner.className = 'panel-inner';
  c.appendChild(inner);

  if (activeSubmenu === 'labs')            renderLabsTab(inner);
  else if (activeSubmenu === 'milestones') renderMilestonesTab(inner);
  else if (activeSubmenu === 'cards')      renderCardsTab(inner);
  else if (activeSubmenu === 'shop')       renderShopTab(inner);
  else if (activeSubmenu === 'skins')      renderSkinsTab(inner);
  else if (activeSubmenu === 'tournament') renderTournamentTab(inner);
  else if (activeSubmenu === 'settings')   renderSettingsTab(inner);
  updateGlobalNavActive();
}

let activeLabTab = 'combat';

function renderLabsTab(c) {
  // v0.7.15: labs replaced by ranks + unlock families.
  // Tab shows: (1) unlock family buttons, (2) ranks grouped by family.
  let html = '';

  // --- UNLOCKS SECTION ---
  html += `<div class="lab-tabs"><button class="lab-tab active">Unlocks & Ranks</button></div><div class="lab-tab-body">`;
  html += `<div style="color:var(--muted);font-size:10px;margin-bottom:8px;letter-spacing:0.5px;">PERMANENT UPGRADES · coin-bought · persist across runs</div>`;

  // Starter ranks (always visible)
  html += `<div class="lab-section-header starter">★ STARTER · ALWAYS UNLOCKED</div>`;
  const starterIds = ['damage','fireRate','coreHealth','armor','range','cashBonus'];
  for (const rid of starterIds) html += renderRankRow(rid);

  // Unlock families — either "owned, show ranks" or "purchase button"
  const FAMILY_ICONS = {
    critSystems:       { icon: '✦', color: 'var(--gold)' },
    economyExpansion:  { icon: '$', color: 'var(--gold)' },
    sustainSystems:    { icon: '✚', color: 'var(--good)' },
    multishotSystems:  { icon: '↟', color: 'var(--good)' },
    bounceSystems:     { icon: '⤢', color: 'var(--purple)' },
    comboSystems:      { icon: '⚡', color: 'var(--gold)' }
  };
  const orderedFamilies = Object.values(UNLOCK_FAMILIES).sort((a,b) => a.order - b.order);
  for (const fam of orderedFamilies) {
    if (familyIsOwned(fam.id)) {
      html += `<div class="lab-section-header unlocked">✓ ${fam.name.toUpperCase()} · UNLOCKED</div>`;
      for (const rid of fam.unlocks) {
        if (RANK_DEFS[rid]) html += renderRankRow(rid);
      }
    } else {
      const can = save.coins >= fam.cost;
      const meta = FAMILY_ICONS[fam.id] || { icon: '🔒', color: 'var(--muted)' };
      html += `
        <div class="lab" style="border-color:${can ? 'var(--accent)' : 'var(--accent-dim)'};margin-top:8px;">
          <div class="lab-icon-tile" style="color:${meta.color};border-color:${meta.color}">${meta.icon}</div>
          <div class="lab-header">
            <span class="lab-name">🔒 ${fam.name}</span>
            <span class="lab-level">LOCKED</span>
          </div>
          <div class="lab-desc">Unlocks: ${fam.unlocks.map(r => RANK_DEFS[r] ? RANK_DEFS[r].name : r).join(', ')}</div>
          <div class="lab-stat">&nbsp;</div>
          <button class="lab-buy" data-unlock="${fam.id}" ${can ? '' : 'disabled'}>
            Unlock · ${formatNum(fam.cost)} coins
          </button>
        </div>`;
    }
  }
  html += `</div>`;
  c.innerHTML = html;

  // Wire rank buy buttons
  c.querySelectorAll('.lab-buy[data-rank]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = btn.dataset.rank;
      const mul = save.settings.buyMultiplier || 1;
      const maxToBuy = mul === 'max' ? 10000 : mul;
      let bought = 0;
      while (bought < maxToBuy) {
        if (!purchaseRank(rid)) break;
        bought++;
      }
      if (bought > 0) { renderLabsTab(c); renderHud(); }
    });
  });

  // Wire unlock family buttons
  c.querySelectorAll('.lab-buy[data-unlock]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.unlock;
      if (purchaseUnlockFamily(fid)) {
        renderLabsTab(c);
        renderHud();
      }
    });
  });
}

// v0.7.17: icon + color per rank for the tile-at-left mockup look
const RANK_ICON_META = {
  damage:        { icon: '🚀', color: 'var(--danger)' },
  fireRate:      { icon: '⏫', color: 'var(--accent)' },
  coreHealth:    { icon: '♥',  color: 'var(--danger)' },
  armor:         { icon: '🛡', color: 'var(--accent)' },
  range:         { icon: '◎',  color: 'var(--accent)' },
  cashBonus:     { icon: '$',  color: 'var(--gold)' },
  critChance:    { icon: '✦',  color: 'var(--gold)' },
  critPower:     { icon: '✸',  color: 'var(--danger)' },
  waveBonus:     { icon: '≋',  color: 'var(--gold)' },
  bossBounty:    { icon: '♛',  color: 'var(--gold)' },
  regen:         { icon: '✚',  color: 'var(--good)' },
  lifesteal:     { icon: '☖',  color: 'var(--good)' },
  multiChance:   { icon: '↟',  color: 'var(--good)' },
  multiPower:    { icon: '⇧',  color: 'var(--good)' },
  multiTargets:  { icon: '⋮⋮', color: 'var(--accent)' },
  bounceChance:  { icon: '⤢',  color: 'var(--purple)' },
  bouncePower:   { icon: '⤨',  color: 'var(--purple)' },
  bounceTargets: { icon: '⋰⋱', color: 'var(--purple)' }
};

function renderRankRow(rid) {
  const def = RANK_DEFS[rid];
  const entry = save.ranks[rid] || { level: 0 };
  const maxed = entry.level >= def.maxRank;
  const cost = maxed ? Infinity : rankCost(rid, entry.level);
  const can = save.coins >= cost && !maxed;
  const curBonus = rankFlatBonus(rid);
  const nextBonus = (entry.level + 1) * def.flatPerRank;
  const fmt = (v) => {
    if (Math.abs(v) < 0.01) return v.toFixed(4);
    if (Math.abs(v) < 1) return v.toFixed(3);
    return v.toFixed(1);
  };
  const meta = RANK_ICON_META[rid] || { icon: '◆', color: 'var(--accent)' };
  return `
    <div class="lab" style="--rank-color:${meta.color}">
      <div class="lab-icon-tile" style="color:${meta.color};border-color:${meta.color}">${meta.icon}</div>
      <div class="lab-header">
        <span class="lab-name">${def.name}</span>
        <span class="lab-level">Rank ${entry.level} / ${def.maxRank}</span>
      </div>
      <div class="lab-desc">${def.desc}</div>
      <div class="lab-stat">+${fmt(curBonus)} → +${fmt(nextBonus)}</div>
      <button class="lab-buy ${maxed ? 'maxed' : ''}" data-rank="${rid}" ${maxed || !can ? 'disabled' : ''}>
        ${maxed ? 'MAXED' : `Rank Up · ${formatNum(cost)} coins`}
      </button>
    </div>`;
}

let activeGoalTier = 1;

function renderMilestonesTab(c) {
  const unlockedTier = highestUnlockedTier();
  if (activeGoalTier > unlockedTier) activeGoalTier = unlockedTier;
  if (activeGoalTier < 1) activeGoalTier = 1;

  // Count ready-to-claim milestones per tier for badge
  const readyCounts = {};
  for (let t = 1; t <= unlockedTier; t++) {
    let n = 0;
    for (const w of MILESTONE_WAVES) {
      if (milestoneReady(t, w) && !save.claimedMilestones[milestoneKey(t, w)]) n++;
    }
    readyCounts[t] = n;
  }

  // v0.7.17: Tier hex progression bar — all 18 tiers, scrollable horizontally
  let html = `<div class="tier-hex-strip">`;
  for (let t = 1; t <= MAX_TIER; t++) {
    const state = t > unlockedTier ? 'locked'
                : t === activeGoalTier ? 'current'
                : 'unlocked';
    const badge = readyCounts[t] > 0 ? `<span class="tier-hex-badge">${readyCounts[t]}</span>` : '';
    html += `<button class="tier-hex ${state}" data-ghex="${t}" ${t > unlockedTier ? 'disabled' : ''}>T${t}${badge}</button>`;
  }
  html += `</div>`;

  // Tier tab bar (horizontal scroll if many tiers)
  html += `<div class="goal-tier-tabs">`;
  for (let t = 1; t <= unlockedTier; t++) {
    const badge = readyCounts[t] > 0 ? `<span class="goal-tier-badge">${readyCounts[t]}</span>` : '';
    html += `<button class="goal-tier-tab ${activeGoalTier === t ? 'active' : ''}" data-gt="${t}">T${t}${badge}</button>`;
  }
  html += `</div>`;

  // Current tier's best
  html += `<div class="milestone-tier-header">Tier ${activeGoalTier} · best W${save.bestWavePerTier[activeGoalTier] || 0}</div>`;

  // Milestones for the active tier only
  for (const w of MILESTONE_WAVES) {
    const key = milestoneKey(activeGoalTier, w);
    const claimed = save.claimedMilestones[key];
    const ready = milestoneReady(activeGoalTier, w) && !claimed;
    const r = milestoneReward(activeGoalTier, w);
    const gemPart = r.gems > 0 ? ` + <b class="gem">${r.gems} gems</b>` : '';
    const stateClass = claimed ? 'claimed' : ready ? 'ready' : '';
    const btnText = claimed ? 'Claimed' : ready ? 'Claim' : 'Locked';
    html += `
      <div class="milestone ${stateClass}">
        <div class="milestone-info">
          <div class="milestone-target">Wave ${w}</div>
          <div class="milestone-reward"><b>${formatNum(r.coins)}</b> coins${gemPart}</div>
        </div>
        <button class="milestone-btn ${!ready ? 'locked' : ''}" data-tier="${activeGoalTier}" data-wave="${w}" ${!ready ? 'disabled' : ''}>
          ${btnText}
        </button>
      </div>
    `;
  }

  c.innerHTML = html;
  c.querySelectorAll('.tier-hex').forEach(h => {
    if (h.disabled) return;
    h.addEventListener('click', () => {
      const t = parseInt(h.dataset.ghex);
      if (t && t <= highestUnlockedTier()) {
        activeGoalTier = t;
        renderMilestonesTab(c);
      }
    });
  });
  c.querySelectorAll('.goal-tier-tab').forEach(t => {
    t.addEventListener('click', () => {
      activeGoalTier = parseInt(t.dataset.gt);
      renderMilestonesTab(c);
    });
  });
  c.querySelectorAll('.milestone-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => claimMilestone(parseInt(btn.dataset.tier), parseInt(btn.dataset.wave)));
  });
}

// State for the cards tab selection flow.
// When user taps an empty slot, we store the slot index here and let
// them tap an inventory card to fill it.
let cardSelectingSlot = -1;

function renderCardsTab(c) {
  const ownedIds = Object.keys(save.cardInventory).filter(id => CARD_POOL[id]);
  const slots = getUnlockedSlots();
  // Ensure equippedCards array matches slots length
  while (save.equippedCards.length < slots) save.equippedCards.push(null);
  const equipped = save.equippedCards;

  // Header + slot row
  let html = `
    <div class="cards-header">
      <div class="cards-header-title">Equipped</div>
      <div class="cards-header-sub">${slots} / ${MAX_SLOTS} slots unlocked</div>
    </div>
    <div class="card-slots">`;
  for (let i = 0; i < slots; i++) {
    const cardId = equipped[i];
    const selecting = cardSelectingSlot === i;
    if (cardId && CARD_POOL[cardId]) {
      const card = CARD_POOL[cardId];
      const inv = save.cardInventory[cardId] || { level: 1 };
      const tierColor = CARD_TIER_COLORS[card.tier];
      // Special cards have object values; just show the level for them.
      let bonusLabel;
      const v = card.values[Math.max(0, Math.min(4, inv.level - 1))];
      if (typeof v === 'number') {
        const pct = v * 100;
        // Small values (under 10%) need one decimal so 0.2% doesn't read "0%"
        bonusLabel = `+${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`;
      } else {
        bonusLabel = `Lv${inv.level}`;
      }
      html += `
        <div class="card-slot filled" data-slot="${i}" style="background:${tierColor.bg};border-color:${tierColor.border}">
          <div class="card-slot-icon">${card.icon}</div>
          <div class="card-slot-name">${card.name}</div>
          <div class="card-slot-lvl">Lv${inv.level} · ${bonusLabel}</div>
        </div>`;
    } else {
      html += `
        <div class="card-slot ${selecting ? 'selecting' : 'empty'}" data-slot="${i}">
          <div class="card-slot-empty-plus">+</div>
          <div class="card-slot-empty-label">${selecting ? 'pick card' : 'empty'}</div>
        </div>`;
    }
  }
  html += `</div>`;

  // Next slot unlock button
  const nextSlotCost = getNextSlotCost();
  if (nextSlotCost !== null) {
    const canAfford = save.gems >= nextSlotCost;
    html += `
      <button class="card-slot-unlock-btn ${canAfford ? 'affordable' : ''}" id="cardSlotUnlockBtn" ${canAfford ? '' : 'disabled'}>
        <span class="slot-unlock-label">Unlock Slot ${slots + 1}</span>
        <span class="slot-unlock-cost">${nextSlotCost} 💎</span>
      </button>`;
  } else {
    html += `<div class="card-slot-unlock-btn maxed">All slots unlocked</div>`;
  }

  // Card bucket summary — shows cumulative bonuses for all active buckets
  const bucketLabels = [
    { key: 'damage',       label: '💥 dmg',       pct: true },
    { key: 'attackSpeed',  label: '⏫ fire rate', pct: true },
    { key: 'health',       label: '🛡 HP',        pct: true },
    { key: 'range',        label: '◎ range',     pct: true },
    { key: 'defense',      label: '🔰 armor',    pct: true, flat: true },
    { key: 'lifesteal',    label: '🩸 lifesteal', pct: true },
    { key: 'regen',        label: '✚ regen',      pct: true },
    { key: 'crit',         label: '🎯 crit',      pct: true, flat: true },
    { key: 'critPower',    label: '✸ crit pwr',   pct: true },
    { key: 'cash',         label: '💰 cash',      pct: true },
    { key: 'coinGain',     label: '⊙ coin gain',  pct: true },
    { key: 'waveBonus',    label: '≋ wave bonus', pct: true },
    { key: 'multiChance',  label: '⌘ multi%',     pct: true, flat: true },
    { key: 'multiPower',   label: '✚ multi pwr',  pct: true },
    { key: 'bounceChance', label: '⤢ bounce%',    pct: true, flat: true },
    { key: 'bouncePower',  label: '⤨ bounce pwr', pct: true },
    { key: 'bossDmg',      label: '♛ boss dmg',   pct: true },
    { key: 'bossBounty',   label: '♛ boss bounty',pct: true }
  ];
  const activeBuckets = [];
  for (const b of bucketLabels) {
    const v = getCardBucket(b.key);
    if (v > 0) {
      const pct = v * 100;
      const label = pct < 10 ? pct.toFixed(1) : pct.toFixed(0);
      activeBuckets.push(`<span>${b.label} +${label}%</span>`);
    }
  }
  // Apex specials
  if (getEquippedSpecialLevel('stormThread'))  activeBuckets.push('<span>⚡ Storm Thread</span>');
  if (getEquippedSpecialLevel('bulwarkVeil'))  activeBuckets.push('<span>⛨ Bulwark</span>');
  if (getEquippedSpecialLevel('predatorLoop')) activeBuckets.push('<span>👁 Predator</span>');
  if (getEquippedSpecialLevel('timeLock'))     activeBuckets.push('<span>❄ Time Lock</span>');
  if (getEquippedSpecialLevel('lastStand'))    activeBuckets.push('<span>☠ Last Stand</span>');
  if (activeBuckets.length) {
    html += `<div class="card-bucket-summary">${activeBuckets.join('')}</div>`;
  }

  // Inventory
  html += `<div class="cards-section-title">Inventory · ${ownedIds.length} / ${Object.keys(CARD_POOL).length}</div>`;

  if (ownedIds.length === 0) {
    html += `
      <div class="shop-coming">
        <div class="shop-coming-item">
          <div class="shop-coming-icon">🎴</div>
          <div class="shop-coming-text">
            <b>No cards yet</b><br>
            <span>Open the Shop tab to pull cards with gems. Dev panel can also add cards for testing.</span>
          </div>
        </div>
      </div>`;
  } else {
    // Group by tier so Apex/Prime stand out
    const byTier = { apex: [], prime: [], standard: [] };
    for (const id of ownedIds) byTier[CARD_POOL[id].tier].push(id);

    for (const tier of ['apex', 'prime', 'standard']) {
      if (byTier[tier].length === 0) continue;
      const tc = CARD_TIER_COLORS[tier];
      html += `<div class="cards-subsection-title" style="color:${tc.nameColor}">${tc.name}</div>`;
      html += `<div class="card-inventory">`;
      for (const id of byTier[tier]) {
        const card = CARD_POOL[id];
        const inv = save.cardInventory[id];
        const tierColor = CARD_TIER_COLORS[card.tier];
        const isEquipped = equipped.includes(id);
        // Bonus label — handle special vs number values
        const v = card.values[Math.max(0, Math.min(4, inv.level - 1))];
        let bonusLabel;
        if (typeof v === 'number') {
          const pct = v * 100;
          bonusLabel = `+${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`;
        } else {
          bonusLabel = `Lv${inv.level}`;
        }
        // Copies progress to next level
        const thresholds = COPIES_TO_LEVEL[card.tier];
        let copyLabel;
        if (inv.level >= 5) {
          copyLabel = `MAX (${inv.copies} copies)`;
        } else {
          const next = thresholds[inv.level];
          copyLabel = `${inv.copies} / ${next} copies`;
        }
        html += `
          <div class="card-tile ${isEquipped ? 'equipped' : ''}" data-card="${id}" style="border-color:${tierColor.border}">
            <div class="card-tile-head" style="background:${tierColor.bg}">
              <span class="card-tile-icon">${card.icon}</span>
              <span class="card-tile-tier" style="color:${tierColor.nameColor}">${tierColor.name}</span>
            </div>
            <div class="card-tile-name">${card.name}</div>
            <div class="card-tile-stat">${bonusLabel} · Lv ${inv.level}/5</div>
            <div class="card-tile-copies">${copyLabel}</div>
            ${isEquipped ? `<div class="card-tile-badge">EQUIPPED</div>` : ''}
          </div>`;
      }
      html += `</div>`;
    }
  }

  c.innerHTML = html;

  // Slot unlock button
  const slotBtn = document.getElementById('cardSlotUnlockBtn');
  if (slotBtn) {
    slotBtn.addEventListener('click', () => {
      if (unlockNextSlot()) {
        renderCardsTab(c);
        renderHud();
      }
    });
  }

  // Wire slot taps
  c.querySelectorAll('.card-slot').forEach(slotEl => {
    slotEl.addEventListener('click', () => {
      const idx = parseInt(slotEl.dataset.slot);
      const equippedNow = save.equippedCards[idx];
      if (equippedNow) {
        save.equippedCards[idx] = null;
        cardSelectingSlot = -1;
        persistSave();
        renderCardsTab(c);
      } else {
        cardSelectingSlot = (cardSelectingSlot === idx) ? -1 : idx;
        renderCardsTab(c);
      }
    });
  });

  // Wire card tile taps
  c.querySelectorAll('.card-tile').forEach(tileEl => {
    tileEl.addEventListener('click', () => {
      const cardId = tileEl.dataset.card;
      const equippedIdx = save.equippedCards.indexOf(cardId);
      if (equippedIdx !== -1) {
        save.equippedCards[equippedIdx] = null;
        cardSelectingSlot = -1;
      } else if (cardSelectingSlot !== -1) {
        save.equippedCards[cardSelectingSlot] = cardId;
        cardSelectingSlot = -1;
      } else {
        const firstEmpty = save.equippedCards.indexOf(null);
        if (firstEmpty !== -1) {
          save.equippedCards[firstEmpty] = cardId;
        }
      }
      persistSave();
      renderCardsTab(c);
    });
  });
}

function renderShopTab(c) {
  const now = Date.now();
  const lastAd = save.lastAdRewardTime || 0;
  const cooldownMs = 24 * 60 * 60 * 1000;
  const remaining = Math.max(0, cooldownMs - (now - lastAd));
  const available = remaining === 0;
  const hrLeft = Math.ceil(remaining / (60 * 60 * 1000));

  // Direct unlock list — only cards not yet owned
  const unownedStandard = Object.values(CARD_POOL).filter(c => c.tier === 'standard' && !save.cardInventory[c.id]);
  const unownedPrime = Object.values(CARD_POOL).filter(c => c.tier === 'prime' && !save.cardInventory[c.id]);

  const singlePullDisabled = save.gems < CARD_PRICING.pullSingle;
  const bundleDisabled = save.gems < CARD_PRICING.pullBundle;

  c.innerHTML = `
    <div class="shop-section-title">Free Gems</div>
    <div class="lab">
      <div class="lab-header">
        <span class="lab-name">📺 Daily Ad Reward</span>
        <span class="lab-level">+20 💎</span>
      </div>
      <div class="lab-desc">Watch a 30-second ad, get 20 gems. Available once every 24 hours. Ads are opt-in and support the game's development.</div>
      <button class="lab-buy" id="shopAdBtn" ${!available ? 'disabled' : ''}>
        ${available ? 'Watch Ad · +20 💎' : `Available in ${hrLeft}h`}
      </button>
    </div>

    <div class="shop-section-title">Card Packs</div>
    <div class="shop-section-sub">78% Standard · 20% Prime · 2% Apex · Duplicates level cards</div>
    <div class="card-pack-grid">
      <button class="card-pack-btn" id="cardPullSingleBtn" ${singlePullDisabled ? 'disabled' : ''}>
        <div class="pack-title">Single Pull</div>
        <div class="pack-desc">1 random card</div>
        <div class="pack-cost">${CARD_PRICING.pullSingle} 💎</div>
      </button>
      <button class="card-pack-btn bundle" id="cardPullBundleBtn" ${bundleDisabled ? 'disabled' : ''}>
        <div class="pack-title">10-Pull Bundle</div>
        <div class="pack-desc">10 random cards · save 20💎</div>
        <div class="pack-cost">${CARD_PRICING.pullBundle} 💎</div>
      </button>
    </div>

    ${unownedStandard.length > 0 || unownedPrime.length > 0 ? `
      <div class="shop-section-title">Direct Unlock</div>
      <div class="shop-section-sub">Buy a specific new card you don't own yet</div>
      <div class="direct-unlock-list">
        ${unownedPrime.map(card => {
          const disabled = save.gems < CARD_PRICING.unlockPrime;
          return `
          <button class="direct-unlock-btn prime" data-unlock="${card.id}" ${disabled ? 'disabled' : ''}>
            <span class="du-icon">${card.icon}</span>
            <span class="du-info">
              <span class="du-name" style="color:var(--purple)">${card.name}</span>
              <span class="du-tier">PRIME</span>
            </span>
            <span class="du-cost">${CARD_PRICING.unlockPrime} 💎</span>
          </button>`;
        }).join('')}
        ${unownedStandard.map(card => {
          const disabled = save.gems < CARD_PRICING.unlockStandard;
          return `
          <button class="direct-unlock-btn standard" data-unlock="${card.id}" ${disabled ? 'disabled' : ''}>
            <span class="du-icon">${card.icon}</span>
            <span class="du-info">
              <span class="du-name">${card.name}</span>
              <span class="du-tier">STANDARD</span>
            </span>
            <span class="du-cost">${CARD_PRICING.unlockStandard} 💎</span>
          </button>`;
        }).join('')}
      </div>
    ` : ''}

    <div class="shop-section-title">Coming Soon</div>
    <div class="shop-coming">
      <div class="shop-coming-item">
        <div class="shop-coming-icon">💎</div>
        <div class="shop-coming-text">
          <b>Gem Packs</b><br>
          <span>v0.8 · $0.99 starter, $4.99 starter bundle, $9.99 monthly pass, etc.</span>
        </div>
      </div>
      <div class="shop-coming-item">
        <div class="shop-coming-icon">✨</div>
        <div class="shop-coming-text">
          <b>Apex Shards</b><br>
          <span>v0.8 · Deterministic progress to Apex cards via shards/pity.</span>
        </div>
      </div>
      <div class="shop-coming-item">
        <div class="shop-coming-icon">🏆</div>
        <div class="shop-coming-text">
          <b>Tournaments</b><br>
          <span>v0.9 · Weekly brackets. Card rewards top spots.</span>
        </div>
      </div>
    </div>
  `;

  const adBtn = document.getElementById('shopAdBtn');
  if (adBtn && available) {
    adBtn.addEventListener('click', () => {
      showSimulatedAd('Free Gems (+20 💎)', 'Thanks for supporting the game. Real ads will launch with the beta.', () => {
        save.gems += 20;
        save.lastAdRewardTime = Date.now();
        persistSave();
        renderHud();
        renderSubmenu();
      });
    });
  }

  // Single pull
  const pullBtn = document.getElementById('cardPullSingleBtn');
  if (pullBtn) {
    pullBtn.addEventListener('click', () => {
      const result = performPull();
      if (result) {
        showPullReveal([result]);
        renderHud();
        renderSubmenu();
      }
    });
  }

  // Bundle pull
  const bundleBtn = document.getElementById('cardPullBundleBtn');
  if (bundleBtn) {
    bundleBtn.addEventListener('click', () => {
      const results = performBundle();
      if (results) {
        showPullReveal(results);
        renderHud();
        renderSubmenu();
      }
    });
  }

  // Direct unlock buttons
  c.querySelectorAll('.direct-unlock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.unlock;
      const result = performDirectUnlock(id);
      if (result) {
        showPullReveal([result]);
        renderHud();
        renderSubmenu();
      }
    });
  });
}

// Reveal a pull result as a full-screen overlay
function showPullReveal(results) {
  const overlay = document.createElement('div');
  overlay.className = 'pull-reveal-overlay';
  const grid = results.map(r => {
    const card = r.card;
    const tc = CARD_TIER_COLORS[card.tier];
    const badge = r.newlyUnlocked ? '<div class="pull-badge new">NEW!</div>'
                : r.leveledUp ? `<div class="pull-badge up">LV UP → ${r.level}</div>`
                : `<div class="pull-badge dup">DUPE +1</div>`;
    return `
      <div class="pull-card" style="border-color:${tc.border}; background:${tc.bg}">
        <div class="pull-card-icon">${card.icon}</div>
        <div class="pull-card-tier" style="color:${tc.nameColor}">${tc.name}</div>
        <div class="pull-card-name">${card.name}</div>
        ${badge}
      </div>`;
  }).join('');
  overlay.innerHTML = `
    <div class="pull-reveal-card">
      <div class="pull-reveal-title">${results.length === 1 ? 'You got:' : `${results.length} Cards`}</div>
      <div class="pull-reveal-grid">${grid}</div>
      <button class="pull-reveal-btn" id="pullRevealClose">Continue</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('pullRevealClose').addEventListener('click', () => {
    overlay.remove();
    // Re-render the shop so newly-owned cards are removed from direct-unlock list
    renderSubmenu();
  });
}

// ============================================================
// SKINS TAB — cosmetic only, no gameplay effect
// ============================================================
function renderSkinsTab(c) {
  // Reflect the currently-equipped skins from save.
  // Defaults: null = no skin equipped → uses original CSS tower/bg.
  const equippedCore = (save.equippedCoreSkin || null);
  const equippedBg   = (save.equippedBgSkin   || null);

  // Core skins — IDs match /assets/cores/ filenames and css/skins.css selectors.
  // All are free/owned right now for testing; economy wiring is a later pass.
  const coreSkins = [
    { id: 'sentinel',   name: 'Sentinel',   cost: 0 },
    { id: 'industrial', name: 'Industrial', cost: 0 },
    { id: 'verdant',    name: 'Verdant',    cost: 0 },
    { id: 'aegis',      name: 'Aegis',      cost: 0 },
    { id: 'frost',      name: 'Frost',      cost: 0 },
    { id: 'royal',      name: 'Royal',      cost: 0 }
  ];

  const bgSkins = [
    { id: 'cyber_grid', name: 'Cyber Grid', cost: 0 },
    { id: 'industrial', name: 'Reactor',    cost: 0 },
    { id: 'organic',    name: 'Organic',    cost: 0 },
    { id: 'steel',      name: 'Steel Bay',  cost: 0 }
  ];

  const tileHTML = (s, kind, equippedId) => {
    const isEquipped = s.id === equippedId;
    const statusLabel = isEquipped ? 'EQUIPPED' : 'Equip';
    const statusClass = isEquipped ? 'equipped' : 'owned';
    return `
      <div class="skin-tile ${statusClass}" data-skin="${s.id}" data-kind="${kind}">
        <div class="skin-preview"></div>
        <div class="skin-name">${s.name}</div>
        <div class="skin-status">${statusLabel}</div>
      </div>`;
  };

  c.innerHTML = `
    <div class="shop-section-title">Core Skins</div>
    <div class="shop-section-sub">Change the look of your Core · cosmetic only</div>
    <div class="skin-grid">
      ${coreSkins.map(s => tileHTML(s, 'core', equippedCore)).join('')}
    </div>

    <div class="shop-section-title">Background Skins</div>
    <div class="shop-section-sub">Change the battlefield backdrop</div>
    <div class="skin-grid">
      ${bgSkins.map(s => tileHTML(s, 'bg', equippedBg)).join('')}
    </div>

    <div class="shop-section-title">Coming Soon</div>
    <div class="shop-coming">
      <div class="shop-coming-item">
        <div class="shop-coming-icon">🎯</div>
        <div class="shop-coming-text">
          <b>Projectile Skins</b><br>
          <span>Pulse bolts, beam bursts, arc chains — art ready, wiring pending.</span>
        </div>
      </div>
      <div class="shop-coming-item">
        <div class="shop-coming-icon">🎛️</div>
        <div class="shop-coming-text">
          <b>UI Themes</b><br>
          <span>Reskin the HUD and menus.</span>
        </div>
      </div>
      <div class="shop-coming-item">
        <div class="shop-coming-icon">🎁</div>
        <div class="shop-coming-text">
          <b>Skin Bundles</b><br>
          <span>Matching Core + background pairs.</span>
        </div>
      </div>
    </div>
  `;

  c.querySelectorAll('.skin-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.getAttribute('data-skin');
      const kind = tile.getAttribute('data-kind');
      if (kind === 'core' && typeof equipCoreSkin === 'function') equipCoreSkin(id);
      if (kind === 'bg'   && typeof equipBgSkin   === 'function') equipBgSkin(id);
      renderSkinsTab(c); // re-render to update EQUIPPED label
    });
  });
}

function renderSettingsTab(c) {
  c.innerHTML = '';
  // Theme picker
  const themes = [
    { key: 'neon',   name: 'Neon',   swatch: ['#00f0ff','#ff3366','#ffcc00'] },
    { key: 'steel',  name: 'Steel',  swatch: ['#8ab4d8','#d66272','#d4b66a'] },
    { key: 'amber',  name: 'Amber',  swatch: ['#ffaa44','#dd5544','#ffdd66'] },
    { key: 'forest', name: 'Forest', swatch: ['#6dd47e','#cc6a5a','#d4b866'] },
    { key: 'royal',  name: 'Royal',  swatch: ['#b488e8','#d66288','#e0b8e8'] },
    { key: 'mono',   name: 'Mono',   swatch: ['#e0e0e0','#c0c0c0','#f0f0f0'] }
  ];
  const themeWrap = document.createElement('div');
  themeWrap.innerHTML = `<div style="color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:bold">Theme</div>`;
  const pickerEl = document.createElement('div');
  pickerEl.className = 'theme-picker';
  pickerEl.style.gridTemplateColumns = 'repeat(3, 1fr)';
  for (const t of themes) {
    const opt = document.createElement('div');
    opt.className = 'theme-opt' + (save.settings.theme === t.key ? ' active' : '');
    opt.dataset.theme = t.key;
    opt.innerHTML = `${t.name}<div class="theme-swatch">${t.swatch.map(s => `<span class="theme-swatch-dot" style="background:${s}"></span>`).join('')}</div>`;
    opt.addEventListener('click', () => {
      save.settings.theme = t.key;
      document.documentElement.dataset.theme = t.key;
      persistSave();
      renderSettingsTab(c);
    });
    pickerEl.appendChild(opt);
  }
  themeWrap.appendChild(pickerEl);
  themeWrap.appendChild(Object.assign(document.createElement('div'), { style: 'height:14px' }));
  c.appendChild(themeWrap);

  const settings = [
    { key: 'showFloatingDamage', label: 'Damage numbers', desc: 'Show floating damage on enemy hits' },
    { key: 'showFloatingCash',   label: 'Cash numbers',   desc: 'Show +$N on kills' },
    { key: 'showFloatingHeals',  label: 'Heal numbers',   desc: 'Show heal amounts' }
  ];
  for (const s of settings) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = `
      <div>
        <div class="setting-label">${s.label}</div>
        <div class="setting-desc">${s.desc}</div>
      </div>
      <div class="toggle ${save.settings[s.key] ? 'on' : ''}" data-key="${s.key}"></div>
    `;
    row.querySelector('.toggle').addEventListener('click', (e) => {
      const k = e.currentTarget.dataset.key;
      save.settings[k] = !save.settings[k];
      e.currentTarget.classList.toggle('on');
      persistSave();
    });
    c.appendChild(row);
  }

  const totalMin = (save.totalPlaytimeMs / 60000).toFixed(1);
  const statsBox = document.createElement('div');
  statsBox.className = 'lab';
  statsBox.style.marginTop = '14px';
  statsBox.innerHTML = `
    <div class="lab-name">Lifetime</div>
    <div class="lab-stat" style="color:var(--text);font-size:10px;line-height:1.7">
      Runs: <b>${save.totalRuns}</b> · Best: <b>T${save.bestTier}·W${save.bestWave}</b><br>
      Tiers unlocked: <b>${highestUnlockedTier()}/${MAX_TIER}</b><br>
      Enemies killed: <b>${formatNum(save.totalEnemiesKilled)}</b><br>
      Cash lifetime: <b>${formatNum(save.totalCashEarned)}</b><br>
      Playtime: <b>${totalMin} min</b> · Offline cap: <b>${offlineCapMinutes().toFixed(0)} min</b>
    </div>
  `;
  c.appendChild(statsBox);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'lab-buy';
  resetBtn.style.cssText = 'background:var(--danger);border-color:var(--danger);color:white;margin-top:14px';
  resetBtn.textContent = 'RESET ALL PROGRESS';
  resetBtn.addEventListener('click', resetSave);
  c.appendChild(resetBtn);

  // Version text — tap 7 times to unlock dev panel
  const ver = document.createElement('div');
  ver.style.cssText = 'text-align:center;color:var(--muted);font-size:9px;margin-top:12px;line-height:1.5;cursor:pointer;padding:10px;user-select:none';
  const verDefault = 'Core Surge v0.7.20 · Nav Redesign · tap 7× for dev tools';
  ver.textContent = verDefault;
  let tapCount = 0;
  let tapTimer = null;
  ver.addEventListener('click', () => {
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      tapCount = 0;
      ver.textContent = verDefault;
    }, 2000);
    if (tapCount >= 7) {
      tapCount = 0;
      ver.textContent = '✓ DEV MODE ACTIVATED';
      save.settings.devMode = true;
      persistSave();
      setTimeout(() => {
        ver.textContent = verDefault;
        openDevPanel();
        renderSettingsTab(c);
        renderHud();
      }, 400);
    } else if (tapCount >= 3) {
      ver.textContent = `${7 - tapCount} more...`;
    }
  });
  c.appendChild(ver);

  if (save.settings.devMode) {
    const devBtn = document.createElement('button');
    devBtn.className = 'lab-buy';
    devBtn.style.cssText = 'background:var(--gold);color:var(--bg);border-color:var(--gold);margin-top:8px;font-weight:bold';
    devBtn.textContent = '⚙ OPEN DEV PANEL';
    devBtn.addEventListener('click', openDevPanel);
    c.appendChild(devBtn);
  }
}

// ============================================================
// DEV PANEL
// ============================================================
function openDevPanel() {
  document.getElementById('devPanel').classList.add('active');
  renderDevPanel();
}
function closeDevPanel() {
  document.getElementById('devPanel').classList.remove('active');
}
function renderDevPanel() {
  const body = document.getElementById('devBody');
  const inBattle = game.running;
  body.innerHTML = `
    <div class="dev-info">
      Dev cheats — useful for testing. Close this panel to resume.
      Changes apply immediately. Battle state: <b>${inBattle ? 'IN BATTLE' : 'IN MENU'}</b>
    </div>

    <div class="dev-section">Currency</div>
    <button class="dev-btn" data-act="coins1k">+ 1,000 coins</button>
    <button class="dev-btn" data-act="coins100k">+ 100,000 coins</button>
    <button class="dev-btn" data-act="coins10m">+ 10,000,000 coins</button>
    <button class="dev-btn" data-act="gems100">+ 100 gems</button>
    <button class="dev-btn" data-act="coins1b">+ 1,000,000,000 coins</button>
    <button class="dev-btn" data-act="gems10k">+ 10,000 gems</button>

    <div class="dev-section">Progression</div>
    <button class="dev-btn" data-act="maxLabs">Max all labs</button>
    <button class="dev-btn" data-act="unlockTiers">Unlock all tiers</button>
    <button class="dev-btn" data-act="maxSpeed">Max game speed (3×)</button>
    <button class="dev-btn" data-act="setBestWave">Set best to W1000 on T1</button>

    <div class="dev-section">In-Battle (battle only)</div>
    <button class="dev-btn" data-act="fullHeal" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>Full heal</button>
    <button class="dev-btn" data-act="killAll" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>Kill all enemies</button>
    <button class="dev-btn" data-act="spawnBoss" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>Force spawn boss</button>
    <button class="dev-btn" data-act="maxInRun" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>Max in-run (L200)</button>
    <button class="dev-btn" data-act="trueMaxInRun" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>TRUE max (L5000)</button>
    <button class="dev-btn" data-act="cash10k" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>+ 10,000 cash</button>
    <button class="dev-btn" data-act="addWave" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>Skip to next wave</button>

    <div class="dev-section">Starting Wave (next battle)</div>
    <button class="dev-btn" data-act="jumpW50">Start next run at W50</button>
    <button class="dev-btn" data-act="jumpW100">Start next run at W100</button>
    <button class="dev-btn" data-act="jumpW500">Start next run at W500</button>
    <button class="dev-btn" data-act="jumpW1000">Start next run at W1000</button>

    <div class="dev-section">Toggles</div>
    <button class="dev-btn ${save.devState.godMode ? 'toggle-on' : ''}" data-act="godMode">God Mode: ${save.devState.godMode ? 'ON' : 'OFF'}</button>
    <button class="dev-btn" data-act="spawnOrbNow" ${!inBattle ? 'disabled style="opacity:0.4"' : ''}>Spawn gem orb now</button>
    <button class="dev-btn" data-act="resetAdCooldown">Reset shop ad cooldown</button>
    <button class="dev-btn" data-act="clearAllMilestones">Clear all milestone claims</button>

    <div class="dev-section">Cards (v0.7.9 economy)</div>
    <button class="dev-btn" data-act="addAllCardsL1">Give all cards · Lv 1</button>
    <button class="dev-btn" data-act="addAllCardsL5">Give all cards · Lv 5 (MAX)</button>
    <button class="dev-btn" data-act="clearCards">Wipe card inventory</button>
    <button class="dev-btn" data-act="unlockAllSlots">Unlock all 10 slots</button>

    <div class="dev-section">Tournament</div>
    <button class="dev-btn" data-act="tourneyForceEnd">Force cycle end now</button>
    <button class="dev-btn" data-act="tourneyResetBracket">Reset bracket (new synths)</button>

    <div class="dev-section">Danger</div>
    <button class="dev-btn" style="border-color:var(--danger);color:var(--danger)" data-act="hideDev">Disable dev mode</button>
    <button class="dev-btn" style="border-color:var(--danger);color:var(--danger)" data-act="reset">Reset ALL progress</button>
  `;
  body.querySelectorAll('.dev-btn').forEach(b => {
    b.addEventListener('click', () => devAct(b.dataset.act));
  });
}

let devJumpWave = 0;

function devAct(act) {
  switch (act) {
    case 'coins1k':   save.coins += 1000; break;
    case 'coins100k': save.coins += 100000; break;
    case 'coins10m':  save.coins += 10000000; break;
    case 'coins1b':   save.coins += 1000000000; break;
    case 'gems100':   save.gems += 100; break;
    case 'gems10k':   save.gems += 10000; break;
    case 'maxLabs':
      // v0.7.15: max all ranks + unlock all families
      for (const fid of Object.keys(UNLOCK_FAMILIES)) save.unlocks[fid] = true;
      for (const rid of Object.keys(RANK_DEFS)) {
        if (!save.ranks[rid]) save.ranks[rid] = { level: 0 };
        save.ranks[rid].level = RANK_DEFS[rid].maxRank;
      }
      break;
    case 'unlockTiers':
      for (let t = 1; t < MAX_TIER; t++) save.bestWavePerTier[t] = Math.max(save.bestWavePerTier[t] || 0, 100);
      break;
    case 'maxSpeed':
      // Game speed is a hard-coded baseline now (3x always available)
      save.settings.gameSpeed = 3;
      break;
    case 'setBestWave':
      save.bestWavePerTier[1] = 1000;
      save.bestWave = 1000;
      break;
    case 'fullHeal':
      if (game.running) game.hp = game.hpMax;
      break;
    case 'killAll':
      if (game.running) {
        for (const e of game.enemies) {
          if (!e.dead) hitEnemy(e, e.hp + 1, true);
        }
      }
      break;
    case 'spawnBoss':
      if (game.running) spawnBoss();
      break;
    case 'maxInRun':
      if (game.running) {
        for (const k of Object.keys(game.upgrades)) {
          const u = game.upgrades[k];
          if (u.isAction) continue;
          // Cap big-stat dev-max to 200 so things are testable, not nuclear.
          // Small-capped stats (targets, etc) go to their max.
          if (u.max && u.max <= 200) u.level = u.max;
          else u.level = 200;
        }
        game.hpMax = getMaxHp();
        game.hp = game.hpMax;
        renderUpgrades();
      }
      break;
    case 'trueMaxInRun':
      if (game.running) {
        for (const k of Object.keys(game.upgrades)) {
          const u = game.upgrades[k];
          if (u.isAction) continue;
          u.level = u.max || 100;
        }
        game.hpMax = getMaxHp();
        game.hp = game.hpMax;
        renderUpgrades();
      }
      break;
    case 'cash10k':
      if (game.running) { game.cash += 10000; game.cashEarnedThisRun += 10000; }
      break;
    case 'addWave':
      if (game.running) {
        for (const e of game.enemies) e.dead = true;
        cleanDeadEnemies();
        advanceWave();
      }
      break;
    case 'jumpW50':   devJumpWave = 50; alert('Next battle will start at Wave 50'); break;
    case 'jumpW100':  devJumpWave = 100; alert('Next battle will start at Wave 100'); break;
    case 'jumpW500':  devJumpWave = 500; alert('Next battle will start at Wave 500'); break;
    case 'jumpW1000': devJumpWave = 1000; alert('Next battle will start at Wave 1000'); break;
    case 'godMode':
      save.devState.godMode = !save.devState.godMode;
      break;
    case 'spawnOrbNow':
      if (game.running && !orbState.currentOrb) {
        spawnGemOrb();
      }
      break;
    case 'resetAdCooldown':
      save.lastAdRewardTime = 0;
      break;
    case 'clearAllMilestones':
      save.claimedMilestones = {};
      break;
    case 'addAllCardsL1':
      for (const id of Object.keys(CARD_POOL)) {
        if (!save.cardInventory[id]) save.cardInventory[id] = { level: 1, copies: 1 };
      }
      break;
    case 'addAllCardsL5':
      for (const id of Object.keys(CARD_POOL)) {
        const card = CARD_POOL[id];
        const maxCopies = COPIES_TO_LEVEL[card.tier][4];
        save.cardInventory[id] = { level: 5, copies: maxCopies };
      }
      break;
    case 'clearCards':
      save.cardInventory = {};
      save.equippedCards = [];
      for (let i = 0; i < save.unlockedSlots; i++) save.equippedCards.push(null);
      break;
    case 'unlockAllSlots':
      save.unlockedSlots = MAX_SLOTS;
      while (save.equippedCards.length < MAX_SLOTS) save.equippedCards.push(null);
      break;
    case 'tourneyForceEnd':
      tourneyDevForceCycleEnd();
      break;
    case 'tourneyResetBracket':
      if (save.tournament) {
        save.tournament.currentBracket = null;
        save.tournament.playerBestWave = 0;
        save.tournament.playerBestTime = 0;
        save.tournament.playerEntries = 0;
        tourneyEnsureActive();
      }
      break;
    case 'hideDev':
      save.settings.devMode = false;
      closeDevPanel();
      renderSubmenu();
      break;
    case 'reset':
      closeDevPanel();
      resetSave();
      return;
  }
  persistSave();
  renderDevPanel();
  renderHud();
  if (activeSubmenu === 'labs' || activeSubmenu === 'cards') renderSubmenu();
}

// override startBattle to honor jump wave
const _origStartBattle = startBattle;
startBattle = function () {
  const w = devJumpWave || 1;
  devJumpWave = 0;
  _origStartBattle(w);
};


// ============================================================
// TOURNAMENT TAB
// ============================================================
function renderTournamentTab(c) {
  const t = tourneyEnsureActive();
  const band = TOURNEY_BANDS.find(b => b.id === t.playerBand) || TOURNEY_BANDS[0];
  const leagueMeta = TOURNEY_LEAGUE_DISPLAY[t.playerLeague];
  const bracket = t.currentBracket;
  const playerId = save.playerId || 'You';
  const sorted = bracket ? tourneySortEntries(bracket.entries) : [];
  const playerRank = bracket ? tourneyPlayerRank(bracket, playerId) : 0;
  const totalEntries = sorted.length;
  const promoteCut = Math.floor(totalEntries * TOURNEY_PROMOTE_PCT);
  const demoteCutRank = totalEntries - Math.floor(totalEntries * TOURNEY_DEMOTE_PCT) + 1;
  const entriesLeft = tourneyEntriesRemaining();
  const timeRemaining = tourneyTimeRemaining();

  // Reward preview for current rank
  const reward = tourneyRewardForPlacement(t.playerBand, t.playerLeague, playerRank);

  // Compute zone label for player
  let zoneLabel, zoneColor;
  if (playerRank <= promoteCut) { zoneLabel = 'PROMOTION ZONE'; zoneColor = 'var(--good)'; }
  else if (playerRank >= demoteCutRank) { zoneLabel = 'DEMOTION ZONE'; zoneColor = 'var(--danger)'; }
  else { zoneLabel = 'SAFE ZONE'; zoneColor = 'var(--accent)'; }

  let html = `
    <div class="tourney-header">
      <div class="tourney-band-row">
        <div class="tourney-band-info">
          <div class="tourney-band-name">${band.name} · T${band.minTier}${band.maxTier < 999 ? '-T'+band.maxTier : '+'}</div>
          <div class="tourney-league-pill" style="background:${leagueMeta.color}20;border-color:${leagueMeta.color};color:${leagueMeta.color}">
            ${leagueMeta.name.toUpperCase()} LEAGUE
          </div>
        </div>
        <div class="tourney-timer">
          <div class="tourney-timer-label">ENDS IN</div>
          <div class="tourney-timer-value">${tourneyFormatTimeRemaining(timeRemaining)}</div>
        </div>
      </div>

      <div class="tourney-rank-card" style="border-color:${zoneColor}">
        <div class="tourney-rank-row">
          <div class="tourney-rank-num" style="color:${zoneColor}">#${playerRank}</div>
          <div class="tourney-rank-of">of ${totalEntries}</div>
          <div class="tourney-zone-label" style="color:${zoneColor}">${zoneLabel}</div>
        </div>
        <div class="tourney-best-row">
          <span>Best Wave: <b>${t.playerBestWave || '—'}</b></span>
          <span>Reward: <b style="color:var(--gold)">+${formatNum(reward.coins)} ⊙</b> <b style="color:var(--purple)">+${reward.gems} 💎</b></span>
        </div>
      </div>

      <div class="tourney-entries-row">
        <span>Entries left: <b>${entriesLeft} / ${TOURNEY_STANDARD_ENTRIES}</b></span>
        ${entriesLeft > 0
          ? `<button class="tourney-play-btn" id="tourneyPlayBtn">Begin Tournament Run</button>`
          : `<span class="tourney-entries-done">All entries used — check back next cycle</span>`
        }
      </div>

      <div class="tourney-zones-legend">
        <span class="tourney-zone-chip" style="color:var(--good)">▲ Top ${promoteCut} promote</span>
        <span class="tourney-zone-chip" style="color:var(--danger)">▼ Bottom ${Math.floor(totalEntries * TOURNEY_DEMOTE_PCT)} demote</span>
      </div>
    </div>`;

  // Last result banner (if any from previous cycle)
  if (t.lastResult && t.lastResult.cycleId === (t.cycleId - 1)) {
    const lr = t.lastResult;
    const leagueChange = lr.promoted ? `Promoted to ${TOURNEY_LEAGUE_DISPLAY[lr.newLeague].name}`
                       : lr.demoted ? `Demoted to ${TOURNEY_LEAGUE_DISPLAY[lr.newLeague].name}`
                       : `Stayed in ${TOURNEY_LEAGUE_DISPLAY[lr.newLeague].name}`;
    html += `
      <div class="tourney-last-result">
        <div class="tourney-last-title">Last Cycle</div>
        <div class="tourney-last-grid">
          <div>Rank <b>#${lr.rank}</b></div>
          <div>Wave <b>${lr.bestWave || '—'}</b></div>
          <div>+${formatNum(lr.coins)} ⊙</div>
          <div>+${lr.gems} 💎</div>
        </div>
        <div class="tourney-last-league">${leagueChange}</div>
      </div>`;
  }

  // Leaderboard — show top 10, then player window, then bottom 5
  html += `<div class="tourney-board-title">Leaderboard</div><div class="tourney-board">`;
  const indices = new Set();
  // Top 10
  for (let i = 0; i < Math.min(10, sorted.length); i++) indices.add(i);
  // Player window (2 above, 2 below)
  const playerIdx = sorted.findIndex(e => e.id === playerId);
  if (playerIdx >= 0) {
    for (let i = Math.max(0, playerIdx - 2); i <= Math.min(sorted.length - 1, playerIdx + 2); i++) {
      indices.add(i);
    }
  }
  // Bottom 3
  for (let i = Math.max(0, sorted.length - 3); i < sorted.length; i++) indices.add(i);

  const sortedIndices = Array.from(indices).sort((a, b) => a - b);
  let prevIdx = -1;
  for (const idx of sortedIndices) {
    if (prevIdx >= 0 && idx > prevIdx + 1) {
      html += `<div class="tourney-board-gap">· · ·</div>`;
    }
    const entry = sorted[idx];
    const rank = idx + 1;
    const isPlayer = entry.id === playerId;
    let rowZoneColor = 'var(--muted)';
    if (rank <= promoteCut) rowZoneColor = 'var(--good)';
    else if (rank >= demoteCutRank) rowZoneColor = 'var(--danger)';
    html += `
      <div class="tourney-row ${isPlayer ? 'is-player' : ''}">
        <span class="tourney-row-rank" style="color:${rowZoneColor}">#${rank}</span>
        <span class="tourney-row-name">${isPlayer ? 'YOU' : entry.name}</span>
        <span class="tourney-row-wave">W${entry.bestWave || '—'}</span>
      </div>`;
    prevIdx = idx;
  }
  html += `</div>`;

  c.innerHTML = html;

  // Wire Begin Tournament Run button
  const playBtn = document.getElementById('tourneyPlayBtn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (game.running) {
        const t2 = document.createElement('div');
        t2.className = 'skin-toast';
        t2.textContent = 'Finish your current run first';
        document.body.appendChild(t2);
        setTimeout(() => t2.remove(), 1400);
        return;
      }
      if (!tourneyConsumeEntry()) return;
      // Flag the next run as a tourney run — score submits on endRun
      game.isTourneyRun = true;
      // Use player's current band's top tier for tourney runs
      const tBand = tourneyBandForTier(save.bestTier || 1);
      save.selectedTier = Math.max(1, Math.min(save.bestTier || 1, tBand.maxTier));
      startBattle();
    });
  }
}
