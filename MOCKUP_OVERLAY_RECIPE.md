# Mockup Overlay Pattern — Extension Recipe

> This is a short handoff for whoever extends the mockup-overlay pattern
> from the Research panel (shipped in v0.7.22) to the remaining 6 panels.
> Read this first, then pick one panel and follow the 6 steps.

## What we have (v0.7.22)

- `assets/mockups/research_hdr.png` — cropped 941x520 header painted art
- `css/mockup-overlay.css` — one `.mockup-bg-research` rule + positioned children
- `js/ui.js` `renderLabsTab()` — emits the wrapper + invisible click targets

## The 6 panels that still need overlays

| Panel          | Current renderer         | Mockup art file (raw, uncropped)                |
|----------------|--------------------------|-------------------------------------------------|
| Home (menu)    | `#screen-menu` + preview | `assets/mockups/home.png` (core-carousel style) |
| Loadout        | `renderCardsTab`         | `assets/mockups/loadout.png` or `loadout_labeled.png` |
| Goals          | `renderMilestonesTab`    | `assets/mockups/goals.png` or `goals_v2.png`    |
| Store          | `renderShopTab`          | `assets/mockups/store.png`                      |
| Settings       | `renderSettingsTab`      | `assets/mockups/settings.png` or `_alt.png`     |
| Skins          | `renderSkinsTab`         | `assets/mockups/skins.png` or `_v2.png`         |
| Tournament     | `renderTournamentTab`    | `assets/mockups/tournament.png`                 |

All raw mockups are 941x1672 (aspect 1.777). They include the top HUD strip
(y=0..115) which **must not be overlaid** because the game already renders
that HUD in `#hud`. Crop each mockup to strip the top HUD before shipping.

## The 6 steps per panel

### 1. Crop the raw mockup to remove the top HUD

```python
from PIL import Image
im = Image.open('assets/mockups/settings.png')
# Strip y=0..~115 (the 4-card HUD). Find the exact y by eye — settings
# mockup's first painted element (the gear-icon header) starts ~y=140.
im.crop((0, 120, im.width, 1600)).save('assets/mockups/settings_hdr.png')
```

Decide the crop height based on what the painted art shows:
- If the art paints ONE "hero" section (title + tabs + some cards) that
  should sit at the top while normal content flows below, crop tight to
  just that hero (like Research did: 941x520).
- If the art paints the WHOLE panel (header + all rows), use the full
  mockup and live with pagination/scroll compromises. Only do this if
  the painted rows are few enough to actually match the data.

**Research chose option 1 (hero-only)** because there can be 1-18 rank
rows depending on unlocks. Flowing them below normal styles is simpler.

### 2. Measure the painted slots

Run this Python to render debug rectangles on top of the cropped mockup
and iterate until the boxes align with the painted frames:

```python
from PIL import Image, ImageDraw
im = Image.open('assets/mockups/settings_hdr.png').convert('RGBA')
w, h = im.size
draw = ImageDraw.Draw(im, 'RGBA')

def pct_box(top_pct, left_pct, width_pct, height_pct, color):
    x1 = int(left_pct * w / 100);  y1 = int(top_pct * h / 100)
    x2 = int((left_pct + width_pct) * w / 100)
    y2 = int((top_pct + height_pct) * h / 100)
    draw.rectangle([x1, y1, x2, y2], outline=color, width=2)

# Eyeball each painted slot — adjust percentages until boxes hug frames
pct_box(top_pct=5, left_pct=10, width_pct=80, height_pct=8, color=(0,255,0,255))
# ... more boxes ...
im.save('assets/mockups/settings_debug.png')
```

View the saved PNG. When the boxes align with the painted art, write
those same percentages into the CSS. **Delete the debug PNG before shipping.**

### 3. Add a CSS block in `css/mockup-overlay.css`

