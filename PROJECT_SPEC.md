# 存錢罐記帳 — Rebuild Specification

**Purpose of this document:** If this project's files or your local machine ever get wiped, hand this whole file to an AI coding assistant (e.g. Claude Code) and say "rebuild this project exactly as specified" — it contains everything needed to recreate the app from scratch, including every feature added across the build history.

---

## 1. What this is

A homescreen-installable expense/income tracker PWA (Progressive Web App), styled after the Taiwanese/HK app **罐頭記帳** — cute jar/can theme, mint-green palette, category-icon grid entry, custom numeric keypad, monthly summary, and donut-chart stats.

- **Stack:** vanilla HTML/CSS/JS. No framework, no build step, no backend, no database.
- **Data storage:** everything (transactions, budgets, currency) lives in the browser's `localStorage` on whatever device the app is opened on. Nothing syncs between devices; nothing is sent to a server.
- **Deployment:** static site on GitHub Pages.
- **Live URL:** https://opensquilw.github.io/money-tracker-app/
- **GitHub repo:** https://github.com/opensquilw/money-tracker-app (public)

---

## 2. File structure

| File | Purpose |
|---|---|
| `index.html` | App shell — all views (Home, Stats, Settings, Add-transaction sheet) as sections toggled via the `hidden` attribute, plus bottom nav. |
| `style.css` | All styling. CSS custom properties in `:root` for theming; `@media (prefers-color-scheme: dark)` block for dark mode. |
| `app.js` | All logic, wrapped in a single IIFE. No modules, no bundler. |
| `manifest.json` | PWA manifest (name, icons, theme color, `display: standalone`). |
| `sw.js` | Service worker — **network-first** fetch strategy (see §7 gotchas), caches app shell for offline fallback only. |
| `duck_icon.svg` | Vector source for the homescreen icon (hand-traced to match a reference image the user provided — a minimalist black-line duck head with an orange beak on a white rounded-square background). |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` | Rasterized from `duck_icon.svg` via `cairosvg` (`python3 -c "import cairosvg; cairosvg.svg2png(url='duck_icon.svg', write_to='icons/icon-XXX.png', output_width=N, output_height=N)"` for N = 192, 512, 180). |

---

## 3. Data model (localStorage keys)

| Key | Shape | Notes |
|---|---|---|
| `canjar_transactions_v1` | `Array<{id, type: "expense"\|"income", category: string, amount: number, note: string, date: "YYYY-MM-DD", createdAt: number}>` | Flat array, all months together; filtered by month at render time via `date.startsWith(ymKey)`. |
| `canjar_currency_v1` | plain string, e.g. `"HK$"` | Default when unset: `"HK$"`. |
| `canjar_budgets_v1` | `{ "YYYY-MM": { [categoryId]: number } }` | **Per-month, independent — no carry-forward.** Setting a budget for July does not affect August. A month with no key shows all budgets as unset. Old flat-format data (`{categoryId: number}` with no month keys, from an early version) is auto-migrated on load into the current month's key — see `loadBudgets()`. |

---

## 4. Categories

### Expense categories (in display order — grid is 4 columns, wraps automatically)

| id | label | icon |
|---|---|---|
| `food` | 餐飲 | 🍚 |
| `transport` | 交通 | 🚗 |
| `shopping` | 購物 | 🛍 |
| `fun` | 娛樂 | 🎮 |
| `home` | 居家 | 🏠 |
| `medical` | 醫療 | 💊 |
| `edu` | 教育 | 📚 |
| `travel` | 旅行 | ✈️ |
| `comm` | 通訊 | 📱 |
| `pet` | 寵物 | 🐾 |
| `gift` | 送禮 | 🎁 |
| `other_e` | 其他 | 📦 |
| `car` | 座駕 | 🚙 |
| `beauty` | 美容美睫 | 💅 |
| `savings` | 儲蓄 | 🐷 |
| `stock` | 股票 | 💹 |
| `household` | 家用 | 👨‍👩‍👧‍👦 |

### Income categories

| id | label | icon |
|---|---|---|
| `salary` | 薪資 | 💰 |
| `bonus` | 獎金 | 🏆 |
| `invest` | 投資 | 📈 |
| `parttime` | 兼職 | 💼 |
| `redpocket` | 紅包 | 🧧 |
| `other_i` | 其他 | 📦 |

### Category chart colors (`CAT_COLORS`, indexed by position in the `expense` array above, wraps via `% length` for the `income` list too)

```
#5FBB97 (mint)   #F0AD4E (orange)  #E8735B (red)    #7BA9E8 (blue)
#C08FE8 (purple) #E8C15F (yellow)  #5FC7E8 (cyan)   #E85F9B (pink)
#8FBB5F (green)  #BB8F5F (brown)   #5F8FE8 (navy)   #B0B0B0 (gray)
#4F9DA6 (teal)   #D65FA0 (magenta) #C9A227 (gold)   #6C5CE7 (violet)
#795548 (coffee brown)
```

**To add a new category:** append `{ id, label, icon }` to the right array in `CATEGORIES`, and append one new hex color to `CAT_COLORS` (don't reuse/reorder existing entries — that reshuffles colors for existing categories the user has already seen).

---

## 5. Budget feature — exact behavior (built incrementally; this is the final spec)

- Location: Settings (設定) → **分類預算** section.
- Has its own month selector (‹ 2026年7月 › style), sharing the same global `currentMonth` state as Home/Stats — navigating the month anywhere in the app keeps everything in sync.
- Each month's budgets are **fully independent** (no inheritance). A hint line explains this: "僅套用於此月份" (already customized) or "尚未設定此月份的預算" (not yet set).
- **Three separate total banners** (this was a specific late-stage request — savings/stock are transfers to the user's own assets, not spending, so they must not be lumped into the spending total):
  1. **此月份預算總額** (mint green `var(--mint)`) — sum of every expense category's budget **except** `savings` and `stock`. Includes `household`.
  2. **此月份儲蓄總額** (gold `#C9A227`, matches `savings`'s chart color) — just the `savings` category's budget.
  3. **此月份股票總額** (violet `#6C5CE7`) — just the `stock` category's budget.
  4. Each banner is hidden (`hidden` attribute) when its value is 0.
