# Let's Plan Today — a daily planning, journaling & focus space

Phases 1–6 complete: product architecture, visual design system, working frontend, Firebase (auth + Firestore + security rules), PWA packaging (manifest, service worker, install prompt, offline app shell, local reminders, Wake Lock), and a testing pass (code review + automated logic checks — see Testing below).

## Project structure

```
/index.html
/manifest.json          — PWA manifest (name, icons, shortcuts, theme)
/sw.js                  — service worker: app-shell caching + offline fallback
/css
  global.css        — design tokens (color, type, spacing, motion) + base styles + keyframes
  components.css     — card, button, task, journal, focus, calendar, progress, settings styles
  responsive.css      — mobile bottom nav ⇄ desktop sidebar (+ sidebar mini calendar), breakpoints
/js
  firebase-config.js — YOUR Firebase project keys go here
  firebase.js         — initializes Firebase app, exposes auth/db
  utils.js              — date/format helpers, day-arc gradient, toast
  icons.js               — small inline SVG icon set (nav + card links + badges)
  calendar.js              — month-grid calendar renderer + streak/heatmap math
  auth.js                    — sign up / sign in / Google sign-in / sign out, auth screen
  tasks.js                     — tasks + Today's 3 (Firestore-backed, optimistic add)
  journal.js                     — daily journal entries (Firestore-backed)
  focus.js                        — focus timer + session history (Firestore-backed)
  reflection.js                    — evening reflection (Firestore-backed)
  pwa.js                            — service worker registration, install prompt,
                                       local reminder scheduling, Wake Lock
  app.js                            — navigation, screen rendering, auth gate
/assets/icons            — generated app icons (standard + maskable + favicon)
firestore.rules
firestore.indexes.json
```

## Phase 8 — settings, reminders & progress follow-ups

Addressed in this pass: the name field in Settings started blank instead of
picking up the name already on the account, the accent themes barely
changed anything beyond a button or two, journaling on mobile kept closing
the keyboard mid-sentence, and reminders were limited to a single
custom time with no push-notification-backed schedule.

- **Name auto-fill.** `initSettingsListener()` now falls back to the
  Firebase Auth `displayName` (set at signup, or supplied by Google
  sign-in) whenever there's no `name` saved yet in the settings doc, so a
  new user sees their own name immediately. It's still fully editable (or
  clearable) in Settings — once saved, that value is what's used.
- **Full-repaint themes.** `lavender`, `sage`, and `peach` previously only
  overrode the accent color (`--marigold`), so most of the app looked
  identical across them — only buttons and highlights changed, unlike
  `dark`, which overrides background/surface/border/text and visibly
  repaints everything. Each theme now sets its own `--paper`,
  `--paper-raised`, `--border`, `--text-primary`, `--text-secondary`, and
  accent colors, so switching themes now recolors the whole app the same
  way `dark` always did.
- **Journal focus fix.** Every debounced autosave wrote to Firestore, which
  echoed back through the `onSnapshot` listener and re-rendered the whole
  journal screen — destroying and recreating the `<textarea>` mid-sentence,
  which closed the on-screen keyboard on mobile roughly every 500ms while
  typing. `renderJournal()` now skips rebuilding the screen while that
  textarea has focus, so typing is never interrupted.