Copy the `.mockup-bg-research` block as a template. Change:
- The class name to `.mockup-bg-<panel>` (e.g. `.mockup-bg-settings`)
- The `background-image` URL
- The `aspect-ratio` to `W / H` of your crop
- Each child selector's `top/left/width/height` percentages

The child element naming convention: `.mor-<role>` (mor = mockup overlay
research) was fine for one panel. For multiple panels, use panel-prefixed
classes to avoid collisions: `.moS-title` for settings, `.moL-title` for
loadout. Or scope under the parent: `.mockup-bg-settings .overlay-title`.
Either is fine — consistency within the file is what matters.

### 4. Modify the panel's renderer in `js/ui.js`

For the hero-only approach (Research pattern):

```js
function renderSettingsTab(c) {
  let html = '';

  // Mockup overlay — hero section with painted art
  html += `<div class="mockup-bg-settings">`;
  html += `  <div class="moS-title">Settings</div>`;
  // ... invisible click targets for each painted control ...
  html += `</div>`;

  // Below the overlay, normal content flows (cloud save, logout, etc.)
  html += `<div class="settings-section">...</div>`;

  c.innerHTML = html;
  // Wire up click handlers
}
```

For the full-panel approach: omit the flowing content below, make the
overlay fill the viewport with `aspect-ratio: auto; height: calc(100vh - 200px)`.

### 5. Syntax check before shipping

```bash
cd /home/claude/split && cat js/*.js > /tmp/c.js && node --check /tmp/c.js
```

Must return OK. Also grep for mismatched braces in the new CSS block.

### 6. Version bump + package

- Bump to `v0.7.23` (or next) in `js/ui.js` `verDefault` and `index.html` `<title>`
- Add a v0.7.23 changelog block at the top of `index.html`
- Package only changed files: `index.html`, `css/mockup-overlay.css`,
  `js/ui.js`, new `assets/mockups/<panel>_hdr.png`

## Gotchas learned in v0.7.22

1. **The raw mockups include the HUD in the composition, but the game
   already renders its own HUD.** Always crop the HUD strip off (top
   ~115px) or the top of the page will have duplicate coin/gem/trophy
   cards.

2. **Don't trust the handoff's mockup labels.** Several filenames in the
   original handoff were inverted (the file called "research.png" was
   actually the home-carousel art). Open each PNG and name it by what
   it actually depicts before writing any CSS.

3. **Painted icons already carry meaning.** Don't add redundant text
   labels inside painted tab frames. Use a hidden label that only
   appears on the active tab (v0.7.22 approach) or a tooltip.

4. **Cost pills are offset from coin icons.** The painted family cards
   have the coin icon on the far-left of the bottom row and a blank pill
   taking the rest. Your cost text must `left: 32%` to sit in the pill,
   not at `left: 8%` which would overlap the painted coin icon.

5. **Narrow-phone breakpoint (max-width: 360px)** needs smaller fonts
   or text clips out of the painted slots.

6. **Tall-screen breakpoint (min-aspect-ratio: 1/2)** — on very tall
   viewports the mockup can dominate; cap it with `height: 42vh` to
   keep it proportional.

7. **Family count doesn't always match painted slot count.** Research
   has 6 unlock families but only 4 painted slots. I solved this by
   keying families-per-sub-tab: each tab shows up to 4 relevant
   families, with empty/locked slots for the remainder.

## Done-done checklist

- [ ] Overlay renders on mobile + desktop without scrollbar artifacts
- [ ] All painted controls have real click targets (no "dead" painted buttons)
- [ ] Live data shows through (coin costs, ownership state, selected tab)
- [ ] Rank/row flows below the overlay with no layout gap or overflow
- [ ] Syntax check passes
- [ ] Zip contains ONLY changed files (not a full repo dump)
- [ ] Changelog block added to index.html
- [ ] Version string bumped in js/ui.js

---

*Written during v0.7.22 handoff. Next: pick a panel, follow 6 steps, ship.*