- **Below the three banners**, a small muted line: `三項合計 {currency}{sum of all three}` — shown only when the sum is > 0.
- Per-category budget rows below that: icon + label + currency prefix + `<input type=number>`, saving on the `change` event (fires on blur/Enter, not every keystroke) directly into `budgets[currentMonthKey][categoryId]`.
- **Budget progress bars also appear on the Home screen** (`#budgetProgress`, above the transaction list, below the summary card) — one row per category that has a budget set for the current month, showing `{spent} / {budget}` with a fill bar, live-updating the moment a transaction is saved (`renderBudgetProgress()` is called from `renderHome()`). Turns red and shows "超支！" text when over.
- Stats page also shows a budget line + mini progress bar under each category in the breakdown list when that category has a budget (uses the *old* single-total logic in `renderBudgetSummary()` for the "本月預算" card there — this was **not** updated to the three-banner split; only the Settings page got that treatment per the user's explicit request. If the user wants Stats to match, that's a follow-up, not yet done as of this doc).

---

## 6. Design system

- Font: system stack (`-apple-system, BlinkMacSystemFont, "PingFang TC", "Helvetica Neue", "Microsoft JhengHei", sans-serif`) — PingFang TC for proper Traditional Chinese rendering on Apple devices.
- Background (light): `#FFFBF2` cream. Dark mode: `#1C1C1E`.
- Primary accent: mint green `#5FBB97` / darker `#47a480`.
- Expense red: `#E8735B`. Income/positive: mint green.
- Cards: white (`#ffffff`) / dark `#2C2C2E`, rounded corners (14–20px), soft shadows.
- Bottom nav: 3 tabs (首頁/統計/設定) plus a raised circular floating **+** button (`nav-fab`) between 統計 and 設定 to open the add-transaction sheet.
- Add-transaction sheet: full-screen overlay (`position: fixed; inset: 0; z-index: 100`), slide-up animation, custom on-screen numeric keypad (not the native mobile keyboard) for amount entry.
- Default currency: **HK$** (user is Hong Kong–based).

---

