// ============================================================
// profile.js — Core Surge player profile (username).
// Owned by: UI AI. No combat math, no backend calls.
//
// Fields added to save:
//   save.username              — string, 3..16 chars, [A-Za-z0-9_-]
//   save.usernameLastChanged   — unix ms timestamp of last change
//
// Backend-ready but fully local: when cloud saves / tournaments come
// online, these fields sync up. For now they just live in localStorage
// via the existing persistSave() pipeline.
// ============================================================

const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 16;
const USERNAME_REGEX = /^[A-Za-z0-9_-]+$/;

function generateRandomUsername() {
  // 4-digit suffix. Not cryptographically unique — backend will reconcile later.
  const n = Math.floor(1000 + Math.random() * 9000);
  return 'Player_' + n;
}

function validateUsername(name) {
  if (typeof name !== 'string') return { ok: false, reason: 'Must be text' };
  const trimmed = name.trim();
  if (trimmed.length < USERNAME_MIN_LEN) return { ok: false, reason: `At least ${USERNAME_MIN_LEN} characters` };
  if (trimmed.length > USERNAME_MAX_LEN) return { ok: false, reason: `At most ${USERNAME_MAX_LEN} characters` };
  if (!USERNAME_REGEX.test(trimmed)) return { ok: false, reason: 'Letters, numbers, _ or - only' };
  return { ok: true, value: trimmed };
}

function ensureUsername() {
  // Called on boot. If save has no username yet, generate one.
  // Does NOT overwrite a user-chosen name.
  if (typeof save === 'undefined') return;
  if (!save.username || !validateUsername(save.username).ok) {
    save.username = generateRandomUsername();
    save.usernameLastChanged = Date.now();
    if (typeof persistSave === 'function') persistSave();
  }
}

function setUsername(newName) {
  // Returns { ok, reason? } so the caller can show inline errors.
  const v = validateUsername(newName);
  if (!v.ok) return v;
  if (save.username === v.value) return { ok: true, unchanged: true };
  save.username = v.value;
  save.usernameLastChanged = Date.now();
  if (typeof persistSave === 'function') persistSave();
  return { ok: true };
}

function formatRelativeTime(ms) {
  // "just now", "3 min ago", "2 hr ago", "5 days ago", "3 weeks ago", "2 months ago"
  if (!ms) return 'never';
  const diff = Date.now() - ms;
  if (diff < 30 * 1000) return 'just now';
  const min = Math.floor(diff / 60000);
  if (min < 60) return min + ' min ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' hr ago';
  const days = Math.floor(hr / 24);
  if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks + (weeks === 1 ? ' week ago' : ' weeks ago');
  const months = Math.floor(days / 30);
  if (months < 12) return months + (months === 1 ? ' month ago' : ' months ago');
  const years = Math.floor(days / 365);
  return years + (years === 1 ? ' year ago' : ' years ago');
}

// Ensure we always have a username once save is loaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureUsername);
} else {
  ensureUsername();
}
