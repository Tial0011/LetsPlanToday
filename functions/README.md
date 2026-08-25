# Real push notifications — setup

The client (js/pwa.js, js/firebase.js, sw.js) is already wired up to
*register* for push and store a device token in Firestore. This function is
the other half: it's what actually sends the notification, on schedule,
even when every browser tab/window is closed.

## One-time setup

1. **Upgrade to the Blaze plan.** Cloud Scheduler (which `onSchedule` uses
   under the hood) requires billing enabled on the Firebase project. A
   single daily reminder per user costs, in practice, nothing — this is
   about enabling the API, not real spend.
   Firebase Console → ⚙️ Project settings → Usage and billing.

2. **Generate a Web Push (VAPID) key pair.**
   Firebase Console → ⚙️ Project settings → Cloud Messaging →
   "Web configuration" → Web Push certificates → "Generate key pair".
   Copy the key string into `js/firebase-config.js` as `firebaseVapidKey`.

3. **Install the Firebase CLI** if you don't have it:
   `npm install -g firebase-tools`, then `firebase login`.

4. **Point the CLI at this project** (from the repo root, not `functions/`):
   `firebase use --add` and pick `signuppage-soun` (or whatever you renamed
   the project to).

5. **Install function dependencies and deploy:**
   ```
   cd functions
   npm install
   cd ..
   firebase deploy --only functions,firestore:rules
   ```

## After that

- In the app, Settings → "Turn on reminders" now requests a push
  subscription first. If it succeeds, reminders work even with the browser
  fully closed. If push isn't available (VAPID key missing, unsupported
  browser, function not deployed yet), it automatically falls back to the
  old tab-open-only behavior — nothing breaks in the meantime.
- Each signed-in device gets its own token doc under
  `users/{uid}/fcmTokens/{token}`. Multiple devices per user just work —
  the function sends to all of them.
- The scheduled function runs every minute, checks each user's chosen
  `reminderTime` against the current time *in their own saved timezone*,
  and sends at most once per calendar day per user
  (`settings/preferences.lastReminderSentDate` guards against duplicates).
- Dead tokens (uninstalled app, revoked permission) are pruned
  automatically after a failed send.

## Known limitations worth knowing about

- **iOS Safari**: web push only works there if the app has been added to
  the Home Screen (iOS 16.4+). It will not work in a regular Safari tab.
- **Precision**: Cloud Scheduler's finest granularity is 1 minute, matching
  the Settings time picker — reminders fire within that window, not
  necessarily the exact second.
- **Cost at scale**: this reads every user's settings doc every minute via
  a collection-group query. Fine for a personal project or a modest user
  base; if this ever needs to scale to many thousands of users, swap the
  polling approach for per-user scheduled tasks (e.g. Cloud Tasks) instead.