## 7. Known gotchas hit during development (don't repeat these)

1. **`[hidden]` + a class that sets `display`:** the browser's default `[hidden] { display: none }` UA-stylesheet rule loses to an author-stylesheet class rule like `.sheet { display: flex }` at equal specificity. Any full-screen overlay toggled via the `hidden` attribute needs an explicit `.sheet[hidden] { display: none; }` override, or it stays visible even when `hidden` is set.
2. **Service worker must be network-first, not cache-first.** An earlier cache-first `sw.js` (matching cache before network) caused real staleness: once a service worker installs and caches `app.js`, a `cache.addAll()`-based install step never re-runs for a byte-identical `sw.js`, so the cached JS could silently stay months stale even after many deploys, and even direct `fetch()` calls would return stale cached content. Fixed by rewriting the fetch handler to always try network first, only falling back to cache when the network fetch fails (offline). Cache name was also bumped (`canjar-v1` → `canjar-v2`) to force a clean cache on the fix itself.
3. **Homescreen icons don't live-update.** iOS/Android snapshot the manifest icon at the moment of "Add to Home Screen" and never re-check it. Changing `icons/*.png` and redeploying requires the user to remove the homescreen shortcut and re-add it to see the new icon. Regular content/feature updates do **not** need this (network-first SW fetches fresh HTML/JS/CSS every time the app is opened online).
4. **Browser-automation coordinate spaces**, `localStorage` cache-busting during local testing (`?cb=N` query trick to bypass the in-tool browser's HTTP cache), etc. — implementation-testing details only, not relevant to a rebuild, omitted here.

---

## 8. Deployment — how it was done, and how to redo it

```bash
# One-time setup
brew install gh
gh auth login --hostname github.com --web --git-protocol https   # user approves a device code in their own browser

cd money-tracker-app
git init
git add -A
git commit -m "Initial commit"
gh repo create money-tracker-app --public --source=. --remote=origin --push
gh api repos/<username>/money-tracker-app/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

To update the live site after any edit:
```bash
cd money-tracker-app
git add -A && git commit -m "..." && git push
# GitHub Pages auto-rebuilds in ~30–60s; poll with:
gh api repos/<username>/money-tracker-app/pages/builds/latest --jq .status
```

**Git remote auth note:** if `git push` fails with "Invalid username or token", run `gh auth setup-git` once to point git's credential helper at the `gh` CLI's token.

To install on a phone: open the live URL in Safari (iOS) or Chrome (Android) → Share/menu → **Add to Home Screen**.

---

## 9. Full feature changelog (chronological, for context on *why* things are shaped this way)

1. Initial build: full app (Home/Stats/Settings/Add-sheet), 12 expense + 6 income categories, localStorage persistence, JSON export/import, offline service worker, PWA manifest, generated placeholder jar/coin icon.
2. Added per-category monthly budgets with progress bars on Home + Stats (initially a flat always-on-every-month budget).
3. Changed default currency from NT$ to HK$.
4. Redesigned budgets to be **per-month and non-carrying** per explicit user correction (a first attempt with carry-forward-between-months was explicitly rejected).
5. Fixed the service worker staleness bug (§7.2).
6. Deployed to GitHub Pages (public repo, `gh` CLI device-flow login).
7. Replaced the placeholder icon with a custom hand-traced duck icon (SVG → PNG via cairosvg) matching a reference image the user provided.
8. Added `car` (座駕) and `beauty` (美容美睫) categories.
9. Added a running **total budget** display in Settings.
10. Added `savings` (儲蓄) and `stock` (股票) categories.
11. Added `household` (家用) category.
12. Split the Settings budget total into **three separate banners** (spending / savings / stock, each its own color) plus a combined grand-total line — because savings/stock are transfers to the user's own assets, not consumption, and shouldn't inflate the "how much can I spend" number.

---

## 10. If rebuilding from scratch — suggested prompt to give the AI

> "Build me a money-tracking PWA installable to the homescreen, styled after the app 罐頭記帳 (cute jar theme, mint green). Here is the full spec: [paste this document]. Recreate all files exactly as described, deploy to GitHub Pages the same way, and verify the live site works before telling me it's done."
