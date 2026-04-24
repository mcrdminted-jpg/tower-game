// ============================================================
// skins.js — Core Surge skin equip/apply/persist.
// Owned by: UI/skin AI. No combat math. Pure DOM + save glue.
//
// Saves skin IDs on `save.equippedCoreSkin` and `save.equippedBgSkin`,
// then applies them as data-attributes on #tower and #battlefield.
// The CSS (css/skins.css) does the actual visual work.
//
// Defaults: if save has no equipped skin, the game uses its original
// CSS-drawn tower/background (no data-attr applied). This means the
// skin system is purely additive — you can delete this file and the
// game still runs.
// ============================================================

// Valid IDs (must match entries in css/skins.css and the Skins tab data arrays)
const CORE_SKIN_IDS = ['sentinel', 'industrial', 'verdant', 'aegis', 'frost', 'royal'];
const BG_SKIN_IDS   = ['cyber_grid', 'industrial', 'organic', 'steel'];

function applyEquippedSkins() {
  const tower = document.getElementById('tower');
  const bf = document.getElementById('battlefield');
  if (!tower || !bf) return;

  const core = (typeof save !== 'undefined' && save.equippedCoreSkin) || null;
  const bg   = (typeof save !== 'undefined' && save.equippedBgSkin)   || null;

  if (core && CORE_SKIN_IDS.includes(core)) {
    tower.setAttribute('data-core-skin', core);
  } else {
    tower.removeAttribute('data-core-skin');
  }

  if (bg && BG_SKIN_IDS.includes(bg)) {
    bf.setAttribute('data-bg-skin', bg);
  } else {
    bf.removeAttribute('data-bg-skin');
  }
}

function equipCoreSkin(id) {
  if (!CORE_SKIN_IDS.includes(id)) return;
  save.equippedCoreSkin = id;
  if (typeof persistSave === 'function') persistSave();
  applyEquippedSkins();
}

function equipBgSkin(id) {
  if (!BG_SKIN_IDS.includes(id)) return;
  save.equippedBgSkin = id;
  if (typeof persistSave === 'function') persistSave();
  applyEquippedSkins();
}

// Apply on load. main.js boot will also call applyEquippedSkins() after
// save is loaded, but this is a safety net in case script order shifts.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyEquippedSkins);
} else {
  applyEquippedSkins();
}