- **4x/day check-in reminders.** A new toggle in Settings ("Check-in
  reminders") turns on a fixed schedule — 7:00 AM, 12:00 PM, 4:00 PM,
  7:00 PM — on top of the existing custom daily-reminder time. Both the
  client-side local watcher (`pwa.js`, tab must be open) and the
  server-side Cloud Function (`functions/index.js`, works with the browser
  fully closed once deployed + configured) honor this schedule.
- **More milestones.** The Progress screen's badge grid grew from 5 to 15
  milestones across journal entries (1/7/30), focus sessions (1/10/25),
  tasks completed (1/10/50 — a new `Tasks.completedCount()`), reflections
  (1/7), and streaks (3/7/14/30 days).

## Phase 7 — engagement & polish pass

Addressed in this pass: the app felt flat and static, the journal's "Calendar"
tab was a plain list rather than a real calendar, the Progress screen was dry
numbers with no sense of momentum, several nav/card icons were decorative
emoji with no functional purpose, and adding a task waited on a Firestore
round-trip before showing up.

- **Motion.** New keyframes and easing tokens in `global.css` (fade/slide-in,
  spring pop, flicker, screen-transition) drive card hover lift, button
  press feedback, animated task-completion, and a smoother toast — all still
  gated by the existing global `prefers-reduced-motion` rule.
- **Real calendar.** `js/calendar.js` renders an actual month grid (day
  cells, prev/next navigation, activity dots) — used both as a persistent
  mini calendar in the desktop sidebar and as the Journal → Calendar tab,
  replacing the old flat entry list.
- **Streaks & a richer Progress screen.** A day-streak is computed from real
  activity (journal entries, completed tasks, focus sessions, reflections)
  and shown as a badge on Today and as a hero stat on Progress, alongside a
  7-day activity heatmap, ring-style stat visualizations, and an icon-based
  milestone badge grid in place of the old ✓/○ list.
- **Real-time task add.** `Tasks.add()` now inserts an optimistic row
  immediately (before the Firestore write resolves) and reconciles it with
  the real document once the snapshot listener catches up, so typing a task
  and hitting Add feels instant instead of network-bound.
- **Icon cleanup.** Nav bars, Today's quick-link cards, and progress badges
  now use a small custom inline-SVG icon set (`js/icons.js`) instead of
  decorative emoji. The mood-picker emoji were kept, since those are
  functional data the user selects, not decoration.
- `sw.js`'s precache list and `CACHE_VERSION` were updated for the two new
  JS files, and all local paths referenced in `index.html`/`manifest.json`/
  `sw.js` were re-verified to exist.

## Setup

### 1. Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. Once created, go to **Build → Authentication → Get started**, and enable:
   - **Email/Password**
   - **Google** (optional but wired up in `auth.js`)
3. Go to **Build → Firestore Database → Create database** (start in production mode — the rules file handles access control).
4. Go to **Project settings → General → Your apps → Add app → Web**. On the SDK setup screen, choose **"Config"** (not the default "npm"/module snippet) — that gives you just the object literal. Copy it into `js/firebase-config.js`, replacing the placeholder values. **Don't** paste any `import` or `initializeApp(...)` lines — this project loads Firebase via classic `<script>` tags (the compat SDK), so an `import` statement there will throw `Cannot use import statement outside a module` and break auth/Firestore entirely. See the comment at the top of `firebase-config.js` for the full explanation if this happens.

### 2. Deploy security rules

Using the [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # point it at this project's firestore.rules / firestore.indexes.json
firebase deploy --only firestore:rules,firestore:indexes
```

Or paste the contents of `firestore.rules` directly into **Firestore Database → Rules** in the console and click Publish.

### 3. Run locally

No build step — open `index.html` directly in a browser, or serve the folder with any static server (e.g. `npx serve .`) if your browser blocks `fetch` on `file://` for fonts.

## Data model

```
users/{userId}                          — displayName, createdAt, onboardingComplete
users/{userId}/journal/{dateKey}        — one doc per day: text, mood, updatedAt
users/{userId}/tasks/{taskId}           — title, date, completed, isToday3
users/{userId}/focusSessions/{id}       — taskTitle, durationPlanned, completedAt
users/{userId}/reflections/{dateKey}    — wentWell, didntGoAsPlanned, proudOf, carryIntoTomorrow
users/{userId}/settings/preferences     — name, theme, focusDuration, reminderTime,
                                           checkInReminders, timezone, lastReminderSentDate,
                                           lastCheckinSent
```

Journal entries and reflections use the date string (`YYYY-MM-DD`) as the document ID directly — one document per day, so "today's entry" is always a single direct read, and history/calendar views are a plain collection listing.

## Security model

Every read/write under `users/{userId}/...` requires `request.auth.uid == userId` (see `firestore.rules`). This is enforced server-side by Firestore, not by the client JS — the frontend has no special privileges. Project-owner Console/Admin SDK access is separate from these rules by design, which is why the in-app copy says "your journal is private" rather than claiming nobody but the user can ever access it.

## PWA (Phase 5)

**Install.** Once the browser decides the app qualifies (roughly: served over HTTPS with a valid manifest + registered service worker, visited a couple of times), Settings shows an **Install app** button, and a "Want your planner one tap away?" banner appears automatically after a user's 3rd visit. Both use the standard `beforeinstallprompt` flow — nothing forced, dismissible any time. iOS Safari has no `beforeinstallprompt`; iOS users install via Share → Add to Home Screen, which is why apple-touch-icon and `apple-mobile-web-app-*` meta tags are set in `index.html`.

**Offline.** `sw.js` precaches the app shell (HTML/CSS/JS/icons) on install and serves it cache-first, so the app still opens with no connection. Firestore reads/writes are deliberately *not* intercepted by the service worker — Firestore's own `enablePersistence()` (in `firebase.js`) already queues writes and syncs them when connectivity returns, which handles conflict-safety far better than a generic cache would. A small "You're offline / Back online" toast (in `pwa.js`) gives users a plain-language signal either way.

**Reminders.** Settings offers two independent layers: a **custom daily reminder** (pick any time) and a fixed **4x/day check-in schedule** (7:00 AM, 12:00 PM, 4:00 PM, 7:00 PM), each toggled on separately. Both work two ways:
- **While a tab is open** (foreground or background): `pwa.js` checks every 20s whether the current time matches, and fires a notification via the service worker. This works with zero server setup.
- **Even with the browser fully closed:** if push is enabled (Settings → "Turn on reminders", requires `firebaseVapidKey` in `js/firebase-config.js` and the Cloud Function in `functions/` deployed — see `functions/README.md`), `functions/index.js` runs on a 1-minute Cloud Scheduler and sends the notification server-side via FCM instead, regardless of whether any tab is open.

If push isn't configured, reminders silently fall back to the tab-open-only local watcher — the Settings copy says so plainly rather than implying otherwise.

**Deep Focus Mode.** Focus sessions call `navigator.wakeLock.request("screen")` where supported, so the screen won't sleep mid-session, and re-acquire it automatically if the tab regains visibility. An optional "Enter Deep Focus (fullscreen)" button uses the Fullscreen API. Neither of these — nor anything else a browser can do — can lock a phone or stop someone from switching apps; the in-app copy never claims otherwise.

**Icons.** Generated programmatically (see `scripts/gen_icons.py`, requires Pillow — `pip install Pillow`) from the design system's day-arc gradient + marigold sun motif already used on the Today screen — standard and maskable variants at 192/512px, plus a favicon and apple-touch-icon. Re-run it if the brand colors in `global.css` ever change.

## Testing (Phase 6)

Two kinds of checks live here: what's already been verified automatically/by code review (no browser needed), and a manual checklist for what genuinely requires a real device or browser — those two aren't the same thing, and this project doesn't pretend otherwise.

**Already verified:**
- All JS files parse cleanly (`node --check`); `manifest.json` is valid JSON.
- Every local file path referenced in `index.html`, `manifest.json`, and `sw.js`'s precache list actually exists in the bundle.
- `tests/logic.test.js` — plain Node, no framework — checks the date/timer/reminder-guard/Today's-3-cap math that's easy to get subtly wrong (run with `node tests/logic.test.js`).
- Code-reviewed for: `innerHTML` injection points all pass user text through `Utils.escapeHtml` (journal text, task titles, reflection fields); every Firestore write has a human-language `.catch()` (no raw `FirebaseError` ever reaches the UI); Firestore rules deny everything outside `users/{own uid}/...`; every screen with a Firestore-backed list has a non-shaming empty state; `prefers-reduced-motion` is respected globally.
- Fixed during this pass: a couple of leftover "Today" brand mentions (auth screen heading, sidebar) that hadn't been updated to "Let's Plan Today."

**Needs a real browser/device — not yet run:**
- [ ] Mobile (320px+), tablet, and desktop breakpoints — no horizontal scroll, no overflowing buttons/modals
- [ ] Slow/throttled network (Chrome DevTools "Slow 3G") — app shell still loads, Firestore reads degrade gracefully
- [ ] Fully offline: airplane mode, reopen the app, confirm the shell renders and queued writes sync back once online
- [ ] Auth flows: sign up, sign in, wrong password, Google sign-in, sign out
- [ ] Firestore rules: confirm a signed-in user genuinely cannot read/write another uid's documents (try it from the console or a second test account)
- [ ] Install prompt on Chrome/Edge (Android + desktop) and the Add-to-Home-Screen flow on iOS Safari
- [ ] Notification permission prompt + a reminder actually firing at the saved time while the tab is open
- [ ] Wake Lock during a focus session (screen doesn't sleep) and Fullscreen (Deep Focus) toggle
- [ ] Screen reader pass (VoiceOver/NVDA) on the auth form, task list, and settings toggles
- [ ] Keyboard-only navigation through every screen (no keyboard traps, visible focus ring throughout)

## What's not built yet

- Onboarding flow (name + "what to improve" steps) — currently name is set directly in Settings
- Non-invasive product analytics events (`journal_created`, `focus_completed`, etc.)
- Netlify/GitHub deployment instructions, future-feature recommendations (added at final delivery)
- Polish pass: micro-interactions, loading states, copy/spacing refinement (Phase 7)

## Known limitations

- Firestore's offline persistence (`enablePersistence`) gives basic offline read/write-queueing; combined with the Phase 5 service worker, the app shell now also opens fully offline — but a user's very first visit still needs one successful load online before offline access works.
- Reminders and Wake Lock depend on browser support and OS-level permissions (e.g. Wake Lock can be refused on low battery); both fail silently rather than breaking the app when unavailable.
- `manifest.json`'s `start_url` assumes the app is deployed at the domain root (`/`). If deployed under a subpath, update `start_url`, `scope`, and the icon paths accordingly.
